#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud
//
// Turul MCP Server — Exposes ALL Turul cloud analysis tools via MCP.
// Runs as a stdio subprocess spawned by the Claude Agent SDK.
//
// IMPORTANT: Cannot import DatabaseManager (better-sqlite3 is compiled for Electron).
// DB tools use sqlite3 CLI. AWS/GCP tools are imported directly (pure JS, no native deps).

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { execFileSync } from 'child_process';
// AWS/GCP tools have ZERO native module dependencies — safe to import
import { awsToolDefinitions, executeAwsTool } from '../tools/aws-tools';
import { gcpToolDefinitions, executeGcpTool } from '../tools/gcp-tools';
import type { AIToolDefinition } from '../../../shared/types/chat';

// Read context from environment
const dbPath = process.env.TURUL_DB_PATH;
const profileName = process.env.TURUL_PROFILE || undefined;
const region = process.env.TURUL_REGION || undefined;
const projectId = process.env.TURUL_PROJECT_ID || undefined;
const cloudProvider = (process.env.TURUL_CLOUD_PROVIDER || 'aws') as 'aws' | 'gcp';

if (!dbPath) {
  process.stderr.write('TURUL_DB_PATH environment variable is required\n');
  process.exit(1);
}

/** Run a read-only SQL query via the sqlite3 CLI and return JSON results */
function queryDb(sql: string): string {
  try {
    const output = execFileSync('sqlite3', ['-json', '-readonly', dbPath!, sql], {
      encoding: 'utf-8',
      timeout: 30000,
    });
    return output.trim() || '[]';
  } catch (err: any) {
    return JSON.stringify({ error: err.stderr || err.message });
  }
}

/**
 * Convert a JSON Schema → Zod shape for MCP tool registration.
 */
function jsonSchemaToZodShape(schema: Record<string, unknown>): Record<string, z.ZodType> {
  const properties = (schema.properties || {}) as Record<string, any>;
  const required = (schema.required || []) as string[];
  const shape: Record<string, z.ZodType> = {};

  for (const [key, prop] of Object.entries(properties)) {
    let field: z.ZodType;

    if (prop.enum) {
      const values = prop.enum as [string, ...string[]];
      field = z.enum(values);
    } else if (prop.type === 'number' || prop.type === 'integer') {
      field = z.number();
    } else if (prop.type === 'boolean') {
      field = z.boolean();
    } else if (prop.type === 'array') {
      field = z.array(prop.items?.type === 'string' ? z.string() : z.any());
    } else {
      field = z.string();
    }

    if (prop.description) field = field.describe(prop.description);
    if (!required.includes(key)) field = field.optional() as any;

    shape[key] = field;
  }

  return shape;
}

/** Register a tool definition with a handler function */
function registerTool(
  server: McpServer,
  toolDef: AIToolDefinition,
  handler: (args: Record<string, unknown>) => Promise<string>
): void {
  const zodShape = jsonSchemaToZodShape(toolDef.inputSchema);
  server.tool(
    toolDef.name,
    toolDef.description,
    zodShape,
    async (args: Record<string, unknown>) => {
      try {
        const result = await handler(args);
        return { content: [{ type: 'text' as const, text: result }] };
      } catch (err: any) {
        return { content: [{ type: 'text' as const, text: JSON.stringify({ error: err.message }) }], isError: true };
      }
    }
  );
}

async function main(): Promise<void> {
  // Verify sqlite3 CLI is available
  try {
    execFileSync('sqlite3', ['--version'], { encoding: 'utf-8', timeout: 5000 });
  } catch {
    process.stderr.write('[turul-mcp] WARNING: sqlite3 CLI not found. Database tools will not work.\n');
  }

  const server = new McpServer({ name: 'turul', version: '1.0.0' });

  // ── Database Tools (via sqlite3 CLI) ──

  server.tool('get_scan_history', 'Get recent scan history with IDs, profiles, regions, services, timestamps, status, and resource counts.', {
    limit: z.number().optional().describe('Max scans to return (default 10)'),
    cloud_provider: z.enum(['aws', 'gcp']).optional().describe('Filter by cloud provider'),
  }, async (args) => {
    const limit = args.limit || 10;
    const where = args.cloud_provider ? `WHERE provider = '${args.cloud_provider}'` : '';
    return { content: [{ type: 'text' as const, text: queryDb(`SELECT id, profile_name, provider, regions, services, status, resource_count, created_at FROM scans ${where} ORDER BY created_at DESC LIMIT ${limit}`) }] };
  });

  server.tool('get_scan_resources', 'Get resources from a specific scan, optionally filtered by service.', {
    scan_id: z.string().describe('The scan ID'),
    service: z.string().optional().describe('Filter by service (e.g. ec2, s3, lambda)'),
  }, async (args) => {
    const sid = args.scan_id.replace(/'/g, "''");
    const svc = args.service ? `AND service = '${args.service.replace(/'/g, "''")}'` : '';
    return { content: [{ type: 'text' as const, text: queryDb(`SELECT id, name, service, resource_type, region, tags FROM resources WHERE scan_id = '${sid}' ${svc} LIMIT 50`) }] };
  });

  server.tool('search_resources', 'Search resources by name, ID, or tags within a scan.', {
    scan_id: z.string().describe('Scan ID to search within'),
    query: z.string().describe('Search query'),
  }, async (args) => {
    const q = args.query.replace(/'/g, "''");
    const sid = args.scan_id.replace(/'/g, "''");
    return { content: [{ type: 'text' as const, text: queryDb(`SELECT id, name, service, resource_type, region, tags FROM resources WHERE scan_id = '${sid}' AND (name LIKE '%${q}%' OR id LIKE '%${q}%' OR tags LIKE '%${q}%') LIMIT 30`) }] };
  });

  server.tool('get_assessment_summary', 'Get latest assessment results with grades and scores.', {
    limit: z.number().optional().describe('Number of assessments (default 5)'),
    cloud_provider: z.enum(['aws', 'gcp']).optional().describe('Filter by provider'),
  }, async (args) => {
    const limit = args.limit || 5;
    const provider = args.cloud_provider || cloudProvider;
    const table = provider === 'gcp' ? 'gcp_assessments' : 'assessments';
    return { content: [{ type: 'text' as const, text: queryDb(`SELECT * FROM ${table} ORDER BY created_at DESC LIMIT ${limit}`) }] };
  });

  server.tool('get_resource_counts_by_service', 'Get resource counts grouped by service for a scan.', {
    scan_id: z.string().describe('The scan ID'),
  }, async (args) => {
    const sid = args.scan_id.replace(/'/g, "''");
    return { content: [{ type: 'text' as const, text: queryDb(`SELECT service, COUNT(*) as count FROM resources WHERE scan_id = '${sid}' GROUP BY service ORDER BY count DESC`) }] };
  });

  server.tool('get_idle_resources', 'Analyze scan data for idle/underutilized resources with estimated cost savings.', {
    scan_id: z.string().describe('The scan ID to analyze'),
  }, async (args) => {
    const sid = args.scan_id.replace(/'/g, "''");
    return { content: [{ type: 'text' as const, text: queryDb(`SELECT name, service, resource_type, region, tags FROM resources WHERE scan_id = '${sid}' AND (tags LIKE '%idle%' OR tags LIKE '%unused%' OR resource_type LIKE '%Volume%' OR resource_type LIKE '%Address%') LIMIT 30`) }] };
  });

  server.tool('query_database', 'Run a read-only SQL query. Tables: scans, resources, assessments, gcp_assessments, gcp_cost_cache, gcp_optimization_snapshots, aws_security_scans, aws_iam_analyses, tag_governance_config, settings, cost_analysis.', {
    sql: z.string().describe('SQL SELECT query (read-only)'),
  }, async (args) => {
    if (!args.sql.trim().toUpperCase().startsWith('SELECT')) {
      return { content: [{ type: 'text' as const, text: JSON.stringify({ error: 'Only SELECT queries allowed' }) }], isError: true };
    }
    return { content: [{ type: 'text' as const, text: queryDb(args.sql) }] };
  });

  // ── AWS Tools (live API calls — imported directly) ──
  for (const toolDef of awsToolDefinitions) {
    registerTool(server, toolDef, (args) => executeAwsTool(toolDef.name, args, profileName, region));
  }

  // ── GCP Tools (live API calls — imported directly) ──
  for (const toolDef of gcpToolDefinitions) {
    registerTool(server, toolDef, (args) => executeGcpTool(toolDef.name, args, projectId));
  }

  const totalTools = 7 + awsToolDefinitions.length + gcpToolDefinitions.length + 1; // +1 for query_database
  process.stderr.write(`[turul-mcp] ${totalTools} tools registered (7 DB + ${awsToolDefinitions.length} AWS + ${gcpToolDefinitions.length} GCP + 1 custom). Server ready.\n`);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  process.on('SIGINT', async () => { await server.close(); process.exit(0); });
  process.on('SIGTERM', async () => { await server.close(); process.exit(0); });
}

main().catch((err) => {
  process.stderr.write(`Turul MCP Server failed to start: ${err.message}\n`);
  process.exit(1);
});

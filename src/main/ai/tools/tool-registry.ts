// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import type { AIToolDefinition } from '../../../shared/types/chat';
import type { DatabaseManager } from '../../database/db-manager';
import type { McpClientManager } from '../mcp/mcp-client-manager';
import { dbToolDefinitions, executeDbTool } from './db-tools';
import { awsToolDefinitions, executeAwsTool } from './aws-tools';
import { gcpToolDefinitions, executeGcpTool } from './gcp-tools';

// MCP client manager reference — set once during IPC registration
let mcpClientManager: McpClientManager | null = null;

export function setMcpClientManager(manager: McpClientManager): void {
  mcpClientManager = manager;
}

export function getAllToolDefinitions(): AIToolDefinition[] {
  return [...dbToolDefinitions, ...awsToolDefinitions, ...gcpToolDefinitions];
}

export function getToolDefinitionsForProvider(cloudProvider: 'aws' | 'gcp'): AIToolDefinition[] {
  const tools = [...dbToolDefinitions];
  if (cloudProvider === 'aws') {
    tools.push(...awsToolDefinitions);
  } else {
    tools.push(...gcpToolDefinitions);
  }
  // Append tools from connected MCP servers
  if (mcpClientManager) {
    tools.push(...mcpClientManager.getToolDefinitions());
  }
  return tools;
}

export async function executeTool(
  name: string,
  args: Record<string, unknown>,
  dbManager: DatabaseManager,
  context?: { profileName?: string; region?: string; projectId?: string }
): Promise<string> {
  // MCP tools — routed to the MCP client manager
  if (name.startsWith('mcp__') && mcpClientManager) {
    return mcpClientManager.executeMcpTool(name, args);
  }

  // DB tools
  const dbTool = dbToolDefinitions.find(t => t.name === name);
  if (dbTool) {
    return executeDbTool(name, args, dbManager);
  }

  // AWS tools
  const awsTool = awsToolDefinitions.find(t => t.name === name);
  if (awsTool) {
    return executeAwsTool(name, args, context?.profileName, context?.region);
  }

  // GCP tools
  const gcpTool = gcpToolDefinitions.find(t => t.name === name);
  if (gcpTool) {
    return executeGcpTool(name, args, context?.projectId);
  }

  return JSON.stringify({ error: `Unknown tool: ${name}` });
}

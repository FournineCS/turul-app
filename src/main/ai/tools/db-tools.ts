// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import type { AIToolDefinition } from '../../../shared/types/chat';
import type { DatabaseManager } from '../../database/db-manager';
import { diffScans } from '../../scanning/scan-diff';
import { analyzeIdleResources } from '../../gcp/cost/resource-idle-analysis';

export const dbToolDefinitions: AIToolDefinition[] = [
  {
    name: 'get_scan_history',
    description: 'Get recent scan history from the local database. Returns scan IDs, profiles, regions, services scanned, timestamps, status, and resource counts.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Max scans to return (default 10)' },
        cloud_provider: { type: 'string', enum: ['aws', 'gcp'], description: 'Filter by cloud provider' },
      },
    },
  },
  {
    name: 'get_scan_resources',
    description: 'Get resources from a specific scan, optionally filtered by service or region.',
    inputSchema: {
      type: 'object',
      properties: {
        scan_id: { type: 'string', description: 'The scan ID to get resources from' },
        service: { type: 'string', description: 'Filter by service (e.g. ec2, s3, lambda)' },
      },
      required: ['scan_id'],
    },
  },
  {
    name: 'search_resources',
    description: 'Search resources across scans by name, ID, or tags. Use this to find specific resources.',
    inputSchema: {
      type: 'object',
      properties: {
        scan_id: { type: 'string', description: 'Scan ID to search within' },
        query: { type: 'string', description: 'Search query (matches name, ID, or tags)' },
      },
      required: ['scan_id', 'query'],
    },
  },
  {
    name: 'get_assessment_summary',
    description: 'Get the latest assessment results including overall grade, scores, and recommendation counts.',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Number of recent assessments to return (default 5)' },
      },
    },
  },
  {
    name: 'get_resource_counts_by_service',
    description: 'Get a summary of resource counts grouped by service for a given scan.',
    inputSchema: {
      type: 'object',
      properties: {
        scan_id: { type: 'string', description: 'The scan ID to analyze' },
      },
      required: ['scan_id'],
    },
  },
  {
    name: 'get_tag_compliance',
    description: 'Check resources from a scan against the configured required tags policy. Returns compliance percentage and non-compliant resources.',
    inputSchema: {
      type: 'object',
      properties: {
        scan_id: { type: 'string', description: 'The scan ID to check tag compliance for' },
      },
      required: ['scan_id'],
    },
  },
  {
    name: 'get_scan_comparison',
    description: 'Compare two scans to find added, removed, and modified resources between them.',
    inputSchema: {
      type: 'object',
      properties: {
        scan_id_old: { type: 'string', description: 'The older scan ID' },
        scan_id_new: { type: 'string', description: 'The newer scan ID' },
      },
      required: ['scan_id_old', 'scan_id_new'],
    },
  },
  {
    name: 'get_idle_resources',
    description: 'Analyze scan data for idle or underutilized resources (stopped VMs, unattached disks, unused IPs, etc.) with estimated cost savings. No live API calls needed.',
    inputSchema: {
      type: 'object',
      properties: {
        scan_id: { type: 'string', description: 'The scan ID to analyze for idle resources' },
      },
      required: ['scan_id'],
    },
  },
];

export async function executeDbTool(
  name: string,
  args: Record<string, unknown>,
  dbManager: DatabaseManager
): Promise<string> {
  switch (name) {
    case 'get_scan_history': {
      const limit = (args.limit as number) || 10;
      const provider = args.cloud_provider as string | undefined;
      const scans = provider
        ? dbManager.getAllScansByProvider(provider as 'aws' | 'gcp', limit)
        : dbManager.getAllScans(limit);
      return JSON.stringify(scans.map(s => ({
        id: s.id,
        profile: s.profile,
        regions: s.regions,
        services: s.services,
        startedAt: s.startedAt,
        completedAt: s.completedAt,
        status: s.status,
        resourceCount: s.resourceCount,
        cloudProvider: s.cloudProvider,
      })));
    }

    case 'get_scan_resources': {
      const scanId = args.scan_id as string;
      const service = args.service as string | undefined;
      const resources = service
        ? dbManager.getResourcesByService(scanId, service)
        : dbManager.getResourcesByScan(scanId);
      // Limit to 50 to avoid overwhelming the context
      const limited = resources.slice(0, 50);
      return JSON.stringify({
        total: resources.length,
        returned: limited.length,
        resources: limited.map(r => ({
          id: r.id,
          name: r.name,
          service: r.service,
          resourceType: r.resourceType,
          region: r.region,
          tags: r.tags,
        })),
      });
    }

    case 'search_resources': {
      const scanId = args.scan_id as string;
      const query = args.query as string;
      const results = dbManager.searchResources(scanId, query);
      const limited = results.slice(0, 30);
      return JSON.stringify({
        total: results.length,
        returned: limited.length,
        resources: limited.map(r => ({
          id: r.id,
          name: r.name,
          service: r.service,
          resourceType: r.resourceType,
          region: r.region,
          tags: r.tags,
        })),
      });
    }

    case 'get_assessment_summary': {
      const limit = (args.limit as number) || 5;
      const assessments = dbManager.getAllAssessments(limit);
      return JSON.stringify(assessments);
    }

    case 'get_resource_counts_by_service': {
      const scanId = args.scan_id as string;
      const resources = dbManager.getResourcesByScan(scanId);
      const counts: Record<string, number> = {};
      for (const r of resources) {
        counts[r.service] = (counts[r.service] || 0) + 1;
      }
      return JSON.stringify({
        totalResources: resources.length,
        byService: counts,
      });
    }

    case 'get_tag_compliance': {
      const scanId = args.scan_id as string;
      const requiredTags = dbManager.getTagGovernanceConfig();
      if (!requiredTags || requiredTags.length === 0) {
        return JSON.stringify({ message: 'No required tags configured. Configure tag governance policies first.' });
      }
      const resources = dbManager.getResourcesByScan(scanId);
      const nonCompliant: Array<{ id: string; name: string; service: string; missingTags: string[] }> = [];
      for (const r of resources) {
        const tags = r.tags || {};
        const missing = requiredTags.filter((t: string) => !tags[t]);
        if (missing.length > 0) {
          nonCompliant.push({ id: r.id, name: r.name, service: r.service, missingTags: missing });
        }
      }
      const compliancePercent = resources.length > 0
        ? Math.round(((resources.length - nonCompliant.length) / resources.length) * 100)
        : 100;
      return JSON.stringify({
        totalResources: resources.length,
        compliantResources: resources.length - nonCompliant.length,
        nonCompliantResources: nonCompliant.length,
        compliancePercent,
        requiredTags,
        nonCompliant: nonCompliant.slice(0, 30),
      });
    }

    case 'get_scan_comparison': {
      const scanIdOld = args.scan_id_old as string;
      const scanIdNew = args.scan_id_new as string;
      const resourcesOld = dbManager.getResourcesByScan(scanIdOld);
      const resourcesNew = dbManager.getResourcesByScan(scanIdNew);
      const diff = diffScans(resourcesOld, resourcesNew);
      return JSON.stringify({
        summary: diff.summary,
        added: (diff.added || []).slice(0, 20).map((r: any) => ({
          resourceId: r.resourceId, name: r.name, service: r.service, region: r.region,
        })),
        removed: (diff.removed || []).slice(0, 20).map((r: any) => ({
          resourceId: r.resourceId, name: r.name, service: r.service, region: r.region,
        })),
        changed: (diff.changed || []).slice(0, 20).map((r: any) => ({
          resourceId: r.resourceId, name: r.name, service: r.service, region: r.region, changedFields: r.changedFields,
        })),
      });
    }

    case 'get_idle_resources': {
      const scanId = args.scan_id as string;
      try {
        const result = await analyzeIdleResources(scanId, dbManager);
        const sorted = (result.findings || [])
          .sort((a: any, b: any) => (b.estimatedMonthlySavings || 0) - (a.estimatedMonthlySavings || 0))
          .slice(0, 30);
        return JSON.stringify({
          scanId: result.scanId,
          scannedAt: result.scannedAt,
          totalFindings: result.totalFindings,
          estimatedMonthlySavings: result.estimatedMonthlySavings,
          byType: result.byType,
          returned: sorted.length,
          findings: sorted,
        });
      } catch (err: any) {
        return JSON.stringify({ error: `Idle resource analysis failed: ${err.message}` });
      }
    }

    default:
      return JSON.stringify({ error: `Unknown DB tool: ${name}` });
  }
}

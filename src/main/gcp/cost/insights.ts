// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { enumerateProjectLocations } from './recommender-expanded';
import type {
  GCPCostInsight,
  GCPCostInsightCategory,
  GCPCostInsightResult,
  GCPCostInsightSeverity,
} from '../../../shared/types/gcp';

// All cost-relevant insight types the app surfaces.
// Source: Recommender API insightTypes catalog (verified late 2025).
export const COST_INSIGHT_TYPES = [
  // Cloud SQL — utilization (cost-relevant for rightsizing decisions)
  'google.cloudsql.instance.CpuUsageInsight',
  'google.cloudsql.instance.MemoryUsageInsight',
  // BigQuery — table stats for partition/cluster prioritization
  'google.bigquery.table.StatsInsight',
  // Resource Manager — project utilization (sibling to projectUtilization recommender)
  'google.resourcemanager.projectUtilization.Insight',
];

const REGIONAL_INSIGHTS = new Set([
  'google.cloudsql.instance.CpuUsageInsight',
  'google.cloudsql.instance.MemoryUsageInsight',
]);

const GLOBAL_INSIGHTS = new Set([
  'google.bigquery.table.StatsInsight',
  'google.resourcemanager.projectUtilization.Insight',
]);

interface RawInsight {
  name?: string | null;
  description?: string | null;
  targetResources?: string[] | null;
  insightSubtype?: string | null;
  content?: Record<string, unknown> | null;
  lastRefreshTime?: string | null;
  observationPeriod?: { seconds?: string | number | null } | null;
  stateInfo?: { state?: string | null; stateMetadata?: Record<string, string> | null } | null;
  category?: string | null;
  severity?: string | null;
  associatedRecommendations?: Array<{ recommendation?: string | null }> | null;
}

function mapSeverity(severity?: string | null): GCPCostInsightSeverity {
  switch ((severity ?? '').toUpperCase()) {
    case 'CRITICAL': return 'critical';
    case 'HIGH': return 'high';
    case 'MEDIUM': return 'medium';
    case 'LOW': return 'low';
    default: return 'low';
  }
}

function mapCategory(category?: string | null): GCPCostInsightCategory {
  switch ((category ?? '').toUpperCase()) {
    case 'COST': return 'cost';
    case 'PERFORMANCE': return 'performance';
    case 'RELIABILITY': return 'reliability';
    case 'SECURITY': return 'security';
    case 'MANAGEABILITY': return 'manageability';
    case 'SUSTAINABILITY': return 'sustainability';
    default: return 'cost';
  }
}

function extractServiceName(insightType: string): string {
  if (insightType.includes('cloudsql')) return 'Cloud SQL';
  if (insightType.includes('bigquery')) return 'BigQuery';
  if (insightType.includes('resourcemanager')) return 'Resource Manager';
  return 'Google Cloud';
}

function extractLocation(name: string, fallback: string): string {
  const match = name.match(/locations\/([^/]+)/);
  return match ? match[1] : fallback;
}

function extractResourceName(uri: string): string {
  if (!uri) return '';
  const segments = uri.replace(/\/$/, '').split('/');
  return segments[segments.length - 1] ?? '';
}

function transformInsight(
  raw: RawInsight,
  insightType: string,
  location: string
): GCPCostInsight {
  const targets = raw.targetResources ?? [];
  const primaryTarget = targets[0] ?? '';
  const associated = (raw.associatedRecommendations ?? [])
    .map((a) => a.recommendation ?? '')
    .filter((s) => s.length > 0);

  return {
    id: raw.name ?? `insight-${Math.random().toString(36).slice(2, 10)}`,
    insightType,
    insightSubtype: raw.insightSubtype ?? undefined,
    service: extractServiceName(insightType),
    description: raw.description ?? 'Diagnostic insight',
    severity: mapSeverity(raw.severity),
    category: mapCategory(raw.category),
    targetResources: targets,
    primaryResourceName: extractResourceName(primaryTarget),
    location: extractLocation(raw.name ?? '', location),
    state: raw.stateInfo?.state ?? undefined,
    lastRefreshTime: raw.lastRefreshTime ?? undefined,
    observationPeriodSeconds: raw.observationPeriod?.seconds
      ? Number(raw.observationPeriod.seconds)
      : undefined,
    associatedRecommendations: associated,
    content: raw.content ?? undefined,
  };
}

/**
 * List cost-relevant insights for a GCP project across all configured insight types.
 * Mirrors the recommender-expanded location-routing pattern. Failures per
 * (location × insightType) combo are swallowed for expected NOT_FOUND/403 cases.
 */
export async function getGCPCostInsights(
  projectId: string,
  options?: { regions?: string[]; concurrencyLimit?: number }
): Promise<GCPCostInsightResult> {
  const { RecommenderClient } = require('@google-cloud/recommender');
  const client = new RecommenderClient();

  const locations = options?.regions
    ? { zones: [] as string[], regions: options.regions }
    : await enumerateProjectLocations(projectId);
  const concurrencyLimit = options?.concurrencyLimit || 10;

  const insights: GCPCostInsight[] = [];
  const errors: string[] = [];

  // Build location-routed tasks
  const tasks: Array<{ location: string; insightType: string }> = [];
  for (const insightType of COST_INSIGHT_TYPES) {
    if (REGIONAL_INSIGHTS.has(insightType)) {
      for (const region of locations.regions) {
        tasks.push({ location: region, insightType });
      }
    } else if (GLOBAL_INSIGHTS.has(insightType)) {
      tasks.push({ location: 'global', insightType });
    } else {
      // Default to regional fan-out
      for (const region of locations.regions) {
        tasks.push({ location: region, insightType });
      }
    }
  }

  const processTask = async (task: { location: string; insightType: string }) => {
    try {
      const parent = `projects/${projectId}/locations/${task.location}/insightTypes/${task.insightType}`;
      const [rawList] = await client.listInsights({ parent });
      for (const raw of rawList as RawInsight[]) {
        insights.push(transformInsight(raw, task.insightType, task.location));
      }
    } catch (err: unknown) {
      const e = err as { code?: number; status?: number; message?: string };
      const code = e?.code || e?.status;
      // NOT_FOUND (5/404) and PERMISSION_DENIED (7/403) are expected for most combos
      if (code !== 5 && code !== 404 && code !== 7 && code !== 403) {
        errors.push(`${task.insightType} in ${task.location}: ${e?.message ?? String(err)}`);
      }
    }
  };

  // Concurrency-limited execution
  const executing = new Set<Promise<void>>();
  for (const task of tasks) {
    const p = processTask(task).then(() => { executing.delete(p); });
    executing.add(p);
    if (executing.size >= concurrencyLimit) {
      await Promise.race(executing);
    }
  }
  await Promise.all(executing);

  // Aggregate counts
  const byType: Record<string, number> = {};
  const bySeverity: Record<GCPCostInsightSeverity, number> = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  };
  for (const i of insights) {
    byType[i.insightType] = (byType[i.insightType] ?? 0) + 1;
    bySeverity[i.severity]++;
  }

  return {
    insights,
    insightTypesScanned: COST_INSIGHT_TYPES,
    locationsScanned: [...new Set(tasks.map((t) => t.location))],
    byType,
    bySeverity,
    errors,
  };
}

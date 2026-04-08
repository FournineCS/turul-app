// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';
import { getGCPProjectManager } from '../project-manager';
import type {
  CostOptimizationRecommendation,
  GCPExpandedRecommendationsResult,
  GCPCostRecommendationMeta,
  GCPCostCategory,
  GCPRecommendation,
} from './types';
import type { GCPOrgScanProgress } from '../../../shared/types';

// All cost-category recommender types from GCP Recommender API
export const COST_RECOMMENDER_TYPES = [
  // Compute Engine (9)
  'google.compute.instance.MachineTypeRecommender',
  'google.compute.instance.IdleResourceRecommender',
  'google.compute.disk.IdleResourceRecommender',
  'google.compute.address.IdleResourceRecommender',
  'google.compute.image.IdleResourceRecommender',
  'google.compute.IdleResourceRecommender',
  'google.compute.commitment.UsageCommitmentRecommender',
  'google.compute.RightSizeResourceRecommender',               // Underutilized reservations
  'google.compute.instanceGroupManager.MachineTypeRecommender', // MIG machine type rightsizing
  // Cloud SQL (2)
  'google.cloudsql.instance.IdleRecommender',
  'google.cloudsql.instance.OverprovisionedRecommender',
  // BigQuery (2)
  'google.bigquery.capacityCommitments.Recommender',
  'google.bigquery.table.PartitionClusterRecommender',
  // Cloud Run (1)
  'google.run.service.CostRecommender',
  // Cloud Storage (1)
  'google.storage.bucket.SoftDeleteRecommender',
  // GKE (1) — CLUSTER_IDLE subtype only; other subtypes are filtered below
  'google.container.DiagnosisRecommender',
];

// Comprehensive fallback region list (all GCP regions as of early 2026)
const ALL_GCP_REGIONS = [
  'us-central1', 'us-east1', 'us-east4', 'us-east5', 'us-south1',
  'us-west1', 'us-west2', 'us-west3', 'us-west4',
  'europe-central2', 'europe-north1', 'europe-southwest1',
  'europe-west1', 'europe-west2', 'europe-west3', 'europe-west4',
  'europe-west6', 'europe-west8', 'europe-west9', 'europe-west10', 'europe-west12',
  'asia-east1', 'asia-east2',
  'asia-northeast1', 'asia-northeast2', 'asia-northeast3',
  'asia-south1', 'asia-south2',
  'asia-southeast1', 'asia-southeast2',
  'australia-southeast1', 'australia-southeast2',
  'northamerica-northeast1', 'northamerica-northeast2',
  'southamerica-east1', 'southamerica-west1',
  'me-central1', 'me-central2', 'me-west1',
  'africa-south1',
];

// Fallback zones derived from regions (typical a/b/c suffixes)
const ALL_GCP_ZONES = ALL_GCP_REGIONS.flatMap(r => [`${r}-a`, `${r}-b`, `${r}-c`]);

// --- Smart location routing per recommender type ---
// Zone-scoped recommenders (VMs, MIGs, disks)
const ZONE_RECOMMENDERS = new Set([
  'google.compute.instance.MachineTypeRecommender',
  'google.compute.instance.IdleResourceRecommender',
  'google.compute.instanceGroupManager.MachineTypeRecommender',
  'google.compute.disk.IdleResourceRecommender',
]);

// Region-scoped recommenders (addresses, Cloud SQL, Cloud Run)
const REGION_RECOMMENDERS = new Set([
  'google.compute.address.IdleResourceRecommender',
  'google.cloudsql.instance.IdleRecommender',
  'google.cloudsql.instance.OverprovisionedRecommender',
  'google.run.service.CostRecommender',
]);

// Global-scoped recommenders (images, commitments, BigQuery, GKE, Storage)
const GLOBAL_RECOMMENDERS = new Set([
  'google.compute.image.IdleResourceRecommender',
  'google.compute.IdleResourceRecommender',
  'google.compute.commitment.UsageCommitmentRecommender',
  'google.compute.RightSizeResourceRecommender',
  'google.bigquery.capacityCommitments.Recommender',
  'google.bigquery.table.PartitionClusterRecommender',
  'google.storage.bucket.SoftDeleteRecommender',
  'google.container.DiagnosisRecommender',
]);

/**
 * Enumerate all active zones, regions, and global for a GCP project via Compute Engine API.
 * Falls back to comprehensive hardcoded lists on failure.
 */
export async function enumerateProjectLocations(
  projectId: string
): Promise<{ zones: string[]; regions: string[] }> {
  try {
    const auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/compute.readonly'],
    });
    const authClient = await auth.getClient();
    const compute = google.compute({ version: 'v1', auth: authClient as never });

    const [zonesResponse, regionsResponse] = await Promise.all([
      compute.zones.list({ project: projectId }),
      compute.regions.list({ project: projectId }),
    ]);

    const zones = (zonesResponse.data.items || [])
      .filter((z) => z.status === 'UP')
      .map((z) => z.name!)
      .filter(Boolean);

    const regions = (regionsResponse.data.items || [])
      .filter((r) => r.status === 'UP')
      .map((r) => r.name!)
      .filter(Boolean);

    return {
      zones: zones.length > 0 ? zones : ALL_GCP_ZONES,
      regions: regions.length > 0 ? regions : ALL_GCP_REGIONS,
    };
  } catch {
    return { zones: ALL_GCP_ZONES, regions: ALL_GCP_REGIONS };
  }
}

/**
 * Backward-compatible wrapper: returns only regions (used by CUD coverage).
 */
export async function enumerateProjectRegions(projectId: string): Promise<string[]> {
  const { regions } = await enumerateProjectLocations(projectId);
  return regions;
}

/**
 * Get cost optimization recommendations from ALL cost-category recommenders
 * across zones (for VM/disk), regions (for IPs/SQL/Run), and global (for images/commitments/etc).
 */
export async function getExpandedCostRecommendations(
  projectId: string,
  options?: { regions?: string[]; concurrencyLimit?: number }
): Promise<GCPExpandedRecommendationsResult> {
  const { RecommenderClient } = require('@google-cloud/recommender');
  const client = new RecommenderClient();

  const locations = options?.regions
    ? { zones: [] as string[], regions: options.regions }
    : await enumerateProjectLocations(projectId);
  const concurrencyLimit = options?.concurrencyLimit || 10;

  const recommendations: CostOptimizationRecommendation[] = [];
  const meta: Record<string, GCPCostRecommendationMeta> = {};
  const errors: string[] = [];

  // Build smart location-routed tasks instead of region x all recommenders
  const tasks: Array<{ location: string; recommenderType: string }> = [];
  for (const recommenderType of COST_RECOMMENDER_TYPES) {
    if (ZONE_RECOMMENDERS.has(recommenderType)) {
      for (const zone of locations.zones) {
        tasks.push({ location: zone, recommenderType });
      }
    } else if (REGION_RECOMMENDERS.has(recommenderType)) {
      for (const region of locations.regions) {
        tasks.push({ location: region, recommenderType });
      }
    } else if (GLOBAL_RECOMMENDERS.has(recommenderType)) {
      tasks.push({ location: 'global', recommenderType });
    } else {
      // Unknown recommender — query regions as fallback
      for (const region of locations.regions) {
        tasks.push({ location: region, recommenderType });
      }
    }
  }

  // Process with concurrency limit
  let idx = 0;
  const processTask = async (task: { location: string; recommenderType: string }) => {
    try {
      const parent = `projects/${projectId}/locations/${task.location}/recommenders/${task.recommenderType}`;
      let [recs] = await client.listRecommendations({ parent });

      // DiagnosisRecommender covers many subtypes; only CLUSTER_IDLE is a cost recommendation
      if (task.recommenderType === 'google.container.DiagnosisRecommender') {
        recs = (recs as GCPRecommendation[]).filter((r) => r.recommenderSubtype === 'CLUSTER_IDLE');
      }

      for (const rec of recs as GCPRecommendation[]) {
        const recId = rec.name || `gcp-rec-${idx++}`;
        const monthlySavings = extractMonthlySavings(rec);
        const recType = mapRecommenderType(task.recommenderType, rec.recommenderSubtype);
        const service = extractServiceName(rec.name || '', task.recommenderType);
        const location = extractLocation(rec.name || '') || task.location;
        const uiCategory = getUICategory(task.recommenderType);

        const rawResource = rec.content?.operationGroups?.[0]?.operations?.[0]?.resource || '';
        const resourceName = extractResourceName(rawResource);
        const actionDesc = buildActionDescription(task.recommenderType, rec, resourceName);

        recommendations.push({
          id: recId,
          type: recType,
          severity: mapPriority(rec.priority),
          service,
          description: rec.description || 'Cost optimization recommendation',
          estimatedMonthlySavings: monthlySavings,
          currency: 'USD',
          actionRequired: actionDesc,
          resourceId: resourceName || rawResource || undefined,
          region: location,
          category: uiCategory,
        });

        meta[recId] = {
          source: 'recommender_api',
          uiCategory,
          recommenderType: task.recommenderType,
          recommenderSubtype: rec.recommenderSubtype,
          consoleUrl: `https://console.cloud.google.com/home/recommendations?project=${projectId}`,
        };
      }
    } catch (err: unknown) {
      const e = err as { code?: number; status?: number; message?: string };
      const code = e?.code || e?.status;
      // NOT_FOUND (5/404) and PERMISSION_DENIED (7/403) are expected for most location/recommender combos
      if (code !== 5 && code !== 404 && code !== 7 && code !== 403) {
        errors.push(`${task.recommenderType} in ${task.location}: ${e?.message || String(err)}`);
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

  // Build byCategory aggregation
  const byCategory: Record<GCPCostCategory, { count: number; savings: number }> = {
    idle_resources: { count: 0, savings: 0 },
    rightsizing: { count: 0, savings: 0 },
    commitments: { count: 0, savings: 0 },
    best_practices: { count: 0, savings: 0 },
    stopped_vms: { count: 0, savings: 0 },
  };

  for (const rec of recommendations) {
    const cat = meta[rec.id]?.uiCategory || 'best_practices';
    byCategory[cat].count++;
    byCategory[cat].savings += rec.estimatedMonthlySavings;
  }

  const totalPotentialSavings = recommendations.reduce((sum, r) => sum + r.estimatedMonthlySavings, 0);

  const allLocations = [...new Set(tasks.map(t => t.location))];

  return {
    recommendations,
    meta,
    totalPotentialSavings,
    currency: 'USD',
    byCategory,
    regionsScanned: allLocations,
    recommenderTypesScanned: COST_RECOMMENDER_TYPES,
    errors,
  };
}

// ── Helper functions ──

function getUICategory(recommenderType: string): GCPCostCategory {
  if (recommenderType.includes('Idle') || recommenderType.includes('idle') ||
      recommenderType === 'google.container.DiagnosisRecommender') return 'idle_resources';
  if (recommenderType.includes('MachineType') || recommenderType.includes('Overprovisioned') ||
      recommenderType.includes('RightSize')) return 'rightsizing';
  if (recommenderType.includes('Commitment') || recommenderType.includes('commitment') ||
      recommenderType.includes('capacityCommitments')) return 'commitments';
  return 'best_practices';
}

function mapRecommenderType(
  recommenderType: string,
  subtype?: string
): CostOptimizationRecommendation['type'] {
  if (recommenderType.includes('Commitment') || recommenderType.includes('commitment') ||
      recommenderType.includes('capacityCommitments')) return 'commitment_coverage';
  if (recommenderType.includes('MachineType') || recommenderType.includes('Overprovisioned') ||
      recommenderType.includes('RightSize') || recommenderType.includes('instanceGroupManager')) return 'rightsizing';
  if (recommenderType.includes('Idle') || recommenderType.includes('idle')) return 'idle_resource';
  if (recommenderType === 'google.container.DiagnosisRecommender') return 'idle_resource';
  if (recommenderType.includes('SoftDelete') || recommenderType.includes('PartitionCluster') ||
      recommenderType.includes('CostRecommender')) return 'best_practice';

  // Fallback to subtype-based mapping
  if (!subtype) return 'idle_resource';
  const s = subtype.toUpperCase();
  if (s.includes('CHANGE_MACHINE_TYPE')) return 'rightsizing';
  if (s.includes('IDLE') || s.includes('STOP_VM') || s.includes('CLUSTER_IDLE')) return 'idle_resource';
  if (s.includes('SNAPSHOT') || s.includes('DELETE')) return 'orphaned_resource';
  return 'underutilized';
}

export function extractMonthlySavings(rec: GCPRecommendation): number {
  const projection = rec.primaryImpact?.costProjection;
  if (!projection?.cost) return 0;

  const units = Math.abs(Number(projection.cost.units || 0));
  const nanos = Math.abs(projection.cost.nanos || 0) / 1e9;
  const totalCost = units + nanos;

  const durationSecs = Number(projection.duration?.seconds || 2592000);
  const durationDays = durationSecs / 86400;
  return durationDays > 0 ? (totalCost / durationDays) * 30 : totalCost;
}

export function mapPriority(priority?: string): CostOptimizationRecommendation['severity'] {
  switch (priority) {
    case 'P1': return 'high';
    case 'P2': return 'medium';
    case 'P3':
    case 'P4':
    default: return 'low';
  }
}

export function extractServiceName(name: string, recommenderType?: string): string {
  if (recommenderType?.includes('bigquery')) return 'BigQuery';
  if (recommenderType?.includes('run.service')) return 'Cloud Run';
  if (recommenderType?.includes('storage.bucket')) return 'Cloud Storage';
  if (recommenderType?.includes('cloudsql')) return 'Cloud SQL';
  if (recommenderType?.includes('container.Diagnosis')) return 'GKE';
  if (recommenderType?.includes('instanceGroupManager')) return 'Compute Engine (MIGs)';
  if (recommenderType?.includes('RightSize')) return 'Compute Engine (Reservations)';
  if (name.includes('compute.instance') || recommenderType?.includes('compute.instance')) return 'Compute Engine (VMs)';
  if (name.includes('compute.disk') || recommenderType?.includes('compute.disk')) return 'Compute Engine (Disks)';
  if (name.includes('compute.address') || recommenderType?.includes('compute.address')) return 'Compute Engine (IPs)';
  if (name.includes('compute.image') || recommenderType?.includes('compute.image')) return 'Compute Engine (Images)';
  if (recommenderType?.includes('compute.commitment')) return 'Compute Engine (CUDs)';
  if (recommenderType?.includes('compute.Idle')) return 'Compute Engine (Reservations)';
  return 'Google Cloud';
}

export function extractLocation(name: string): string {
  const match = name.match(/locations\/([^/]+)/);
  return match ? match[1] : 'global';
}

/**
 * Extract the short resource name from a full GCP resource path.
 * e.g. "//compute.googleapis.com/projects/my-proj/zones/us-central1-a/instances/nsq-02" → "nsq-02"
 */
function extractResourceName(resourcePath: string): string {
  if (!resourcePath) return '';
  // Take the last path segment
  const segments = resourcePath.replace(/\/$/, '').split('/');
  return segments[segments.length - 1] || '';
}

/**
 * Build a human-readable action description from the recommender type and recommendation data.
 */
function buildActionDescription(
  recommenderType: string,
  rec: GCPRecommendation,
  resourceName: string
): string {
  const subtype = rec.recommenderSubtype || '';
  const target = resourceName ? ` for "${resourceName}"` : '';

  if (recommenderType.includes('MachineTypeRecommender')) {
    return `Rightsize VM instance${target}`;
  }
  if (recommenderType.includes('instance.IdleResourceRecommender')) {
    return `Stop or delete idle VM instance${target}`;
  }
  if (recommenderType.includes('disk.IdleResourceRecommender')) {
    return `Delete idle persistent disk${target}`;
  }
  if (recommenderType.includes('address.IdleResourceRecommender')) {
    return `Release idle static IP address${target}`;
  }
  if (recommenderType.includes('image.IdleResourceRecommender')) {
    return `Delete idle image${target}`;
  }
  if (recommenderType.includes('commitment.UsageCommitmentRecommender')) {
    return `Purchase committed use discount${target}`;
  }
  if (recommenderType.includes('RightSizeResourceRecommender')) {
    return `Rightsize underutilized reservation${target}`;
  }
  if (recommenderType.includes('compute.IdleResourceRecommender')) {
    return `Delete idle reservation${target}`;
  }
  if (recommenderType.includes('instanceGroupManager.MachineTypeRecommender')) {
    return `Rightsize MIG machine type${target}`;
  }
  if (recommenderType.includes('cloudsql.instance.IdleRecommender')) {
    return `Stop or delete idle Cloud SQL instance${target}`;
  }
  if (recommenderType.includes('cloudsql.instance.OverprovisionedRecommender')) {
    return `Rightsize overprovisioned Cloud SQL instance${target}`;
  }
  if (recommenderType.includes('bigquery.capacityCommitments')) {
    return `Optimize BigQuery capacity commitments${target}`;
  }
  if (recommenderType.includes('bigquery.table.PartitionCluster')) {
    return `Add partitioning/clustering to BigQuery table${target}`;
  }
  if (recommenderType.includes('run.service.CostRecommender')) {
    return `Optimize Cloud Run service${target}`;
  }
  if (recommenderType.includes('storage.bucket.SoftDelete')) {
    return `Adjust Cloud Storage soft-delete policy${target}`;
  }
  if (recommenderType.includes('container.DiagnosisRecommender') && subtype === 'CLUSTER_IDLE') {
    return `Delete idle GKE cluster${target}`;
  }

  return `Review recommendation in GCP Console${target}`;
}

function chunkArr<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Get cost optimization recommendations across all accessible GCP projects.
 * Only scans projects with billing enabled to avoid wasting Recommender API quota.
 * Calls onProgress after each batch so the UI can show partial results.
 */
export async function getExpandedCostRecommendationsOrgWide(
  _orgId: string,
  onProgress?: (p: GCPOrgScanProgress) => void
): Promise<GCPExpandedRecommendationsResult> {
  const projects = await getGCPProjectManager().getProjectsWithBillingEnabled();
  const CONCURRENCY = 3;

  const allRecs: CostOptimizationRecommendation[] = [];
  const allMeta: Record<string, GCPCostRecommendationMeta> = {};
  const errors: string[] = [];
  let projectsCompleted = 0;

  const byCategory: Record<GCPCostCategory, { count: number; savings: number }> = {
    idle_resources: { count: 0, savings: 0 },
    rightsizing: { count: 0, savings: 0 },
    commitments: { count: 0, savings: 0 },
    best_practices: { count: 0, savings: 0 },
    stopped_vms: { count: 0, savings: 0 },
  };

  for (const batch of chunkArr(projects, CONCURRENCY)) {
    const results = await Promise.allSettled(
      batch.map((p) => getExpandedCostRecommendations(p.projectId))
    );
    for (const r of results) {
      if (r.status === 'fulfilled') {
        allRecs.push(...r.value.recommendations);
        Object.assign(allMeta, r.value.meta);
        errors.push(...r.value.errors);
        for (const cat of Object.keys(r.value.byCategory) as GCPCostCategory[]) {
          byCategory[cat].count += r.value.byCategory[cat].count;
          byCategory[cat].savings += r.value.byCategory[cat].savings;
        }
      } else {
        errors.push(String(r.reason));
      }
    }
    projectsCompleted += batch.length;
    onProgress?.({
      projectsCompleted,
      totalProjects: projects.length,
      currentProject: batch[batch.length - 1].projectId,
      partial: {
        recommendations: allRecs,
        meta: allMeta,
        totalPotentialSavings: allRecs.reduce((s, r) => s + r.estimatedMonthlySavings, 0),
        currency: 'USD',
        byCategory,
        regionsScanned: [],
        recommenderTypesScanned: COST_RECOMMENDER_TYPES,
        errors,
      },
    });
  }

  return {
    recommendations: allRecs,
    meta: allMeta,
    totalPotentialSavings: allRecs.reduce((s, r) => s + r.estimatedMonthlySavings, 0),
    currency: 'USD',
    byCategory,
    regionsScanned: [],
    recommenderTypesScanned: COST_RECOMMENDER_TYPES,
    errors,
  };
}

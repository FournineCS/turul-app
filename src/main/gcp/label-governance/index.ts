// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import crypto from 'crypto';
import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';
import {
  GCPLabelGovernanceConfig,
  GCPLabelComplianceResult,
  GCPLabelServiceCompliance,
  GCPLabelKeyCompliance,
  GCPUnlabeledResource,
} from './types';

export { GCPLabelGovernanceConfig, GCPLabelComplianceResult } from './types';

interface ResourceEntry {
  name: string;
  id: string;
  service: string;
  region: string;
  labels: Record<string, string>;
}

/**
 * Run label compliance check across GCP resources using Cloud Asset Inventory.
 * Falls back to direct API calls if Asset API is unavailable.
 */
export async function runGCPLabelCompliance(
  projectId: string,
  config: GCPLabelGovernanceConfig
): Promise<GCPLabelComplianceResult> {
  const startTime = Date.now();
  const requiredLabels = config.requiredLabels;
  if (requiredLabels.length === 0) {
    return {
      id: crypto.randomUUID(),
      projectId,
      totalResources: 0,
      fullyCompliantResources: 0,
      overallCompliancePercent: 100,
      byService: [],
      byLabelKey: [],
      unlabeledResources: [],
      analyzedAt: new Date().toISOString(),
      duration: Date.now() - startTime,
    };
  }

  const resources = await collectResources(projectId);
  return analyzeCompliance(projectId, resources, requiredLabels, startTime);
}

async function collectResources(projectId: string): Promise<ResourceEntry[]> {
  const resources: ResourceEntry[] = [];
  const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });

  // Try Cloud Asset Inventory first (most comprehensive)
  try {
    const asset = google.cloudasset({ version: 'v1', auth });
    const assetTypes = [
      'compute.googleapis.com/Instance',
      'compute.googleapis.com/Disk',
      'storage.googleapis.com/Bucket',
      'sqladmin.googleapis.com/Instance',
      'container.googleapis.com/Cluster',
      'bigquery.googleapis.com/Dataset',
      'run.googleapis.com/Service',
      'cloudfunctions.googleapis.com/Function',
    ];

    let pageToken: string | undefined;
    do {
      const response = await asset.assets.list({
        parent: `projects/${projectId}`,
        assetTypes,
        contentType: 'RESOURCE',
        pageSize: 500,
        pageToken,
      });

      for (const a of response.data.assets || []) {
        const resource = a.resource?.data as Record<string, unknown> | undefined;
        const assetType = a.assetType || '';
        const service = assetType.split('/')[0]?.replace('.googleapis.com', '') || 'unknown';
        const name = (resource?.name as string) || a.name?.split('/').pop() || '';
        const labels = (resource?.labels as Record<string, string>) || {};
        const location = (resource?.location as string) || (resource?.zone as string) || 'global';

        resources.push({
          name,
          id: a.name || name,
          service: mapServiceName(service),
          region: extractRegion(location),
          labels,
        });
      }

      pageToken = response.data.nextPageToken ?? undefined;
    } while (pageToken);

    if (resources.length > 0) return resources;
  } catch {
    // Asset API not available, fall back to direct API calls
  }

  // Fallback: query common services directly
  await Promise.allSettled([
    collectComputeInstances(projectId, auth, resources),
    collectGCSBuckets(projectId, resources),
    collectCloudSQL(projectId, auth, resources),
    collectGKEClusters(projectId, auth, resources),
  ]);

  return resources;
}

async function collectComputeInstances(
  projectId: string,
  auth: GoogleAuth,
  resources: ResourceEntry[]
): Promise<void> {
  const compute = google.compute({ version: 'v1', auth });
  const response = await compute.instances.aggregatedList({ project: projectId });
  const items = response.data.items || {};

  for (const [zone, scopedList] of Object.entries(items)) {
    for (const instance of (scopedList as { instances?: Array<Record<string, unknown>> }).instances || []) {
      resources.push({
        name: (instance.name as string) || '',
        id: String(instance.id || ''),
        service: 'Compute Engine',
        region: extractRegion(zone),
        labels: (instance.labels as Record<string, string>) || {},
      });
    }
  }
}

async function collectGCSBuckets(
  projectId: string,
  resources: ResourceEntry[]
): Promise<void> {
  const { Storage } = await import('@google-cloud/storage');
  const storage = new Storage({ projectId });
  const [buckets] = await storage.getBuckets();

  for (const bucket of buckets) {
    resources.push({
      name: bucket.name || '',
      id: bucket.name || '',
      service: 'Cloud Storage',
      region: (bucket.metadata?.location as string)?.toLowerCase() || 'global',
      labels: (bucket.metadata?.labels as Record<string, string>) || {},
    });
  }
}

async function collectCloudSQL(
  projectId: string,
  auth: GoogleAuth,
  resources: ResourceEntry[]
): Promise<void> {
  const sqladmin = google.sqladmin({ version: 'v1beta4', auth });
  const response = await sqladmin.instances.list({ project: projectId });

  for (const instance of response.data.items || []) {
    resources.push({
      name: instance.name || '',
      id: instance.name || '',
      service: 'Cloud SQL',
      region: instance.region || 'unknown',
      labels: (instance.settings?.userLabels as Record<string, string>) || {},
    });
  }
}

async function collectGKEClusters(
  projectId: string,
  auth: GoogleAuth,
  resources: ResourceEntry[]
): Promise<void> {
  const container = google.container({ version: 'v1', auth });
  const response = await container.projects.locations.clusters.list({
    parent: `projects/${projectId}/locations/-`,
  });

  for (const cluster of response.data.clusters || []) {
    resources.push({
      name: cluster.name || '',
      id: cluster.name || '',
      service: 'GKE',
      region: cluster.location || 'unknown',
      labels: (cluster.resourceLabels as Record<string, string>) || {},
    });
  }
}

function analyzeCompliance(
  projectId: string,
  resources: ResourceEntry[],
  requiredLabels: string[],
  startTime: number
): GCPLabelComplianceResult {
  const unlabeledResources: GCPUnlabeledResource[] = [];
  let fullyCompliant = 0;

  // Per-service tracking
  const serviceMap = new Map<string, { total: number; compliant: number }>();
  // Per-label-key tracking
  const labelKeyMap = new Map<string, { total: number; labeled: number }>();

  for (const label of requiredLabels) {
    labelKeyMap.set(label, { total: 0, labeled: 0 });
  }

  for (const resource of resources) {
    const missingLabels = requiredLabels.filter((l) => !(l in resource.labels));
    const isCompliant = missingLabels.length === 0;

    if (isCompliant) fullyCompliant++;

    // Service tracking
    const svc = serviceMap.get(resource.service) || { total: 0, compliant: 0 };
    svc.total++;
    if (isCompliant) svc.compliant++;
    serviceMap.set(resource.service, svc);

    // Label key tracking
    for (const label of requiredLabels) {
      const entry = labelKeyMap.get(label)!;
      entry.total++;
      if (label in resource.labels) entry.labeled++;
    }

    if (!isCompliant) {
      unlabeledResources.push({
        id: resource.id,
        name: resource.name,
        service: resource.service,
        region: resource.region,
        missingLabels,
      });
    }
  }

  const byService: GCPLabelServiceCompliance[] = Array.from(serviceMap.entries())
    .map(([service, data]) => ({
      service,
      totalResources: data.total,
      compliantResources: data.compliant,
      compliancePercent: data.total > 0 ? Math.round((data.compliant / data.total) * 100) : 100,
    }))
    .sort((a, b) => a.compliancePercent - b.compliancePercent);

  const byLabelKey: GCPLabelKeyCompliance[] = Array.from(labelKeyMap.entries())
    .map(([labelKey, data]) => ({
      labelKey,
      totalResources: data.total,
      labeledResources: data.labeled,
      coveragePercent: data.total > 0 ? Math.round((data.labeled / data.total) * 100) : 100,
    }))
    .sort((a, b) => a.coveragePercent - b.coveragePercent);

  const totalResources = resources.length;

  return {
    id: crypto.randomUUID(),
    projectId,
    totalResources,
    fullyCompliantResources: fullyCompliant,
    overallCompliancePercent:
      totalResources > 0 ? Math.round((fullyCompliant / totalResources) * 100) : 100,
    byService,
    byLabelKey,
    unlabeledResources,
    analyzedAt: new Date().toISOString(),
    duration: Date.now() - startTime,
  };
}

function mapServiceName(service: string): string {
  const map: Record<string, string> = {
    compute: 'Compute Engine',
    storage: 'Cloud Storage',
    sqladmin: 'Cloud SQL',
    container: 'GKE',
    bigquery: 'BigQuery',
    run: 'Cloud Run',
    cloudfunctions: 'Cloud Functions',
  };
  return map[service] || service;
}

function extractRegion(location: string): string {
  // "zones/us-central1-a" → "us-central1"
  const cleaned = location.replace('zones/', '').replace('regions/', '');
  const match = cleaned.match(/^([a-z]+-[a-z]+\d)/);
  return match ? match[1] : cleaned;
}

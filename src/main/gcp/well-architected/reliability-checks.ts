// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';
import { GCPWAFinding, GCPWAPillarSummary, GCPWACheckDefinition, GCPWAPillarId } from './types';

const CHECKS: GCPWACheckDefinition[] = [
  {
    id: 'GCP-REL-001',
    title: 'Cloud SQL instances have high availability',
    description: 'Cloud SQL instances should be configured for high availability (regional) to survive zone failures.',
    pillar: 'reliability',
    severity: 'HIGH',
    service: 'Cloud SQL',
    remediationRecommendation: 'Enable high availability on Cloud SQL instances by configuring them as regional instances with automatic failover.',
  },
  {
    id: 'GCP-REL-002',
    title: 'Cloud SQL instances have backups enabled',
    description: 'Cloud SQL instances should have automated backups enabled for data recovery.',
    pillar: 'reliability',
    severity: 'HIGH',
    service: 'Cloud SQL',
    remediationRecommendation: 'Enable automated backups on all Cloud SQL instances with an appropriate retention period (at least 7 days for production).',
  },
  {
    id: 'GCP-REL-003',
    title: 'GKE clusters are regional (multi-zone)',
    description: 'GKE clusters should be regional to ensure control plane and node availability across multiple zones.',
    pillar: 'reliability',
    severity: 'HIGH',
    service: 'GKE',
    remediationRecommendation: 'Use regional GKE clusters instead of zonal clusters to distribute the control plane and nodes across multiple zones.',
  },
  {
    id: 'GCP-REL-004',
    title: 'Instance groups span multiple zones',
    description: 'Managed instance groups should be distributed across multiple zones for fault tolerance.',
    pillar: 'reliability',
    severity: 'MEDIUM',
    service: 'Compute Engine',
    remediationRecommendation: 'Convert single-zone managed instance groups to regional (multi-zone) managed instance groups.',
  },
  {
    id: 'GCP-REL-005',
    title: 'Load balancers have health checks',
    description: 'Backend services used by load balancers should have health checks configured to detect and route around unhealthy instances.',
    pillar: 'reliability',
    severity: 'HIGH',
    service: 'Load Balancing',
    remediationRecommendation: 'Ensure all backend services have health checks configured with appropriate intervals and thresholds.',
  },
];

export async function runReliabilityChecks(projectId: string): Promise<GCPWAPillarSummary> {
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  const findings: GCPWAFinding[] = [];

  // GCP-REL-001: Check Cloud SQL high availability
  try {
    const sqladmin = google.sqladmin({ version: 'v1beta4', auth });
    const instancesResponse = await sqladmin.instances.list({ project: projectId });
    const instances = instancesResponse.data.items || [];
    const noHaInstances: string[] = [];

    for (const instance of instances) {
      // Skip read replicas
      if (instance.instanceType === 'READ_REPLICA_INSTANCE') continue;
      const availabilityType = instance.settings?.availabilityType;
      if (availabilityType !== 'REGIONAL') {
        noHaInstances.push(instance.name || '');
      }
    }

    const primaryInstances = instances.filter((i) => i.instanceType !== 'READ_REPLICA_INSTANCE');
    if (primaryInstances.length === 0) {
      findings.push({
        check: CHECKS[0],
        status: 'PASS',
        resources: [],
        detail: 'No Cloud SQL primary instances found (check not applicable)',
      });
    } else {
      findings.push({
        check: CHECKS[0],
        status: noHaInstances.length === 0 ? 'PASS' : 'FAIL',
        resources: noHaInstances,
        detail: noHaInstances.length === 0
          ? `All ${primaryInstances.length} Cloud SQL instances are highly available`
          : `${noHaInstances.length} of ${primaryInstances.length} Cloud SQL ${noHaInstances.length === 1 ? 'instance is' : 'instances are'} not highly available`,
      });
    }
  } catch (error) {
    findings.push({
      check: CHECKS[0],
      status: 'ERROR',
      resources: [],
      detail: `Failed to check Cloud SQL HA: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }

  // GCP-REL-002: Check Cloud SQL backups
  try {
    const sqladmin = google.sqladmin({ version: 'v1beta4', auth });
    const instancesResponse = await sqladmin.instances.list({ project: projectId });
    const instances = instancesResponse.data.items || [];
    const noBackupInstances: string[] = [];

    for (const instance of instances) {
      if (instance.instanceType === 'READ_REPLICA_INSTANCE') continue;
      const backupEnabled = instance.settings?.backupConfiguration?.enabled;
      if (!backupEnabled) {
        noBackupInstances.push(instance.name || '');
      }
    }

    const primaryInstances = instances.filter((i) => i.instanceType !== 'READ_REPLICA_INSTANCE');
    if (primaryInstances.length === 0) {
      findings.push({
        check: CHECKS[1],
        status: 'PASS',
        resources: [],
        detail: 'No Cloud SQL primary instances found (check not applicable)',
      });
    } else {
      findings.push({
        check: CHECKS[1],
        status: noBackupInstances.length === 0 ? 'PASS' : 'FAIL',
        resources: noBackupInstances,
        detail: noBackupInstances.length === 0
          ? `All ${primaryInstances.length} Cloud SQL instances have backups enabled`
          : `${noBackupInstances.length} of ${primaryInstances.length} Cloud SQL ${noBackupInstances.length === 1 ? 'instance does' : 'instances do'} not have backups enabled`,
      });
    }
  } catch (error) {
    findings.push({
      check: CHECKS[1],
      status: 'ERROR',
      resources: [],
      detail: `Failed to check Cloud SQL backups: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }

  // GCP-REL-003: Check GKE clusters are regional
  try {
    const container = google.container({ version: 'v1', auth });
    const clustersResponse = await container.projects.locations.clusters.list({
      parent: `projects/${projectId}/locations/-`,
    });
    const clusters = clustersResponse.data.clusters || [];
    const zonalClusters: string[] = [];

    for (const cluster of clusters) {
      // A zonal cluster has a location like 'us-central1-a' (with zone suffix)
      // A regional cluster has a location like 'us-central1'
      const location = cluster.location || '';
      const isZonal = /^[a-z]+-[a-z]+\d+-[a-z]$/.test(location);
      if (isZonal) {
        zonalClusters.push(cluster.name || '');
      }
    }

    if (clusters.length === 0) {
      findings.push({
        check: CHECKS[2],
        status: 'PASS',
        resources: [],
        detail: 'No GKE clusters found (check not applicable)',
      });
    } else {
      findings.push({
        check: CHECKS[2],
        status: zonalClusters.length === 0 ? 'PASS' : 'FAIL',
        resources: zonalClusters,
        detail: zonalClusters.length === 0
          ? `All ${clusters.length} GKE clusters are regional`
          : `${zonalClusters.length} of ${clusters.length} GKE ${zonalClusters.length === 1 ? 'cluster is' : 'clusters are'} zonal (not regional)`,
      });
    }
  } catch (error) {
    findings.push({
      check: CHECKS[2],
      status: 'ERROR',
      resources: [],
      detail: `Failed to check GKE clusters: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }

  // GCP-REL-004: Check instance groups span multiple zones
  try {
    const compute = google.compute({ version: 'v1', auth });
    // Check for single-zone managed instance groups
    const zonesResponse = await compute.zones.list({ project: projectId });
    const zones = zonesResponse.data.items || [];
    const singleZoneGroups: string[] = [];
    let totalMigs = 0;

    for (const zone of zones) {
      if (!zone.name) continue;
      try {
        const igsResponse = await compute.instanceGroupManagers.list({
          project: projectId,
          zone: zone.name,
        });
        const managers = igsResponse.data.items || [];
        for (const manager of managers) {
          totalMigs++;
          singleZoneGroups.push(`${manager.name} (${zone.name})`);
        }
      } catch {
        // Skip zones we cannot access
      }
    }

    // Also check for regional (multi-zone) instance groups
    let regionalMigCount = 0;
    try {
      const regionsResponse = await compute.regions.list({ project: projectId });
      const regions = regionsResponse.data.items || [];
      for (const region of regions) {
        if (!region.name) continue;
        try {
          const rigResponse = await compute.regionInstanceGroupManagers.list({
            project: projectId,
            region: region.name,
          });
          const managers = rigResponse.data.items || [];
          regionalMigCount += managers.length;
        } catch {
          // Skip regions we cannot access
        }
      }
    } catch {
      // Skip if regions listing fails
    }

    totalMigs += regionalMigCount;

    if (totalMigs === 0) {
      findings.push({
        check: CHECKS[3],
        status: 'PASS',
        resources: [],
        detail: 'No managed instance groups found (check not applicable)',
      });
    } else {
      findings.push({
        check: CHECKS[3],
        status: singleZoneGroups.length === 0 ? 'PASS' : 'FAIL',
        resources: singleZoneGroups,
        detail: singleZoneGroups.length === 0
          ? `All ${totalMigs} managed instance groups are multi-zone`
          : `${singleZoneGroups.length} of ${totalMigs} managed instance ${singleZoneGroups.length === 1 ? 'group is' : 'groups are'} single-zone`,
      });
    }
  } catch (error) {
    findings.push({
      check: CHECKS[3],
      status: 'ERROR',
      resources: [],
      detail: `Failed to check instance groups: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }

  // GCP-REL-005: Check load balancers have health checks
  try {
    const compute = google.compute({ version: 'v1', auth });
    const backendServicesResponse = await compute.backendServices.list({ project: projectId });
    const backendServices = backendServicesResponse.data.items || [];
    const noHealthCheckServices: string[] = [];

    for (const service of backendServices) {
      const healthChecks = service.healthChecks || [];
      if (healthChecks.length === 0) {
        noHealthCheckServices.push(service.name || '');
      }
    }

    // Also check regional backend services
    try {
      const regionsResponse = await compute.regions.list({ project: projectId });
      const regions = regionsResponse.data.items || [];
      for (const region of regions) {
        if (!region.name) continue;
        try {
          const regionalBsResponse = await compute.regionBackendServices.list({
            project: projectId,
            region: region.name,
          });
          const regionalServices = regionalBsResponse.data.items || [];
          for (const service of regionalServices) {
            const healthChecks = service.healthChecks || [];
            if (healthChecks.length === 0) {
              noHealthCheckServices.push(`${service.name} (${region.name})`);
            }
          }
          backendServices.push(...regionalServices);
        } catch {
          // Skip regions we cannot access
        }
      }
    } catch {
      // Skip if regions listing fails
    }

    if (backendServices.length === 0) {
      findings.push({
        check: CHECKS[4],
        status: 'PASS',
        resources: [],
        detail: 'No backend services found (check not applicable)',
      });
    } else {
      findings.push({
        check: CHECKS[4],
        status: noHealthCheckServices.length === 0 ? 'PASS' : 'FAIL',
        resources: noHealthCheckServices,
        detail: noHealthCheckServices.length === 0
          ? `All ${backendServices.length} backend services have health checks`
          : `${noHealthCheckServices.length} backend ${noHealthCheckServices.length === 1 ? 'service lacks' : 'services lack'} health checks`,
      });
    }
  } catch (error) {
    findings.push({
      check: CHECKS[4],
      status: 'ERROR',
      resources: [],
      detail: `Failed to check backend services: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }

  return buildSummary('reliability', 'Reliability', findings);
}

function buildSummary(pillar: GCPWAPillarId, pillarName: string, findings: GCPWAFinding[]): GCPWAPillarSummary {
  return {
    pillar,
    pillarName,
    totalChecks: findings.length,
    passCount: findings.filter((f) => f.status === 'PASS').length,
    failCount: findings.filter((f) => f.status === 'FAIL').length,
    errorCount: findings.filter((f) => f.status === 'ERROR').length,
    findings,
  };
}

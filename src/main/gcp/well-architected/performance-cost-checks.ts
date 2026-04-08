// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';
import { GCPWAFinding, GCPWAPillarSummary, GCPWACheckDefinition, GCPWAPillarId } from './types';

const CHECKS: GCPWACheckDefinition[] = [
  {
    id: 'GCP-PERF-001',
    title: 'Recommender has machine type rightsizing recommendations',
    description: 'The Recommender API may have VM rightsizing recommendations indicating over- or under-provisioned instances.',
    pillar: 'performance_cost',
    severity: 'MEDIUM',
    service: 'Recommender',
    remediationRecommendation: 'Review and apply VM rightsizing recommendations from the Recommender API to optimize cost and performance.',
  },
  {
    id: 'GCP-PERF-002',
    title: 'Cloud CDN enabled on backend services',
    description: 'Backend services serving static or cacheable content should have Cloud CDN enabled to reduce latency and costs.',
    pillar: 'performance_cost',
    severity: 'LOW',
    service: 'Cloud CDN',
    remediationRecommendation: 'Enable Cloud CDN on backend services that serve cacheable content to improve performance and reduce origin load.',
  },
  {
    id: 'GCP-PERF-003',
    title: 'Autoscaling enabled on instance groups',
    description: 'Managed instance groups should have autoscaling configured to dynamically adjust capacity based on demand.',
    pillar: 'performance_cost',
    severity: 'MEDIUM',
    service: 'Compute Engine',
    remediationRecommendation: 'Enable autoscaling on managed instance groups with appropriate min/max instance counts and scaling policies.',
  },
];

export async function runPerformanceCostChecks(projectId: string): Promise<GCPWAPillarSummary> {
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  const findings: GCPWAFinding[] = [];

  // GCP-PERF-001: Check Recommender for VM rightsizing recommendations
  try {
    const recommender = google.recommender({ version: 'v1', auth });
    // List zones to check for recommendations in each zone
    const compute = google.compute({ version: 'v1', auth });
    const zonesResponse = await compute.zones.list({ project: projectId });
    const zones = zonesResponse.data.items || [];
    const recommendations: string[] = [];

    for (const zone of zones) {
      if (!zone.name) continue;
      try {
        const recsResponse = await recommender.projects.locations.recommenders.recommendations.list({
          parent: `projects/${projectId}/locations/${zone.name}/recommenders/google.compute.instance.MachineTypeRecommender`,
        });
        const recs = recsResponse.data.recommendations || [];
        for (const rec of recs) {
          const description = rec.description || rec.name || '';
          recommendations.push(description);
        }
      } catch {
        // Zone may not have recommendations or API not enabled, skip
      }
    }

    findings.push({
      check: CHECKS[0],
      status: recommendations.length === 0 ? 'PASS' : 'FAIL',
      resources: recommendations.slice(0, 20), // Limit to 20 for readability
      detail: recommendations.length === 0
        ? 'No VM rightsizing recommendations found (instances appear well-sized)'
        : `${recommendations.length} VM rightsizing ${recommendations.length === 1 ? 'recommendation' : 'recommendations'} found`,
    });
  } catch (error) {
    findings.push({
      check: CHECKS[0],
      status: 'ERROR',
      resources: [],
      detail: `Failed to check Recommender: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }

  // GCP-PERF-002: Check Cloud CDN on backend services
  try {
    const compute = google.compute({ version: 'v1', auth });
    const backendServicesResponse = await compute.backendServices.list({ project: projectId });
    const backendServices = backendServicesResponse.data.items || [];
    const noCdnServices: string[] = [];

    for (const service of backendServices) {
      if (!service.enableCDN) {
        noCdnServices.push(service.name || '');
      }
    }

    if (backendServices.length === 0) {
      findings.push({
        check: CHECKS[1],
        status: 'PASS',
        resources: [],
        detail: 'No backend services found (check not applicable)',
      });
    } else {
      findings.push({
        check: CHECKS[1],
        status: noCdnServices.length === 0 ? 'PASS' : 'FAIL',
        resources: noCdnServices,
        detail: noCdnServices.length === 0
          ? `All ${backendServices.length} backend services have Cloud CDN enabled`
          : `${noCdnServices.length} of ${backendServices.length} backend ${noCdnServices.length === 1 ? 'service does' : 'services do'} not have Cloud CDN enabled`,
      });
    }
  } catch (error) {
    findings.push({
      check: CHECKS[1],
      status: 'ERROR',
      resources: [],
      detail: `Failed to check backend services: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }

  // GCP-PERF-003: Check autoscaling on managed instance groups
  try {
    const compute = google.compute({ version: 'v1', auth });
    const zonesResponse = await compute.zones.list({ project: projectId });
    const zones = zonesResponse.data.items || [];
    const noAutoscaleGroups: string[] = [];
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
          // Check if autoscaler exists for this MIG
          try {
            const autoscalersResponse = await compute.autoscalers.list({
              project: projectId,
              zone: zone.name,
              filter: `target eq .*${manager.name}`,
            });
            const autoscalers = autoscalersResponse.data.items || [];
            if (autoscalers.length === 0) {
              noAutoscaleGroups.push(`${manager.name} (${zone.name})`);
            }
          } catch {
            // Cannot check autoscalers for this zone
          }
        }
      } catch {
        // Skip zones we cannot access
      }
    }

    // Also check regional MIGs
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
          for (const manager of managers) {
            totalMigs++;
            try {
              const autoscalersResponse = await compute.regionAutoscalers.list({
                project: projectId,
                region: region.name,
                filter: `target eq .*${manager.name}`,
              });
              const autoscalers = autoscalersResponse.data.items || [];
              if (autoscalers.length === 0) {
                noAutoscaleGroups.push(`${manager.name} (${region.name})`);
              }
            } catch {
              // Cannot check autoscalers for this region
            }
          }
        } catch {
          // Skip regions we cannot access
        }
      }
    } catch {
      // Skip if regions listing fails
    }

    if (totalMigs === 0) {
      findings.push({
        check: CHECKS[2],
        status: 'PASS',
        resources: [],
        detail: 'No managed instance groups found (check not applicable)',
      });
    } else {
      findings.push({
        check: CHECKS[2],
        status: noAutoscaleGroups.length === 0 ? 'PASS' : 'FAIL',
        resources: noAutoscaleGroups,
        detail: noAutoscaleGroups.length === 0
          ? `All ${totalMigs} managed instance groups have autoscaling enabled`
          : `${noAutoscaleGroups.length} of ${totalMigs} managed instance ${noAutoscaleGroups.length === 1 ? 'group does' : 'groups do'} not have autoscaling`,
      });
    }
  } catch (error) {
    findings.push({
      check: CHECKS[2],
      status: 'ERROR',
      resources: [],
      detail: `Failed to check instance group autoscaling: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }

  return buildSummary('performance_cost', 'Performance & Cost Optimization', findings);
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

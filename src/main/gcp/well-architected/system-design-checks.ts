// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';
import { GCPWAFinding, GCPWAPillarSummary, GCPWACheckDefinition, GCPWAPillarId } from './types';

const CHECKS: GCPWACheckDefinition[] = [
  {
    id: 'GCP-SYS-001',
    title: 'Using managed services',
    description: 'The project should leverage managed services (Cloud SQL, GKE, Cloud Run) rather than self-managed infrastructure to reduce operational burden.',
    pillar: 'system_design',
    severity: 'LOW',
    service: 'Multiple',
    remediationRecommendation: 'Evaluate adopting managed services such as Cloud SQL, GKE, Cloud Run, or App Engine to reduce operational complexity.',
  },
  {
    id: 'GCP-SYS-002',
    title: 'Asynchronous processing configured',
    description: 'The project should use Pub/Sub or Cloud Tasks for asynchronous and decoupled processing patterns.',
    pillar: 'system_design',
    severity: 'LOW',
    service: 'Pub/Sub',
    remediationRecommendation: 'Use Cloud Pub/Sub for event-driven architectures or Cloud Tasks for reliable task execution to decouple system components.',
  },
  {
    id: 'GCP-SYS-003',
    title: 'VPC networks use custom mode',
    description: 'VPC networks should use custom subnet mode instead of auto mode for better control over IP address ranges and network design.',
    pillar: 'system_design',
    severity: 'MEDIUM',
    service: 'VPC',
    remediationRecommendation: 'Create custom mode VPC networks with explicitly defined subnets. Migrate away from auto mode VPCs for production workloads.',
  },
];

export async function runSystemDesignChecks(projectId: string): Promise<GCPWAPillarSummary> {
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  const findings: GCPWAFinding[] = [];

  // GCP-SYS-001: Check for usage of managed services
  try {
    const managedServices: string[] = [];

    // Check for Cloud SQL
    try {
      const sqladmin = google.sqladmin({ version: 'v1beta4', auth });
      const sqlResponse = await sqladmin.instances.list({ project: projectId });
      const sqlInstances = sqlResponse.data.items || [];
      if (sqlInstances.length > 0) {
        managedServices.push(`Cloud SQL (${sqlInstances.length} ${sqlInstances.length === 1 ? 'instance' : 'instances'})`);
      }
    } catch {
      // Cloud SQL API may not be enabled
    }

    // Check for GKE
    try {
      const container = google.container({ version: 'v1', auth });
      const gkeResponse = await container.projects.locations.clusters.list({
        parent: `projects/${projectId}/locations/-`,
      });
      const clusters = gkeResponse.data.clusters || [];
      if (clusters.length > 0) {
        managedServices.push(`GKE (${clusters.length} ${clusters.length === 1 ? 'cluster' : 'clusters'})`);
      }
    } catch {
      // GKE API may not be enabled
    }

    // Check for Cloud Run
    try {
      const run = google.run({ version: 'v2', auth });
      const runResponse = await run.projects.locations.services.list({
        parent: `projects/${projectId}/locations/-`,
      });
      const services = runResponse.data.services || [];
      if (services.length > 0) {
        managedServices.push(`Cloud Run (${services.length} ${services.length === 1 ? 'service' : 'services'})`);
      }
    } catch {
      // Cloud Run API may not be enabled
    }

    // Check for App Engine
    try {
      const appengine = google.appengine({ version: 'v1', auth });
      const appResponse = await appengine.apps.get({ appsId: projectId });
      if (appResponse.data.id) {
        managedServices.push('App Engine');
      }
    } catch {
      // App Engine may not be configured
    }

    findings.push({
      check: CHECKS[0],
      status: managedServices.length > 0 ? 'PASS' : 'FAIL',
      resources: managedServices,
      detail: managedServices.length > 0
        ? `Using ${managedServices.length} managed ${managedServices.length === 1 ? 'service' : 'services'}: ${managedServices.join(', ')}`
        : 'No managed services detected (Cloud SQL, GKE, Cloud Run, App Engine). Consider adopting managed services.',
    });
  } catch (error) {
    findings.push({
      check: CHECKS[0],
      status: 'ERROR',
      resources: [],
      detail: `Failed to check managed services: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }

  // GCP-SYS-002: Check for Pub/Sub or Cloud Tasks usage
  try {
    const asyncServices: string[] = [];

    // Check for Pub/Sub topics
    try {
      const pubsub = google.pubsub({ version: 'v1', auth });
      const topicsResponse = await pubsub.projects.topics.list({
        project: `projects/${projectId}`,
      });
      const topics = topicsResponse.data.topics || [];
      // Filter out system topics
      const userTopics = topics.filter((t) => !t.name?.includes('gcf-') && !t.name?.includes('dead-letter'));
      if (userTopics.length > 0) {
        asyncServices.push(`Pub/Sub (${userTopics.length} ${userTopics.length === 1 ? 'topic' : 'topics'})`);
      }
    } catch {
      // Pub/Sub API may not be enabled
    }

    // Check for Cloud Tasks queues
    try {
      const cloudtasks = google.cloudtasks({ version: 'v2', auth });
      // List locations first, then queues per location
      const compute = google.compute({ version: 'v1', auth });
      const regionsResponse = await compute.regions.list({ project: projectId });
      const regions = regionsResponse.data.items || [];
      let totalQueues = 0;

      for (const region of regions) {
        if (!region.name) continue;
        try {
          const queuesResponse = await cloudtasks.projects.locations.queues.list({
            parent: `projects/${projectId}/locations/${region.name}`,
          });
          const queues = queuesResponse.data.queues || [];
          totalQueues += queues.length;
        } catch {
          // Location may not support Cloud Tasks
        }
      }

      if (totalQueues > 0) {
        asyncServices.push(`Cloud Tasks (${totalQueues} ${totalQueues === 1 ? 'queue' : 'queues'})`);
      }
    } catch {
      // Cloud Tasks API may not be enabled
    }

    findings.push({
      check: CHECKS[1],
      status: asyncServices.length > 0 ? 'PASS' : 'FAIL',
      resources: asyncServices,
      detail: asyncServices.length > 0
        ? `Using asynchronous processing: ${asyncServices.join(', ')}`
        : 'No Pub/Sub topics or Cloud Tasks queues found. Consider using asynchronous processing for decoupled architectures.',
    });
  } catch (error) {
    findings.push({
      check: CHECKS[1],
      status: 'ERROR',
      resources: [],
      detail: `Failed to check async processing services: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }

  // GCP-SYS-003: Check VPC networks use custom mode
  try {
    const compute = google.compute({ version: 'v1', auth });
    const networksResponse = await compute.networks.list({ project: projectId });
    const networks = networksResponse.data.items || [];
    const autoModeNetworks: string[] = [];

    for (const network of networks) {
      if (network.autoCreateSubnetworks) {
        autoModeNetworks.push(network.name || '');
      }
    }

    if (networks.length === 0) {
      findings.push({
        check: CHECKS[2],
        status: 'PASS',
        resources: [],
        detail: 'No VPC networks found (check not applicable)',
      });
    } else {
      findings.push({
        check: CHECKS[2],
        status: autoModeNetworks.length === 0 ? 'PASS' : 'FAIL',
        resources: autoModeNetworks,
        detail: autoModeNetworks.length === 0
          ? `All ${networks.length} VPC networks use custom subnet mode`
          : `${autoModeNetworks.length} of ${networks.length} VPC ${autoModeNetworks.length === 1 ? 'network uses' : 'networks use'} auto mode (not custom)`,
      });
    }
  } catch (error) {
    findings.push({
      check: CHECKS[2],
      status: 'ERROR',
      resources: [],
      detail: `Failed to check VPC networks: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }

  return buildSummary('system_design', 'System Design', findings);
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

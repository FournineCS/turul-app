// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';
import { GCPWAFinding, GCPWAPillarSummary, GCPWACheckDefinition, GCPWAPillarId } from './types';

const CHECKS: GCPWACheckDefinition[] = [
  {
    id: 'GCP-OPS-001',
    title: 'Monitoring alerting policies configured',
    description: 'At least one alert policy should be configured to detect and respond to operational issues.',
    pillar: 'ops_excellence',
    severity: 'HIGH',
    service: 'Monitoring',
    remediationRecommendation: 'Create alerting policies for key metrics such as CPU utilization, memory usage, error rates, and latency in Cloud Monitoring.',
  },
  {
    id: 'GCP-OPS-002',
    title: 'Log sinks configured for export',
    description: 'Logs should be exported to a sink for long-term retention and analysis beyond the default retention period.',
    pillar: 'ops_excellence',
    severity: 'MEDIUM',
    service: 'Logging',
    remediationRecommendation: 'Create log sinks to export logs to Cloud Storage, BigQuery, or Pub/Sub for long-term retention and analysis.',
  },
  {
    id: 'GCP-OPS-003',
    title: 'Uptime checks configured',
    description: 'At least one uptime check should monitor service availability from external locations.',
    pillar: 'ops_excellence',
    severity: 'MEDIUM',
    service: 'Monitoring',
    remediationRecommendation: 'Create uptime checks in Cloud Monitoring for your public-facing services and endpoints.',
  },
];

export async function runOpsExcellenceChecks(projectId: string): Promise<GCPWAPillarSummary> {
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  const monitoring = google.monitoring({ version: 'v3', auth });
  const logging = google.logging({ version: 'v2', auth });
  const findings: GCPWAFinding[] = [];

  // GCP-OPS-001: Check alert policies
  try {
    const alertResponse = await monitoring.projects.alertPolicies.list({
      name: `projects/${projectId}`,
    });
    const policies = alertResponse.data.alertPolicies || [];
    findings.push({
      check: CHECKS[0],
      status: policies.length > 0 ? 'PASS' : 'FAIL',
      resources: policies.map((p) => p.displayName || p.name || ''),
      detail: policies.length > 0
        ? `${policies.length} alert ${policies.length === 1 ? 'policy' : 'policies'} configured`
        : 'No alert policies found',
    });
  } catch (error) {
    findings.push({
      check: CHECKS[0],
      status: 'ERROR',
      resources: [],
      detail: `Failed to check alert policies: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }

  // GCP-OPS-002: Check log sinks
  try {
    const sinksResponse = await logging.projects.sinks.list({
      parent: `projects/${projectId}`,
    });
    const sinks = sinksResponse.data.sinks || [];
    const nonDefaultSinks = sinks.filter((s) => !s.name?.startsWith('_'));
    findings.push({
      check: CHECKS[1],
      status: nonDefaultSinks.length > 0 ? 'PASS' : 'FAIL',
      resources: nonDefaultSinks.map((s) => s.name || ''),
      detail: nonDefaultSinks.length > 0
        ? `${nonDefaultSinks.length} custom log ${nonDefaultSinks.length === 1 ? 'sink' : 'sinks'} configured`
        : 'No custom log sinks configured',
    });
  } catch (error) {
    findings.push({
      check: CHECKS[1],
      status: 'ERROR',
      resources: [],
      detail: `Failed to check log sinks: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }

  // GCP-OPS-003: Check uptime checks
  try {
    const uptimeResponse = await monitoring.projects.uptimeCheckConfigs.list({
      parent: `projects/${projectId}`,
    });
    const uptimeChecks = uptimeResponse.data.uptimeCheckConfigs || [];
    findings.push({
      check: CHECKS[2],
      status: uptimeChecks.length > 0 ? 'PASS' : 'FAIL',
      resources: uptimeChecks.map((c) => c.displayName || c.name || ''),
      detail: uptimeChecks.length > 0
        ? `${uptimeChecks.length} uptime ${uptimeChecks.length === 1 ? 'check' : 'checks'} configured`
        : 'No uptime checks configured',
    });
  } catch (error) {
    findings.push({
      check: CHECKS[2],
      status: 'ERROR',
      resources: [],
      detail: `Failed to check uptime configs: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }

  return buildSummary('ops_excellence', 'Operational Excellence', findings);
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

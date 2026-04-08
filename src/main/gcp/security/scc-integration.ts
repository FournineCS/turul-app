// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import crypto from 'crypto';
import { SecurityCenterClient } from '@google-cloud/security-center';
import type {
  SecurityAnalysisResult,
  SecurityFinding,
  SecurityPostureSummary,
  FindingSeverity,
  FindingSource,
  FindingStatus,
} from '../../../shared/types';

/**
 * Fetch security findings from Google Cloud Security Command Center.
 * Requires the Security Command Center API to be enabled and
 * appropriate IAM permissions (securitycenter.findings.list).
 */
export async function getGCPSecurityPosture(
  projectId: string,
  includeResolved: boolean = false
): Promise<SecurityAnalysisResult> {
  const startTime = Date.now();
  const client = new SecurityCenterClient();

  const findings: SecurityFinding[] = [];
  let count = 0;
  const maxFindings = 1000;

  try {
    const filter = includeResolved ? '' : 'state="ACTIVE"';
    const parent = `projects/${projectId}/sources/-`;

    const request = {
      parent,
      filter,
      pageSize: 100,
    };

    const iterable = client.listFindingsAsync(request);

    for await (const response of iterable) {
      if (count >= maxFindings) break;

      const finding = response.finding;
      if (!finding) continue;

      findings.push({
        id: finding.name || `scc-${count}`,
        title: (finding.category as string) || 'Security Finding',
        description: (finding.description as string) || (finding.category as string) || '',
        severity: mapSCCSeverity(finding.severity as number),
        status: mapSCCState(finding.state as number),
        source: 'SECURITY_HUB' as FindingSource, // Map SCC to our generic source
        region: extractRegionFromResource(finding.resourceName as string),
        resourceType: (finding.resourceName as string)?.split('/').slice(-2, -1)[0] || undefined,
        resourceId: finding.resourceName as string || undefined,
        resourceArn: finding.resourceName as string || undefined,
        remediationRecommendation: (finding.nextSteps as string) || undefined,
        firstObservedAt: finding.createTime
          ? new Date((finding.createTime as { seconds: number }).seconds * 1000).toISOString()
          : undefined,
        lastObservedAt: finding.eventTime
          ? new Date((finding.eventTime as { seconds: number }).seconds * 1000).toISOString()
          : undefined,
        generatorId: finding.category as string || undefined,
        productName: 'Security Command Center',
      });

      count++;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    // If SCC is not enabled or no org-level access, return empty result
    if (
      message.includes('not enabled') ||
      message.includes('PERMISSION_DENIED') ||
      message.includes('NOT_FOUND')
    ) {
      return {
        id: crypto.randomUUID(),
        projectId,
        scanMode: 'security_hub',
        timestamp: new Date().toISOString(),
        duration: Date.now() - startTime,
        summary: createEmptySummary(),
        findings: [],
        enabledStandards: [],
        error: `Security Command Center is not available: ${message}`,
      };
    }
    throw error;
  }

  const summary = buildSummary(findings);

  return {
    id: crypto.randomUUID(),
    projectId,
    scanMode: 'security_hub',
    timestamp: new Date().toISOString(),
    duration: Date.now() - startTime,
    summary,
    findings,
    enabledStandards: [],
  };
}

function mapSCCSeverity(severity: number): FindingSeverity {
  // SCC severity enum: 0=UNSPECIFIED, 1=CRITICAL, 2=HIGH, 3=MEDIUM, 4=LOW
  switch (severity) {
    case 1: return 'CRITICAL';
    case 2: return 'HIGH';
    case 3: return 'MEDIUM';
    case 4: return 'LOW';
    default: return 'INFORMATIONAL';
  }
}

function mapSCCState(state: number): FindingStatus {
  // SCC state enum: 0=UNSPECIFIED, 1=ACTIVE, 2=INACTIVE
  switch (state) {
    case 1: return 'ACTIVE';
    case 2: return 'RESOLVED';
    default: return 'ACTIVE';
  }
}

function extractRegionFromResource(resourceName: string | undefined): string {
  if (!resourceName) return 'global';
  const regionMatch = resourceName.match(/\/locations\/([^/]+)/);
  if (regionMatch) return regionMatch[1];
  const zoneMatch = resourceName.match(/\/zones\/([^/]+)/);
  if (zoneMatch) {
    const parts = zoneMatch[1].split('-');
    return parts.slice(0, -1).join('-');
  }
  return 'global';
}

function buildSummary(findings: SecurityFinding[]): SecurityPostureSummary {
  const summary: SecurityPostureSummary = {
    totalFindings: findings.length,
    criticalCount: 0,
    highCount: 0,
    mediumCount: 0,
    lowCount: 0,
    informationalCount: 0,
    bySource: {} as Record<FindingSource, number>,
    complianceScores: [],
    lastRefreshed: new Date().toISOString(),
  };

  for (const finding of findings) {
    switch (finding.severity) {
      case 'CRITICAL': summary.criticalCount++; break;
      case 'HIGH': summary.highCount++; break;
      case 'MEDIUM': summary.mediumCount++; break;
      case 'LOW': summary.lowCount++; break;
      case 'INFORMATIONAL': summary.informationalCount++; break;
    }
    const source = finding.source as FindingSource;
    summary.bySource[source] = (summary.bySource[source] || 0) + 1;
  }

  return summary;
}

function createEmptySummary(): SecurityPostureSummary {
  return {
    totalFindings: 0,
    criticalCount: 0,
    highCount: 0,
    mediumCount: 0,
    lowCount: 0,
    informationalCount: 0,
    bySource: {} as Record<FindingSource, number>,
    complianceScores: [],
    lastRefreshed: new Date().toISOString(),
  };
}

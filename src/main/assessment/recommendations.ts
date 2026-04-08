// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import type {
  AssessmentRecommendation,
  CostOptimizationResult,
  SecurityAnalysisResult,
  WABPScanResult,
} from '../../shared/types';

let recCounter = 0;

function nextId(prefix: string): string {
  return `${prefix}-${++recCounter}`;
}

export function resetRecommendationCounter(): void {
  recCounter = 0;
}

function costRecTitle(rec: CostOptimizationResult['recommendations'][0]): string {
  const svc = rec.service;
  const resType = rec.resourceType || 'resource';
  switch (rec.type) {
    case 'reserved_instance':
      return `Consider Reserved Instances for ${svc}`;
    case 'savings_plan':
      return `Evaluate Savings Plans for ${svc}`;
    case 'idle_resource':
      return `${resType} is idle — ${svc}`;
    case 'orphaned_resource':
      return `Orphaned ${resType} — ${svc}`;
    case 'cost_anomaly':
      return `Cost anomaly detected — ${svc}`;
    case 'rightsizing':
      return `Right-size ${resType} — ${svc}`;
    case 'unused_resource':
      return `Unused ${resType} — ${svc}`;
    case 'underutilized':
      return `Review underutilized ${svc}`;
    default:
      return `${svc} — Cost optimization`;
  }
}

export function extractCostRecommendations(
  optimizations: CostOptimizationResult | undefined
): AssessmentRecommendation[] {
  if (!optimizations?.recommendations) return [];

  return optimizations.recommendations.map((rec) => ({
    id: nextId('cost'),
    domain: 'cost' as const,
    severity: rec.severity === 'high' ? 'high' : rec.severity === 'medium' ? 'medium' : 'low',
    title: costRecTitle(rec),
    description: rec.description,
    impact: `Estimated monthly savings: $${rec.estimatedMonthlySavings.toFixed(2)}`,
    remediation: rec.actionRequired,
    estimatedSavings: rec.estimatedMonthlySavings,
    resourceId: rec.resourceId,
  }));
}

export function extractSecurityRecommendations(
  securityData: SecurityAnalysisResult | undefined
): AssessmentRecommendation[] {
  if (!securityData?.findings) return [];

  // Group findings by title to avoid duplication, keep the highest severity
  const grouped = new Map<string, typeof securityData.findings[0]>();
  for (const finding of securityData.findings) {
    if (finding.status !== 'ACTIVE') continue;
    const existing = grouped.get(finding.title);
    if (!existing || severityRank(finding.severity) > severityRank(existing.severity)) {
      grouped.set(finding.title, finding);
    }
  }

  return Array.from(grouped.values())
    .sort((a, b) => severityRank(b.severity) - severityRank(a.severity))
    .slice(0, 50) // Cap at 50 unique recommendations
    .map((finding) => ({
      id: nextId('sec'),
      domain: 'security' as const,
      severity: mapFindingSeverity(finding.severity),
      title: finding.title,
      description: finding.description,
      remediation: finding.remediationRecommendation,
      resourceId: finding.resourceId,
    }));
}

export function extractWARecommendations(
  waData: WABPScanResult | undefined
): AssessmentRecommendation[] {
  if (!waData?.pillarSummaries) return [];

  const recs: AssessmentRecommendation[] = [];

  for (const pillar of waData.pillarSummaries) {
    const failedFindings = pillar.findings.filter(f => f.status === 'FAIL');
    for (const finding of failedFindings) {
      recs.push({
        id: nextId('wa'),
        domain: 'wellArchitected' as const,
        severity: mapFindingSeverity(finding.severity),
        title: `[${pillar.pillarName}] ${finding.title}`,
        description: finding.description,
        remediation: finding.remediationRecommendation,
        resourceId: finding.resourceId,
      });
    }
  }

  return recs
    .sort((a, b) => severityOrder(a.severity) - severityOrder(b.severity))
    .slice(0, 50);
}

export function extractInventoryRecommendations(
  resourceSummary: { totalResources: number; byService: Record<string, number>; tagCoverage: number } | undefined
): AssessmentRecommendation[] {
  if (!resourceSummary) return [];

  const recs: AssessmentRecommendation[] = [];

  if (resourceSummary.tagCoverage < 50) {
    recs.push({
      id: nextId('inv'),
      domain: 'inventory' as const,
      severity: resourceSummary.tagCoverage < 20 ? 'high' : 'medium',
      title: 'Low tag coverage across resources',
      description: `Only ${resourceSummary.tagCoverage.toFixed(0)}% of resources have tags. Tags are essential for cost allocation, access control, and operational management.`,
      remediation: 'Implement a tagging strategy and use AWS Tag Editor or automation to apply tags consistently.',
    });
  }

  if (resourceSummary.totalResources === 0) {
    recs.push({
      id: nextId('inv'),
      domain: 'inventory' as const,
      severity: 'info',
      title: 'No resources discovered',
      description: 'The inventory scan found no resources. This may indicate the account is unused or the scan scope was too narrow.',
      remediation: 'Verify scan configuration or broaden the services to scan.',
    });
  }

  return recs;
}

function severityRank(severity: string): number {
  switch (severity) {
    case 'CRITICAL': return 5;
    case 'HIGH': return 4;
    case 'MEDIUM': return 3;
    case 'LOW': return 2;
    case 'INFORMATIONAL': return 1;
    default: return 0;
  }
}

function severityOrder(severity: string): number {
  switch (severity) {
    case 'critical': return 0;
    case 'high': return 1;
    case 'medium': return 2;
    case 'low': return 3;
    case 'info': return 4;
    default: return 5;
  }
}

function mapFindingSeverity(severity: string): AssessmentRecommendation['severity'] {
  switch (severity) {
    case 'CRITICAL': return 'critical';
    case 'HIGH': return 'high';
    case 'MEDIUM': return 'medium';
    case 'LOW': return 'low';
    default: return 'info';
  }
}

// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  GCPAssessmentDomain,
  GCPDomainScore,
  GCPAssessmentRecommendation,
} from './types';
import { runGCPBestPracticesScan } from '../security/best-practices';
import { getGCPSecurityPosture } from '../security/scc-integration';
import { runGCPIAMAnalysis } from '../iam-analysis';

const DOMAIN_WEIGHTS: Record<GCPAssessmentDomain, number> = {
  cost: 0.20,
  security: 0.30,
  reliability: 0.20,
  compliance: 0.15,
  iam: 0.15,
};

function grade(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

function clampScore(score: number): number {
  return Math.max(0, Math.min(100, score));
}

// ---------------------------------------------------------------------------
// Cost Domain
// ---------------------------------------------------------------------------

export async function scoreCostDomain(
  projectId: string,
  _bqProject?: string,
  _bqDataset?: string
): Promise<GCPDomainScore> {
  const recommendations: GCPAssessmentRecommendation[] = [];
  let score = 85; // Baseline – hard to assess without billing export

  // Try to get cost recommendations via Recommender API
  try {
    const { google } = await import('googleapis');
    const { GoogleAuth } = await import('google-auth-library');
    const auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
    const recommender = google.recommender({ version: 'v1', auth });

    const locations = ['us-central1', 'us-east1', 'us-west1', 'europe-west1'];
    for (const loc of locations) {
      try {
        const res = await recommender.projects.locations.recommenders.recommendations.list({
          parent: `projects/${projectId}/locations/${loc}/recommenders/google.compute.instance.MachineTypeRecommender`,
        });
        for (const rec of res.data.recommendations || []) {
          score -= 3;
          recommendations.push({
            id: `cost-${rec.name?.split('/').pop() || 'unknown'}`,
            domain: 'cost',
            severity: 'medium',
            title: rec.description || 'Rightsizing recommendation',
            description:
              rec.content?.overview?.toString() || 'Consider rightsizing this resource',
            remediation: 'Review and apply the recommendation in GCP Console',
            resourceId: rec.name || '',
          });
        }
      } catch {
        /* skip location */
      }
    }
  } catch {
    /* Recommender API not available */
  }

  score = clampScore(score);

  return {
    domain: 'cost',
    score,
    grade: grade(score),
    weight: DOMAIN_WEIGHTS.cost,
    findings: recommendations.length,
    recommendations,
    details: { checkedRecommenders: true },
  };
}

// ---------------------------------------------------------------------------
// Security Domain
// ---------------------------------------------------------------------------

export async function scoreSecurityDomain(projectId: string): Promise<GCPDomainScore> {
  const recommendations: GCPAssessmentRecommendation[] = [];
  let score = 100;

  // Run best practices scan
  const bpResult = await runGCPBestPracticesScan(projectId);

  for (const finding of bpResult.findings) {
    const severity = finding.severity;
    switch (severity) {
      case 'CRITICAL':
        score -= 15;
        break;
      case 'HIGH':
        score -= 8;
        break;
      case 'MEDIUM':
        score -= 3;
        break;
      case 'LOW':
        score -= 1;
        break;
    }

    recommendations.push({
      id: `sec-${finding.id}`,
      domain: 'security',
      severity: severity.toLowerCase() as GCPAssessmentRecommendation['severity'],
      title: finding.title,
      description: finding.description,
      remediation: finding.remediationRecommendation,
      resourceId: finding.resourceId,
    });
  }

  // Also check SCC if available
  try {
    const sccResult = await getGCPSecurityPosture(projectId);
    for (const finding of sccResult.findings) {
      switch (finding.severity) {
        case 'CRITICAL':
          score -= 10;
          break;
        case 'HIGH':
          score -= 5;
          break;
        case 'MEDIUM':
          score -= 2;
          break;
        case 'LOW':
          score -= 1;
          break;
      }
    }
  } catch {
    /* SCC not available */
  }

  score = clampScore(score);

  return {
    domain: 'security',
    score,
    grade: grade(score),
    weight: DOMAIN_WEIGHTS.security,
    findings: recommendations.length,
    recommendations,
    details: { bestPracticesFindings: bpResult.findings.length },
  };
}

// ---------------------------------------------------------------------------
// Reliability Domain
// ---------------------------------------------------------------------------

export async function scoreReliabilityDomain(projectId: string): Promise<GCPDomainScore> {
  const recommendations: GCPAssessmentRecommendation[] = [];
  let score = 100;

  const { google } = await import('googleapis');
  const { GoogleAuth } = await import('google-auth-library');
  const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });

  // Check Cloud SQL for HA and backups
  try {
    const sqladmin = google.sqladmin({ version: 'v1beta4', auth });
    const sqlResponse = await sqladmin.instances.list({ project: projectId });
    for (const instance of sqlResponse.data.items || []) {
      if (!instance.settings?.backupConfiguration?.enabled) {
        score -= 5;
        recommendations.push({
          id: `rel-sql-backup-${instance.name}`,
          domain: 'reliability',
          severity: 'high',
          title: `Cloud SQL instance "${instance.name}" has no backups`,
          description: 'Automated backups are not enabled',
          remediation: 'Enable automated backups in Cloud SQL settings',
          resourceId: instance.name || '',
        });
      }
      if (instance.settings?.availabilityType !== 'REGIONAL') {
        score -= 3;
        recommendations.push({
          id: `rel-sql-ha-${instance.name}`,
          domain: 'reliability',
          severity: 'medium',
          title: `Cloud SQL instance "${instance.name}" is not HA`,
          description: 'Instance is not configured for regional high availability',
          remediation: 'Enable High Availability (regional) for production databases',
          resourceId: instance.name || '',
        });
      }
    }
  } catch {
    /* SQL API not available */
  }

  // Check GKE for multi-zone
  try {
    const container = google.container({ version: 'v1', auth });
    const gkeResponse = await container.projects.locations.clusters.list({
      parent: `projects/${projectId}/locations/-`,
    });
    for (const cluster of gkeResponse.data.clusters || []) {
      if (!cluster.locations || cluster.locations.length < 2) {
        score -= 5;
        recommendations.push({
          id: `rel-gke-multizone-${cluster.name}`,
          domain: 'reliability',
          severity: 'medium',
          title: `GKE cluster "${cluster.name}" is single-zone`,
          description: 'Cluster nodes are in a single zone, reducing availability',
          remediation: 'Configure cluster for multi-zone or regional deployment',
          resourceId: cluster.name || '',
        });
      }
    }
  } catch {
    /* GKE API not available */
  }

  score = clampScore(score);

  return {
    domain: 'reliability',
    score,
    grade: grade(score),
    weight: DOMAIN_WEIGHTS.reliability,
    findings: recommendations.length,
    recommendations,
    details: {},
  };
}

// ---------------------------------------------------------------------------
// Compliance Domain
// ---------------------------------------------------------------------------

export async function scoreComplianceDomain(projectId: string): Promise<GCPDomainScore> {
  const recommendations: GCPAssessmentRecommendation[] = [];
  let score = 100;

  // Run best practices scan and map results against CIS GCP controls
  try {
    const { CIS_GCP_CONTROLS } = await import('../security/compliance/cis-gcp-controls');
    const bpResult = await runGCPBestPracticesScan(projectId);

    const findingIds = new Set(bpResult.findings.map((f) => f.id));

    let totalControls = 0;
    let passedControls = 0;

    for (const control of CIS_GCP_CONTROLS) {
      // Skip controls that have no automated check mappings
      if (control.checkIds.length === 0) continue;

      totalControls++;
      const failed = control.checkIds.some((checkId) =>
        Array.from(findingIds).some((fid) => fid.startsWith(checkId))
      );

      if (failed) {
        recommendations.push({
          id: `comp-${control.id}`,
          domain: 'compliance',
          severity: control.level === 1 ? 'high' : 'medium',
          title: `CIS ${control.id}: ${control.title}`,
          description: `Failed CIS GCP control in section "${control.section}"`,
          remediation: `Review and remediate CIS GCP Benchmark control ${control.id}`,
        });
      } else {
        passedControls++;
      }
    }

    if (totalControls > 0) {
      score = Math.round((passedControls / totalControls) * 100);
    }
  } catch {
    // Could not run compliance – use conservative default
    score = 75;
  }

  return {
    domain: 'compliance',
    score,
    grade: grade(score),
    weight: DOMAIN_WEIGHTS.compliance,
    findings: recommendations.length,
    recommendations,
    details: {},
  };
}

// ---------------------------------------------------------------------------
// IAM Domain
// ---------------------------------------------------------------------------

export async function scoreIAMDomain(projectId: string): Promise<GCPDomainScore> {
  const recommendations: GCPAssessmentRecommendation[] = [];
  let score = 100;

  try {
    const iamResult = await runGCPIAMAnalysis(projectId);

    // Unused service accounts
    for (const sa of iamResult.unusedServiceAccounts) {
      score -= 3;
      recommendations.push({
        id: `iam-unused-${sa.email}`,
        domain: 'iam',
        severity: sa.hasKeys ? 'high' : 'medium',
        title: `Unused service account: ${sa.email}`,
        description:
          sa.daysSinceLastActivity > 0
            ? `Not used in ${sa.daysSinceLastActivity} days`
            : 'Service account appears to be unused',
        remediation: 'Disable or delete unused service accounts',
        resourceId: sa.email,
      });
    }

    // Overly permissive bindings
    for (const binding of iamResult.overlyPermissiveBindings) {
      score -= binding.roleType === 'primitive' ? 8 : 4;
      recommendations.push({
        id: `iam-perm-${binding.member}-${binding.role}`,
        domain: 'iam',
        severity: binding.roleType === 'primitive' ? 'high' : 'medium',
        title: `Overly permissive: ${binding.member} has ${binding.role}`,
        description: binding.reason,
        remediation: 'Replace with least-privilege predefined or custom roles',
        resourceId: binding.member,
      });
    }

    // Service account key issues
    for (const key of iamResult.serviceAccountKeyIssues) {
      score -= key.severity === 'HIGH' ? 5 : 2;
      recommendations.push({
        id: `iam-key-${key.keyId}`,
        domain: 'iam',
        severity: key.severity.toLowerCase() as GCPAssessmentRecommendation['severity'],
        title: `SA key issue: ${key.serviceAccountEmail}`,
        description: key.issue,
        remediation: 'Rotate or delete old keys; prefer Workload Identity Federation',
        resourceId: key.serviceAccountEmail,
      });
    }

    // Cross-project bindings
    for (const cp of iamResult.crossProjectBindings) {
      score -= 2;
      recommendations.push({
        id: `iam-cross-${cp.member}`,
        domain: 'iam',
        severity: 'medium',
        title: `Cross-project binding: ${cp.member}`,
        description: `Service account from project ${cp.memberProjectId} has ${cp.role} in this project`,
        remediation: 'Review and document cross-project access; ensure it is intended',
        resourceId: cp.member,
      });
    }
  } catch {
    // IAM analysis failed – use conservative default
    score = 70;
  }

  score = clampScore(score);

  return {
    domain: 'iam',
    score,
    grade: grade(score),
    weight: DOMAIN_WEIGHTS.iam,
    findings: recommendations.length,
    recommendations,
    details: {},
  };
}

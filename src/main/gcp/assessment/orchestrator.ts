// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { v4 as uuidv4 } from 'uuid';
import {
  GCPAssessmentConfig,
  GCPAssessmentDomain,
  GCPAssessmentProgress,
  GCPAssessmentResult,
  GCPDomainScore,
} from './types';
import {
  scoreCostDomain,
  scoreSecurityDomain,
  scoreReliabilityDomain,
  scoreComplianceDomain,
  scoreIAMDomain,
} from './scoring';

const ALL_DOMAINS: GCPAssessmentDomain[] = ['cost', 'security', 'reliability', 'compliance', 'iam'];

export async function runGCPAssessment(
  config: GCPAssessmentConfig,
  onProgress?: (progress: GCPAssessmentProgress) => void
): Promise<GCPAssessmentResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const domainScores: GCPDomainScore[] = [];

  const domains = config.domains.length > 0 ? config.domains : ALL_DOMAINS;

  let completed = 0;
  const total = domains.length;

  const report = (msg: string) => {
    completed++;
    onProgress?.({
      stage: 'Analyzing',
      percent: Math.round((completed / total) * 90),
      message: msg,
    });
  };

  onProgress?.({ stage: 'Starting', percent: 0, message: 'Initializing GCP assessment...' });

  // Run all domain scorers in parallel
  const scorers = domains.map(async (domain) => {
    try {
      let score: GCPDomainScore;
      switch (domain) {
        case 'cost':
          score = await scoreCostDomain(config.projectId, config.bqProject, config.bqDataset);
          break;
        case 'security':
          score = await scoreSecurityDomain(config.projectId);
          break;
        case 'reliability':
          score = await scoreReliabilityDomain(config.projectId);
          break;
        case 'compliance':
          score = await scoreComplianceDomain(config.projectId);
          break;
        case 'iam':
          score = await scoreIAMDomain(config.projectId);
          break;
        default:
          return null;
      }
      report(`Completed ${domain} analysis`);
      return score;
    } catch (err) {
      errors.push(`${domain}: ${err instanceof Error ? err.message : String(err)}`);
      report(`Failed ${domain} analysis`);
      return null;
    }
  });

  const results = await Promise.allSettled(scorers);

  for (const r of results) {
    if (r.status === 'fulfilled' && r.value) {
      domainScores.push(r.value);
    }
  }

  // Calculate overall score (weighted)
  let overallScore = 0;
  let totalWeight = 0;
  for (const ds of domainScores) {
    overallScore += ds.score * ds.weight;
    totalWeight += ds.weight;
  }
  if (totalWeight > 0) overallScore = Math.round(overallScore / totalWeight);

  const overallGrade = scoreToGrade(overallScore);

  // Count recommendations by severity
  const allRecs = domainScores.flatMap((d) => d.recommendations);

  onProgress?.({ stage: 'Complete', percent: 100, message: 'Assessment complete' });

  return {
    id: uuidv4(),
    projectId: config.projectId,
    timestamp: new Date().toISOString(),
    overallScore,
    overallGrade,
    domainScores,
    totalRecommendations: allRecs.length,
    criticalCount: allRecs.filter((r) => r.severity === 'critical').length,
    highCount: allRecs.filter((r) => r.severity === 'high').length,
    mediumCount: allRecs.filter((r) => r.severity === 'medium').length,
    lowCount: allRecs.filter((r) => r.severity === 'low').length,
    duration: Date.now() - startTime,
    errors,
  };
}

function scoreToGrade(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

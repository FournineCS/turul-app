// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import type {
  DomainScore,
  AssessmentDomain,
  CostAnalysisResult,
  CostOptimizationResult,
  SecurityAnalysisResult,
  WABPScanResult,
  AssessmentRecommendation,
} from '../../shared/types';

const DOMAIN_WEIGHTS: Record<AssessmentDomain, number> = {
  cost: 0.25,
  security: 0.35,
  wellArchitected: 0.25,
  inventory: 0.15,
};

export function getGrade(score: number): string {
  if (score >= 90) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

export function getGradeColor(grade: string): string {
  switch (grade) {
    case 'A': return '#22c55e';
    case 'B': return '#84cc16';
    case 'C': return '#eab308';
    case 'D': return '#f97316';
    case 'F': return '#ef4444';
    default: return '#6b7280';
  }
}

export function computeOverallScore(
  domainScores: DomainScore[]
): { score: number; grade: string } {
  if (domainScores.length === 0) {
    return { score: 0, grade: 'F' };
  }

  // Re-normalize weights based on available domains
  const totalWeight = domainScores.reduce((sum, ds) => sum + ds.weight, 0);
  const weightedSum = domainScores.reduce(
    (sum, ds) => sum + ds.score * (ds.weight / totalWeight),
    0
  );

  const score = Math.round(weightedSum);
  return { score, grade: getGrade(score) };
}

export function scoreCostDomain(
  costData: CostAnalysisResult | undefined,
  optimizations: CostOptimizationResult | undefined,
  recommendations: AssessmentRecommendation[]
): DomainScore {
  let score = 100;

  if (!costData) {
    return {
      domain: 'cost',
      score: 50,
      grade: 'C',
      weight: DOMAIN_WEIGHTS.cost,
      findings: 0,
      recommendations,
      details: { error: 'Cost data unavailable' },
    };
  }

  // Penalize for worsening cost trend
  if (costData.percentChange > 0) {
    if (costData.percentChange > 100) score -= 30;
    else if (costData.percentChange > 50) score -= 20;
    else if (costData.percentChange > 20) score -= 10;
    else if (costData.percentChange > 5) score -= 5;
  } else {
    // Improving trend: small bonus
    score = Math.min(100, score + 5);
  }

  // Penalize for optimization recommendations
  if (optimizations?.recommendations) {
    const recCount = optimizations.recommendations.length;
    const highSeverity = optimizations.recommendations.filter(r => r.severity === 'high').length;
    score -= highSeverity * 8;
    score -= Math.min(recCount * 3, 20);

    // Penalize for high savings potential (indicates waste)
    if (optimizations.totalPotentialSavings > 0 && costData.totalCost > 0) {
      const savingsRatio = optimizations.totalPotentialSavings / costData.totalCost;
      if (savingsRatio > 0.3) score -= 15;
      else if (savingsRatio > 0.15) score -= 10;
      else if (savingsRatio > 0.05) score -= 5;
    }
  }

  score = Math.max(0, Math.min(100, score));

  return {
    domain: 'cost',
    score,
    grade: getGrade(score),
    weight: DOMAIN_WEIGHTS.cost,
    findings: optimizations?.recommendations.length || 0,
    recommendations,
    details: {
      totalCost: costData.totalCost,
      percentChange: costData.percentChange,
      totalPotentialSavings: optimizations?.totalPotentialSavings || 0,
      topServices: costData.byService.slice(0, 5).map(s => ({
        service: s.service,
        cost: s.cost,
        change: s.percentChange,
      })),
    },
  };
}

export function scoreSecurityDomain(
  securityData: SecurityAnalysisResult | undefined,
  recommendations: AssessmentRecommendation[]
): DomainScore {
  let score = 100;

  if (!securityData || securityData.error) {
    return {
      domain: 'security',
      score: 50,
      grade: 'C',
      weight: DOMAIN_WEIGHTS.security,
      findings: 0,
      recommendations,
      details: { error: securityData?.error || 'Security data unavailable' },
    };
  }

  const { summary } = securityData;

  // Penalize by finding severity
  score -= summary.criticalCount * 15;
  score -= summary.highCount * 8;
  score -= summary.mediumCount * 3;
  score -= summary.lowCount * 1;

  // Compliance score bonus/penalty
  if (summary.complianceScores.length > 0) {
    const avgCompliance = summary.complianceScores.reduce(
      (sum, cs) => sum + cs.score,
      0
    ) / summary.complianceScores.length;
    // Blend compliance into score
    score = Math.round(score * 0.6 + avgCompliance * 0.4);
  }

  score = Math.max(0, Math.min(100, score));

  return {
    domain: 'security',
    score,
    grade: getGrade(score),
    weight: DOMAIN_WEIGHTS.security,
    findings: summary.totalFindings,
    recommendations,
    details: {
      totalFindings: summary.totalFindings,
      criticalCount: summary.criticalCount,
      highCount: summary.highCount,
      mediumCount: summary.mediumCount,
      lowCount: summary.lowCount,
      complianceScores: summary.complianceScores,
    },
  };
}

export function scoreWellArchitectedDomain(
  waData: WABPScanResult | undefined,
  recommendations: AssessmentRecommendation[]
): DomainScore {
  let score = 100;

  if (!waData || waData.error) {
    return {
      domain: 'wellArchitected',
      score: 50,
      grade: 'C',
      weight: DOMAIN_WEIGHTS.wellArchitected,
      findings: 0,
      recommendations,
      details: { error: waData?.error || 'Well-Architected data unavailable' },
    };
  }

  // Compute pass rate
  const totalChecks = waData.totalChecks || 1;
  const passRate = waData.totalPass / totalChecks;

  // Base score from pass rate
  score = Math.round(passRate * 100);

  // Extra penalty for failures (beyond just the pass rate)
  const failRatio = waData.totalFail / totalChecks;
  if (failRatio > 0.5) score -= 15;
  else if (failRatio > 0.3) score -= 10;
  else if (failRatio > 0.15) score -= 5;

  score = Math.max(0, Math.min(100, score));

  const pillarDetails = waData.pillarSummaries.map(p => ({
    pillarId: p.pillarId,
    pillarName: p.pillarName,
    totalChecks: p.totalChecks,
    passCount: p.passCount,
    failCount: p.failCount,
    passRate: p.totalChecks > 0 ? p.passCount / p.totalChecks : 0,
  }));

  return {
    domain: 'wellArchitected',
    score,
    grade: getGrade(score),
    weight: DOMAIN_WEIGHTS.wellArchitected,
    findings: waData.totalFail,
    recommendations,
    details: {
      totalChecks: waData.totalChecks,
      totalPass: waData.totalPass,
      totalFail: waData.totalFail,
      passRate,
      pillarDetails,
    },
  };
}

export function scoreInventoryDomain(
  resourceSummary: { totalResources: number; byService: Record<string, number>; tagCoverage: number } | undefined,
  recommendations: AssessmentRecommendation[]
): DomainScore {
  let score = 100;

  if (!resourceSummary) {
    return {
      domain: 'inventory',
      score: 50,
      grade: 'C',
      weight: DOMAIN_WEIGHTS.inventory,
      findings: 0,
      recommendations,
      details: { error: 'Inventory data unavailable' },
    };
  }

  // Tag coverage is important for governance
  const tagCoverage = resourceSummary.tagCoverage;
  if (tagCoverage < 30) score -= 30;
  else if (tagCoverage < 50) score -= 20;
  else if (tagCoverage < 70) score -= 10;
  else if (tagCoverage < 90) score -= 5;

  // Resource diversity — having resources across many services is generally healthy
  const serviceCount = Object.keys(resourceSummary.byService).length;
  if (serviceCount === 0) score -= 20;

  score = Math.max(0, Math.min(100, score));

  return {
    domain: 'inventory',
    score,
    grade: getGrade(score),
    weight: DOMAIN_WEIGHTS.inventory,
    findings: recommendations.length,
    recommendations,
    details: {
      totalResources: resourceSummary.totalResources,
      serviceCount,
      tagCoverage,
      topServices: Object.entries(resourceSummary.byService)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([service, count]) => ({ service, count })),
    },
  };
}

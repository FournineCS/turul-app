// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import type {
  WABPScanResult,
  WABPPillarSummary,
  WABPFinding,
  WAPillarId,
} from '../../../../shared/types';
import { runOpsExcellenceChecks } from './ops-excellence-checks';
import { runSecurityChecks } from './security-checks';
import { runReliabilityChecks } from './reliability-checks';
import { runPerformanceChecks } from './performance-checks';
import { runCostChecks } from './cost-checks';
import { runSustainabilityChecks } from './sustainability-checks';
import type { WABPCheckResult, WABPProgressCallback } from './types';

export { type WABPCheckResult, type WABPProgressCallback } from './types';

const PILLAR_NAMES: Record<WAPillarId, string> = {
  operationalExcellence: 'Operational Excellence',
  security: 'Security',
  reliability: 'Reliability',
  performance: 'Performance Efficiency',
  costOptimization: 'Cost Optimization',
  sustainability: 'Sustainability',
};

interface PillarRunner {
  pillarId: WAPillarId;
  runner: (profile: string, region: string) => Promise<WABPCheckResult>;
}

const PILLAR_RUNNERS: PillarRunner[] = [
  { pillarId: 'operationalExcellence', runner: runOpsExcellenceChecks },
  { pillarId: 'security', runner: runSecurityChecks },
  { pillarId: 'reliability', runner: runReliabilityChecks },
  { pillarId: 'performance', runner: runPerformanceChecks },
  { pillarId: 'costOptimization', runner: runCostChecks },
  { pillarId: 'sustainability', runner: runSustainabilityChecks },
];

/**
 * Build a pillar summary from check results and findings
 */
function buildPillarSummary(
  pillarId: WAPillarId,
  result: WABPCheckResult
): WABPPillarSummary {
  const passCount = result.checksRun - result.checksWithFindings;
  return {
    pillarId,
    pillarName: PILLAR_NAMES[pillarId],
    totalChecks: result.checksRun,
    passCount: passCount,
    failCount: result.checksWithFindings,
    errorCount: result.errors.length,
    findings: result.findings,
  };
}

/**
 * Run the full Well-Architected Best Practices scan across all 6 pillars
 */
export async function runWABestPracticesScan(
  profile: string,
  region: string = 'us-west-2',
  progressCallback?: WABPProgressCallback
): Promise<WABPScanResult> {
  const startTime = Date.now();
  const pillarSummaries: WABPPillarSummary[] = [];
  const allErrors: string[] = [];
  const totalPillars = PILLAR_RUNNERS.length;

  for (let i = 0; i < PILLAR_RUNNERS.length; i++) {
    const { pillarId, runner } = PILLAR_RUNNERS[i];
    const pillarName = PILLAR_NAMES[pillarId];

    progressCallback?.({
      phase: 'Scanning',
      pillar: pillarName,
      service: '',
      percent: Math.round((i / totalPillars) * 100),
    });

    try {
      const result = await runner(profile, region);
      pillarSummaries.push(buildPillarSummary(pillarId, result));

      if (result.errors.length > 0) {
        allErrors.push(...result.errors.map((e) => `${pillarName}: ${e}`));
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      allErrors.push(`${pillarName}: ${errorMessage}`);
      console.error(`Failed to run ${pillarName} checks:`, error);

      // Add empty pillar summary for failed pillars
      pillarSummaries.push({
        pillarId,
        pillarName,
        totalChecks: 0,
        passCount: 0,
        failCount: 0,
        errorCount: 1,
        findings: [],
      });
    }

    progressCallback?.({
      phase: 'Scanning',
      pillar: pillarName,
      service: '',
      percent: Math.round(((i + 1) / totalPillars) * 100),
    });
  }

  progressCallback?.({
    phase: 'Complete',
    pillar: '',
    service: '',
    percent: 100,
  });

  const duration = Date.now() - startTime;

  // Calculate totals
  const totalChecks = pillarSummaries.reduce((sum, p) => sum + p.totalChecks, 0);
  const totalPass = pillarSummaries.reduce((sum, p) => sum + p.passCount, 0);
  const totalFail = pillarSummaries.reduce((sum, p) => sum + p.failCount, 0);
  const totalError = pillarSummaries.reduce((sum, p) => sum + p.errorCount, 0);

  return {
    pillarSummaries,
    totalChecks,
    totalPass,
    totalFail,
    totalError,
    duration,
    timestamp: new Date().toISOString(),
    error:
      allErrors.length > 0
        ? `Some checks encountered errors: ${allErrors.slice(0, 3).join('; ')}${allErrors.length > 3 ? ` and ${allErrors.length - 3} more` : ''}`
        : undefined,
  };
}

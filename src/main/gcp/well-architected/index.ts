// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import crypto from 'crypto';
import { GCPWAScanResult, GCPWAScanProgress, GCPWAPillarSummary } from './types';
import { runOpsExcellenceChecks } from './ops-excellence-checks';
import { runSecurityChecks } from './security-checks';
import { runReliabilityChecks } from './reliability-checks';
import { runPerformanceCostChecks } from './performance-cost-checks';
import { runSystemDesignChecks } from './system-design-checks';

interface PillarRunner {
  fn: (projectId: string) => Promise<GCPWAPillarSummary>;
  name: string;
}

const PILLAR_RUNNERS: PillarRunner[] = [
  { fn: runOpsExcellenceChecks, name: 'Operational Excellence' },
  { fn: runSecurityChecks, name: 'Security, Privacy & Compliance' },
  { fn: runReliabilityChecks, name: 'Reliability' },
  { fn: runPerformanceCostChecks, name: 'Performance & Cost Optimization' },
  { fn: runSystemDesignChecks, name: 'System Design' },
];

/**
 * Run the full GCP Architecture Framework scan across all 5 pillars.
 *
 * This is the main entry point for the GCP Well-Architected module.
 * It sequentially runs checks for each pillar and aggregates results.
 */
export async function runGCPArchitectureFrameworkScan(
  projectId: string,
  onProgress?: (progress: GCPWAScanProgress) => void
): Promise<GCPWAScanResult> {
  const startTime = Date.now();
  const pillarSummaries: GCPWAPillarSummary[] = [];
  const allErrors: string[] = [];
  const totalPillars = PILLAR_RUNNERS.length;

  for (let i = 0; i < PILLAR_RUNNERS.length; i++) {
    const { fn, name } = PILLAR_RUNNERS[i];

    onProgress?.({
      phase: 'Scanning',
      pillar: name,
      percent: Math.round((i / totalPillars) * 100),
      service: '',
    });

    try {
      const summary = await fn(projectId);
      pillarSummaries.push(summary);

      // Collect errors from findings
      const errorFindings = summary.findings.filter((f) => f.status === 'ERROR');
      if (errorFindings.length > 0) {
        allErrors.push(
          ...errorFindings.map((f) => `${name}: ${f.detail || f.check.title}`)
        );
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      allErrors.push(`${name}: ${errorMessage}`);
      console.error(`Failed to run ${name} checks:`, error);

      // Add empty pillar summary for failed pillar
      const pillarId = PILLAR_RUNNERS[i].fn === runOpsExcellenceChecks ? 'ops_excellence'
        : PILLAR_RUNNERS[i].fn === runSecurityChecks ? 'security'
        : PILLAR_RUNNERS[i].fn === runReliabilityChecks ? 'reliability'
        : PILLAR_RUNNERS[i].fn === runPerformanceCostChecks ? 'performance_cost'
        : 'system_design';

      pillarSummaries.push({
        pillar: pillarId,
        pillarName: name,
        totalChecks: 0,
        passCount: 0,
        failCount: 0,
        errorCount: 1,
        findings: [],
      });
    }

    onProgress?.({
      phase: 'Scanning',
      pillar: name,
      percent: Math.round(((i + 1) / totalPillars) * 100),
      service: '',
    });
  }

  onProgress?.({
    phase: 'Complete',
    pillar: '',
    percent: 100,
    service: '',
  });

  const duration = Date.now() - startTime;

  // Calculate totals
  const totalChecks = pillarSummaries.reduce((sum, p) => sum + p.totalChecks, 0);
  const totalPass = pillarSummaries.reduce((sum, p) => sum + p.passCount, 0);
  const totalFail = pillarSummaries.reduce((sum, p) => sum + p.failCount, 0);
  const totalError = pillarSummaries.reduce((sum, p) => sum + p.errorCount, 0);

  return {
    id: crypto.randomUUID(),
    projectId,
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

export * from './types';

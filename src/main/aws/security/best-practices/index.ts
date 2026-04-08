// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import type {
  SecurityFinding,
  SecurityPostureSummary,
  SecurityAnalysisResult,
  FindingSource,
} from '../../../../shared/types';
import { runEC2Checks } from './ec2-checks';
import { runS3Checks } from './s3-checks';
import { runIAMChecks } from './iam-checks';
import { runRDSChecks } from './rds-checks';
import { runCloudTrailChecks } from './cloudtrail-checks';
import { runVPCChecks } from './vpc-checks';
import { runKMSChecks } from './kms-checks';
import type { CheckResult, ScanProgressCallback } from './types';

export { type CheckResult, type ScanProgressCallback } from './types';

/**
 * Progress information for best practices scan
 */
export interface BestPracticesScanProgress {
  phase: string;
  service: string;
  percent: number;
  findingsCount: number;
}

/**
 * Aggregate check results into a single result
 */
function aggregateResults(results: CheckResult[]): CheckResult {
  return {
    findings: results.flatMap((r) => r.findings),
    errors: results.flatMap((r) => r.errors),
    checksRun: results.reduce((sum, r) => sum + r.checksRun, 0),
    checksWithFindings: results.reduce((sum, r) => sum + r.checksWithFindings, 0),
  };
}

/**
 * Calculate summary from findings
 */
function calculateSummary(findings: SecurityFinding[]): SecurityPostureSummary {
  const bySource: Record<FindingSource, number> = {
    SECURITY_HUB: 0,
    GUARDDUTY: 0,
    INSPECTOR: 0,
    ACCESS_ANALYZER: 0,
    CONFIG: 0,
    BEST_PRACTICES: 0,
  };

  let criticalCount = 0;
  let highCount = 0;
  let mediumCount = 0;
  let lowCount = 0;
  let informationalCount = 0;

  for (const finding of findings) {
    // Count by severity
    switch (finding.severity) {
      case 'CRITICAL':
        criticalCount++;
        break;
      case 'HIGH':
        highCount++;
        break;
      case 'MEDIUM':
        mediumCount++;
        break;
      case 'LOW':
        lowCount++;
        break;
      case 'INFORMATIONAL':
        informationalCount++;
        break;
    }

    // Count by source
    if (finding.source in bySource) {
      bySource[finding.source as FindingSource]++;
    }
  }

  return {
    totalFindings: findings.length,
    criticalCount,
    highCount,
    mediumCount,
    lowCount,
    informationalCount,
    bySource,
    complianceScores: [],
    lastRefreshed: new Date().toISOString(),
  };
}

/**
 * Run all best practices security checks
 */
export async function runBestPracticesScan(
  profile: string,
  region: string = 'us-east-1',
  progressCallback?: ScanProgressCallback
): Promise<SecurityAnalysisResult> {
  const results: CheckResult[] = [];
  const allErrors: string[] = [];

  const services = [
    { name: 'EC2', runner: runEC2Checks },
    { name: 'S3', runner: runS3Checks },
    { name: 'IAM', runner: runIAMChecks },
    { name: 'RDS', runner: runRDSChecks },
    { name: 'CloudTrail', runner: runCloudTrailChecks },
    { name: 'VPC', runner: runVPCChecks },
    { name: 'KMS', runner: runKMSChecks },
  ];

  const totalServices = services.length;

  for (let i = 0; i < services.length; i++) {
    const { name, runner } = services[i];
    const percent = Math.round(((i + 1) / totalServices) * 100);

    progressCallback?.({
      phase: 'Scanning',
      service: name,
      percent: Math.round((i / totalServices) * 100),
    });

    try {
      const result = await runner(profile, region);
      results.push(result);

      if (result.errors.length > 0) {
        allErrors.push(...result.errors);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      allErrors.push(`${name}: ${errorMessage}`);
      console.error(`Failed to run ${name} checks:`, error);
    }

    progressCallback?.({
      phase: 'Scanning',
      service: name,
      percent,
    });
  }

  progressCallback?.({
    phase: 'Complete',
    service: '',
    percent: 100,
  });

  // Aggregate results
  const aggregated = aggregateResults(results);
  const summary = calculateSummary(aggregated.findings);

  // Sort findings by severity
  const severityOrder = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFORMATIONAL'];
  aggregated.findings.sort(
    (a, b) => severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity)
  );

  return {
    summary,
    findings: aggregated.findings,
    enabledStandards: [
      {
        standardArn: 'best-practices',
        standardName: 'AWS Security Best Practices',
        description:
          'Security checks based on AWS Well-Architected Framework and security best practices',
      },
    ],
    error:
      allErrors.length > 0
        ? `Some checks encountered errors: ${allErrors.slice(0, 3).join('; ')}${allErrors.length > 3 ? ` and ${allErrors.length - 3} more` : ''}`
        : undefined,
  };
}

/**
 * Get the list of services that will be scanned
 */
export function getBestPracticesServices(): string[] {
  return ['EC2', 'S3', 'IAM', 'RDS', 'CloudTrail', 'VPC', 'KMS'];
}

/**
 * Get the total number of checks that will be run
 */
export function getBestPracticesCheckCount(): number {
  // EC2: 2 (Security Groups, EBS encryption)
  // S3: 3 (Encryption, Public Access, Versioning)
  // IAM: 2 (Root access keys, User MFA)
  // RDS: 2 (Encryption, Public Access)
  return 9;
}

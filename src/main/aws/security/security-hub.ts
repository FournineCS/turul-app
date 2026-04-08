// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  GetFindingsCommand,
  GetEnabledStandardsCommand,
  DescribeStandardsControlsCommand,
  type AwsSecurityFinding,
  type StandardsSubscription,
} from '@aws-sdk/client-securityhub';
import { getClientFactory } from '../client-factory';
import type {
  SecurityFinding,
  SecurityPostureSummary,
  SecurityAnalysisResult,
  ComplianceStandard,
  ComplianceScore,
  FindingSeverity,
  FindingSource,
  FindingStatus,
} from '../../../shared/types';

/**
 * Map AWS Security Hub severity label to our FindingSeverity type.
 */
function mapSeverity(severityLabel?: string): FindingSeverity {
  switch (severityLabel?.toUpperCase()) {
    case 'CRITICAL':
      return 'CRITICAL';
    case 'HIGH':
      return 'HIGH';
    case 'MEDIUM':
      return 'MEDIUM';
    case 'LOW':
      return 'LOW';
    case 'INFORMATIONAL':
    default:
      return 'INFORMATIONAL';
  }
}

/**
 * Determine the finding source from the product name.
 */
function mapSource(productName?: string, generatorId?: string): FindingSource {
  const product = productName?.toLowerCase() || '';
  const generator = generatorId?.toLowerCase() || '';

  if (product.includes('guardduty') || generator.includes('guardduty')) {
    return 'GUARDDUTY';
  }
  if (product.includes('inspector') || generator.includes('inspector')) {
    return 'INSPECTOR';
  }
  if (product.includes('access analyzer') || generator.includes('access-analyzer')) {
    return 'ACCESS_ANALYZER';
  }
  if (product.includes('config') || generator.includes('config')) {
    return 'CONFIG';
  }
  return 'SECURITY_HUB';
}

/**
 * Map AWS workflow status to our FindingStatus type.
 */
function mapStatus(workflowStatus?: string, recordState?: string): FindingStatus {
  if (recordState === 'ARCHIVED') {
    return 'ARCHIVED';
  }
  if (workflowStatus === 'RESOLVED') {
    return 'RESOLVED';
  }
  return 'ACTIVE';
}

/**
 * Convert AWS Security Hub finding to our SecurityFinding interface.
 */
function convertFinding(awsFinding: AwsSecurityFinding): SecurityFinding {
  const resource = awsFinding.Resources?.[0];

  return {
    id: awsFinding.Id || '',
    title: awsFinding.Title || 'Untitled Finding',
    description: awsFinding.Description || '',
    severity: mapSeverity(awsFinding.Severity?.Label),
    status: mapStatus(awsFinding.Workflow?.Status, awsFinding.RecordState),
    source: mapSource(awsFinding.ProductName, awsFinding.GeneratorId),
    region: awsFinding.Region || resource?.Region || 'unknown',
    resourceType: resource?.Type,
    resourceId: resource?.Id,
    resourceArn: resource?.Id,
    complianceStatus: awsFinding.Compliance?.Status,
    remediationRecommendation: awsFinding.Remediation?.Recommendation?.Text,
    remediationUrl: awsFinding.Remediation?.Recommendation?.Url,
    firstObservedAt: awsFinding.FirstObservedAt,
    lastObservedAt: awsFinding.LastObservedAt || awsFinding.UpdatedAt,
    awsAccountId: awsFinding.AwsAccountId,
    generatorId: awsFinding.GeneratorId,
    productName: awsFinding.ProductName,
  };
}

/**
 * Get security findings from AWS Security Hub.
 */
export async function getSecurityFindings(
  profile: string,
  region: string = 'us-east-1',
  includeArchived: boolean = false,
  maxResults: number = 100
): Promise<SecurityAnalysisResult> {
  const client = getClientFactory().getSecurityHubClient({
    profile,
    region,
  });

  try {
    // Build filters for active findings
    const filters: Record<string, unknown[]> = {
      RecordState: [{ Value: 'ACTIVE', Comparison: 'EQUALS' }],
    };

    if (includeArchived) {
      // Include both ACTIVE and ARCHIVED
      filters.RecordState = [
        { Value: 'ACTIVE', Comparison: 'EQUALS' },
        { Value: 'ARCHIVED', Comparison: 'EQUALS' },
      ];
    }

    // Fetch findings
    const findingsResponse = await client.send(
      new GetFindingsCommand({
        Filters: filters as never,
        MaxResults: maxResults,
        SortCriteria: [
          {
            Field: 'SeverityLabel',
            SortOrder: 'asc',
          },
        ],
      })
    );

    const findings: SecurityFinding[] = (findingsResponse.Findings || []).map(convertFinding);

    // Calculate summary statistics
    const summary = calculateSummary(findings);

    // Fetch enabled standards
    const enabledStandards = await getEnabledStandards(profile, region);

    // Fetch compliance scores for enabled standards
    const complianceScores = await getComplianceScores(profile, region, enabledStandards);
    summary.complianceScores = complianceScores;

    return {
      summary,
      findings,
      enabledStandards,
    };
  } catch (error) {
    // Return empty result with error
    const errorMessage = error instanceof Error ? error.message : 'Failed to get security findings';

    // Check for common errors - log concisely for expected conditions
    if (errorMessage.includes('not subscribed') || errorMessage.includes('not enabled') || errorMessage.includes('InvalidAccessException')) {
      console.warn(`Security Hub not enabled for this account/region: ${errorMessage}`);
      return {
        summary: createEmptySummary(),
        findings: [],
        enabledStandards: [],
        error: 'AWS Security Hub is not enabled in this region. Please enable Security Hub in the AWS Console.',
      };
    }

    if (errorMessage.includes('AccessDenied') || errorMessage.includes('not authorized')) {
      console.warn(`Security Hub access denied: ${errorMessage}`);
      return {
        summary: createEmptySummary(),
        findings: [],
        enabledStandards: [],
        error: 'Access denied. Ensure you have the required IAM permissions for Security Hub.',
      };
    }

    console.error('Failed to get security findings:', errorMessage);
    return {
      summary: createEmptySummary(),
      findings: [],
      enabledStandards: [],
      error: errorMessage,
    };
  }
}

/**
 * Get enabled security standards from Security Hub.
 */
export async function getEnabledStandards(
  profile: string,
  region: string = 'us-east-1'
): Promise<ComplianceStandard[]> {
  const client = getClientFactory().getSecurityHubClient({
    profile,
    region,
  });

  try {
    const response = await client.send(new GetEnabledStandardsCommand({}));

    return (response.StandardsSubscriptions || []).map((sub: StandardsSubscription) => ({
      standardArn: sub.StandardsArn || '',
      standardName: extractStandardName(sub.StandardsArn || ''),
      description: getStandardDescription(sub.StandardsArn || ''),
      enabledDate: sub.StandardsSubscriptionArn ? undefined : undefined,
    }));
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.warn(`Failed to get enabled standards: ${msg}`);
    return [];
  }
}

/**
 * Get compliance scores for enabled standards.
 */
async function getComplianceScores(
  profile: string,
  region: string,
  standards: ComplianceStandard[]
): Promise<ComplianceScore[]> {
  const client = getClientFactory().getSecurityHubClient({
    profile,
    region,
  });

  const scores: ComplianceScore[] = [];

  for (const standard of standards) {
    try {
      const response = await client.send(
        new DescribeStandardsControlsCommand({
          StandardsSubscriptionArn: standard.standardArn,
          MaxResults: 100,
        })
      );

      const controls = response.Controls || [];
      let passed = 0;
      let failed = 0;

      for (const control of controls) {
        if (control.ControlStatus === 'ENABLED') {
          // Count based on compliance status of findings
          // This is a simplified calculation - in production you'd aggregate finding results
          // SeverityRating can be 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | undefined
          if (control.SeverityRating === 'LOW' || !control.SeverityRating) {
            passed++;
          } else {
            // CRITICAL, HIGH, MEDIUM controls need attention
            failed++;
          }
        }
      }

      const total = passed + failed;
      const score = total > 0 ? Math.round((passed / total) * 100) : 0;

      scores.push({
        standardName: standard.standardName,
        standardArn: standard.standardArn,
        score,
        passedControls: passed,
        failedControls: failed,
        totalControls: total,
      });
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      console.warn(`Failed to get compliance score for ${standard.standardName}: ${msg}`);
      // Add placeholder score
      scores.push({
        standardName: standard.standardName,
        standardArn: standard.standardArn,
        score: 0,
        passedControls: 0,
        failedControls: 0,
        totalControls: 0,
      });
    }
  }

  return scores;
}

/**
 * Extract human-readable standard name from ARN.
 */
function extractStandardName(arn: string): string {
  // Example ARN: arn:aws:securityhub:us-east-1::standards/aws-foundational-security-best-practices/v/1.0.0
  const arnParts = arn.split('/');
  const standardPart = arnParts[1] || '';

  const nameMap: Record<string, string> = {
    'aws-foundational-security-best-practices': 'AWS Foundational Security Best Practices (FSBP)',
    'cis-aws-foundations-benchmark': 'CIS AWS Foundations Benchmark',
    'pci-dss': 'PCI DSS v3.2.1',
    'nist-800-53': 'NIST 800-53 Rev. 5',
  };

  return nameMap[standardPart] || standardPart || 'Unknown Standard';
}

/**
 * Get description for a security standard.
 */
function getStandardDescription(arn: string): string {
  const arnParts = arn.split('/');
  const standardPart = arnParts[1] || '';

  const descriptionMap: Record<string, string> = {
    'aws-foundational-security-best-practices':
      'A set of controls that detect when your deployed accounts and resources deviate from security best practices.',
    'cis-aws-foundations-benchmark':
      'Security controls based on the CIS AWS Foundations Benchmark.',
    'pci-dss':
      'Controls related to Payment Card Industry Data Security Standard compliance.',
    'nist-800-53':
      'Security and privacy controls based on NIST Special Publication 800-53.',
  };

  return descriptionMap[standardPart] || '';
}

/**
 * Calculate summary statistics from findings.
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
    bySource[finding.source]++;
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
 * Create an empty summary for error cases.
 */
function createEmptySummary(): SecurityPostureSummary {
  return {
    totalFindings: 0,
    criticalCount: 0,
    highCount: 0,
    mediumCount: 0,
    lowCount: 0,
    informationalCount: 0,
    bySource: {
      SECURITY_HUB: 0,
      GUARDDUTY: 0,
      INSPECTOR: 0,
      ACCESS_ANALYZER: 0,
      CONFIG: 0,
      BEST_PRACTICES: 0,
    },
    complianceScores: [],
    lastRefreshed: new Date().toISOString(),
  };
}

/**
 * Get a single finding by ID.
 */
export async function getSecurityFindingById(
  profile: string,
  findingId: string,
  region: string = 'us-east-1'
): Promise<SecurityFinding | null> {
  const client = getClientFactory().getSecurityHubClient({
    profile,
    region,
  });

  try {
    const response = await client.send(
      new GetFindingsCommand({
        Filters: {
          Id: [{ Value: findingId, Comparison: 'EQUALS' }],
        },
        MaxResults: 1,
      })
    );

    if (response.Findings && response.Findings.length > 0) {
      return convertFinding(response.Findings[0]);
    }

    return null;
  } catch (error) {
    console.error('Failed to get finding by ID:', error);
    return null;
  }
}

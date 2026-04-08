// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  DescribeTrailsCommand,
  GetTrailStatusCommand,
} from '@aws-sdk/client-cloudtrail';
import { getClientFactory } from '../../client-factory';
import type { SecurityFinding } from '../../../../shared/types';
import type { CheckResult } from './types';

export async function runCloudTrailChecks(
  profile: string,
  region: string
): Promise<CheckResult> {
  const findings: SecurityFinding[] = [];
  const errors: string[] = [];
  let checksRun = 0;
  let checksWithFindings = 0;

  try {
    const client = getClientFactory().getCloudTrailClient({ profile, region });
    const { trailList } = await client.send(new DescribeTrailsCommand({}));

    if (!trailList || trailList.length === 0) {
      checksRun++;
      checksWithFindings++;
      findings.push({
        id: `BP-CT-001-no-trails`,
        title: 'No CloudTrail trails configured',
        description: 'No CloudTrail trails are configured in this account. CloudTrail is essential for audit logging.',
        severity: 'HIGH',
        status: 'ACTIVE',
        source: 'BEST_PRACTICES',
        region,
        resourceType: 'AWS::CloudTrail::Trail',
        remediationRecommendation: 'Create a CloudTrail trail that logs to S3 with multi-region enabled.',
        remediationUrl: 'https://docs.aws.amazon.com/awscloudtrail/latest/userguide/cloudtrail-create-and-update-a-trail.html',
      });
      return { findings, errors, checksRun, checksWithFindings };
    }

    // Check for multi-region trail
    checksRun++;
    const multiRegionTrail = trailList.find((t) => t.IsMultiRegionTrail);
    if (!multiRegionTrail) {
      checksWithFindings++;
      findings.push({
        id: 'BP-CT-001-no-multiregion',
        title: 'No multi-region CloudTrail trail',
        description: 'No trail is configured with multi-region logging. Events in other regions may not be captured.',
        severity: 'HIGH',
        status: 'ACTIVE',
        source: 'BEST_PRACTICES',
        region,
        resourceType: 'AWS::CloudTrail::Trail',
        remediationRecommendation: 'Enable multi-region logging on at least one trail.',
        remediationUrl: 'https://docs.aws.amazon.com/awscloudtrail/latest/userguide/cloudtrail-create-and-update-a-trail.html',
      });
    }

    // Check log file validation
    checksRun++;
    const noValidation = trailList.filter((t) => !t.LogFileValidationEnabled);
    if (noValidation.length > 0) {
      checksWithFindings++;
      for (const trail of noValidation) {
        findings.push({
          id: `BP-CT-002-${trail.TrailARN}`,
          title: 'CloudTrail log file validation disabled',
          description: `Trail "${trail.Name}" does not have log file validation enabled. Without validation, log integrity cannot be verified.`,
          severity: 'MEDIUM',
          status: 'ACTIVE',
          source: 'BEST_PRACTICES',
          region,
          resourceType: 'AWS::CloudTrail::Trail',
          resourceId: trail.Name,
          resourceArn: trail.TrailARN,
          remediationRecommendation: 'Enable log file validation on the trail.',
          remediationUrl: 'https://docs.aws.amazon.com/awscloudtrail/latest/userguide/cloudtrail-log-file-validation-intro.html',
        });
      }
    }

    // Check encryption
    checksRun++;
    const noEncryption = trailList.filter((t) => !t.KmsKeyId);
    if (noEncryption.length > 0) {
      checksWithFindings++;
      for (const trail of noEncryption) {
        findings.push({
          id: `BP-CT-003-${trail.TrailARN}`,
          title: 'CloudTrail not encrypted with KMS',
          description: `Trail "${trail.Name}" is not encrypted with a KMS key. Logs may not be adequately protected at rest.`,
          severity: 'MEDIUM',
          status: 'ACTIVE',
          source: 'BEST_PRACTICES',
          region,
          resourceType: 'AWS::CloudTrail::Trail',
          resourceId: trail.Name,
          resourceArn: trail.TrailARN,
          remediationRecommendation: 'Enable KMS encryption on the trail.',
          remediationUrl: 'https://docs.aws.amazon.com/awscloudtrail/latest/userguide/encrypting-cloudtrail-log-files-with-aws-kms.html',
        });
      }
    }

    // Check if trail is logging
    checksRun++;
    for (const trail of trailList) {
      if (!trail.TrailARN) continue;
      try {
        const status = await client.send(new GetTrailStatusCommand({ Name: trail.TrailARN }));
        if (!status.IsLogging) {
          checksWithFindings++;
          findings.push({
            id: `BP-CT-004-${trail.TrailARN}`,
            title: 'CloudTrail trail is not logging',
            description: `Trail "${trail.Name}" exists but logging is stopped.`,
            severity: 'HIGH',
            status: 'ACTIVE',
            source: 'BEST_PRACTICES',
            region,
            resourceType: 'AWS::CloudTrail::Trail',
            resourceId: trail.Name,
            resourceArn: trail.TrailARN,
            remediationRecommendation: 'Start logging on the trail.',
          });
        }
      } catch {
        // Skip individual trail status errors
      }
    }
  } catch (error) {
    errors.push(`CloudTrail: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return { findings, errors, checksRun, checksWithFindings };
}

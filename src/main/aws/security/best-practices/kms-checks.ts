// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  ListKeysCommand,
  DescribeKeyCommand,
  GetKeyRotationStatusCommand,
} from '@aws-sdk/client-kms';
import { getClientFactory } from '../../client-factory';
import type { SecurityFinding } from '../../../../shared/types';
import type { CheckResult } from './types';

export async function runKMSChecks(
  profile: string,
  region: string
): Promise<CheckResult> {
  const findings: SecurityFinding[] = [];
  const errors: string[] = [];
  let checksRun = 0;
  let checksWithFindings = 0;

  try {
    const client = getClientFactory().getKMSClient({ profile, region });
    const { Keys } = await client.send(new ListKeysCommand({ Limit: 100 }));

    if (!Keys || Keys.length === 0) {
      return { findings, errors, checksRun: 0, checksWithFindings: 0 };
    }

    // Check key rotation for customer-managed keys
    checksRun++;
    for (const key of Keys) {
      if (!key.KeyId) continue;

      try {
        const desc = await client.send(new DescribeKeyCommand({ KeyId: key.KeyId }));
        const metadata = desc.KeyMetadata;

        if (!metadata) continue;

        // Skip AWS-managed keys and disabled/pending deletion keys
        if (metadata.KeyManager !== 'CUSTOMER') continue;
        if (metadata.KeyState !== 'Enabled') continue;

        try {
          const rotationStatus = await client.send(
            new GetKeyRotationStatusCommand({ KeyId: key.KeyId })
          );

          if (!rotationStatus.KeyRotationEnabled) {
            checksWithFindings++;
            findings.push({
              id: `BP-KMS-001-${key.KeyId}`,
              title: 'KMS key rotation not enabled',
              description: `Customer-managed KMS key "${metadata.Description || key.KeyId}" does not have automatic key rotation enabled.`,
              severity: 'MEDIUM',
              status: 'ACTIVE',
              source: 'BEST_PRACTICES',
              region,
              resourceType: 'AWS::KMS::Key',
              resourceId: key.KeyId,
              resourceArn: metadata.Arn,
              remediationRecommendation: 'Enable automatic key rotation for customer-managed KMS keys.',
              remediationUrl: 'https://docs.aws.amazon.com/kms/latest/developerguide/rotate-keys.html',
            });
          }
        } catch {
          // Some key types don't support rotation status
        }
      } catch {
        // Skip individual key errors
      }
    }
  } catch (error) {
    errors.push(`KMS: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return { findings, errors, checksRun, checksWithFindings };
}

// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  GenerateCredentialReportCommand,
  GetCredentialReportCommand,
  GetAccountSummaryCommand,
  ListUsersCommand,
  ListMFADevicesCommand,
} from '@aws-sdk/client-iam';
import { getClientFactory } from '../../client-factory';
import type { SecurityFinding } from '../../../../shared/types';
import { IAM_CHECKS, type CheckResult } from './types';

interface CredentialReportUser {
  user: string;
  arn: string;
  user_creation_time: string;
  password_enabled: string;
  password_last_used: string;
  password_last_changed: string;
  password_next_rotation: string;
  mfa_active: string;
  access_key_1_active: string;
  access_key_1_last_rotated: string;
  access_key_1_last_used_date: string;
  access_key_1_last_used_region: string;
  access_key_1_last_used_service: string;
  access_key_2_active: string;
  access_key_2_last_rotated: string;
  access_key_2_last_used_date: string;
  access_key_2_last_used_region: string;
  access_key_2_last_used_service: string;
  cert_1_active: string;
  cert_1_last_rotated: string;
  cert_2_active: string;
  cert_2_last_rotated: string;
}

/**
 * Generate and get the IAM credential report
 */
async function getCredentialReport(profile: string): Promise<CredentialReportUser[]> {
  const client = getClientFactory().getIAMClient({ profile, region: 'us-east-1' });

  // Generate the report (might need to wait)
  let reportReady = false;
  let attempts = 0;
  const maxAttempts = 10;

  while (!reportReady && attempts < maxAttempts) {
    try {
      const generateResponse = await client.send(new GenerateCredentialReportCommand({}));
      if (generateResponse.State === 'COMPLETE') {
        reportReady = true;
      } else {
        // Wait before checking again
        await new Promise((resolve) => setTimeout(resolve, 1000));
        attempts++;
      }
    } catch (error) {
      // Report might already be generating
      await new Promise((resolve) => setTimeout(resolve, 1000));
      attempts++;
    }
  }

  // Get the report
  const response = await client.send(new GetCredentialReportCommand({}));

  if (!response.Content) {
    throw new Error('Failed to get credential report content');
  }

  // Decode and parse the CSV
  const csvContent = Buffer.from(response.Content).toString('utf-8');
  const lines = csvContent.split('\n');
  const headers = lines[0].split(',');
  const users: CredentialReportUser[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = line.split(',');
    const user: Record<string, string> = {};

    headers.forEach((header, index) => {
      user[header] = values[index] || '';
    });

    users.push(user as unknown as CredentialReportUser);
  }

  return users;
}

/**
 * Check for root account access keys
 */
function checkRootAccessKeys(
  credentialReport: CredentialReportUser[],
  region: string
): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  const checkDef = IAM_CHECKS.find((c) => c.id === 'BP-IAM-001');

  if (!checkDef) return findings;

  const rootUser = credentialReport.find((user) => user.user === '<root_account>');

  if (rootUser) {
    const hasAccessKey1 = rootUser.access_key_1_active === 'true';
    const hasAccessKey2 = rootUser.access_key_2_active === 'true';

    if (hasAccessKey1 || hasAccessKey2) {
      const keyInfo =
        hasAccessKey1 && hasAccessKey2
          ? 'two active access keys'
          : 'an active access key';

      findings.push({
        id: 'BP-IAM-001-root',
        title: checkDef.title,
        description: `${checkDef.description} The root account has ${keyInfo}.`,
        severity: checkDef.severity,
        status: 'ACTIVE',
        source: 'BEST_PRACTICES',
        region,
        resourceType: 'AwsIamRootUser',
        resourceId: 'root',
        resourceArn: rootUser.arn,
        remediationRecommendation: checkDef.remediationRecommendation,
        remediationUrl: checkDef.remediationUrl,
        firstObservedAt: new Date().toISOString(),
        lastObservedAt: new Date().toISOString(),
        generatorId: checkDef.id,
        productName: 'Best Practices Scanner',
      });
    }
  }

  return findings;
}

/**
 * Check for IAM users without MFA
 */
function checkUsersWithoutMFA(
  credentialReport: CredentialReportUser[],
  region: string
): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  const checkDefMFA = IAM_CHECKS.find((c) => c.id === 'BP-IAM-002');
  const checkDefConsoleMFA = IAM_CHECKS.find((c) => c.id === 'BP-IAM-003');

  for (const user of credentialReport) {
    // Skip root account (handled separately)
    if (user.user === '<root_account>') continue;

    const hasMFA = user.mfa_active === 'true';
    const hasPassword = user.password_enabled === 'true';

    // Check for console access without MFA (critical)
    if (hasPassword && !hasMFA && checkDefConsoleMFA) {
      findings.push({
        id: `BP-IAM-003-${user.user}`,
        title: checkDefConsoleMFA.title,
        description: `${checkDefConsoleMFA.description} User "${user.user}" has console access but no MFA enabled.`,
        severity: checkDefConsoleMFA.severity,
        status: 'ACTIVE',
        source: 'BEST_PRACTICES',
        region,
        resourceType: 'AwsIamUser',
        resourceId: user.user,
        resourceArn: user.arn,
        remediationRecommendation: checkDefConsoleMFA.remediationRecommendation,
        remediationUrl: checkDefConsoleMFA.remediationUrl,
        firstObservedAt: new Date().toISOString(),
        lastObservedAt: new Date().toISOString(),
        generatorId: checkDefConsoleMFA.id,
        productName: 'Best Practices Scanner',
      });
    }
    // Check for any user without MFA (if they have any active credentials)
    else if (!hasMFA && checkDefMFA) {
      const hasAccessKey =
        user.access_key_1_active === 'true' || user.access_key_2_active === 'true';

      if (hasPassword || hasAccessKey) {
        findings.push({
          id: `BP-IAM-002-${user.user}`,
          title: checkDefMFA.title,
          description: `${checkDefMFA.description} User "${user.user}" does not have MFA enabled.`,
          severity: checkDefMFA.severity,
          status: 'ACTIVE',
          source: 'BEST_PRACTICES',
          region,
          resourceType: 'AwsIamUser',
          resourceId: user.user,
          resourceArn: user.arn,
          remediationRecommendation: checkDefMFA.remediationRecommendation,
          remediationUrl: checkDefMFA.remediationUrl,
          firstObservedAt: new Date().toISOString(),
          lastObservedAt: new Date().toISOString(),
          generatorId: checkDefMFA.id,
          productName: 'Best Practices Scanner',
        });
      }
    }
  }

  return findings;
}

/**
 * Run all IAM security checks
 */
export async function runIAMChecks(
  profile: string,
  region: string
): Promise<CheckResult> {
  const findings: SecurityFinding[] = [];
  const errors: string[] = [];
  let checksRun = 0;
  let checksWithFindings = 0;

  try {
    // Get credential report
    const credentialReport = await getCredentialReport(profile);

    // Check root access keys
    checksRun++;
    const rootFindings = checkRootAccessKeys(credentialReport, region);
    if (rootFindings.length > 0) {
      checksWithFindings++;
      findings.push(...rootFindings);
    }

    // Check users without MFA
    checksRun++;
    const mfaFindings = checkUsersWithoutMFA(credentialReport, region);
    if (mfaFindings.length > 0) {
      checksWithFindings++;
      findings.push(...mfaFindings);
    }
  } catch (error) {
    errors.push(`IAM checks: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return {
    findings,
    errors,
    checksRun,
    checksWithFindings,
  };
}

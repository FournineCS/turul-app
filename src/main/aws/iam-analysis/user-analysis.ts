// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  GenerateCredentialReportCommand,
  GetCredentialReportCommand,
  ListAttachedUserPoliciesCommand,
  ListUserPoliciesCommand,
} from '@aws-sdk/client-iam';
import { getClientFactory } from '../client-factory';
import type { IAMUserIssue, IAMUserAnalysisResult, UserIssueSeverity } from './types';

interface CredentialReportUser {
  user: string;
  arn: string;
  user_creation_time: string;
  password_enabled: string;
  password_last_used: string;
  mfa_active: string;
  access_key_1_active: string;
  access_key_1_last_rotated: string;
  access_key_1_last_used_date: string;
  access_key_2_active: string;
  access_key_2_last_rotated: string;
  access_key_2_last_used_date: string;
}

const ROTATION_THRESHOLD_DAYS = 90;
const UNUSED_THRESHOLD_DAYS = 45;
const BATCH_SIZE = 5;

function daysSince(dateStr: string): number {
  if (!dateStr || dateStr === 'N/A' || dateStr === 'no_information' || dateStr === 'not_supported') {
    return Infinity;
  }
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return Infinity;
  return Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24));
}

async function getCredentialReport(profile: string): Promise<CredentialReportUser[]> {
  const client = getClientFactory().getIAMClient({ profile, region: 'us-east-1' });

  let reportReady = false;
  let attempts = 0;
  const maxAttempts = 15;

  while (!reportReady && attempts < maxAttempts) {
    try {
      const res = await client.send(new GenerateCredentialReportCommand({}));
      if (res.State === 'COMPLETE') {
        reportReady = true;
      } else {
        await new Promise((r) => setTimeout(r, 3000));
        attempts++;
      }
    } catch {
      await new Promise((r) => setTimeout(r, 3000));
      attempts++;
    }
  }

  const response = await client.send(new GetCredentialReportCommand({}));
  if (!response.Content) {
    throw new Error('Failed to get credential report content');
  }

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

function analyzeRootAccount(root: CredentialReportUser): IAMUserIssue[] {
  const issues: IAMUserIssue[] = [];

  if (root.mfa_active !== 'true') {
    issues.push({
      userName: '<root_account>',
      userArn: root.arn,
      issue: 'Root account does not have MFA enabled',
      severity: 'CRITICAL',
      category: 'root_account',
      detail: 'CIS 1.5 / IAM.9: The root user account should have MFA enabled to prevent unauthorized access.',
    });
  }

  if (root.access_key_1_active === 'true' || root.access_key_2_active === 'true') {
    const keyCount = [root.access_key_1_active, root.access_key_2_active].filter(k => k === 'true').length;
    issues.push({
      userName: '<root_account>',
      userArn: root.arn,
      issue: `Root account has ${keyCount} active access key${keyCount > 1 ? 's' : ''}`,
      severity: 'CRITICAL',
      category: 'root_account',
      detail: 'CIS 1.4 / IAM.4: Root account access keys should be removed. Use IAM users or roles instead.',
    });
  }

  return issues;
}

function analyzeUserCredentials(user: CredentialReportUser): IAMUserIssue[] {
  const issues: IAMUserIssue[] = [];
  const hasPassword = user.password_enabled === 'true';
  const hasMFA = user.mfa_active === 'true';
  const key1Active = user.access_key_1_active === 'true';
  const key2Active = user.access_key_2_active === 'true';

  // Check 3: Console users without MFA
  if (hasPassword && !hasMFA) {
    issues.push({
      userName: user.user,
      userArn: user.arn,
      issue: 'Console access without MFA',
      severity: 'HIGH',
      category: 'mfa',
      detail: 'CIS 1.10 / IAM.5: User has console password enabled but no MFA device configured.',
    });
  }

  // Check 4: Access key rotation > 90 days
  if (key1Active) {
    const days = daysSince(user.access_key_1_last_rotated);
    if (days > ROTATION_THRESHOLD_DAYS) {
      issues.push({
        userName: user.user,
        userArn: user.arn,
        issue: `Access key 1 not rotated in ${days === Infinity ? 'unknown' : days} days`,
        severity: 'MEDIUM',
        category: 'access_key_rotation',
        detail: `CIS 1.14 / IAM.3: Access keys should be rotated every 90 days. Last rotated: ${user.access_key_1_last_rotated || 'N/A'}.`,
      });
    }
  }
  if (key2Active) {
    const days = daysSince(user.access_key_2_last_rotated);
    if (days > ROTATION_THRESHOLD_DAYS) {
      issues.push({
        userName: user.user,
        userArn: user.arn,
        issue: `Access key 2 not rotated in ${days === Infinity ? 'unknown' : days} days`,
        severity: 'MEDIUM',
        category: 'access_key_rotation',
        detail: `CIS 1.14 / IAM.3: Access keys should be rotated every 90 days. Last rotated: ${user.access_key_2_last_rotated || 'N/A'}.`,
      });
    }
  }

  // Check 5: Unused credentials > 45 days
  const passwordLastUsedDays = hasPassword ? daysSince(user.password_last_used) : Infinity;
  const key1LastUsedDays = key1Active ? daysSince(user.access_key_1_last_used_date) : Infinity;
  const key2LastUsedDays = key2Active ? daysSince(user.access_key_2_last_used_date) : Infinity;
  const mostRecentActivity = Math.min(passwordLastUsedDays, key1LastUsedDays, key2LastUsedDays);

  if (mostRecentActivity > UNUSED_THRESHOLD_DAYS && mostRecentActivity !== Infinity) {
    issues.push({
      userName: user.user,
      userArn: user.arn,
      issue: `No credential activity in ${mostRecentActivity} days`,
      severity: 'MEDIUM',
      category: 'unused_credentials',
      detail: `CIS 1.12 / IAM.22: Credentials unused for 45+ days should be disabled or removed.`,
    });
  }

  // Check 6: Multiple active access keys
  if (key1Active && key2Active) {
    issues.push({
      userName: user.user,
      userArn: user.arn,
      issue: 'Multiple active access keys',
      severity: 'LOW',
      category: 'multiple_keys',
      detail: 'CIS 1.13: Each IAM user should have only one active access key at a time for easier rotation and auditing.',
    });
  }

  return issues;
}

async function checkDirectPolicies(profile: string, users: CredentialReportUser[]): Promise<IAMUserIssue[]> {
  const client = getClientFactory().getIAMClient({ profile, region: 'us-east-1' });
  const issues: IAMUserIssue[] = [];
  const iamUsers = users.filter(u => u.user !== '<root_account>');

  for (let i = 0; i < iamUsers.length; i += BATCH_SIZE) {
    const batch = iamUsers.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(async (user) => {
        const [attached, inline] = await Promise.all([
          client.send(new ListAttachedUserPoliciesCommand({ UserName: user.user })),
          client.send(new ListUserPoliciesCommand({ UserName: user.user })),
        ]);
        const attachedCount = attached.AttachedPolicies?.length || 0;
        const inlineCount = inline.PolicyNames?.length || 0;
        if (attachedCount + inlineCount > 0) {
          const parts: string[] = [];
          if (attachedCount > 0) parts.push(`${attachedCount} attached`);
          if (inlineCount > 0) parts.push(`${inlineCount} inline`);
          issues.push({
            userName: user.user,
            userArn: user.arn,
            issue: `${attachedCount + inlineCount} policies directly attached`,
            severity: 'LOW' as UserIssueSeverity,
            category: 'direct_policy',
            detail: `CIS 1.15 / IAM.2: User has ${parts.join(' and ')} policies attached directly. Use IAM groups instead.`,
          });
        }
      })
    );
    // Silently ignore per-user failures
    if (i + BATCH_SIZE < iamUsers.length) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  return issues;
}

function computeScore(issues: IAMUserIssue[]): number {
  const penalties: Record<UserIssueSeverity, number> = {
    CRITICAL: 15,
    HIGH: 10,
    MEDIUM: 5,
    LOW: 2,
  };
  let score = 100;
  for (const issue of issues) {
    score -= penalties[issue.severity];
  }
  return Math.max(0, Math.min(100, score));
}

export async function analyzeIAMUsers(profile: string): Promise<IAMUserAnalysisResult> {
  const credentialReport = await getCredentialReport(profile);

  const issues: IAMUserIssue[] = [];
  const rootUser = credentialReport.find(u => u.user === '<root_account>');

  // Root account checks
  if (rootUser) {
    issues.push(...analyzeRootAccount(rootUser));
  }

  // Per-user credential checks
  for (const user of credentialReport) {
    if (user.user === '<root_account>') continue;
    issues.push(...analyzeUserCredentials(user));
  }

  // Direct policy attachment checks (requires API calls)
  try {
    const directPolicyIssues = await checkDirectPolicies(profile, credentialReport);
    issues.push(...directPolicyIssues);
  } catch {
    // Non-fatal: credential-based checks still available
  }

  const summary = {
    rootIssues: issues.filter(i => i.category === 'root_account').length,
    noMFA: issues.filter(i => i.category === 'mfa').length,
    oldAccessKeys: issues.filter(i => i.category === 'access_key_rotation').length,
    unusedCredentials: issues.filter(i => i.category === 'unused_credentials').length,
    multipleActiveKeys: issues.filter(i => i.category === 'multiple_keys').length,
    directPolicies: issues.filter(i => i.category === 'direct_policy').length,
  };

  return {
    totalUsers: credentialReport.filter(u => u.user !== '<root_account>').length,
    issues,
    summary,
    score: computeScore(issues),
  };
}

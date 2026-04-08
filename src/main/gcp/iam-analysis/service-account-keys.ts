// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';
import { GCPServiceAccountKeyIssue } from './types';

const KEY_AGE_THRESHOLD_DAYS = 90;

export async function analyzeServiceAccountKeys(projectId: string): Promise<GCPServiceAccountKeyIssue[]> {
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  const iam = google.iam({ version: 'v1', auth });

  // List all service accounts in the project
  const response = await iam.projects.serviceAccounts.list({
    name: `projects/${projectId}`,
  });

  const serviceAccounts = response.data.accounts || [];
  const issues: GCPServiceAccountKeyIssue[] = [];

  for (const sa of serviceAccounts) {
    if (!sa.email) continue;

    // Skip default/managed service accounts
    if (sa.email.includes('compute@developer') || sa.email.includes('appspot')) continue;

    try {
      const keysResponse = await iam.projects.serviceAccounts.keys.list({
        name: `projects/${projectId}/serviceAccounts/${sa.email}`,
        keyTypes: ['USER_MANAGED'],
      });

      for (const key of keysResponse.data.keys || []) {
        const createdAt = key.validAfterTime || '';
        const expiresAt = key.validBeforeTime || undefined;
        const keyAge = Math.floor(
          (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24)
        );
        const keyId = key.name?.split('/').pop() || '';

        // User-managed keys are always a finding
        issues.push({
          serviceAccountEmail: sa.email,
          keyId,
          keyType: 'USER_MANAGED',
          createdAt,
          expiresAt: expiresAt || undefined,
          keyAgeInDays: keyAge,
          issue:
            keyAge > KEY_AGE_THRESHOLD_DAYS
              ? `User-managed key is ${keyAge} days old (>${KEY_AGE_THRESHOLD_DAYS} days)`
              : 'User-managed key exists (prefer Workload Identity)',
          severity: keyAge > KEY_AGE_THRESHOLD_DAYS ? 'HIGH' : 'MEDIUM',
        });
      }
    } catch {
      // Skip SAs we can't read keys for
    }
  }

  return issues;
}

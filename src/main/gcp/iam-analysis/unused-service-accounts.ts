// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';
import { GCPUnusedServiceAccount } from './types';

export async function findUnusedServiceAccounts(projectId: string): Promise<GCPUnusedServiceAccount[]> {
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  const iam = google.iam({ version: 'v1', auth });

  // List all service accounts in the project
  const response = await iam.projects.serviceAccounts.list({
    name: `projects/${projectId}`,
  });

  const serviceAccounts = response.data.accounts || [];
  const unused: GCPUnusedServiceAccount[] = [];

  // Set up recommender client for IAM insights
  const recommender = google.recommender({ version: 'v1', auth });

  // Fetch all active IAM service account insights in one call
  let insightsByEmail: Map<string, { lastAuthenticatedTime?: string }> = new Map();
  let recommenderAvailable = true;

  try {
    const insightsResponse = await recommender.projects.locations.insightTypes.insights.list({
      parent: `projects/${projectId}/locations/-/insightTypes/google.iam.serviceAccount.Insight`,
      filter: 'stateInfo.state=ACTIVE',
    });

    const insights = insightsResponse.data.insights || [];
    for (const insight of insights) {
      const targetEmail = insight.content?.email as string | undefined;
      if (targetEmail) {
        insightsByEmail.set(targetEmail, {
          lastAuthenticatedTime: insight.content?.lastAuthenticatedTime as string | undefined,
        });
      }
    }
  } catch {
    // Recommender API not enabled or not accessible
    recommenderAvailable = false;
  }

  for (const sa of serviceAccounts) {
    if (!sa.email) continue;

    // Skip non-custom service accounts (default compute, App Engine, etc.)
    if (!sa.email.endsWith('.iam.gserviceaccount.com')) continue;
    if (sa.email.includes('compute@developer') || sa.email.includes('appspot')) continue;

    // Count user-managed keys for this SA
    let keyCount = 0;
    let hasUserKeys = false;
    try {
      const keysResponse = await iam.projects.serviceAccounts.keys.list({
        name: `projects/${projectId}/serviceAccounts/${sa.email}`,
        keyTypes: ['USER_MANAGED'],
      });
      keyCount = keysResponse.data.keys?.length || 0;
      hasUserKeys = keyCount > 0;
    } catch {
      // Skip if we can't read keys
    }

    if (recommenderAvailable) {
      // Check if the recommender flagged this SA as unused
      const insight = insightsByEmail.get(sa.email);
      if (insight) {
        const lastActivity = insight.lastAuthenticatedTime;
        const daysSince = lastActivity
          ? Math.floor((Date.now() - new Date(lastActivity).getTime()) / (1000 * 60 * 60 * 24))
          : 365;

        unused.push({
          email: sa.email,
          displayName: sa.displayName || '',
          projectId: sa.projectId || projectId,
          uniqueId: sa.uniqueId || '',
          lastActivityDate: lastActivity,
          daysSinceLastActivity: daysSince,
          hasKeys: hasUserKeys,
          keyCount,
          disabled: sa.disabled || false,
        });
      }
    } else {
      // Recommender not available - fall back to reporting disabled SAs
      if (sa.disabled) {
        unused.push({
          email: sa.email,
          displayName: sa.displayName || '',
          projectId: sa.projectId || projectId,
          uniqueId: sa.uniqueId || '',
          daysSinceLastActivity: -1,
          hasKeys: hasUserKeys,
          keyCount,
          disabled: true,
        });
      }
    }
  }

  return unused;
}

// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  ListRolesCommand,
  GetServiceLastAccessedDetailsCommand,
  GenerateServiceLastAccessedDetailsCommand,
} from '@aws-sdk/client-iam';
import { getClientFactory } from '../client-factory';
import type { UnusedRole } from './types';

const UNUSED_THRESHOLD_DAYS = 90;

async function waitForJobCompletion(
  profile: string,
  jobId: string,
  maxAttempts = 10
): Promise<'COMPLETED' | 'FAILED'> {
  const client = getClientFactory().getIAMClient({ profile, region: 'us-east-1' });

  for (let i = 0; i < maxAttempts; i++) {
    const result = await client.send(
      new GetServiceLastAccessedDetailsCommand({ JobId: jobId })
    );
    if (result.JobStatus === 'COMPLETED') return 'COMPLETED';
    if (result.JobStatus === 'FAILED') return 'FAILED';
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  return 'FAILED';
}

export async function findUnusedRoles(profile: string): Promise<UnusedRole[]> {
  const client = getClientFactory().getIAMClient({ profile, region: 'us-east-1' });
  const unusedRoles: UnusedRole[] = [];

  // List all roles (paginated)
  let marker: string | undefined;
  const allRoles: Array<{
    RoleName: string;
    Arn: string;
    CreateDate: Date;
    RoleLastUsed?: { LastUsedDate?: Date };
  }> = [];

  do {
    const response = await client.send(
      new ListRolesCommand({ Marker: marker, MaxItems: 100 })
    );

    for (const role of response.Roles || []) {
      // Skip AWS service-linked roles
      if (role.Path?.startsWith('/aws-service-role/')) continue;
      if (!role.RoleName || !role.Arn || !role.CreateDate) continue;

      allRoles.push({
        RoleName: role.RoleName,
        Arn: role.Arn,
        CreateDate: role.CreateDate,
        RoleLastUsed: role.RoleLastUsed,
      });
    }

    marker = response.IsTruncated ? response.Marker : undefined;
  } while (marker);

  // Batch check roles (5 at a time to respect rate limits)
  const batchSize = 5;
  for (let i = 0; i < allRoles.length; i += batchSize) {
    const batch = allRoles.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map(async (role) => {
        // Check last used date from role metadata first
        const lastUsed = role.RoleLastUsed?.LastUsedDate;
        const daysSinceLastUse = lastUsed
          ? Math.floor((Date.now() - lastUsed.getTime()) / (1000 * 60 * 60 * 24))
          : Math.floor((Date.now() - role.CreateDate.getTime()) / (1000 * 60 * 60 * 24));

        if (daysSinceLastUse < UNUSED_THRESHOLD_DAYS) return null;

        // For roles that appear unused, verify via service last accessed
        try {
          const genResult = await client.send(
            new GenerateServiceLastAccessedDetailsCommand({ Arn: role.Arn })
          );
          if (!genResult.JobId) return null;

          const status = await waitForJobCompletion(profile, genResult.JobId);
          if (status !== 'COMPLETED') return null;

          const details = await client.send(
            new GetServiceLastAccessedDetailsCommand({ JobId: genResult.JobId })
          );

          // Check if any service was accessed recently
          const recentAccess = (details.ServicesLastAccessed || []).some((svc) => {
            if (!svc.LastAuthenticated) return false;
            const daysAgo = Math.floor(
              (Date.now() - svc.LastAuthenticated.getTime()) / (1000 * 60 * 60 * 24)
            );
            return daysAgo < UNUSED_THRESHOLD_DAYS;
          });

          if (recentAccess) return null;
        } catch {
          // If we can't check service access, fall back to role last used
        }

        return {
          roleName: role.RoleName,
          roleArn: role.Arn,
          createdDate: role.CreateDate.toISOString(),
          lastUsedDate: lastUsed?.toISOString(),
          daysSinceLastUse,
          hasInlinePolicies: false, // Simplified — full check would need ListRolePolicies
          attachedPolicyCount: 0,
        } as UnusedRole;
      })
    );

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value) {
        unusedRoles.push(result.value);
      }
    }
  }

  return unusedRoles;
}

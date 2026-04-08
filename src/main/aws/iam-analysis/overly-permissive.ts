// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  ListPoliciesCommand,
  GetPolicyVersionCommand,
} from '@aws-sdk/client-iam';
import { getClientFactory } from '../client-factory';
import type { OverlyPermissivePolicy } from './types';

export async function findOverlyPermissivePolicies(
  profile: string
): Promise<OverlyPermissivePolicy[]> {
  const client = getClientFactory().getIAMClient({ profile, region: 'us-east-1' });
  const results: OverlyPermissivePolicy[] = [];

  // List customer-managed policies only (Scope: Local)
  let marker: string | undefined;
  const policies: Array<{
    PolicyName: string;
    Arn: string;
    DefaultVersionId: string;
    AttachmentCount: number;
    IsAttachable: boolean;
  }> = [];

  do {
    const response = await client.send(
      new ListPoliciesCommand({ Scope: 'Local', Marker: marker, MaxItems: 100 })
    );

    for (const policy of response.Policies || []) {
      if (!policy.PolicyName || !policy.Arn || !policy.DefaultVersionId) continue;
      policies.push({
        PolicyName: policy.PolicyName,
        Arn: policy.Arn,
        DefaultVersionId: policy.DefaultVersionId,
        AttachmentCount: policy.AttachmentCount || 0,
        IsAttachable: policy.IsAttachable !== false,
      });
    }

    marker = response.IsTruncated ? response.Marker : undefined;
  } while (marker);

  // Batch analyze policies (5 at a time)
  const batchSize = 5;
  for (let i = 0; i < policies.length; i += batchSize) {
    const batch = policies.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(
      batch.map(async (policy) => {
        const versionResponse = await client.send(
          new GetPolicyVersionCommand({
            PolicyArn: policy.Arn,
            VersionId: policy.DefaultVersionId,
          })
        );

        const policyDoc = versionResponse.PolicyVersion?.Document;
        if (!policyDoc) return null;

        const doc = JSON.parse(decodeURIComponent(policyDoc));
        const statements = Array.isArray(doc.Statement) ? doc.Statement : [doc.Statement];

        let wildcardActions = false;
        let wildcardResources = false;
        const dangerousStatements: string[] = [];

        for (const stmt of statements) {
          if (stmt.Effect !== 'Allow') continue;

          const actions = Array.isArray(stmt.Action) ? stmt.Action : [stmt.Action];
          const resources = Array.isArray(stmt.Resource) ? stmt.Resource : [stmt.Resource];

          const hasWildcardAction = actions.some(
            (a: string) => a === '*'
          );
          const hasWildcardResource = resources.some(
            (r: string) => r === '*'
          );

          if (hasWildcardAction) wildcardActions = true;
          if (hasWildcardResource) wildcardResources = true;

          if (hasWildcardAction && hasWildcardResource) {
            dangerousStatements.push('Full admin: Action=* Resource=*');
          } else if (hasWildcardAction) {
            dangerousStatements.push(
              `Wildcard actions on: ${resources.join(', ')}`
            );
          } else if (hasWildcardResource) {
            const dangerousActions = actions.filter(
              (a: string) =>
                a.includes(':*') ||
                a.includes(':Delete') ||
                a.includes(':Put') ||
                a.includes(':Create') ||
                a.includes(':Update')
            );
            if (dangerousActions.length > 0) {
              dangerousStatements.push(
                `Write actions on all resources: ${dangerousActions.slice(0, 3).join(', ')}${dangerousActions.length > 3 ? '...' : ''}`
              );
            }
          }
        }

        if (dangerousStatements.length === 0) return null;

        return {
          policyName: policy.PolicyName,
          policyArn: policy.Arn,
          isAWSManaged: false,
          attachmentCount: policy.AttachmentCount,
          wildcardActions,
          wildcardResources,
          dangerousStatements,
        } as OverlyPermissivePolicy;
      })
    );

    for (const result of batchResults) {
      if (result.status === 'fulfilled' && result.value) {
        results.push(result.value);
      }
    }
  }

  return results;
}

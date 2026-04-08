// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  ListRolesCommand,
} from '@aws-sdk/client-iam';
import {
  GetCallerIdentityCommand,
} from '@aws-sdk/client-sts';
import { getClientFactory } from '../client-factory';
import type { CrossAccountTrust } from './types';

function extractAccountIds(principal: unknown): string[] {
  if (!principal || typeof principal !== 'object') return [];
  const p = principal as Record<string, unknown>;

  const awsPrincipals: string[] = [];
  const awsField = p.AWS;

  if (typeof awsField === 'string') {
    awsPrincipals.push(awsField);
  } else if (Array.isArray(awsField)) {
    awsPrincipals.push(...awsField.filter((v): v is string => typeof v === 'string'));
  }

  const results: string[] = [];
  for (const arn of awsPrincipals) {
    // arn:aws:iam::ACCOUNT_ID:root or arn:aws:iam::ACCOUNT_ID:role/... or just ACCOUNT_ID
    const arnMatch = arn.match(/arn:aws:iam::(\d{12}):/);
    if (arnMatch) {
      results.push(arnMatch[1]);
    } else if (/^\d{12}$/.test(arn)) {
      results.push(arn);
    }
  }

  return results;
}

function extractConditionKeys(condition: unknown): string[] {
  if (!condition || typeof condition !== 'object') return [];
  const keys: string[] = [];
  const cond = condition as Record<string, Record<string, unknown>>;

  for (const operator of Object.keys(cond)) {
    for (const key of Object.keys(cond[operator] || {})) {
      keys.push(`${operator}: ${key}`);
    }
  }
  return keys;
}

export async function findCrossAccountTrusts(
  profile: string
): Promise<CrossAccountTrust[]> {
  const clientFactory = getClientFactory();
  const iamClient = clientFactory.getIAMClient({ profile, region: 'us-east-1' });
  const stsClient = clientFactory.getSTSClient({ profile, region: 'us-east-1' });

  // Get current account ID
  const identity = await stsClient.send(new GetCallerIdentityCommand({}));
  const currentAccountId = identity.Account;
  if (!currentAccountId) throw new Error('Could not determine current account ID');

  const trusts: CrossAccountTrust[] = [];

  // List all roles
  let marker: string | undefined;
  do {
    const response = await iamClient.send(
      new ListRolesCommand({ Marker: marker, MaxItems: 100 })
    );

    for (const role of response.Roles || []) {
      if (!role.RoleName || !role.Arn || !role.AssumeRolePolicyDocument) continue;

      // Skip service-linked roles
      if (role.Path?.startsWith('/aws-service-role/')) continue;

      try {
        const trustPolicy = JSON.parse(decodeURIComponent(role.AssumeRolePolicyDocument));
        const statements = Array.isArray(trustPolicy.Statement)
          ? trustPolicy.Statement
          : [trustPolicy.Statement];

        for (const stmt of statements) {
          if (stmt.Effect !== 'Allow') continue;

          const accountIds = extractAccountIds(stmt.Principal);
          const conditionKeys = extractConditionKeys(stmt.Condition);

          for (const accountId of accountIds) {
            if (accountId !== currentAccountId) {
              const awsPrincipals = Array.isArray(stmt.Principal?.AWS)
                ? stmt.Principal.AWS
                : [stmt.Principal?.AWS].filter(Boolean);

              const principalStr = awsPrincipals.find(
                (p: string) => p.includes(accountId)
              ) || accountId;

              trusts.push({
                roleName: role.RoleName,
                roleArn: role.Arn,
                trustedAccountId: accountId,
                trustedPrincipal: principalStr,
                isExternalAccount: true,
                conditionKeys,
              });
            }
          }
        }
      } catch {
        // Skip roles with unparseable trust policies
      }
    }

    marker = response.IsTruncated ? response.Marker : undefined;
  } while (marker);

  return trusts;
}

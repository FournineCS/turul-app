// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GetAccountPasswordPolicyCommand } from '@aws-sdk/client-iam';
import { getClientFactory } from '../client-factory';
import type { PasswordPolicyCompliance, PasswordPolicyCheck } from './types';

export async function analyzePasswordPolicy(
  profile: string
): Promise<PasswordPolicyCompliance> {
  const client = getClientFactory().getIAMClient({ profile, region: 'us-east-1' });

  try {
    const response = await client.send(new GetAccountPasswordPolicyCommand({}));
    const policy = response.PasswordPolicy;

    if (!policy) {
      return {
        hasPolicy: false,
        checks: [
          {
            check: 'Password Policy Exists',
            current: 'No policy',
            recommended: 'Custom password policy',
            compliant: false,
          },
        ],
        score: 0,
      };
    }

    const checks: PasswordPolicyCheck[] = [
      {
        check: 'Minimum Password Length',
        current: String(policy.MinimumPasswordLength || 0),
        recommended: '14',
        compliant: (policy.MinimumPasswordLength || 0) >= 14,
      },
      {
        check: 'Require Uppercase',
        current: policy.RequireUppercaseCharacters ? 'Yes' : 'No',
        recommended: 'Yes',
        compliant: policy.RequireUppercaseCharacters === true,
      },
      {
        check: 'Require Lowercase',
        current: policy.RequireLowercaseCharacters ? 'Yes' : 'No',
        recommended: 'Yes',
        compliant: policy.RequireLowercaseCharacters === true,
      },
      {
        check: 'Require Numbers',
        current: policy.RequireNumbers ? 'Yes' : 'No',
        recommended: 'Yes',
        compliant: policy.RequireNumbers === true,
      },
      {
        check: 'Require Symbols',
        current: policy.RequireSymbols ? 'Yes' : 'No',
        recommended: 'Yes',
        compliant: policy.RequireSymbols === true,
      },
      {
        check: 'Password Expiration',
        current: policy.MaxPasswordAge ? `${policy.MaxPasswordAge} days` : 'Never',
        recommended: '90 days or less',
        compliant: (policy.MaxPasswordAge || Infinity) <= 90,
      },
      {
        check: 'Password Reuse Prevention',
        current: policy.PasswordReusePrevention
          ? `Last ${policy.PasswordReusePrevention}`
          : 'None',
        recommended: 'Last 24',
        compliant: (policy.PasswordReusePrevention || 0) >= 24,
      },
      {
        check: 'Allow Users to Change Password',
        current: policy.AllowUsersToChangePassword ? 'Yes' : 'No',
        recommended: 'Yes',
        compliant: policy.AllowUsersToChangePassword === true,
      },
    ];

    const compliantCount = checks.filter((c) => c.compliant).length;
    const score = Math.round((compliantCount / checks.length) * 100);

    return {
      hasPolicy: true,
      checks,
      score,
    };
  } catch (err: unknown) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    // NoSuchEntity means no custom policy exists
    if (errorMessage.includes('NoSuchEntity')) {
      return {
        hasPolicy: false,
        checks: [
          {
            check: 'Password Policy Exists',
            current: 'Using AWS default',
            recommended: 'Custom password policy',
            compliant: false,
          },
        ],
        score: 0,
      };
    }
    throw err;
  }
}

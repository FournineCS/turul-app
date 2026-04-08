// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { findUnusedRoles } from './unused-roles';
import { findOverlyPermissivePolicies } from './overly-permissive';
import { findCrossAccountTrusts } from './cross-account-trust';
import { analyzePasswordPolicy } from './password-policy';
import { analyzeIAMUsers } from './user-analysis';
import type { IAMAnalysisResult } from './types';

export type {
  IAMAnalysisResult,
  UnusedRole,
  OverlyPermissivePolicy,
  CrossAccountTrust,
  PasswordPolicyCompliance,
  PasswordPolicyCheck,
  IAMUserIssue,
  IAMUserAnalysisResult,
  IAMUserAnalysisSummary,
  UserIssueSeverity,
} from './types';

export async function runIAMAnalysis(profile: string): Promise<IAMAnalysisResult> {
  const errors: string[] = [];

  const [unusedRolesResult, permissiveResult, crossAccountResult, passwordResult, userAnalysisResult] =
    await Promise.allSettled([
      findUnusedRoles(profile),
      findOverlyPermissivePolicies(profile),
      findCrossAccountTrusts(profile),
      analyzePasswordPolicy(profile),
      analyzeIAMUsers(profile),
    ]);

  const unusedRoles =
    unusedRolesResult.status === 'fulfilled'
      ? unusedRolesResult.value
      : (() => {
          errors.push(`Unused roles: ${unusedRolesResult.reason}`);
          return [];
        })();

  const overlyPermissivePolicies =
    permissiveResult.status === 'fulfilled'
      ? permissiveResult.value
      : (() => {
          errors.push(`Permissive policies: ${permissiveResult.reason}`);
          return [];
        })();

  const crossAccountTrusts =
    crossAccountResult.status === 'fulfilled'
      ? crossAccountResult.value
      : (() => {
          errors.push(`Cross-account trusts: ${crossAccountResult.reason}`);
          return [];
        })();

  const passwordPolicy =
    passwordResult.status === 'fulfilled'
      ? passwordResult.value
      : (() => {
          errors.push(`Password policy: ${passwordResult.reason}`);
          return { hasPolicy: false, checks: [], score: 0 };
        })();

  const userAnalysis =
    userAnalysisResult.status === 'fulfilled'
      ? userAnalysisResult.value
      : (() => {
          errors.push(`User analysis: ${userAnalysisResult.reason}`);
          return { totalUsers: 0, issues: [], summary: { rootIssues: 0, noMFA: 0, oldAccessKeys: 0, unusedCredentials: 0, multipleActiveKeys: 0, directPolicies: 0 }, score: 0 };
        })();

  return {
    unusedRoles,
    overlyPermissivePolicies,
    crossAccountTrusts,
    passwordPolicy,
    userAnalysis,
    analyzedAt: new Date().toISOString(),
    errors,
  };
}

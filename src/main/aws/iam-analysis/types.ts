// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

export interface UnusedRole {
  roleName: string;
  roleArn: string;
  createdDate: string;
  lastUsedDate?: string;
  daysSinceLastUse: number;
  hasInlinePolicies: boolean;
  attachedPolicyCount: number;
}

export interface OverlyPermissivePolicy {
  policyName: string;
  policyArn: string;
  isAWSManaged: boolean;
  attachmentCount: number;
  wildcardActions: boolean;
  wildcardResources: boolean;
  dangerousStatements: string[];
}

export interface CrossAccountTrust {
  roleName: string;
  roleArn: string;
  trustedAccountId: string;
  trustedPrincipal: string;
  isExternalAccount: boolean;
  conditionKeys: string[];
}

export interface PasswordPolicyCheck {
  check: string;
  current: string;
  recommended: string;
  compliant: boolean;
}

export interface PasswordPolicyCompliance {
  hasPolicy: boolean;
  checks: PasswordPolicyCheck[];
  score: number; // 0-100
}

export type UserIssueSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface IAMUserIssue {
  userName: string;
  userArn: string;
  issue: string;
  severity: UserIssueSeverity;
  category: 'mfa' | 'access_key_rotation' | 'unused_credentials' | 'multiple_keys' | 'direct_policy' | 'root_account';
  detail: string;
}

export interface IAMUserAnalysisSummary {
  rootIssues: number;
  noMFA: number;
  oldAccessKeys: number;
  unusedCredentials: number;
  multipleActiveKeys: number;
  directPolicies: number;
}

export interface IAMUserAnalysisResult {
  totalUsers: number;
  issues: IAMUserIssue[];
  summary: IAMUserAnalysisSummary;
  score: number;
}

export interface IAMAnalysisResult {
  unusedRoles: UnusedRole[];
  overlyPermissivePolicies: OverlyPermissivePolicy[];
  crossAccountTrusts: CrossAccountTrust[];
  passwordPolicy: PasswordPolicyCompliance;
  userAnalysis?: IAMUserAnalysisResult;
  analyzedAt: string;
  errors: string[];
}

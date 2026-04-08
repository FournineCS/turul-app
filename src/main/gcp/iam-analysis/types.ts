// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

export interface GCPUnusedServiceAccount {
  email: string;
  displayName: string;
  projectId: string;
  uniqueId: string;
  lastActivityDate?: string;
  daysSinceLastActivity: number;
  hasKeys: boolean;
  keyCount: number;
  disabled: boolean;
}

export interface GCPOverlyPermissiveBinding {
  member: string;
  memberType: 'serviceAccount' | 'user' | 'group' | 'domain';
  role: string;
  roleType: 'primitive' | 'predefined' | 'custom';
  projectId: string;
  isOrgLevel: boolean;
  reason: string;
}

export interface GCPServiceAccountKeyIssue {
  serviceAccountEmail: string;
  keyId: string;
  keyType: 'USER_MANAGED' | 'SYSTEM_MANAGED';
  createdAt: string;
  expiresAt?: string;
  keyAgeInDays: number;
  issue: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface GCPCrossProjectBinding {
  sourceProjectId: string;
  member: string;
  memberProjectId: string;
  role: string;
  isExternalProject: boolean;
}

export interface GCPIAMAnalysisResult {
  id: string;
  projectId: string;
  unusedServiceAccounts: GCPUnusedServiceAccount[];
  overlyPermissiveBindings: GCPOverlyPermissiveBinding[];
  serviceAccountKeyIssues: GCPServiceAccountKeyIssue[];
  crossProjectBindings: GCPCrossProjectBinding[];
  analyzedAt: string;
  duration: number;
  errors: string[];
}

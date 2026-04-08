// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import crypto from 'crypto';
import { GCPIAMAnalysisResult } from './types';
import { findUnusedServiceAccounts } from './unused-service-accounts';
import { findOverlyPermissiveBindings } from './overly-permissive';
import { analyzeServiceAccountKeys } from './service-account-keys';
import { findCrossProjectBindings } from './cross-project-bindings';

export async function runGCPIAMAnalysis(projectId: string): Promise<GCPIAMAnalysisResult> {
  const startTime = Date.now();
  const errors: string[] = [];

  const [unusedResult, permissiveResult, keysResult, crossProjectResult] = await Promise.allSettled([
    findUnusedServiceAccounts(projectId),
    findOverlyPermissiveBindings(projectId),
    analyzeServiceAccountKeys(projectId),
    findCrossProjectBindings(projectId),
  ]);

  const unusedServiceAccounts =
    unusedResult.status === 'fulfilled' ? unusedResult.value : [];
  if (unusedResult.status === 'rejected') {
    errors.push(`Unused service accounts analysis failed: ${unusedResult.reason}`);
  }

  const overlyPermissiveBindings =
    permissiveResult.status === 'fulfilled' ? permissiveResult.value : [];
  if (permissiveResult.status === 'rejected') {
    errors.push(`Overly permissive bindings analysis failed: ${permissiveResult.reason}`);
  }

  const serviceAccountKeyIssues =
    keysResult.status === 'fulfilled' ? keysResult.value : [];
  if (keysResult.status === 'rejected') {
    errors.push(`Service account keys analysis failed: ${keysResult.reason}`);
  }

  const crossProjectBindings =
    crossProjectResult.status === 'fulfilled' ? crossProjectResult.value : [];
  if (crossProjectResult.status === 'rejected') {
    errors.push(`Cross-project bindings analysis failed: ${crossProjectResult.reason}`);
  }

  return {
    id: crypto.randomUUID(),
    projectId,
    unusedServiceAccounts,
    overlyPermissiveBindings,
    serviceAccountKeyIssues,
    crossProjectBindings,
    analyzedAt: new Date().toISOString(),
    duration: Date.now() - startTime,
    errors,
  };
}

export type {
  GCPIAMAnalysisResult,
  GCPUnusedServiceAccount,
  GCPOverlyPermissiveBinding,
  GCPServiceAccountKeyIssue,
  GCPCrossProjectBinding,
} from './types';

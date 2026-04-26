// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GoogleAuth, type AuthClient } from 'google-auth-library';
import { SecurityCenterClient } from '@google-cloud/security-center';
import { google } from 'googleapis';

/**
 * SCC client construction + scope resolution.
 *
 * Why this module exists:
 *
 *  1. ADC user credentials require a `quota_project_id` for billing/quota
 *     attribution on `securitycenter.googleapis.com`. Setting it via
 *     `GoogleAuth({ clientOptions: { quotaProjectId } })` does NOT propagate
 *     to `UserRefreshClient` (only to service-account clients). The supported
 *     path is to assign `authClient.quotaProjectId` after `getClient()`.
 *     See: https://cloud.google.com/docs/authentication/adc-troubleshooting/user-creds
 *
 *  2. When SCC is activated only at the organization level (Premium/Enterprise),
 *     project-scoped queries (`projects/{id}/sources/-`) return PERMISSION_DENIED.
 *     Findings live under `organizations/{org_id}/sources/...`. We discover the
 *     org via Cloud Resource Manager v3 ancestry walk and prefer org-scope.
 */

const ORG_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const orgIdCache = new Map<string, { orgId: string | null; ts: number }>();

interface AuthClientWithQuota extends AuthClient {
  quotaProjectId?: string;
}

/**
 * Build a SecurityCenterClient with `quotaProjectId` correctly set on the
 * underlying auth client (works for both user-cred and SA ADC).
 */
export async function createSecurityCenterClient(
  quotaProjectId: string,
): Promise<SecurityCenterClient> {
  const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    projectId: quotaProjectId,
  });
  const authClient = (await auth.getClient()) as AuthClientWithQuota;
  // This is the line that actually attaches the `x-goog-user-project` header
  // for UserRefreshClient (gcloud ADC). clientOptions.quotaProjectId is silently
  // ignored for user creds in google-auth-library.
  authClient.quotaProjectId = quotaProjectId;
  if (process.env.SCC_DEBUG) {
    console.log(
      `[SCC] createSecurityCenterClient: quotaProjectId=${quotaProjectId || '<empty>'} ` +
      `authClientType=${authClient.constructor?.name} ` +
      `attached=${authClient.quotaProjectId === quotaProjectId}`,
    );
  }
  // SecurityCenterClient's typed authClient narrows to a JSONClient union
  // resolved via google-gax's bundled google-auth-library copy, which is a
  // structurally-distinct type from our top-level google-auth-library import.
  // Runtime is fine — the same UserRefreshClient/JWT instance is honored by
  // both — so a double-unknown cast is the right knot to cut here.
  return new SecurityCenterClient({
    authClient: authClient as unknown as never,
    projectId: quotaProjectId,
  });
}

/**
 * Walk the Resource Manager v3 parent chain from a project up to the org.
 * Returns null if the project sits outside an organization (rare, but
 * possible for legacy standalone projects).
 *
 * Uses v3 `projects.get` and `folders.get` — both require only read on the
 * resource itself (no org-level permissions needed for the walk).
 */
export async function discoverOrgId(projectId: string): Promise<string | null> {
  const cached = orgIdCache.get(projectId);
  if (cached && Date.now() - cached.ts < ORG_CACHE_TTL_MS) {
    return cached.orgId;
  }

  try {
    const auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform.read-only'],
    });
    const crm = google.cloudresourcemanager({ version: 'v3', auth });

    let parent: string | undefined;
    const projectResp = await crm.projects.get({ name: `projects/${projectId}` });
    parent = projectResp.data.parent || undefined;

    // Walk up folders until we hit an organization or run out of parents.
    let safety = 32;
    while (parent && parent.startsWith('folders/') && safety-- > 0) {
      const folderResp = await crm.folders.get({ name: parent });
      parent = folderResp.data.parent || undefined;
    }

    const orgId = parent && parent.startsWith('organizations/')
      ? parent.slice('organizations/'.length)
      : null;
    orgIdCache.set(projectId, { orgId, ts: Date.now() });
    return orgId;
  } catch (err) {
    // No ancestry access — most commonly caller lacks resourcemanager.projects.get
    // or resourcemanager.folders.get on the parent chain. Surface the cause so a
    // PERMISSION_DENIED downstream can be traced back here. Cache the negative
    // for the TTL so we don't hammer.
    const msg = err instanceof Error ? err.message : String(err);
    console.error(
      `[SCC] org auto-discovery failed for project ${projectId} — falling back to project scope. Underlying: ${msg}`,
    );
    orgIdCache.set(projectId, { orgId: null, ts: Date.now() });
    return null;
  }
}

export type OrgIdSource = 'settings' | 'discovered' | 'none';

export interface ResolvedSccParent {
  parent: string;
  scope: 'organization' | 'project';
  /**
   * When set, callers should AND this into the listFindings filter to scope
   * org-wide results to a single project. Empty string at project scope.
   */
  resourceFilter: string;
  orgId?: string;
  /** How the orgId was obtained — needed to diagnose silent fallbacks. */
  orgIdSource: OrgIdSource;
}

/**
 * Decide the listFindings parent. Preference order:
 *   1. user-supplied org override (from Settings)
 *   2. auto-discovered org from project ancestry
 *   3. project-scope fallback
 */
export async function resolveSccParent(
  projectId: string,
  orgIdOverride?: string,
): Promise<ResolvedSccParent> {
  const trimmedOverride = orgIdOverride?.trim();
  if (trimmedOverride) {
    return {
      parent: `organizations/${trimmedOverride}/sources/-`,
      scope: 'organization',
      resourceFilter: `resourceName : "/projects/${projectId}/"`,
      orgId: trimmedOverride,
      orgIdSource: 'settings',
    };
  }
  const discoveredOrgId = await discoverOrgId(projectId);
  if (discoveredOrgId) {
    return {
      parent: `organizations/${discoveredOrgId}/sources/-`,
      scope: 'organization',
      // Filter findings to the active project's resources only. SCC findings
      // store the canonical resource name, e.g. for a GCE instance:
      //   //compute.googleapis.com/projects/PROJECT_ID/zones/.../instances/...
      // Substring match keeps it simple and works across resource types.
      resourceFilter: `resourceName : "/projects/${projectId}/"`,
      orgId: discoveredOrgId,
      orgIdSource: 'discovered',
    };
  }
  return {
    parent: `projects/${projectId}/sources/-`,
    scope: 'project',
    resourceFilter: '',
    orgIdSource: 'none',
  };
}

/** Heuristic — is the underlying gRPC error the quota-project variant? */
export function isQuotaProjectError(message: string): boolean {
  return /adc-troubleshooting\/user-creds/.test(message)
    || /requires a quota project/.test(message);
}

/**
 * Numeric gRPC status code (or null if not a gRPC error). See
 * https://grpc.github.io/grpc/core/md_doc_statuscodes.html for the mapping.
 * Common ones we care about: 5=NOT_FOUND, 7=PERMISSION_DENIED,
 * 9=FAILED_PRECONDITION, 16=UNAUTHENTICATED.
 */
export function extractGrpcCode(error: unknown): number | null {
  if (!error || typeof error !== 'object') return null;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'number' ? code : null;
}

/** Human-readable name for a gRPC numeric status code, for log lines. */
export function grpcCodeName(code: number | null): string {
  if (code == null) return 'UNKNOWN';
  const names: Record<number, string> = {
    0: 'OK', 1: 'CANCELLED', 2: 'UNKNOWN', 3: 'INVALID_ARGUMENT',
    4: 'DEADLINE_EXCEEDED', 5: 'NOT_FOUND', 6: 'ALREADY_EXISTS',
    7: 'PERMISSION_DENIED', 8: 'RESOURCE_EXHAUSTED', 9: 'FAILED_PRECONDITION',
    10: 'ABORTED', 11: 'OUT_OF_RANGE', 12: 'UNIMPLEMENTED', 13: 'INTERNAL',
    14: 'UNAVAILABLE', 15: 'DATA_LOSS', 16: 'UNAUTHENTICATED',
  };
  return names[code] ?? `CODE_${code}`;
}

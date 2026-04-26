// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import crypto from 'crypto';
import type {
  SecurityAnalysisResult,
  SecurityFinding,
  SecurityPostureSummary,
  FindingSeverity,
  FindingSource,
  FindingStatus,
  SccProbeResult,
} from '../../../shared/types';
import {
  createSecurityCenterClient,
  resolveSccParent,
  isQuotaProjectError,
  extractGrpcCode,
  grpcCodeName,
  type ResolvedSccParent,
  type OrgIdSource,
} from './scc-client';

export interface SccQueryOptions {
  /** Manual org-id override from Settings; empty string = auto-discover. */
  orgId?: string;
  includeResolved?: boolean;
}

/**
 * Fetch security findings from Google Cloud Security Command Center.
 *
 * Resolution order for the listFindings parent:
 *   1. Caller-supplied org id (Settings → "Default SCC Organization ID")
 *   2. Auto-discovered org id via Resource Manager v3 ancestry walk
 *   3. project-scope fallback (only works if SCC is project-activated)
 */
export async function getGCPSecurityPosture(
  projectId: string,
  options: SccQueryOptions = {},
): Promise<SecurityAnalysisResult> {
  const startTime = Date.now();
  const includeResolved = options.includeResolved ?? false;

  let parentInfo: ResolvedSccParent;
  try {
    parentInfo = await resolveSccParent(projectId, options.orgId);
  } catch (error) {
    return failureResult(projectId, startTime, error, {
      scope: 'project',
      parent: `projects/${projectId}/sources/-`,
      filter: '',
      orgIdSource: 'none',
      quotaProject: projectId,
    });
  }

  const client = await createSecurityCenterClient(projectId);

  // Always exclude muted findings: SCC mute is the documented mechanism for
  // suppressing intentionally-acknowledged noise.
  const baseFilter = includeResolved
    ? 'mute!="MUTED"'
    : 'state="ACTIVE" AND mute!="MUTED"';
  const filter = parentInfo.resourceFilter
    ? `${baseFilter} AND ${parentInfo.resourceFilter}`
    : baseFilter;

  const findings: SecurityFinding[] = [];
  let count = 0;
  const maxFindings = 1000;

  try {
    const iterable = client.listFindingsAsync({
      parent: parentInfo.parent,
      filter,
      pageSize: 100,
    });

    for await (const response of iterable) {
      if (count >= maxFindings) break;

      const finding = response.finding;
      if (!finding) continue;

      findings.push({
        id: finding.name || `scc-${count}`,
        title: (finding.category as string) || 'Security Finding',
        description: (finding.description as string) || (finding.category as string) || '',
        severity: mapSCCSeverity(finding.severity as number),
        status: mapSCCState(finding.state as number),
        source: 'SECURITY_HUB' as FindingSource, // Map SCC to our generic source
        region: extractRegionFromResource(finding.resourceName as string),
        resourceType: (finding.resourceName as string)?.split('/').slice(-2, -1)[0] || undefined,
        resourceId: finding.resourceName as string || undefined,
        resourceArn: finding.resourceName as string || undefined,
        remediationRecommendation: (finding.nextSteps as string) || undefined,
        firstObservedAt: protoTimestampToIso(finding.createTime),
        lastObservedAt: protoTimestampToIso(finding.eventTime),
        generatorId: finding.category as string || undefined,
        productName: 'Security Command Center',
      });

      count++;
    }
  } catch (error) {
    return failureResult(projectId, startTime, error, {
      scope: parentInfo.scope,
      parent: parentInfo.parent,
      filter,
      orgId: parentInfo.orgId,
      orgIdSource: parentInfo.orgIdSource,
      quotaProject: projectId,
    });
  }

  return {
    id: crypto.randomUUID(),
    projectId,
    scanMode: 'security_hub',
    timestamp: new Date().toISOString(),
    duration: Date.now() - startTime,
    summary: buildSummary(findings),
    findings,
    enabledStandards: [],
  };
}

interface FailureContext {
  scope: 'organization' | 'project';
  parent: string;
  filter: string;
  orgId?: string;
  orgIdSource: OrgIdSource;
  quotaProject: string;
}

/**
 * Build a user-actionable error result. Differentiates between the three
 * common PERMISSION_DENIED variants since they share the same gRPC code:
 *   - quota project not set on user-cred ADC
 *   - caller lacks securitycenter.findings.list at the queried scope
 *   - SCC not activated at the queried scope
 *
 * Always logs the full error to the main-process console (with gRPC code,
 * details, metadata) and appends a [diag] block to the user-facing message
 * so the renderer can show the parent path / source that was actually used.
 */
function failureResult(
  projectId: string,
  startTime: number,
  error: unknown,
  ctx: FailureContext,
): SecurityAnalysisResult {
  const message = error instanceof Error ? error.message : String(error);
  const grpcCode = extractGrpcCode(error);
  const grpcName = grpcCodeName(grpcCode);
  const errObj = error as { code?: unknown; details?: unknown; metadata?: unknown } | null;

  // Always log the raw error so the main-process console has the full picture.
  // This is the evidence we've been missing across multiple debug sessions.
  console.error(
    `[SCC] listFindings failed — projectId=${projectId} parent=${ctx.parent} ` +
    `scope=${ctx.scope} orgIdSource=${ctx.orgIdSource} quotaProject=${ctx.quotaProject} ` +
    `grpcCode=${grpcCode}/${grpcName}`,
    {
      message,
      code: errObj?.code,
      details: errObj?.details,
      metadata: errObj?.metadata,
    },
  );

  let userMessage: string;
  if (isQuotaProjectError(message)) {
    userMessage =
      `SCC API quota project is not set. Run: gcloud auth application-default ` +
      `set-quota-project ${projectId} — or configure a different project in Settings → ` +
      `"Default Security Command Center Project".`;
  } else if (grpcCode === 7 || /PERMISSION_DENIED/.test(message)) {
    if (ctx.scope === 'organization') {
      userMessage =
        `Permission denied querying SCC at ${ctx.parent}. ` +
        `Grant the principal "roles/securitycenter.findingsViewer" at the organization ` +
        `(or override the org id in Settings → "Default SCC Organization ID"). ` +
        `Underlying error: ${message}`;
    } else {
      userMessage =
        `Permission denied querying SCC at ${ctx.parent}. ` +
        `SCC is likely activated only at the organization level — set Settings → ` +
        `"Default SCC Organization ID" to your org id. ` +
        `Underlying error: ${message}`;
    }
  } else if (/not enabled/i.test(message)) {
    userMessage =
      `Security Command Center API is not enabled on project ${ctx.quotaProject}. ` +
      `Enable it: gcloud services enable securitycenter.googleapis.com --project=${ctx.quotaProject}`;
  } else if (grpcCode === 5 || /NOT_FOUND/.test(message)) {
    userMessage =
      `SCC resource not found at ${ctx.parent}. ` +
      `Verify the ${ctx.scope === 'organization' ? 'organization id is correct and SCC is activated for it' : 'project has SCC activated'}. ` +
      `If your org activated SCC on/after 2024-12-09 it may be v2-only and require ` +
      `a /locations/global path segment.`;
  } else {
    userMessage = `Security Command Center is not available: ${message}`;
  }

  // Append a diagnostic block — visible in the UI, kept short. If you've ever
  // wondered "which parent did it actually use?", this is the answer.
  userMessage += ` [diag] grpcCode=${grpcCode ?? 'n/a'}/${grpcName} parent=${ctx.parent} ` +
    `orgIdSource=${ctx.orgIdSource} quotaProject=${ctx.quotaProject}`;

  return {
    id: crypto.randomUUID(),
    projectId,
    scanMode: 'security_hub',
    timestamp: new Date().toISOString(),
    duration: Date.now() - startTime,
    summary: createEmptySummary(),
    findings: [],
    enabledStandards: [],
    error: userMessage,
  };
}

/**
 * Single-shot SCC probe used by Settings → "Test SCC Connection".
 * Runs `listFindings` with `pageSize: 1` and returns the raw failure shape
 * untouched, so the user can see the actual gRPC code and the parent that
 * was queried. Synchronous (no fire-and-forget IPC), no DB writes.
 */
export async function probeSccConnection(
  projectId: string,
  orgIdOverride?: string,
): Promise<SccProbeResult> {
  const startTime = Date.now();
  let parentInfo: ResolvedSccParent;
  try {
    parentInfo = await resolveSccParent(projectId, orgIdOverride);
  } catch (error) {
    return {
      ok: false,
      parent: `projects/${projectId}/sources/-`,
      scope: 'project',
      orgIdSource: 'none',
      quotaProject: projectId,
      filter: '',
      durationMs: Date.now() - startTime,
      error: {
        grpcCode: extractGrpcCode(error),
        grpcCodeName: grpcCodeName(extractGrpcCode(error)),
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }

  const filter = 'state="ACTIVE"';
  try {
    const client = await createSecurityCenterClient(projectId);
    const iterable = client.listFindingsAsync({
      parent: parentInfo.parent,
      filter,
      pageSize: 1,
    });
    let count = 0;
    for await (const _ of iterable) {
      count++;
      if (count >= 1) break;
    }
    return {
      ok: true,
      parent: parentInfo.parent,
      scope: parentInfo.scope,
      orgId: parentInfo.orgId,
      orgIdSource: parentInfo.orgIdSource,
      quotaProject: projectId,
      filter,
      durationMs: Date.now() - startTime,
      sampleCount: count,
    };
  } catch (error) {
    const grpcCode = extractGrpcCode(error);
    const errObj = error as { details?: unknown };
    console.error(
      `[SCC probe] failed — parent=${parentInfo.parent} orgIdSource=${parentInfo.orgIdSource} ` +
      `grpcCode=${grpcCode}/${grpcCodeName(grpcCode)}`,
      error,
    );
    return {
      ok: false,
      parent: parentInfo.parent,
      scope: parentInfo.scope,
      orgId: parentInfo.orgId,
      orgIdSource: parentInfo.orgIdSource,
      quotaProject: projectId,
      filter,
      durationMs: Date.now() - startTime,
      error: {
        grpcCode,
        grpcCodeName: grpcCodeName(grpcCode),
        message: error instanceof Error ? error.message : String(error),
        details: typeof errObj?.details === 'string' ? errObj.details : undefined,
      },
    };
  }
}

/**
 * Convert a google.protobuf.Timestamp ({seconds, nanos}) — where `seconds` may be
 * a Long object or plain number depending on transport — into an ISO string.
 */
function protoTimestampToIso(ts: unknown): string | undefined {
  if (!ts || typeof ts !== 'object') return undefined;
  const seconds = (ts as { seconds?: number | { toNumber?: () => number } | string }).seconds;
  if (seconds == null) return undefined;
  let secs: number;
  if (typeof seconds === 'number') {
    secs = seconds;
  } else if (typeof seconds === 'string') {
    secs = Number(seconds);
  } else if (typeof seconds.toNumber === 'function') {
    secs = seconds.toNumber();
  } else {
    return undefined;
  }
  if (!Number.isFinite(secs)) return undefined;
  return new Date(secs * 1000).toISOString();
}

function mapSCCSeverity(severity: number): FindingSeverity {
  // SCC severity enum: 0=UNSPECIFIED, 1=CRITICAL, 2=HIGH, 3=MEDIUM, 4=LOW
  switch (severity) {
    case 1: return 'CRITICAL';
    case 2: return 'HIGH';
    case 3: return 'MEDIUM';
    case 4: return 'LOW';
    default: return 'INFORMATIONAL';
  }
}

function mapSCCState(state: number): FindingStatus {
  // SCC state enum: 0=UNSPECIFIED, 1=ACTIVE, 2=INACTIVE
  switch (state) {
    case 1: return 'ACTIVE';
    case 2: return 'RESOLVED';
    default: return 'ACTIVE';
  }
}

function extractRegionFromResource(resourceName: string | undefined): string {
  if (!resourceName) return 'global';
  const regionMatch = resourceName.match(/\/locations\/([^/]+)/);
  if (regionMatch) return regionMatch[1];
  const zoneMatch = resourceName.match(/\/zones\/([^/]+)/);
  if (zoneMatch) {
    const parts = zoneMatch[1].split('-');
    return parts.slice(0, -1).join('-');
  }
  return 'global';
}

function buildSummary(findings: SecurityFinding[]): SecurityPostureSummary {
  const summary: SecurityPostureSummary = {
    totalFindings: findings.length,
    criticalCount: 0,
    highCount: 0,
    mediumCount: 0,
    lowCount: 0,
    informationalCount: 0,
    bySource: {} as Record<FindingSource, number>,
    complianceScores: [],
    lastRefreshed: new Date().toISOString(),
  };

  for (const finding of findings) {
    switch (finding.severity) {
      case 'CRITICAL': summary.criticalCount++; break;
      case 'HIGH': summary.highCount++; break;
      case 'MEDIUM': summary.mediumCount++; break;
      case 'LOW': summary.lowCount++; break;
      case 'INFORMATIONAL': summary.informationalCount++; break;
    }
    const source = finding.source as FindingSource;
    summary.bySource[source] = (summary.bySource[source] || 0) + 1;
  }

  return summary;
}

function createEmptySummary(): SecurityPostureSummary {
  return {
    totalFindings: 0,
    criticalCount: 0,
    highCount: 0,
    mediumCount: 0,
    lowCount: 0,
    informationalCount: 0,
    bySource: {} as Record<FindingSource, number>,
    complianceScores: [],
    lastRefreshed: new Date().toISOString(),
  };
}

// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { getGCPClientFactory } from '../client-factory';
import type {
  GCPBudget,
  GCPBudgetAmount,
  GCPBudgetFilter,
  GCPBudgetListResult,
  GCPBudgetThreshold,
  GCPBudgetThresholdBasis,
} from '../../../shared/types/gcp';

/**
 * Resolve the billing account ID for a project via Cloud Billing API.
 * Returns the full resource name (e.g. "billingAccounts/0X0X0X-0X0X0X-0X0X0X")
 * or null when no billing account is linked.
 */
export async function resolveBillingAccountForProject(
  projectId: string
): Promise<string | null> {
  const factory = getGCPClientFactory(projectId);
  const billingClient = factory.getBillingClient();
  const [info] = await billingClient.getProjectBillingInfo({
    name: `projects/${projectId}`,
  });
  if (!info?.billingAccountName) return null;
  return info.billingAccountName;
}

interface RawBudget {
  name?: string | null;
  displayName?: string | null;
  amount?: {
    specifiedAmount?: { currencyCode?: string | null; units?: string | number | null; nanos?: number | null } | null;
    lastPeriodAmount?: Record<string, unknown> | null;
    customPeriod?: { startDate?: unknown; endDate?: unknown } | null;
  } | null;
  thresholdRules?: Array<{
    thresholdPercent?: number | null;
    spendBasis?: string | null;
  }> | null;
  budgetFilter?: {
    projects?: string[] | null;
    services?: string[] | null;
    creditTypesTreatment?: string | null;
    labels?: Record<string, { values?: string[] | null } | string[]> | null;
    calendarPeriod?: string | null;
    customPeriod?: {
      startDate?: { year?: number; month?: number; day?: number } | null;
      endDate?: { year?: number; month?: number; day?: number } | null;
    } | null;
  } | null;
  notificationsRule?: {
    pubsubTopic?: string | null;
    monitoringNotificationChannels?: string[] | null;
    disableDefaultIamRecipients?: boolean | null;
  } | null;
  etag?: string | null;
}

function toAmount(raw: RawBudget['amount']): GCPBudgetAmount {
  const specified = raw?.specifiedAmount;
  if (specified) {
    const units = Number(specified.units ?? 0);
    const nanos = Number(specified.nanos ?? 0) / 1e9;
    return {
      currencyCode: specified.currencyCode ?? 'USD',
      units: units + nanos,
    };
  }
  if (raw?.lastPeriodAmount) {
    return {
      currencyCode: 'USD',
      lastPeriodAmount: true,
    };
  }
  return { currencyCode: 'USD' };
}

function toThresholds(raw: RawBudget['thresholdRules']): GCPBudgetThreshold[] {
  if (!raw) return [];
  return raw.map((r) => ({
    thresholdPercent: Number(r.thresholdPercent ?? 0),
    spendBasis: ((r.spendBasis ?? 'UNSPECIFIED') as GCPBudgetThresholdBasis),
  }));
}

function toFilter(raw: RawBudget['budgetFilter']): GCPBudgetFilter | undefined {
  if (!raw) return undefined;

  const labels: Record<string, string[]> | undefined = raw.labels
    ? Object.fromEntries(
        Object.entries(raw.labels).map(([k, v]) => {
          if (Array.isArray(v)) return [k, v];
          return [k, v?.values ?? []];
        })
      )
    : undefined;

  const formatDate = (d?: { year?: number; month?: number; day?: number } | null) =>
    d ? `${d.year ?? ''}-${String(d.month ?? '').padStart(2, '0')}-${String(d.day ?? '').padStart(2, '0')}` : undefined;

  return {
    projects: raw.projects ?? undefined,
    services: raw.services ?? undefined,
    creditTypesTreatment: raw.creditTypesTreatment ?? undefined,
    labels,
    calendarPeriod: raw.calendarPeriod ?? undefined,
    customPeriodStart: formatDate(raw.customPeriod?.startDate),
    customPeriodEnd: formatDate(raw.customPeriod?.endDate),
  };
}

function transformBudget(raw: RawBudget): GCPBudget {
  return {
    name: raw.name ?? '',
    displayName: raw.displayName ?? '(unnamed budget)',
    amount: toAmount(raw.amount),
    thresholds: toThresholds(raw.thresholdRules),
    filter: toFilter(raw.budgetFilter),
    pubsubTopic: raw.notificationsRule?.pubsubTopic ?? undefined,
    notificationEmail:
      !raw.notificationsRule?.disableDefaultIamRecipients ||
      (raw.notificationsRule?.monitoringNotificationChannels?.length ?? 0) > 0,
    etag: raw.etag ?? undefined,
  };
}

/**
 * List all budgets under a billing account.
 * Requires `billing.budgets.list` IAM permission on the billing account.
 */
export async function listBudgets(
  projectId: string,
  billingAccountId: string
): Promise<GCPBudgetListResult> {
  const factory = getGCPClientFactory(projectId);
  const client = factory.getBudgetServiceClient();
  const errors: string[] = [];
  const budgets: GCPBudget[] = [];

  try {
    const iterable = client.listBudgetsAsync({ parent: billingAccountId });
    for await (const raw of iterable) {
      budgets.push(transformBudget(raw as RawBudget));
    }
  } catch (err: unknown) {
    const e = err as { code?: number; message?: string };
    errors.push(`listBudgets failed: ${e?.message ?? String(err)}`);
  }

  return { billingAccountId, budgets, errors };
}

/**
 * Get a single budget by full resource name.
 */
export async function getBudget(
  projectId: string,
  budgetName: string
): Promise<GCPBudget | null> {
  const factory = getGCPClientFactory(projectId);
  const client = factory.getBudgetServiceClient();
  try {
    const [raw] = await client.getBudget({ name: budgetName });
    return transformBudget(raw as RawBudget);
  } catch {
    return null;
  }
}

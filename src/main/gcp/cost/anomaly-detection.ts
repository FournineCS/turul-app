// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import crypto from 'crypto';
import { detectBillingTable } from './billing-analysis';
import type {
  GCPCostAnomaly,
  GCPCostAnomalyDirection,
  GCPCostAnomalyOptions,
  GCPCostAnomalyResult,
  GCPCostAnomalySeverity,
  GCPCostAnomalySkuContributor,
} from '../../../shared/types/gcp';

const DEFAULT_WINDOW_DAYS = 7;
const DEFAULT_MIN_DEVIATION_PCT = 30;
const DEFAULT_MIN_IMPACT_USD = 25;
const DEFAULT_MAX_ANOMALIES = 25;

interface ServiceWindowRow {
  service_name: string;
  window_cost: number;
  prior_cost: number;
  currency: string;
}

interface SkuWindowRow {
  service_name: string;
  sku: string;
  window_cost: number;
  prior_cost: number;
}

function severityFor(deviationPct: number, absDelta: number): GCPCostAnomalySeverity {
  if (absDelta >= 1000 || deviationPct >= 200) return 'high';
  if (absDelta >= 250 || deviationPct >= 75) return 'medium';
  return 'low';
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function hashAnomalyId(service: string, windowStart: string, windowEnd: string): string {
  return crypto.createHash('sha256').update(`${service}|${windowStart}|${windowEnd}`).digest('hex').slice(0, 16);
}

/**
 * Detect cost anomalies for a project by comparing the most recent N-day window
 * against the prior N-day window using BigQuery billing export. Heuristic only —
 * does not consume GCP's first-party anomaly Pub/Sub feed (separate phase).
 *
 * Net-cost expression includes credits (CUDs, sustained-use, promotional) so that
 * spikes from credit expiry are surfaced.
 */
export async function detectCostAnomalies(
  projectId: string,
  bqProject: string,
  bqDataset: string,
  bqRegion?: string,
  options?: GCPCostAnomalyOptions
): Promise<GCPCostAnomalyResult> {
  const windowDays = options?.windowDays ?? DEFAULT_WINDOW_DAYS;
  const minDeviationPct = options?.minDeviationPct ?? DEFAULT_MIN_DEVIATION_PCT;
  const minImpactUsd = options?.minImpactUsd ?? DEFAULT_MIN_IMPACT_USD;
  const maxAnomalies = options?.maxAnomalies ?? DEFAULT_MAX_ANOMALIES;

  const errors: string[] = [];
  const today = new Date();
  const windowEnd = new Date(today);
  windowEnd.setUTCDate(windowEnd.getUTCDate() - 1); // yesterday (latest closed day)
  const windowStart = new Date(windowEnd);
  windowStart.setUTCDate(windowStart.getUTCDate() - (windowDays - 1));
  const baselineEnd = new Date(windowStart);
  baselineEnd.setUTCDate(baselineEnd.getUTCDate() - 1);
  const baselineStart = new Date(baselineEnd);
  baselineStart.setUTCDate(baselineStart.getUTCDate() - (windowDays - 1));

  const result: GCPCostAnomalyResult = {
    anomalies: [],
    windowStart: isoDate(windowStart),
    windowEnd: isoDate(windowEnd),
    baselineStart: isoDate(baselineStart),
    baselineEnd: isoDate(baselineEnd),
    servicesEvaluated: 0,
    thresholds: { minDeviationPct, minImpactUsd, windowDays },
    errors,
  };

  let bigquery: InstanceType<typeof import('@google-cloud/bigquery').BigQuery>;
  try {
    const { BigQuery } = await import('@google-cloud/bigquery');
    bigquery = new BigQuery({ projectId: bqProject });
  } catch (err) {
    errors.push(`BigQuery client init failed: ${err instanceof Error ? err.message : String(err)}`);
    return result;
  }

  let billingTable: string;
  try {
    billingTable = await detectBillingTable(bigquery, bqProject, bqDataset, bqRegion);
  } catch (err) {
    errors.push(`Billing table detection failed: ${err instanceof Error ? err.message : String(err)}`);
    return result;
  }

  const tableRef = `\`${bqProject}.${bqDataset}.${billingTable}\``;

  // Net cost: cost + sum(credits.amount). Credits.amount is negative, so this
  // surfaces spikes from credit expiry. Inlined into both queries below.
  // Service-level WoW comparison
  const serviceQuery = `
    WITH windows AS (
      SELECT
        service.description AS service_name,
        currency,
        SUM(IF(usage_start_time >= TIMESTAMP(@windowStart) AND usage_start_time < TIMESTAMP_ADD(TIMESTAMP(@windowEnd), INTERVAL 1 DAY),
               cost + IFNULL((SELECT SUM(c.amount) FROM UNNEST(credits) c), 0), 0)) AS window_cost,
        SUM(IF(usage_start_time >= TIMESTAMP(@baselineStart) AND usage_start_time < TIMESTAMP_ADD(TIMESTAMP(@baselineEnd), INTERVAL 1 DAY),
               cost + IFNULL((SELECT SUM(c.amount) FROM UNNEST(credits) c), 0), 0)) AS prior_cost
      FROM ${tableRef}
      WHERE project.id = @projectId
        AND usage_start_time >= TIMESTAMP(@baselineStart)
        AND usage_start_time < TIMESTAMP_ADD(TIMESTAMP(@windowEnd), INTERVAL 1 DAY)
      GROUP BY service_name, currency
    )
    SELECT * FROM windows
    WHERE window_cost > 0 OR prior_cost > 0
  `;

  const queryParams = {
    projectId,
    windowStart: result.windowStart,
    windowEnd: result.windowEnd,
    baselineStart: result.baselineStart,
    baselineEnd: result.baselineEnd,
  };

  let serviceRows: ServiceWindowRow[] = [];
  try {
    const opts: Record<string, unknown> = { query: serviceQuery, params: queryParams };
    if (bqRegion) opts.location = bqRegion;
    const [rows] = await bigquery.query(opts);
    serviceRows = rows as ServiceWindowRow[];
  } catch (err) {
    errors.push(`Service-level query failed: ${err instanceof Error ? err.message : String(err)}`);
    return result;
  }

  result.servicesEvaluated = serviceRows.length;

  // Filter to anomalous services
  const anomalousServices = serviceRows
    .map((r) => {
      const windowCost = Number(r.window_cost ?? 0);
      const priorCost = Number(r.prior_cost ?? 0);
      const delta = windowCost - priorCost;
      // Avoid div-by-zero: when prior is ~0 and current > minImpactUsd, treat as 100%+ deviation
      const deviationPct = priorCost > 1e-6
        ? (delta / priorCost) * 100
        : (windowCost > 0 ? 999 : 0);
      return { ...r, windowCost, priorCost, delta, deviationPct };
    })
    .filter((r) => Math.abs(r.delta) >= minImpactUsd && Math.abs(r.deviationPct) >= minDeviationPct)
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
    .slice(0, maxAnomalies);

  if (!anomalousServices.length) return result;

  // Top SKU contributors per anomalous service
  const skuQuery = `
    SELECT
      service.description AS service_name,
      sku.description AS sku,
      SUM(IF(usage_start_time >= TIMESTAMP(@windowStart) AND usage_start_time < TIMESTAMP_ADD(TIMESTAMP(@windowEnd), INTERVAL 1 DAY),
             cost + IFNULL((SELECT SUM(c.amount) FROM UNNEST(credits) c), 0), 0)) AS window_cost,
      SUM(IF(usage_start_time >= TIMESTAMP(@baselineStart) AND usage_start_time < TIMESTAMP_ADD(TIMESTAMP(@baselineEnd), INTERVAL 1 DAY),
             cost + IFNULL((SELECT SUM(c.amount) FROM UNNEST(credits) c), 0), 0)) AS prior_cost
    FROM ${tableRef}
    WHERE project.id = @projectId
      AND service.description IN UNNEST(@serviceNames)
      AND usage_start_time >= TIMESTAMP(@baselineStart)
      AND usage_start_time < TIMESTAMP_ADD(TIMESTAMP(@windowEnd), INTERVAL 1 DAY)
    GROUP BY service_name, sku
  `;

  let skuRows: SkuWindowRow[] = [];
  try {
    const opts: Record<string, unknown> = {
      query: skuQuery,
      params: { ...queryParams, serviceNames: anomalousServices.map((s) => s.service_name) },
    };
    if (bqRegion) opts.location = bqRegion;
    const [rows] = await bigquery.query(opts);
    skuRows = rows as SkuWindowRow[];
  } catch (err) {
    errors.push(`SKU-level query failed: ${err instanceof Error ? err.message : String(err)}`);
    // Continue without SKU contributors
  }

  // Group SKUs by service and pick top 3 by absolute delta
  const skusByService = new Map<string, GCPCostAnomalySkuContributor[]>();
  for (const row of skuRows) {
    const cost = Number(row.window_cost ?? 0);
    const prior = Number(row.prior_cost ?? 0);
    const arr = skusByService.get(row.service_name) ?? [];
    arr.push({
      sku: row.sku ?? '(unknown)',
      cost,
      priorCost: prior,
      delta: cost - prior,
    });
    skusByService.set(row.service_name, arr);
  }

  const anomalies: GCPCostAnomaly[] = anomalousServices.map((s) => {
    const direction: GCPCostAnomalyDirection = s.delta >= 0 ? 'increase' : 'decrease';
    const absDelta = Math.abs(s.delta);
    const severity = severityFor(Math.abs(s.deviationPct), absDelta);
    const topSkus = (skusByService.get(s.service_name) ?? [])
      .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
      .slice(0, 3);

    const verb = direction === 'increase' ? 'increased' : 'decreased';
    const description = `${s.service_name} cost ${verb} ${Math.abs(s.deviationPct).toFixed(1)}% (${direction === 'increase' ? '+' : '-'}$${absDelta.toFixed(2)}) over the last ${windowDays} days vs the prior ${windowDays} days.`;

    return {
      id: hashAnomalyId(s.service_name, result.windowStart, result.windowEnd),
      service: s.service_name,
      windowDays,
      windowStart: result.windowStart,
      windowEnd: result.windowEnd,
      baselineStart: result.baselineStart,
      baselineEnd: result.baselineEnd,
      cost: s.windowCost,
      priorCost: s.priorCost,
      delta: s.delta,
      deviationPct: s.deviationPct,
      direction,
      severity,
      topSkus,
      description,
      currency: s.currency ?? 'USD',
    };
  });

  result.anomalies = anomalies;
  return result;
}

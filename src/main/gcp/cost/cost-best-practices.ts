// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import type {
  CostOptimizationRecommendation,
  GCPCostBestPracticesResult,
} from './types';

interface CostCheckDefinition {
  id: string;
  title: string;
  description: string;
  severity: CostOptimizationRecommendation['severity'];
  category: string;
  recType: CostOptimizationRecommendation['type'];
  queryTemplate: string;
  mapRows: (rows: Record<string, unknown>[], checkDef: CostCheckDefinition) => CostOptimizationRecommendation[];
}

function formatCost(n: number): string {
  return `$${n.toFixed(2)}`;
}

const COST_BEST_PRACTICE_CHECKS: CostCheckDefinition[] = [
  {
    id: 'GCP-COST-BP-001',
    title: 'Services with costs but zero or near-zero usage',
    description: 'Services incurring charges with minimal actual usage may indicate provisioned but unused resources.',
    severity: 'medium',
    category: 'Zombie Resources',
    recType: 'best_practice',
    queryTemplate: `
      SELECT
        service.description AS service_name,
        SUM(cost) AS total_cost,
        SUM(usage.amount) AS total_usage,
        currency
      FROM \`{bqProject}.{bqDataset}.gcp_billing_export_v1_*\`
      WHERE usage_start_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
        AND project.id = @projectId
        AND cost > 0
      GROUP BY service_name, currency
      HAVING total_usage < 0.01 AND total_cost > 1.0
      ORDER BY total_cost DESC
    `,
    mapRows: (rows, checkDef) =>
      rows.map((row, i) => ({
        id: `${checkDef.id}-${i}`,
        type: checkDef.recType,
        severity: checkDef.severity,
        service: String(row.service_name || 'Unknown'),
        description: `${row.service_name} incurred ${formatCost(Number(row.total_cost || 0))} over 30 days with near-zero usage. This may indicate provisioned but unused resources.`,
        estimatedMonthlySavings: Number(row.total_cost || 0),
        currency: String(row.currency || 'USD'),
        actionRequired: 'Review resource usage and consider decommissioning or scaling down.',
        category: checkDef.category,
      })),
  },
  {
    id: 'GCP-COST-BP-002',
    title: 'Sudden cost spike detected',
    description: 'A service shows a daily cost more than 3x its 30-day average.',
    severity: 'high',
    category: 'Anomaly Detection',
    recType: 'cost_anomaly',
    queryTemplate: `
      WITH daily_costs AS (
        SELECT
          service.description AS service_name,
          DATE(usage_start_time) AS day,
          SUM(cost) AS daily_cost
        FROM \`{bqProject}.{bqDataset}.gcp_billing_export_v1_*\`
        WHERE usage_start_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
          AND project.id = @projectId
        GROUP BY service_name, day
      ),
      averages AS (
        SELECT service_name, AVG(daily_cost) AS avg_daily_cost
        FROM daily_costs
        GROUP BY service_name
        HAVING AVG(daily_cost) > 1.0
      )
      SELECT dc.service_name, dc.day, dc.daily_cost, a.avg_daily_cost,
             SAFE_DIVIDE(dc.daily_cost, a.avg_daily_cost) AS spike_ratio
      FROM daily_costs dc
      JOIN averages a ON dc.service_name = a.service_name
      WHERE dc.daily_cost > a.avg_daily_cost * 3
        AND dc.day >= DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY)
      ORDER BY spike_ratio DESC
      LIMIT 20
    `,
    mapRows: (rows, checkDef) =>
      rows.map((row, i) => {
        const spikeRatio = Number(row.spike_ratio || 0);
        const dailyCost = Number(row.daily_cost || 0);
        const avgCost = Number(row.avg_daily_cost || 0);
        const excessDaily = dailyCost - avgCost;
        return {
          id: `${checkDef.id}-${i}`,
          type: checkDef.recType,
          severity: checkDef.severity,
          service: String(row.service_name || 'Unknown'),
          description: `${row.service_name} spiked to ${formatCost(dailyCost)}/day on ${row.day} (${spikeRatio.toFixed(1)}x the 30-day avg of ${formatCost(avgCost)}/day).`,
          estimatedMonthlySavings: excessDaily * 30,
          currency: 'USD',
          actionRequired: 'Investigate the spike cause. Check for unintended scaling, data processing, or misconfigurations.',
          category: checkDef.category,
        };
      }),
  },
  {
    id: 'GCP-COST-BP-003',
    title: 'Stale resources with unchanged costs for 30+ days',
    description: 'Resources with costs that have not changed in over 30 days may be forgotten zombie resources.',
    severity: 'medium',
    category: 'Zombie Resources',
    recType: 'best_practice',
    queryTemplate: `
      WITH daily_service_cost AS (
        SELECT
          service.description AS service_name,
          sku.description AS sku_name,
          DATE(usage_start_time) AS day,
          SUM(cost) AS daily_cost
        FROM \`{bqProject}.{bqDataset}.gcp_billing_export_v1_*\`
        WHERE usage_start_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 45 DAY)
          AND project.id = @projectId
          AND cost > 0
        GROUP BY service_name, sku_name, day
      )
      SELECT service_name, sku_name,
             MIN(daily_cost) AS min_cost, MAX(daily_cost) AS max_cost,
             AVG(daily_cost) AS avg_cost, COUNT(DISTINCT day) AS active_days,
             SAFE_DIVIDE(MAX(daily_cost) - MIN(daily_cost), NULLIF(AVG(daily_cost), 0)) AS variance_pct
      FROM daily_service_cost
      GROUP BY service_name, sku_name
      HAVING variance_pct < 0.05 AND avg_cost > 0.50 AND active_days >= 30
      ORDER BY avg_cost DESC
      LIMIT 30
    `,
    mapRows: (rows, checkDef) =>
      rows.map((row, i) => ({
        id: `${checkDef.id}-${i}`,
        type: checkDef.recType,
        severity: checkDef.severity,
        service: String(row.service_name || 'Unknown'),
        description: `${row.service_name} / ${row.sku_name} has cost ~${formatCost(Number(row.avg_cost || 0))}/day for ${row.active_days}+ days with <5% variance. Likely a forgotten resource.`,
        estimatedMonthlySavings: Number(row.avg_cost || 0) * 30,
        currency: 'USD',
        actionRequired: 'Review if this resource is still needed. Consider deleting or resizing.',
        resourceType: String(row.sku_name || ''),
        category: checkDef.category,
      })),
  },
  {
    id: 'GCP-COST-BP-004',
    title: 'High egress costs',
    description: 'Significant network egress costs detected.',
    severity: 'medium',
    category: 'Egress',
    recType: 'egress_optimization',
    queryTemplate: `
      SELECT
        service.description AS service_name,
        sku.description AS sku_name,
        SUM(cost) AS total_cost,
        SUM(usage.amount) AS total_usage,
        usage.unit AS usage_unit,
        currency
      FROM \`{bqProject}.{bqDataset}.gcp_billing_export_v1_*\`
      WHERE usage_start_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
        AND project.id = @projectId
        AND (LOWER(sku.description) LIKE '%egress%' OR LOWER(sku.description) LIKE '%download%')
        AND cost > 0
      GROUP BY service_name, sku_name, usage_unit, currency
      HAVING total_cost > 5.0
      ORDER BY total_cost DESC
      LIMIT 20
    `,
    mapRows: (rows, checkDef) =>
      rows.map((row, i) => ({
        id: `${checkDef.id}-${i}`,
        type: checkDef.recType,
        severity: checkDef.severity,
        service: String(row.service_name || 'Unknown'),
        description: `${row.service_name}: ${row.sku_name} cost ${formatCost(Number(row.total_cost || 0))} over 30 days. Consider Cloud CDN, caching, or architecture changes.`,
        estimatedMonthlySavings: Number(row.total_cost || 0) * 0.4,  // ~40% reduction possible with caching
        currency: String(row.currency || 'USD'),
        actionRequired: 'Evaluate egress patterns. Consider Cloud CDN, regional data placement, or compression.',
        resourceType: String(row.sku_name || ''),
        category: checkDef.category,
      })),
  },
  {
    id: 'GCP-COST-BP-005',
    title: 'Unused BigQuery tables (90+ days since last modified)',
    description: 'Large BigQuery tables that have not been modified in 90+ days are still incurring storage costs.',
    severity: 'medium',
    category: 'Unused Storage',
    recType: 'best_practice',
    queryTemplate: `
      SELECT
        table_catalog,
        table_schema,
        table_name,
        TIMESTAMP_DIFF(CURRENT_TIMESTAMP(), last_modified_time, DAY) AS days_since_modified,
        ROUND(size_bytes / POW(1024, 3), 2) AS size_gb
      FROM \`{bqProject}.{bqDataset}.INFORMATION_SCHEMA.TABLE_STORAGE\`
      WHERE last_modified_time < TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 90 DAY)
        AND size_bytes > 1073741824
      ORDER BY size_bytes DESC
      LIMIT 30
    `,
    mapRows: (rows, checkDef) =>
      rows.map((row, i) => {
        const sizeGb = Number(row.size_gb || 0);
        // BigQuery active storage: ~$0.02/GB/month; long-term (90+ days): ~$0.01/GB/month
        const monthlyCost = sizeGb * 0.02;
        return {
          id: `${checkDef.id}-${i}`,
          type: checkDef.recType,
          severity: checkDef.severity,
          service: 'BigQuery',
          description: `Table \`${row.table_catalog}.${row.table_schema}.${row.table_name}\` (${sizeGb} GB) has not been modified in ${row.days_since_modified} days but is still incurring ~${formatCost(monthlyCost)}/month in storage.`,
          estimatedMonthlySavings: monthlyCost,
          currency: 'USD',
          actionRequired: 'Review if this table is still needed. Consider archiving to Cloud Storage or deleting if unused.',
          resourceType: `${row.table_schema}.${row.table_name}`,
          category: checkDef.category,
        };
      }),
  },
  {
    id: 'GCP-COST-BP-006',
    title: 'Consistently low BigQuery slot utilization',
    description: 'Purchased BigQuery capacity commitment slots are significantly underutilized compared to actual job usage.',
    severity: 'medium',
    category: 'Slot Utilization',
    recType: 'best_practice',
    queryTemplate: `
      SELECT
        ROUND(AVG(total_slot_ms) / 1000.0 / 3600.0, 2) AS avg_slot_hours_per_day,
        ROUND(MAX(total_slot_ms) / 1000.0 / 3600.0, 2) AS peak_slot_hours_per_day,
        COUNT(*) AS total_jobs
      FROM (
        SELECT
          DATE(creation_time) AS job_date,
          SUM(total_slot_ms) AS total_slot_ms
        FROM \`{bqProject}.{bqDataset}.INFORMATION_SCHEMA.JOBS_BY_PROJECT\`
        WHERE creation_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
          AND job_type = 'QUERY'
          AND state = 'DONE'
        GROUP BY job_date
      )
    `,
    mapRows: (rows, checkDef) => {
      const row = rows[0];
      if (!row) return [];
      const avgSlotHours = Number(row.avg_slot_hours_per_day || 0);
      const peakSlotHours = Number(row.peak_slot_hours_per_day || 0);
      // Only flag if avg utilization is very low — suggest flex slots or on-demand
      if (avgSlotHours > 500 || peakSlotHours === 0) return [];
      return [{
        id: `${checkDef.id}-0`,
        type: checkDef.recType,
        severity: checkDef.severity,
        service: 'BigQuery',
        description: `BigQuery slot usage averaged ${avgSlotHours} slot-hours/day (peak: ${peakSlotHours}) over the last 30 days. If you have flat-rate or capacity commitments, consider switching to on-demand or Flex Slots.`,
        estimatedMonthlySavings: 0,  // Cannot calculate without knowing purchased slot count
        currency: 'USD',
        actionRequired: 'Review purchased slot reservations in BigQuery Reservations. Consider downsizing commitments or switching to on-demand pricing.',
        category: checkDef.category,
      }];
    },
  },
];

/**
 * Run BigQuery-based cost best practices checks against the billing export.
 */
export async function runGCPCostBestPractices(
  projectId: string,
  bqProject: string,
  bqDataset?: string
): Promise<GCPCostBestPracticesResult> {
  const { BigQuery } = require('@google-cloud/bigquery');
  const bigquery = new BigQuery({ projectId: bqProject });
  const dataset = bqDataset || 'billing_export';

  const allRecommendations: CostOptimizationRecommendation[] = [];
  const errors: string[] = [];
  let checksWithFindings = 0;

  for (const check of COST_BEST_PRACTICE_CHECKS) {
    try {
      const query = check.queryTemplate
        .replace(/\{bqProject\}/g, bqProject)
        .replace(/\{bqDataset\}/g, dataset);

      const [rows] = await bigquery.query({
        query,
        params: { projectId },
      });

      if (rows && rows.length > 0) {
        const recs = check.mapRows(rows, check);
        allRecommendations.push(...recs);
        checksWithFindings++;
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(`${check.id} (${check.title}): ${msg}`);
    }
  }

  const totalPotentialSavings = allRecommendations.reduce(
    (sum, r) => sum + r.estimatedMonthlySavings, 0
  );

  return {
    recommendations: allRecommendations,
    checksRun: COST_BEST_PRACTICE_CHECKS.length,
    checksWithFindings,
    errors,
    totalPotentialSavings,
    currency: 'USD',
  };
}

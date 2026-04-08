// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';
import type {
  CostAnalysisResult,
  DetailedServiceCost,
  CostTrendDataPoint,
  RegionCost,
  ProjectCost,
  SkuCost,
  ResourceCost,
  CostOptimizationResult,
  GCPCostFilters,
} from '../../../shared/types';

/**
 * GCP Cost Analysis using Cloud Billing API and BigQuery billing export.
 *
 * Important: GCP does NOT have a Cost Explorer equivalent API.
 * The Cloud Billing API only provides billing account management and pricing catalogs.
 * For actual cost/usage data, BigQuery billing export is required.
 *
 * This module provides:
 * 1. Cost analysis via BigQuery billing export (if configured)
 * 2. Billing account verification via Cloud Billing API (fallback)
 * 3. Recommender API for cost optimization suggestions
 */

/**
 * Build parameterized BigQuery WHERE fragments from cost filters.
 * Returns two sets of clauses:
 *   - `clauses`/`params` — standard filters (service, sku, region, project) safe for all queries
 *   - `resourceClauses`/`resourceParams` — resource-specific filters (labels, resourceName) only for resource queries
 */
function buildFilterClauses(filters?: GCPCostFilters): {
  clauses: string[]; params: Record<string, unknown>;
  resourceClauses: string[]; resourceParams: Record<string, unknown>;
} {
  const clauses: string[] = [];
  const params: Record<string, unknown> = {};
  const resourceClauses: string[] = [];
  const resourceParams: Record<string, unknown> = {};

  if (!filters) return { clauses, params, resourceClauses, resourceParams };

  if (filters.services && filters.services.length > 0) {
    clauses.push('service.description IN UNNEST(@filterServices)');
    params.filterServices = filters.services;
  }
  if (filters.skus && filters.skus.length > 0) {
    clauses.push('sku.description IN UNNEST(@filterSkus)');
    params.filterSkus = filters.skus;
  }
  if (filters.regions && filters.regions.length > 0) {
    clauses.push('CAST(location.region AS STRING) IN UNNEST(@filterRegions)');
    params.filterRegions = filters.regions;
  }
  if (filters.projectIds && filters.projectIds.length > 0) {
    clauses.push('project.id IN UNNEST(@filterProjectIds)');
    params.filterProjectIds = filters.projectIds;
  }

  if (filters.labels && filters.labels.length > 0) {
    for (let i = 0; i < filters.labels.length; i++) {
      const label = filters.labels[i];
      clauses.push(
        `EXISTS (SELECT 1 FROM UNNEST(labels) AS l WHERE l.key = @labelKey_${i} AND l.value IN UNNEST(@labelValues_${i}))`
      );
      params[`labelKey_${i}`] = label.key;
      params[`labelValues_${i}`] = label.values;
    }
  }

  if (filters.resourceName && filters.resourceName.trim()) {
    resourceClauses.push(`resource.name LIKE CONCAT('%', @resourceNameFilter, '%')`);
    resourceParams.resourceNameFilter = filters.resourceName.trim();
  }

  return { clauses, params, resourceClauses, resourceParams };
}

function extractShortName(resourceName: string): string {
  if (!resourceName) return '';
  const parts = resourceName.split('/');
  return parts[parts.length - 1] || resourceName;
}

/**
 * Net cost expression that includes credits (matches Grafana pattern).
 * Standard export and resource export both have the `credits` column.
 */
const NET_COST = `SUM(cost) + SUM(IFNULL((SELECT SUM(c.amount) FROM UNNEST(credits) c), 0))`;

/**
 * Cache of detected billing table names per "project.dataset" key.
 */
const billingTableCache = new Map<string, string>();

/**
 * Clear the billing table cache. Call when region or dataset config changes
 * so stale entries from failed auto-detect don't persist.
 */
export function clearBillingTableCache(): void {
  billingTableCache.clear();
}

/**
 * Cache of cost analysis results with TTL (1 hour default).
 * Key = JSON-stable hash of query parameters; value = { result, timestamp }.
 */

/**
 * Auto-detect the correct billing export table in the given dataset.
 * Prefers `gcp_billing_export_resource_v1_*` (has labels + resource.name)
 * and falls back to `gcp_billing_export_v1_*` (standard export).
 */
export async function detectBillingTable(
  bigquery: InstanceType<typeof import('@google-cloud/bigquery').BigQuery>,
  bqProject: string,
  billingDataset: string,
  region?: string
): Promise<string> {
  const cacheKey = `${bqProject}.${billingDataset}`;
  const cached = billingTableCache.get(cacheKey);
  if (cached) return cached;

  const queryOpts = (query: string) => {
    const opts: Record<string, unknown> = { query };
    if (region) opts.location = region;
    return opts;
  };

  // Try resource-level export first (has labels + resource.name)
  try {
    const [rows] = await bigquery.query(queryOpts(`
        SELECT table_name
        FROM \`${bqProject}.${billingDataset}.INFORMATION_SCHEMA.TABLES\`
        WHERE table_name LIKE 'gcp_billing_export_resource_v1_%'
        LIMIT 1
      `));
    if (rows && rows.length > 0) {
      const tableName = (rows[0] as { table_name: string }).table_name;
      billingTableCache.set(cacheKey, tableName);
      return tableName;
    }
  } catch (err) {
    // INFORMATION_SCHEMA query for resource table failed — fall through to standard export
    void err;
  }

  // Fall back to standard export
  try {
    const [rows] = await bigquery.query(queryOpts(`
        SELECT table_name
        FROM \`${bqProject}.${billingDataset}.INFORMATION_SCHEMA.TABLES\`
        WHERE table_name LIKE 'gcp_billing_export_v1_%'
        LIMIT 1
      `));
    if (rows && rows.length > 0) {
      const tableName = (rows[0] as { table_name: string }).table_name;
      billingTableCache.set(cacheKey, tableName);
      return tableName;
    }
  } catch (err) {
    // INFORMATION_SCHEMA query for standard table failed — fall through to wildcard
    void err;
  }

  // Final fallback — use wildcard (original behavior)
  const fallback = 'gcp_billing_export_v1_*';
  billingTableCache.set(cacheKey, fallback);
  return fallback;
}

export async function getGCPCostAnalysis(
  projectId: string,
  startDate: string,
  endDate: string,
  bqProject?: string,
  bqDataset?: string,
  filters?: GCPCostFilters,
  forceRefresh?: boolean,
  bqRegion?: string
): Promise<CostAnalysisResult> {
  const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });

  // Try BigQuery billing export first — this is the only source for actual cost data
  try {
    const result = await queryBillingExport(auth, projectId, startDate, endDate, bqProject, bqDataset, filters, bqRegion);
    if (result) {
      return result;
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('Cannot find module') || msg.includes('MODULE_NOT_FOUND')) {
      throw new Error(
        'GCP cost analysis requires the @google-cloud/bigquery package. ' +
        'Install it with: npm install @google-cloud/bigquery'
      );
    }
  }

  // Fallback: check billing account status via Cloud Billing API for better error messages
  let billingInfo = '';
  try {
    billingInfo = await getBillingAccountInfo(auth, projectId);
  } catch {
    // Ignore — billing API access is optional
  }

  const setupMessage =
    'GCP does not provide a Cost Explorer API. ' +
    'Cost data requires BigQuery billing export.\n\n' +
    'Setup steps:\n' +
    '1. Go to GCP Console > Billing > Billing export\n' +
    '2. Enable "Detailed usage cost" export to BigQuery\n' +
    '3. Set the dataset name to "billing_export"\n' +
    '4. Wait 24-48 hours for data to populate' +
    (billingInfo ? '\n\n' + billingInfo : '');

  throw new Error(setupMessage);
}

/**
 * Organization-level cost analysis via BigQuery billing export.
 * Same as project-level but without project filter, plus a cost-by-project breakdown.
 */
export async function getGCPOrgCostAnalysis(
  startDate: string,
  endDate: string,
  bqProject: string,
  bqDataset?: string,
  filters?: GCPCostFilters,
  forceRefresh?: boolean,
  bqRegion?: string
): Promise<CostAnalysisResult> {
  if (!bqProject) {
    throw new Error(
      'BigQuery billing project is required for organization-level cost analysis. ' +
      'Configure the BQ Project in the Billing Config card.'
    );
  }

  const { BigQuery } = require('@google-cloud/bigquery');

  const billingDataset = bqDataset || 'billing_export';
  const region = bqRegion?.trim() || undefined;
  const bqOptions: Record<string, string> = { projectId: bqProject };
  if (region) bqOptions.location = region;
  const bigquery = new BigQuery(bqOptions);
  const billingTable = await detectBillingTable(bigquery, bqProject, billingDataset, region);

  const { clauses: filterClauses, params: filterParams, resourceClauses, resourceParams } = buildFilterClauses(filters);
  const filterWhere = filterClauses.length > 0 ? ' AND ' + filterClauses.join(' AND ') : '';
  const allResourceClauses = [...filterClauses, ...resourceClauses];
  const resourceFilterWhere = allResourceClauses.length > 0 ? ' AND ' + allResourceClauses.join(' AND ') : '';

  // Calculate previous period (same duration, immediately before startDate)
  const currentStart = new Date(startDate);
  const currentEnd = new Date(endDate);
  const durationMs = currentEnd.getTime() - currentStart.getTime();
  const prevEndDate = startDate;
  const prevStartDate = new Date(currentStart.getTime() - durationMs).toISOString().split('T')[0];

  const baseParams = { startDate, endDate, ...filterParams };
  const prevParams = { startDate: prevStartDate, endDate: prevEndDate, ...filterParams };
  const resourceQueryParams = { ...baseParams, ...resourceParams };

  // Run core queries in parallel; resource + labels are best-effort
  const [serviceRows, trendRows, regionRows, projectRows, skuRows, prevTotalRows] = await Promise.all([
    // Cost by service (org-wide)
    bigquery.query({
      query: `
        SELECT
          service.description AS service_name,
          ${NET_COST} AS total_cost,
          currency
        FROM \`${bqProject}.${billingDataset}.${billingTable}\`
        WHERE usage_start_time >= @startDate
          AND usage_start_time < @endDate${filterWhere}
        GROUP BY service_name, currency
        ORDER BY total_cost DESC
      `,
      params: baseParams,
      location: region,
    }).then((r: unknown[][]) => r[0]),

    // Cost trend (org-wide daily)
    bigquery.query({
      query: `
        SELECT
          DATE(usage_start_time) AS date,
          ${NET_COST} AS daily_cost,
          currency
        FROM \`${bqProject}.${billingDataset}.${billingTable}\`
        WHERE usage_start_time >= @startDate
          AND usage_start_time < @endDate${filterWhere}
        GROUP BY date, currency
        ORDER BY date
      `,
      params: baseParams,
      location: region,
    }).then((r: unknown[][]) => r[0]),

    // Cost by region (org-wide)
    bigquery.query({
      query: `
        SELECT
          IFNULL(CAST(location.region AS STRING), '') AS region,
          ${NET_COST} AS total_cost,
          currency
        FROM \`${bqProject}.${billingDataset}.${billingTable}\`
        WHERE usage_start_time >= @startDate
          AND usage_start_time < @endDate${filterWhere}
        GROUP BY region, currency
        ORDER BY total_cost DESC
      `,
      params: baseParams,
      location: region,
    }).then((r: unknown[][]) => r[0]),

    // Cost by project
    bigquery.query({
      query: `
        SELECT
          project.id AS project_id,
          project.name AS project_name,
          ${NET_COST} AS total_cost,
          currency
        FROM \`${bqProject}.${billingDataset}.${billingTable}\`
        WHERE usage_start_time >= @startDate
          AND usage_start_time < @endDate${filterWhere}
        GROUP BY project_id, project_name, currency
        ORDER BY total_cost DESC
      `,
      params: baseParams,
      location: region,
    }).then((r: unknown[][]) => r[0]),

    // Cost by SKU (top 200)
    bigquery.query({
      query: `
        SELECT
          service.description AS service_name,
          sku.description AS sku_name,
          ${NET_COST} AS total_cost,
          currency
        FROM \`${bqProject}.${billingDataset}.${billingTable}\`
        WHERE usage_start_time >= @startDate
          AND usage_start_time < @endDate${filterWhere}
        GROUP BY service_name, sku_name, currency
        HAVING ${NET_COST} > 0.01
        ORDER BY total_cost DESC
        LIMIT 200
      `,
      params: baseParams,
      location: region,
    }).then((r: unknown[][]) => r[0]),

    // Previous period total (same duration window before current period)
    bigquery.query({
      query: `
        SELECT
          ${NET_COST} AS total_cost,
          currency
        FROM \`${bqProject}.${billingDataset}.${billingTable}\`
        WHERE usage_start_time >= @startDate
          AND usage_start_time < @endDate${filterWhere}
        GROUP BY currency
        ORDER BY total_cost DESC
        LIMIT 1
      `,
      params: prevParams,
      location: region,
    }).then((r: unknown[][]) => r[0]).catch(() => []),
  ]);

  // Resource + labels queries run separately — best-effort, don't break core analysis
  let resourceRows: unknown[] = [];
  let labelsRows: unknown[] = [];
  try {
    [resourceRows, labelsRows] = await Promise.all([
      bigquery.query({
        query: `
          WITH sku_costs AS (
            SELECT
              resource.name AS resource_name,
              service.description AS service_name,
              sku.description AS sku_name,
              project.id AS project_id,
              IFNULL(CAST(location.region AS STRING), '') AS region,
              currency,
              ${NET_COST} AS sku_cost
            FROM \`${bqProject}.${billingDataset}.${billingTable}\`
            WHERE usage_start_time >= @startDate
              AND usage_start_time < @endDate
              AND resource.name IS NOT NULL AND resource.name != ''${resourceFilterWhere}
            GROUP BY resource_name, service_name, sku_name, project_id, region, currency
            HAVING ${NET_COST} > 0.001
          )
          SELECT
            resource_name,
            service_name,
            project_id,
            region,
            currency,
            SUM(sku_cost) AS total_cost,
            ARRAY_AGG(STRUCT(sku_name AS sku, sku_cost AS cost) ORDER BY sku_cost DESC) AS sku_breakdown
          FROM sku_costs
          GROUP BY resource_name, service_name, project_id, region, currency
          HAVING SUM(sku_cost) > 0.01
          ORDER BY total_cost DESC
          LIMIT 500
        `,
        params: resourceQueryParams,
        location: region,
      }).then((r: unknown[][]) => r[0]),

      bigquery.query({
        query: `
          SELECT
            label.key AS label_key,
            ARRAY_AGG(DISTINCT label.value IGNORE NULLS ORDER BY label.value LIMIT 100) AS label_values
          FROM \`${bqProject}.${billingDataset}.${billingTable}\`
          LEFT JOIN UNNEST(labels) AS label
          WHERE usage_start_time >= @startDate
            AND usage_start_time < @endDate
            AND label.key IS NOT NULL
          GROUP BY label_key
          ORDER BY label_key
          LIMIT 50
        `,
        params: baseParams,
        location: region,
      }).then((r: unknown[][]) => r[0]),
    ]);
  } catch {
    // Resource/labels queries failed — best-effort, ignore
  }

  const totalCost = (serviceRows as Array<{ total_cost: number }>).reduce(
    (sum, row) => sum + (row.total_cost || 0),
    0
  );

  const previousPeriodTotalCost = ((prevTotalRows as Array<{ total_cost: number }>)[0]?.total_cost) || 0;
  const percentChange = previousPeriodTotalCost > 0
    ? ((totalCost - previousPeriodTotalCost) / previousPeriodTotalCost) * 100
    : 0;

  const byService: DetailedServiceCost[] = (serviceRows as Array<{ service_name: string; total_cost: number; currency: string }>).map(
    (row) => ({
      service: row.service_name || 'Unknown',
      cost: row.total_cost || 0,
      previousPeriodCost: 0,
      percentChange: 0,
      currency: row.currency || 'USD',
    })
  );

  const trend: CostTrendDataPoint[] = (trendRows as Array<{ date: { value: string }; daily_cost: number; currency: string }>).map(
    (row) => ({
      date: row.date?.value || '',
      cost: row.daily_cost || 0,
      currency: row.currency || 'USD',
    })
  );

  const byRegion: RegionCost[] = (regionRows as Array<{ region: string; total_cost: number; currency: string }>).map(
    (row) => ({
      region: row.region || 'global',
      cost: row.total_cost || 0,
      currency: row.currency || 'USD',
    })
  );

  const byProject: ProjectCost[] = (projectRows as Array<{ project_id: string; project_name: string; total_cost: number; currency: string }>).map(
    (row) => ({
      projectId: row.project_id || 'unknown',
      projectName: row.project_name || row.project_id || 'Unknown',
      cost: row.total_cost || 0,
      currency: row.currency || 'USD',
    })
  );

  const bySku: SkuCost[] = (skuRows as Array<{ service_name: string; sku_name: string; total_cost: number; currency: string }>).map(
    (row) => ({
      service: row.service_name || 'Unknown',
      sku: row.sku_name || 'Unknown',
      cost: row.total_cost || 0,
      currency: row.currency || 'USD',
    })
  );

  const byResource: ResourceCost[] = (resourceRows as Array<{ resource_name: string; service_name: string; sku_breakdown: Array<{ sku: string; cost: number }>; project_id: string; region: string; total_cost: number; currency: string }>).map(
    (row) => ({
      resourceName: row.resource_name || '',
      shortName: extractShortName(row.resource_name || ''),
      service: row.service_name || 'Unknown',
      projectId: row.project_id || undefined,
      region: row.region || 'global',
      cost: row.total_cost || 0,
      currency: row.currency || 'USD',
      labels: {} as Record<string, string>,
      skuBreakdown: (row.sku_breakdown || []).map((s) => ({ sku: s.sku, cost: s.cost })),
    })
  );

  const availableLabels: { key: string; values: string[] }[] = (labelsRows as Array<{ label_key: string; label_values: string[] }>).map(
    (row) => ({
      key: row.label_key || '',
      values: (row.label_values || []).filter(Boolean),
    })
  ).filter((l) => l.key);

  const result: CostAnalysisResult = {
    totalCost,
    previousPeriodTotalCost,
    percentChange,
    currency: 'USD',
    startDate,
    endDate,
    trend,
    serviceTrends: {},
    byService,
    byRegion,
    byProject,
    bySku,
    byResource,
    availableLabels,
  };
  return result;
}

/**
 * Check billing account status for the project using the Cloud Billing API.
 * This API cannot return cost data, but can verify billing is enabled.
 */
async function getBillingAccountInfo(auth: GoogleAuth, projectId: string): Promise<string> {
  const authClient = await auth.getClient();
  const billing = google.cloudbilling({ version: 'v1', auth: authClient as never });

  const projectBilling = await billing.projects.getBillingInfo({
    name: `projects/${projectId}`,
  });

  const data = projectBilling.data;
  if (!data.billingEnabled) {
    return `Billing is NOT enabled for project "${projectId}". Enable billing first.`;
  }

  const accountName = data.billingAccountName || 'unknown';
  return `Billing account: ${accountName} (billing is enabled for this project).`;
}

async function queryBillingExport(
  auth: GoogleAuth,
  projectId: string,
  startDate: string,
  endDate: string,
  bqProject?: string,
  bqDataset?: string,
  filters?: GCPCostFilters,
  bqRegion?: string
): Promise<CostAnalysisResult | null> {
  const { BigQuery } = require('@google-cloud/bigquery');

  const billingProject = bqProject || projectId;
  const billingDataset = bqDataset || 'billing_export';
  const region = bqRegion?.trim() || undefined;
  const bqOptions: Record<string, string> = { projectId: billingProject };
  if (region) bqOptions.location = region;
  const bigquery = new BigQuery(bqOptions);
  const billingTable = await detectBillingTable(bigquery, billingProject, billingDataset, region);

  const { clauses: filterClauses, params: filterParams, resourceClauses, resourceParams } = buildFilterClauses(filters);
  const filterWhere = filterClauses.length > 0 ? ' AND ' + filterClauses.join(' AND ') : '';
  const allResourceClauses = [...filterClauses, ...resourceClauses];
  const resourceFilterWhere = allResourceClauses.length > 0 ? ' AND ' + allResourceClauses.join(' AND ') : '';

  // Calculate previous period (same duration, immediately before startDate)
  const currentStart = new Date(startDate);
  const currentEnd = new Date(endDate);
  const durationMs = currentEnd.getTime() - currentStart.getTime();
  const prevEndDate = startDate;
  const prevStartDate = new Date(currentStart.getTime() - durationMs).toISOString().split('T')[0];

  const baseParams = { startDate, endDate, projectId, ...filterParams };
  const prevParams = { startDate: prevStartDate, endDate: prevEndDate, projectId, ...filterParams };
  const resourceQueryParams = { ...baseParams, ...resourceParams };

  try {
    // Run core 4 queries in parallel
    const [serviceResult, trendResult, regionResult, skuResult, prevTotalResult] = await Promise.all([
      // Cost by service
      bigquery.query({
        query: `
          SELECT
            service.description AS service_name,
            ${NET_COST} AS total_cost,
            currency
          FROM \`${billingProject}.${billingDataset}.${billingTable}\`
          WHERE usage_start_time >= @startDate
            AND usage_start_time < @endDate
            AND project.id = @projectId${filterWhere}
          GROUP BY service_name, currency
          ORDER BY total_cost DESC
        `,
        params: baseParams,
        location: region,
      }),

      // Cost trend (daily)
      bigquery.query({
        query: `
          SELECT
            DATE(usage_start_time) AS date,
            ${NET_COST} AS daily_cost,
            currency
          FROM \`${billingProject}.${billingDataset}.${billingTable}\`
          WHERE usage_start_time >= @startDate
            AND usage_start_time < @endDate
            AND project.id = @projectId${filterWhere}
          GROUP BY date, currency
          ORDER BY date
        `,
        params: baseParams,
        location: region,
      }),

      // Cost by region
      bigquery.query({
        query: `
          SELECT
            IFNULL(CAST(location.region AS STRING), '') AS region,
            ${NET_COST} AS total_cost,
            currency
          FROM \`${billingProject}.${billingDataset}.${billingTable}\`
          WHERE usage_start_time >= @startDate
            AND usage_start_time < @endDate
            AND project.id = @projectId${filterWhere}
          GROUP BY region, currency
          ORDER BY total_cost DESC
        `,
        params: baseParams,
        location: region,
      }),

      // Cost by SKU (top 200)
      bigquery.query({
        query: `
          SELECT
            service.description AS service_name,
            sku.description AS sku_name,
            ${NET_COST} AS total_cost,
            currency
          FROM \`${billingProject}.${billingDataset}.${billingTable}\`
          WHERE usage_start_time >= @startDate
            AND usage_start_time < @endDate
            AND project.id = @projectId${filterWhere}
          GROUP BY service_name, sku_name, currency
          HAVING ${NET_COST} > 0.01
          ORDER BY total_cost DESC
          LIMIT 200
        `,
        params: baseParams,
        location: region,
      }),

      // Previous period total (same duration window before current period)
      bigquery.query({
        query: `
          SELECT
            ${NET_COST} AS total_cost,
            currency
          FROM \`${billingProject}.${billingDataset}.${billingTable}\`
          WHERE usage_start_time >= @startDate
            AND usage_start_time < @endDate
            AND project.id = @projectId${filterWhere}
          GROUP BY currency
          ORDER BY total_cost DESC
          LIMIT 1
        `,
        params: prevParams,
        location: region,
      }).catch(() => [[]] as unknown[][]),
    ]);

    const serviceRows = serviceResult[0];
    const trendRows = trendResult[0];
    const regionRows = regionResult[0];
    const skuQueryRows = skuResult[0];
    const prevTotalRows = prevTotalResult[0] || [];

    // Resource + labels queries — best-effort, don't break core analysis
    let resourceRows: unknown[] = [];
    let labelsRows: unknown[] = [];
    try {
      const [resourceResult, labelsResult] = await Promise.all([
        bigquery.query({
          query: `
            WITH sku_costs AS (
              SELECT
                resource.name AS resource_name,
                service.description AS service_name,
                sku.description AS sku_name,
                IFNULL(CAST(location.region AS STRING), '') AS region,
                currency,
                ${NET_COST} AS sku_cost
              FROM \`${billingProject}.${billingDataset}.${billingTable}\`
              WHERE usage_start_time >= @startDate
                AND usage_start_time < @endDate
                AND project.id = @projectId
                AND resource.name IS NOT NULL AND resource.name != ''${resourceFilterWhere}
              GROUP BY resource_name, service_name, sku_name, region, currency
              HAVING ${NET_COST} > 0.001
            )
            SELECT
              resource_name,
              service_name,
              region,
              currency,
              SUM(sku_cost) AS total_cost,
              ARRAY_AGG(STRUCT(sku_name AS sku, sku_cost AS cost) ORDER BY sku_cost DESC) AS sku_breakdown
            FROM sku_costs
            GROUP BY resource_name, service_name, region, currency
            HAVING SUM(sku_cost) > 0.01
            ORDER BY total_cost DESC
            LIMIT 500
          `,
          params: resourceQueryParams,
          location: region,
        }),

        bigquery.query({
          query: `
            SELECT
              label.key AS label_key,
              ARRAY_AGG(DISTINCT label.value IGNORE NULLS ORDER BY label.value LIMIT 100) AS label_values
            FROM \`${billingProject}.${billingDataset}.${billingTable}\`
            LEFT JOIN UNNEST(labels) AS label
            WHERE usage_start_time >= @startDate
              AND usage_start_time < @endDate
              AND project.id = @projectId
              AND label.key IS NOT NULL
            GROUP BY label_key
            ORDER BY label_key
            LIMIT 50
          `,
          params: baseParams,
          location: region,
        }),
      ]);
      resourceRows = resourceResult[0];
      labelsRows = labelsResult[0];
    } catch {
      // Resource/labels queries failed — best-effort, ignore
    }

    const totalCost = serviceRows.reduce(
      (sum: number, row: { total_cost: number }) => sum + (row.total_cost || 0),
      0
    );

    const previousPeriodTotalCost = ((prevTotalRows as Array<{ total_cost: number }>)[0]?.total_cost) || 0;
    const percentChange = previousPeriodTotalCost > 0
      ? ((totalCost - previousPeriodTotalCost) / previousPeriodTotalCost) * 100
      : 0;

    const byService: DetailedServiceCost[] = serviceRows.map(
      (row: { service_name: string; total_cost: number; currency: string }) => ({
        service: row.service_name || 'Unknown',
        cost: row.total_cost || 0,
        previousPeriodCost: 0,
        percentChange: 0,
        currency: row.currency || 'USD',
      })
    );

    const trend: CostTrendDataPoint[] = trendRows.map(
      (row: { date: { value: string }; daily_cost: number; currency: string }) => ({
        date: row.date?.value || '',
        cost: row.daily_cost || 0,
        currency: row.currency || 'USD',
      })
    );

    const byRegion: RegionCost[] = regionRows.map(
      (row: { region: string; total_cost: number; currency: string }) => ({
        region: row.region || 'global',
        cost: row.total_cost || 0,
        currency: row.currency || 'USD',
      })
    );

    const bySku: SkuCost[] = skuQueryRows.map(
      (row: { service_name: string; sku_name: string; total_cost: number; currency: string }) => ({
        service: row.service_name || 'Unknown',
        sku: row.sku_name || 'Unknown',
        cost: row.total_cost || 0,
        currency: row.currency || 'USD',
      })
    );

    const byResource: ResourceCost[] = (resourceRows as Array<{ resource_name: string; service_name: string; sku_breakdown: Array<{ sku: string; cost: number }>; region: string; total_cost: number; currency: string }>).map(
      (row) => ({
        resourceName: row.resource_name || '',
        shortName: extractShortName(row.resource_name || ''),
        service: row.service_name || 'Unknown',
        region: row.region || 'global',
        cost: row.total_cost || 0,
        currency: row.currency || 'USD',
        labels: {} as Record<string, string>,
        skuBreakdown: (row.sku_breakdown || []).map((s) => ({ sku: s.sku, cost: s.cost })),
      })
    );

    const availableLabels: { key: string; values: string[] }[] = (labelsRows as Array<{ label_key: string; label_values: string[] }>).map(
      (row) => ({
        key: row.label_key || '',
        values: (row.label_values || []).filter(Boolean),
      })
    ).filter((l) => l.key);

    return {
      totalCost,
      previousPeriodTotalCost,
      percentChange,
      currency: 'USD',
      startDate,
      endDate,
      trend,
      serviceTrends: {},
      byService,
      byRegion,
      bySku,
      byResource,
      availableLabels,
    };
  } catch {
    // BigQuery export not configured or accessible
    return null;
  }
}

/**
 * Get cost optimization recommendations from the GCP Recommender API.
 * Delegates to the expanded recommender module which covers all 13 cost-category
 * recommender types across all active regions.
 *
 * Returns data in the CostOptimizationResult format for backward compatibility.
 */
export async function getGCPCostRecommendations(projectId: string): Promise<CostOptimizationResult> {
  const { getExpandedCostRecommendations } = await import('./recommender-expanded');
  const expanded = await getExpandedCostRecommendations(projectId);

  return {
    recommendations: expanded.recommendations,
    totalPotentialSavings: expanded.totalPotentialSavings,
    currency: expanded.currency,
  };
}

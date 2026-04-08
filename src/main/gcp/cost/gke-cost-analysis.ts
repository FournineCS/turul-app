// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { detectBillingTable } from './billing-analysis';

/**
 * GKE Cost Analysis — queries BigQuery billing export for GKE-specific
 * label dimensions (cluster, namespace, workload) available when
 * GKE cost allocation is enabled on clusters.
 */

/** Net cost expression including credits. */
const NET_COST = `SUM(cost) + SUM(IFNULL((SELECT SUM(c.amount) FROM UNNEST(credits) c), 0))`;

/** WHERE fragment that scopes rows to GKE resources only. */
const GKE_FILTER = `EXISTS(SELECT 1 FROM UNNEST(labels) l WHERE l.key = 'goog-k8s-cluster-name')`;

function labelValue(alias: string, key: string): string {
  return `(SELECT l.value FROM UNNEST(labels) l WHERE l.key = '${key}') AS ${alias}`;
}

export interface GKEClusterCost {
  cluster: string;
  cost: number;
  namespaceCount?: number;
}

export interface GKENamespaceCost {
  namespace: string;
  cluster: string;
  cost: number;
}

export interface GKEWorkloadCost {
  workload: string;
  workloadType: string;
  namespace: string;
  cluster: string;
  cost: number;
}

export interface GKETrendPoint {
  date: string;
  cost: number;
  cluster?: string;
}

export interface GKESkuCost {
  sku: string;
  cost: number;
}

export interface GKECostAnalysis {
  totalCost: number;
  currency: string;
  byCluster: GKEClusterCost[];
  byNamespace: GKENamespaceCost[];
  byWorkload: GKEWorkloadCost[];
  trend: GKETrendPoint[];
  bySku: GKESkuCost[];
}

/**
 * Query GKE costs. When projectId is empty/null, queries across all projects (org-level).
 */
export async function getGKECosts(
  projectId: string | null | undefined,
  startDate: string,
  endDate: string,
  bqProject: string,
  bqDataset?: string,
  clusterFilter?: string,
  namespaceFilter?: string,
  bqRegion?: string
): Promise<GKECostAnalysis> {
  const { BigQuery } = require('@google-cloud/bigquery');

  const billingProject = bqProject;
  const billingDataset = bqDataset || 'billing_export';
  const region = bqRegion?.trim() || undefined;


  const bqOptions: Record<string, string> = { projectId: billingProject };
  if (region) bqOptions.location = region;
  const bigquery = new BigQuery(bqOptions);
  const billingTable = await detectBillingTable(bigquery, billingProject, billingDataset, region);
  const table = `\`${billingProject}.${billingDataset}.${billingTable}\``;

  // Base params
  const baseParams: Record<string, unknown> = { startDate, endDate };
  if (projectId) baseParams.projectId = projectId;

  const projectClause = projectId ? ' AND project.id = @projectId' : '';

  // Optional drill-down filters
  let clusterClause = '';
  if (clusterFilter) {
    clusterClause = ` AND (SELECT l.value FROM UNNEST(labels) l WHERE l.key = 'goog-k8s-cluster-name') = @clusterFilter`;
    baseParams.clusterFilter = clusterFilter;
  }
  let nsClause = '';
  if (namespaceFilter) {
    nsClause = ` AND (SELECT l.value FROM UNNEST(labels) l WHERE l.key = 'k8s-namespace') = @namespaceFilter`;
    baseParams.namespaceFilter = namespaceFilter;
  }

  const baseWhere = `usage_start_time >= @startDate AND usage_start_time < @endDate${projectClause} AND ${GKE_FILTER}`;

  const q = (query: string) => ({ query, params: baseParams, location: region });

  // Run all 5 queries in parallel
  const [clusterRows, nsRows, wlRows, trendRows, skuRows] = await Promise.all([
    // 1. Cost by cluster
    bigquery.query(q(`
      SELECT
        ${labelValue('cluster_name', 'goog-k8s-cluster-name')},
        ${NET_COST} AS total_cost,
        COUNT(DISTINCT (SELECT l.value FROM UNNEST(labels) l WHERE l.key = 'k8s-namespace')) AS ns_count,
        currency
      FROM ${table}
      WHERE ${baseWhere}${clusterClause}
      GROUP BY cluster_name, currency
      HAVING ${NET_COST} > 0
      ORDER BY total_cost DESC
    `)).then((r: unknown[][]) => r[0]),

    // 2. Cost by namespace
    bigquery.query(q(`
      SELECT
        ${labelValue('namespace', 'k8s-namespace')},
        ${labelValue('cluster_name', 'goog-k8s-cluster-name')},
        ${NET_COST} AS total_cost,
        currency
      FROM ${table}
      WHERE ${baseWhere}${clusterClause}
      GROUP BY namespace, cluster_name, currency
      HAVING ${NET_COST} > 0
      ORDER BY total_cost DESC
    `)).then((r: unknown[][]) => r[0]),

    // 3. Cost by workload
    bigquery.query(q(`
      SELECT
        ${labelValue('workload_name', 'k8s-workload-name')},
        ${labelValue('workload_type', 'k8s-workload-type')},
        ${labelValue('namespace', 'k8s-namespace')},
        ${labelValue('cluster_name', 'goog-k8s-cluster-name')},
        ${NET_COST} AS total_cost,
        currency
      FROM ${table}
      WHERE ${baseWhere}${clusterClause}${nsClause}
      GROUP BY workload_name, workload_type, namespace, cluster_name, currency
      HAVING ${NET_COST} > 0.01
      ORDER BY total_cost DESC
      LIMIT 500
    `)).then((r: unknown[][]) => r[0]),

    // 4. Daily trend (optionally per cluster)
    bigquery.query(q(
      clusterFilter
        ? `
          SELECT
            DATE(usage_start_time) AS date,
            ${NET_COST} AS daily_cost,
            currency
          FROM ${table}
          WHERE ${baseWhere}${clusterClause}
          GROUP BY date, currency
          ORDER BY date
        `
        : `
          SELECT
            DATE(usage_start_time) AS date,
            ${labelValue('cluster_name', 'goog-k8s-cluster-name')},
            ${NET_COST} AS daily_cost,
            currency
          FROM ${table}
          WHERE ${baseWhere}
          GROUP BY date, cluster_name, currency
          ORDER BY date
        `
    )).then((r: unknown[][]) => r[0]),

    // 5. Cost by SKU
    bigquery.query(q(`
      SELECT
        sku.description AS sku_name,
        ${NET_COST} AS total_cost,
        currency
      FROM ${table}
      WHERE ${baseWhere}${clusterClause}${nsClause}
      GROUP BY sku_name, currency
      HAVING ${NET_COST} > 0.01
      ORDER BY total_cost DESC
      LIMIT 100
    `)).then((r: unknown[][]) => r[0]),
  ]);

  // Parse results
  const byCluster: GKEClusterCost[] = (clusterRows as Array<{
    cluster_name: string; total_cost: number; ns_count: number;
  }>).map(r => ({
    cluster: r.cluster_name || 'unknown',
    cost: r.total_cost || 0,
    namespaceCount: r.ns_count || 0,
  }));

  const totalCost = byCluster.reduce((s, c) => s + c.cost, 0);

  const byNamespace: GKENamespaceCost[] = (nsRows as Array<{
    namespace: string; cluster_name: string; total_cost: number;
  }>).map(r => ({
    namespace: r.namespace || 'unknown',
    cluster: r.cluster_name || 'unknown',
    cost: r.total_cost || 0,
  }));

  const byWorkload: GKEWorkloadCost[] = (wlRows as Array<{
    workload_name: string; workload_type: string; namespace: string; cluster_name: string; total_cost: number;
  }>).map(r => ({
    workload: r.workload_name || '(unallocated)',
    workloadType: r.workload_type || '',
    namespace: r.namespace || 'unknown',
    cluster: r.cluster_name || 'unknown',
    cost: r.total_cost || 0,
  }));

  const trend: GKETrendPoint[] = (trendRows as Array<{
    date: { value: string }; cluster_name?: string; daily_cost: number;
  }>).map(r => ({
    date: r.date?.value || '',
    cost: r.daily_cost || 0,
    cluster: r.cluster_name || undefined,
  }));

  const bySku: GKESkuCost[] = (skuRows as Array<{
    sku_name: string; total_cost: number;
  }>).map(r => ({
    sku: r.sku_name || 'Unknown',
    cost: r.total_cost || 0,
  }));

  const currency = (clusterRows as Array<{ currency?: string }>)[0]?.currency || 'USD';

  return { totalCost, currency, byCluster, byNamespace, byWorkload, trend, bySku };
}

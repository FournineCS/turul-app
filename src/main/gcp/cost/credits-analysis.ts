// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { detectBillingTable } from './billing-analysis';
import type { CreditsAnalysisResult, CreditsByCategory, CreditsTrendPoint } from '../../../shared/types';

const CREDIT_TYPE_LABELS: Record<string, string> = {
  COMMITTED_USAGE_DISCOUNT: 'Committed Use Discount',
  COMMITTED_USAGE_DISCOUNT_DOLLAR_BASE: 'CUD (Dollar-based)',
  SUSTAINED_USAGE_DISCOUNT: 'Sustained Use Discount',
  PROMOTION: 'Promotional Credit',
  FREE_TIER: 'Free Tier',
  SUBSCRIPTION_BENEFIT: 'Subscription Benefit',
  SPENDING_BASED_DISCOUNT: 'Spending-based Discount',
  RESELLER_MARGIN: 'Reseller Margin',
  DISCOUNT: 'Discount',
  CREDIT_TYPE_UNSPECIFIED: 'Other',
};

function formatCreditType(type: string): string {
  return CREDIT_TYPE_LABELS[type] || type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
}

async function runQueries(
  bigquery: InstanceType<typeof import('@google-cloud/bigquery').BigQuery>,
  billingTable: string,
  bqProject: string,
  billingDataset: string,
  startDate: string,
  endDate: string,
  region?: string,
  projectFilter?: string
): Promise<CreditsAnalysisResult> {
  const tableRef = `\`${bqProject}.${billingDataset}.${billingTable}\``;
  const projectWhere = projectFilter ? `AND project.id = @projectId` : '';
  const baseParams: Record<string, string> = { startDate, endDate };
  if (projectFilter) baseParams.projectId = projectFilter;

  const queryOpts = (query: string, params: Record<string, string> = baseParams) => {
    const opts: Record<string, unknown> = { query, params };
    if (region) opts.location = region;
    return opts;
  };

  const [typeRows, serviceRows, trendRows, grossRows, projectRows] = await Promise.all([
    // Credits by type
    bigquery.query(queryOpts(`
      SELECT
        c.type AS credit_type,
        SUM(ABS(c.amount)) AS total_credits,
        COUNT(*) AS credit_count,
        currency
      FROM ${tableRef}, UNNEST(credits) AS c
      WHERE DATE(usage_start_time) >= @startDate
        AND DATE(usage_start_time) < @endDate
        AND c.amount != 0
        ${projectWhere}
      GROUP BY credit_type, currency
      ORDER BY total_credits DESC
    `)),
    // Credits by service
    bigquery.query(queryOpts(`
      SELECT
        service.description AS service_name,
        SUM(ABS(c.amount)) AS total_credits,
        COUNT(*) AS credit_count,
        currency
      FROM ${tableRef}, UNNEST(credits) AS c
      WHERE DATE(usage_start_time) >= @startDate
        AND DATE(usage_start_time) < @endDate
        AND c.amount != 0
        ${projectWhere}
      GROUP BY service_name, currency
      ORDER BY total_credits DESC
    `)),
    // Credits trend by month and type
    bigquery.query(queryOpts(`
      SELECT
        FORMAT_DATE('%Y-%m', DATE(usage_start_time)) AS month,
        c.type AS credit_type,
        SUM(ABS(c.amount)) AS total_credits,
        currency
      FROM ${tableRef}, UNNEST(credits) AS c
      WHERE DATE(usage_start_time) >= @startDate
        AND DATE(usage_start_time) < @endDate
        AND c.amount != 0
        ${projectWhere}
      GROUP BY month, credit_type, currency
      ORDER BY month
    `)),
    // Gross cost (cost only, no credits)
    bigquery.query(queryOpts(`
      SELECT
        SUM(cost) AS gross_cost,
        currency
      FROM ${tableRef}
      WHERE DATE(usage_start_time) >= @startDate
        AND DATE(usage_start_time) < @endDate
        ${projectWhere}
      GROUP BY currency
    `)),
    // Credits by project (only for org-level, skip for project-level)
    projectFilter
      ? Promise.resolve([[]])
      : bigquery.query(queryOpts(`
          SELECT
            project.id AS project_id,
            SUM(ABS(c.amount)) AS total_credits,
            COUNT(*) AS credit_count,
            currency
          FROM ${tableRef}, UNNEST(credits) AS c
          WHERE DATE(usage_start_time) >= @startDate
            AND DATE(usage_start_time) < @endDate
            AND c.amount != 0
          GROUP BY project_id, currency
          ORDER BY total_credits DESC
          LIMIT 50
        `)),
  ]);

  let currency = 'USD';

  // Process credits by type
  const byType: CreditsByCategory[] = ((typeRows as any[][])[0] || []).map((row: any) => {
    currency = row.currency || currency;
    return {
      category: formatCreditType(row.credit_type || 'UNKNOWN'),
      amount: parseFloat(row.total_credits) || 0,
      currency: row.currency || currency,
      count: parseInt(row.credit_count) || 0,
    };
  });

  // Process credits by service
  const byService: CreditsByCategory[] = ((serviceRows as any[][])[0] || []).map((row: any) => {
    currency = row.currency || currency;
    return {
      category: row.service_name || 'Unknown',
      amount: parseFloat(row.total_credits) || 0,
      currency: row.currency || currency,
      count: parseInt(row.credit_count) || 0,
    };
  });

  // Process trend data (group by month, with byType breakdown)
  const trendMap = new Map<string, CreditsTrendPoint>();
  for (const row of (trendRows as any[][])[0] || []) {
    currency = row.currency || currency;
    const month = row.month || '';
    const creditType = formatCreditType(row.credit_type || 'UNKNOWN');
    const amount = parseFloat(row.total_credits) || 0;

    if (!trendMap.has(month)) {
      trendMap.set(month, { date: month, totalCredits: 0, byType: {}, currency });
    }
    const point = trendMap.get(month)!;
    point.totalCredits += amount;
    point.byType![creditType] = (point.byType![creditType] || 0) + amount;
  }
  const trend = Array.from(trendMap.values()).sort((a, b) => a.date.localeCompare(b.date));

  // Process gross cost
  let totalGrossCost = 0;
  for (const row of (grossRows as any[][])[0] || []) {
    currency = row.currency || currency;
    totalGrossCost += parseFloat(row.gross_cost) || 0;
  }

  // Process credits by project (org-level)
  const byProject: CreditsByCategory[] | undefined = !projectFilter
    ? ((projectRows as any[][])[0] || []).map((row: any) => ({
        category: row.project_id || 'Unknown',
        amount: parseFloat(row.total_credits) || 0,
        currency: row.currency || currency,
        count: parseInt(row.credit_count) || 0,
      }))
    : undefined;

  const totalCredits = byType.reduce((sum, t) => sum + t.amount, 0);
  const totalNetCost = totalGrossCost - totalCredits;
  const creditsAsPercentOfGross = totalGrossCost > 0 ? (totalCredits / totalGrossCost) * 100 : 0;

  return {
    totalCredits,
    totalGrossCost,
    totalNetCost,
    creditsAsPercentOfGross,
    currency,
    startDate,
    endDate,
    trend,
    byService,
    byType,
    byProject: byProject && byProject.length > 0 ? byProject : undefined,
  };
}

export async function getGCPCreditsAnalysis(
  projectId: string,
  startDate: string,
  endDate: string,
  bqProject?: string,
  bqDataset?: string,
  bqRegion?: string
): Promise<CreditsAnalysisResult> {
  const { BigQuery } = require('@google-cloud/bigquery');

  const billingProject = bqProject || projectId;
  const billingDataset = bqDataset || 'billing_export';
  const region = bqRegion?.trim() || undefined;

  const bqOptions: Record<string, string> = { projectId: billingProject };
  if (region) bqOptions.location = region;
  const bigquery = new BigQuery(bqOptions);
  const billingTable = await detectBillingTable(bigquery, billingProject, billingDataset, region);

  return runQueries(bigquery, billingTable, billingProject, billingDataset, startDate, endDate, region, projectId);
}

export async function getGCPOrgCreditsAnalysis(
  startDate: string,
  endDate: string,
  bqProject: string,
  bqDataset?: string,
  bqRegion?: string
): Promise<CreditsAnalysisResult> {
  if (!bqProject) {
    throw new Error('BigQuery billing project is required for organization-level credits analysis.');
  }

  const { BigQuery } = require('@google-cloud/bigquery');

  const billingDataset = bqDataset || 'billing_export';
  const region = bqRegion?.trim() || undefined;

  const bqOptions: Record<string, string> = { projectId: bqProject };
  if (region) bqOptions.location = region;
  const bigquery = new BigQuery(bqOptions);
  const billingTable = await detectBillingTable(bigquery, bqProject, billingDataset, region);

  return runQueries(bigquery, billingTable, bqProject, billingDataset, startDate, endDate, region);
}

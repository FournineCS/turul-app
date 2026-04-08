// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';
import type {
  CostOptimizationRecommendation,
  GCPCUDCoverageResult,
  GCPCommitment,
  GCPCommitmentCostBreakdown,
} from './types';
import { enumerateProjectRegions } from './recommender-expanded';
import { detectBillingTable } from './billing-analysis';

/**
 * Analyse GCP Committed Use Discount (CUD) coverage.
 *
 * Three data sources are combined:
 * 1. Compute Engine API — regionCommitments.list() per region → active commitments
 * 2. BigQuery billing export — committed vs on-demand Compute Engine spend per region (last 30 days)
 * 3. Recommender API — UsageCommitmentRecommender suggestions
 *
 * Gracefully degrades when BigQuery is unavailable (commitments + recommender only,
 * coverageRatio = -1).
 */
export async function getGCPCUDCoverage(
  projectId: string,
  bqProject?: string,
  bqDataset?: string
): Promise<GCPCUDCoverageResult> {
  const errors: string[] = [];

  // 1. Fetch active commitments via Compute Engine API
  const commitments = await fetchCommitments(projectId, errors);

  // 2. Fetch CUD recommendations from Recommender API
  const cudRecommendations = await fetchCUDRecommendations(projectId, errors);

  // 3. If BigQuery is configured, compute coverage metrics + commitment breakdown
  let coverageRatio = -1;
  let totalCommittedSpend = 0;
  let totalEligibleOnDemandSpend = 0;
  let uncoveredOnDemandSpend = 0;
  let potentialSavingsFromCUD = 0;
  let byRegion: GCPCUDCoverageResult['byRegion'] = [];
  let commitmentBreakdown: GCPCommitmentCostBreakdown[] = [];
  let costUtilization = { totalCommitmentFees: 0, totalCUDCredits: 0, utilizationRatio: 0 };

  if (bqProject) {
    try {
      const [bqResult, breakdownResult] = await Promise.all([
        queryCUDCoverage(projectId, bqProject, bqDataset),
        queryCommitmentBreakdown(bqProject, bqDataset, errors),
      ]);
      coverageRatio = bqResult.coverageRatio;
      totalCommittedSpend = bqResult.totalCommittedSpend;
      totalEligibleOnDemandSpend = bqResult.totalEligibleOnDemandSpend;
      uncoveredOnDemandSpend = bqResult.uncoveredOnDemandSpend;
      potentialSavingsFromCUD = bqResult.potentialSavingsFromCUD;
      byRegion = bqResult.byRegion;
      commitmentBreakdown = breakdownResult.breakdown;
      costUtilization = breakdownResult.costUtilization;
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      errors.push(`BQ CUD coverage query failed: ${msg}`);
    }
  }

  return {
    commitments,
    coverageRatio,
    totalCommittedSpend,
    totalEligibleOnDemandSpend,
    uncoveredOnDemandSpend,
    potentialSavingsFromCUD,
    currency: 'USD',
    byRegion,
    cudRecommendations,
    commitmentBreakdown,
    costUtilization,
    errors,
  };
}

// ── Fetch active CUD commitments via Compute Engine API ──

async function fetchCommitments(projectId: string, errors: string[]): Promise<GCPCommitment[]> {
  try {
    const auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/compute.readonly'],
    });
    const authClient = await auth.getClient();
    const compute = google.compute({ version: 'v1', auth: authClient as never });

    const regions = await enumerateProjectRegions(projectId);
    const commitments: GCPCommitment[] = [];

    // Fetch commitments per region (concurrency-limited)
    const concurrency = 10;
    const executing = new Set<Promise<void>>();

    for (const region of regions) {
      const task = (async () => {
        try {
          const response = await compute.regionCommitments.list({
            project: projectId,
            region,
          });

          for (const c of response.data.items || []) {
            commitments.push({
              name: c.name || 'unknown',
              region,
              type: c.type || 'GENERAL_PURPOSE',
              plan: c.plan || 'TWELVE_MONTH',
              status: c.status || 'UNKNOWN',
              startTimestamp: c.startTimestamp || '',
              endTimestamp: c.endTimestamp || '',
              resources: (c.resources || []).map((r) => ({
                type: r.type || 'VCPU',
                amount: Number(r.amount || 0),
                unit: r.type === 'MEMORY' ? 'GB' : 'vCPUs',
              })),
            });
          }
        } catch {
          // Most regions won't have commitments — silent catch
        }
      })();

      const tracked = task.then(() => { executing.delete(tracked); });
      executing.add(tracked);
      if (executing.size >= concurrency) {
        await Promise.race(executing);
      }
    }
    await Promise.all(executing);

    return commitments;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    errors.push(`Failed to fetch CUD commitments: ${msg}`);
    return [];
  }
}

// ── Fetch CUD purchase recommendations via Recommender API ──

async function fetchCUDRecommendations(
  projectId: string,
  errors: string[]
): Promise<CostOptimizationRecommendation[]> {
  try {
    const { RecommenderClient } = require('@google-cloud/recommender');
    const client = new RecommenderClient();

    const regions = await enumerateProjectRegions(projectId);
    const recommendations: CostOptimizationRecommendation[] = [];
    let idx = 0;

    const concurrency = 10;
    const executing = new Set<Promise<void>>();

    for (const region of regions) {
      const task = (async () => {
        try {
          const parent = `projects/${projectId}/locations/${region}/recommenders/google.compute.commitment.UsageCommitmentRecommender`;
          const [recs] = await client.listRecommendations({ parent });

          for (const rec of recs) {
            const projection = rec.primaryImpact?.costProjection;
            let monthlySavings = 0;
            if (projection?.cost) {
              const units = Math.abs(Number(projection.cost.units || 0));
              const nanos = Math.abs(projection.cost.nanos || 0) / 1e9;
              const totalCost = units + nanos;
              const durationSecs = Number(projection.duration?.seconds || 2592000);
              const durationDays = durationSecs / 86400;
              monthlySavings = durationDays > 0 ? (totalCost / durationDays) * 30 : totalCost;
            }

            recommendations.push({
              id: rec.name || `cud-rec-${idx++}`,
              type: 'commitment_coverage',
              severity: rec.priority === 'P1' ? 'high' : rec.priority === 'P2' ? 'medium' : 'low',
              service: 'Compute Engine (CUDs)',
              description: rec.description || 'Consider purchasing a committed use discount.',
              estimatedMonthlySavings: monthlySavings,
              currency: 'USD',
              actionRequired: 'Review CUD purchase recommendation in GCP Console.',
              region,
              category: 'Commitments',
            });
          }
        } catch {
          // Most regions won't have CUD recommendations — silent catch
        }
      })();

      const tracked = task.then(() => { executing.delete(tracked); });
      executing.add(tracked);
      if (executing.size >= concurrency) {
        await Promise.race(executing);
      }
    }
    await Promise.all(executing);

    return recommendations;
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    errors.push(`Failed to fetch CUD recommendations: ${msg}`);
    return [];
  }
}

// ── BigQuery-based commitment cost breakdown ──

interface CommitmentBreakdownResult {
  breakdown: GCPCommitmentCostBreakdown[];
  costUtilization: {
    totalCommitmentFees: number;
    totalCUDCredits: number;
    utilizationRatio: number;
  };
}

async function queryCommitmentBreakdown(
  bqProject: string,
  bqDataset: string | undefined,
  errors: string[]
): Promise<CommitmentBreakdownResult> {
  const emptyResult: CommitmentBreakdownResult = {
    breakdown: [],
    costUtilization: { totalCommitmentFees: 0, totalCUDCredits: 0, utilizationRatio: 0 },
  };

  try {
    const { BigQuery } = require('@google-cloud/bigquery');
    const bigquery = new BigQuery({ projectId: bqProject });
    const dataset = bqDataset || 'billing_export';
    const billingTable = await detectBillingTable(bigquery, bqProject, dataset);
    const tableRef = `\`${bqProject}.${dataset}.${billingTable}\``;

    // Run both queries in parallel
    const feesQuery = `
      SELECT
        REGEXP_EXTRACT(sku.description, r'Commitment v\\d+: (.+) for \\d+ Year') AS commitment_label,
        sku.description AS sku_description,
        SUM(cost) AS commitment_fee
      FROM ${tableRef}
      WHERE usage_start_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
        AND service.description = 'Compute Engine'
        AND LOWER(sku.description) LIKE '%commitment%'
        AND cost > 0
      GROUP BY commitment_label, sku_description
      ORDER BY commitment_fee DESC
    `;

    const creditsQuery = `
      SELECT
        SUM(ABS(c.amount)) AS total_cud_credits
      FROM ${tableRef}, UNNEST(credits) AS c
      WHERE usage_start_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
        AND service.description = 'Compute Engine'
        AND LOWER(c.name) LIKE '%committed use discount%'
    `;

    const [[feesRows], [creditsRows]] = await Promise.all([
      bigquery.query({ query: feesQuery }),
      bigquery.query({ query: creditsQuery }),
    ]);

    const breakdown: GCPCommitmentCostBreakdown[] = [];
    let totalCommitmentFees = 0;

    for (const row of feesRows as Array<{
      commitment_label: string | null;
      sku_description: string;
      commitment_fee: number;
    }>) {
      const fee = Number(row.commitment_fee || 0);
      totalCommitmentFees += fee;
      breakdown.push({
        commitmentLabel: row.commitment_label || row.sku_description,
        skuDescription: row.sku_description,
        commitmentFee: fee,
      });
    }

    const totalCUDCredits = Number(
      (creditsRows as Array<{ total_cud_credits: number }>)[0]?.total_cud_credits || 0
    );

    const utilizationRatio = totalCommitmentFees > 0
      ? totalCUDCredits / totalCommitmentFees
      : 0;

    return {
      breakdown,
      costUtilization: { totalCommitmentFees, totalCUDCredits, utilizationRatio },
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    errors.push(`BQ commitment breakdown query failed: ${msg}`);
    return emptyResult;
  }
}

// ── BigQuery-based CUD coverage analysis ──

interface BQCoverageResult {
  coverageRatio: number;
  totalCommittedSpend: number;
  totalEligibleOnDemandSpend: number;
  uncoveredOnDemandSpend: number;
  potentialSavingsFromCUD: number;
  byRegion: Array<{ region: string; committedSpend: number; onDemandSpend: number; coverageRatio: number }>;
}

async function queryCUDCoverage(
  projectId: string,
  bqProject: string,
  bqDataset?: string
): Promise<BQCoverageResult> {
  const { BigQuery } = require('@google-cloud/bigquery');
  const bigquery = new BigQuery({ projectId: bqProject });
  const dataset = bqDataset || 'billing_export';

  // Query: compute committed vs on-demand spend by region for Compute Engine
  const query = `
    WITH compute_costs AS (
      SELECT
        location.region AS region,
        SUM(CASE
          WHEN LOWER(sku.description) LIKE '%commitment%'
            OR LOWER(sku.description) LIKE '%committed%'
          THEN cost ELSE 0
        END) AS committed_spend,
        SUM(CASE
          WHEN LOWER(sku.description) NOT LIKE '%commitment%'
            AND LOWER(sku.description) NOT LIKE '%committed%'
          THEN cost ELSE 0
        END) AS on_demand_spend
      FROM \`${bqProject}.${dataset}.gcp_billing_export_v1_*\`
      WHERE usage_start_time >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
        AND project.id = @projectId
        AND service.description = 'Compute Engine'
        AND cost > 0
      GROUP BY region
      HAVING (committed_spend + on_demand_spend) > 0.01
    )
    SELECT
      region,
      committed_spend,
      on_demand_spend,
      SAFE_DIVIDE(committed_spend, committed_spend + on_demand_spend) AS coverage_ratio
    FROM compute_costs
    ORDER BY (committed_spend + on_demand_spend) DESC
  `;

  const [rows] = await bigquery.query({
    query,
    params: { projectId },
  });

  let totalCommittedSpend = 0;
  let totalOnDemandSpend = 0;
  const byRegion: BQCoverageResult['byRegion'] = [];

  for (const row of rows as Array<{
    region: string;
    committed_spend: number;
    on_demand_spend: number;
    coverage_ratio: number;
  }>) {
    const committed = Number(row.committed_spend || 0);
    const onDemand = Number(row.on_demand_spend || 0);
    totalCommittedSpend += committed;
    totalOnDemandSpend += onDemand;

    byRegion.push({
      region: row.region || 'global',
      committedSpend: committed,
      onDemandSpend: onDemand,
      coverageRatio: Number(row.coverage_ratio || 0),
    });
  }

  const totalSpend = totalCommittedSpend + totalOnDemandSpend;
  const coverageRatio = totalSpend > 0 ? totalCommittedSpend / totalSpend : 0;
  const uncoveredOnDemandSpend = totalOnDemandSpend;
  // ~30% savings typically achievable with CUDs on uncovered on-demand spend
  const potentialSavingsFromCUD = uncoveredOnDemandSpend * 0.3;

  return {
    coverageRatio,
    totalCommittedSpend,
    totalEligibleOnDemandSpend: totalOnDemandSpend,
    uncoveredOnDemandSpend,
    potentialSavingsFromCUD,
    byRegion,
  };
}

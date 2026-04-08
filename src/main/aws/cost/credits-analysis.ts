// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GetCostAndUsageCommand } from '@aws-sdk/client-cost-explorer';
import { getClientFactory } from '../client-factory';
import type { CreditsAnalysisResult, CreditsByCategory, CreditsTrendPoint } from '../../../shared/types';

export async function getAWSCreditsAnalysis(
  profile: string,
  startDate: string,
  endDate: string
): Promise<CreditsAnalysisResult> {
  const client = getClientFactory().getCostExplorerClient({ profile, region: 'us-east-1' });

  const creditsFilter = { Dimensions: { Key: 'RECORD_TYPE' as const, Values: ['Credit'] } };
  const grossFilter = { Not: { Dimensions: { Key: 'RECORD_TYPE' as const, Values: ['Credit', 'Refund'] } } };
  const timePeriod = { Start: startDate, End: endDate };

  const [serviceResp, trendResp, accountResp, grossResp] = await Promise.all([
    client.send(new GetCostAndUsageCommand({
      TimePeriod: timePeriod,
      Granularity: 'MONTHLY',
      Metrics: ['UnblendedCost'],
      GroupBy: [{ Type: 'DIMENSION', Key: 'SERVICE' }],
      Filter: creditsFilter,
    })),
    client.send(new GetCostAndUsageCommand({
      TimePeriod: timePeriod,
      Granularity: 'MONTHLY',
      Metrics: ['UnblendedCost'],
      Filter: creditsFilter,
    })),
    client.send(new GetCostAndUsageCommand({
      TimePeriod: timePeriod,
      Granularity: 'MONTHLY',
      Metrics: ['UnblendedCost'],
      GroupBy: [{ Type: 'DIMENSION', Key: 'LINKED_ACCOUNT' }],
      Filter: creditsFilter,
    })),
    client.send(new GetCostAndUsageCommand({
      TimePeriod: timePeriod,
      Granularity: 'MONTHLY',
      Metrics: ['UnblendedCost'],
      Filter: grossFilter,
    })),
  ]);

  let currency = 'USD';

  // Aggregate credits by service
  const serviceMap = new Map<string, { amount: number; count: number }>();
  for (const period of serviceResp.ResultsByTime || []) {
    for (const group of period.Groups || []) {
      const name = group.Keys?.[0] || 'Unknown';
      const amount = Math.abs(parseFloat(group.Metrics?.UnblendedCost?.Amount || '0'));
      currency = group.Metrics?.UnblendedCost?.Unit || currency;
      if (amount > 0) {
        const existing = serviceMap.get(name) || { amount: 0, count: 0 };
        serviceMap.set(name, { amount: existing.amount + amount, count: existing.count + 1 });
      }
    }
  }
  const byService: CreditsByCategory[] = Array.from(serviceMap.entries())
    .map(([category, v]) => ({ category, amount: v.amount, currency, count: v.count }))
    .sort((a, b) => b.amount - a.amount);

  // Aggregate credits trend
  const trend: CreditsTrendPoint[] = [];
  for (const period of trendResp.ResultsByTime || []) {
    const amount = Math.abs(parseFloat(period.Total?.UnblendedCost?.Amount || '0'));
    currency = period.Total?.UnblendedCost?.Unit || currency;
    trend.push({
      date: period.TimePeriod?.Start || '',
      totalCredits: amount,
      currency,
    });
  }

  // Aggregate credits by linked account
  const accountMap = new Map<string, { amount: number; count: number }>();
  for (const period of accountResp.ResultsByTime || []) {
    for (const group of period.Groups || []) {
      const name = group.Keys?.[0] || 'Unknown';
      const amount = Math.abs(parseFloat(group.Metrics?.UnblendedCost?.Amount || '0'));
      if (amount > 0) {
        const existing = accountMap.get(name) || { amount: 0, count: 0 };
        accountMap.set(name, { amount: existing.amount + amount, count: existing.count + 1 });
      }
    }
  }
  const byLinkedAccount: CreditsByCategory[] = Array.from(accountMap.entries())
    .map(([category, v]) => ({ category, amount: v.amount, currency, count: v.count }))
    .sort((a, b) => b.amount - a.amount);

  // Calculate gross cost
  let totalGrossCost = 0;
  for (const period of grossResp.ResultsByTime || []) {
    totalGrossCost += parseFloat(period.Total?.UnblendedCost?.Amount || '0');
  }

  const totalCredits = trend.reduce((sum, t) => sum + t.totalCredits, 0);
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
    byType: totalCredits > 0 ? [{ category: 'Credit', amount: totalCredits, currency, count: byService.reduce((s, e) => s + e.count, 0) }] : [],
    byLinkedAccount: byLinkedAccount.length > 0 ? byLinkedAccount : undefined,
  };
}

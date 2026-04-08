// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React from 'react';
import type { CostAnalysisResult } from '../../../shared/types';

interface CostOverviewProps {
  analysis: CostAnalysisResult | null;
  isLoading: boolean;
}

function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatPercentChange(change: number): string {
  const sign = change >= 0 ? '+' : '';
  return `${sign}${change.toFixed(1)}%`;
}

interface StatCardProps {
  title: string;
  value: string;
  subtitle?: string;
  isPositive?: boolean;
  isNegative?: boolean;
  isLoading?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  isPositive,
  isNegative,
  isLoading,
}) => (
  <div
    style={{
      backgroundColor: 'var(--color-bg-secondary)',
      border: '1px solid var(--color-border)',
      borderRadius: 8,
      padding: 20,
      minWidth: 160,
      flex: '1 1 0',
    }}
  >
    <div
      style={{
        fontSize: 12,
        color: 'var(--color-text-secondary)',
        marginBottom: 8,
        textTransform: 'uppercase',
        fontWeight: 500,
        letterSpacing: '0.5px',
      }}
    >
      {title}
    </div>
    {isLoading ? (
      <div
        style={{
          height: 32,
          backgroundColor: 'var(--color-bg-tertiary)',
          borderRadius: 4,
          animation: 'pulse 1.5s ease-in-out infinite',
        }}
      />
    ) : (
      <>
        <div
          style={{
            fontSize: 28,
            fontWeight: 600,
            color: isPositive
              ? 'var(--color-error)'
              : isNegative
              ? 'var(--color-success)'
              : 'var(--color-text)',
            fontFamily: 'monospace',
            marginBottom: subtitle ? 4 : 0,
          }}
        >
          {value}
        </div>
        {subtitle && (
          <div
            style={{
              fontSize: 12,
              color: 'var(--color-text-secondary)',
            }}
          >
            {subtitle}
          </div>
        )}
      </>
    )}
  </div>
);

export const CostOverview: React.FC<CostOverviewProps> = ({ analysis, isLoading }) => {
  const totalCost = analysis?.totalCost ?? 0;
  const previousCost = analysis?.previousPeriodTotalCost ?? 0;
  const percentChange = analysis?.percentChange ?? 0;
  const currency = analysis?.currency ?? 'USD';
  const serviceCount = analysis?.byService.length ?? 0;
  const regionCount = analysis?.byRegion.length ?? 0;

  return (
    <div
      style={{
        display: 'flex',
        gap: 16,
        marginBottom: 24,
        flexWrap: 'wrap',
      }}
    >
      <StatCard
        title="Total Cost"
        value={formatCurrency(totalCost, currency)}
        subtitle={`${analysis?.startDate || ''} - ${analysis?.endDate || ''}`}
        isLoading={isLoading}
      />
      <StatCard
        title="Previous Period"
        value={formatCurrency(previousCost, currency)}
        isLoading={isLoading}
      />
      <StatCard
        title="Change"
        value={formatPercentChange(percentChange)}
        isPositive={percentChange > 0}
        isNegative={percentChange < 0}
        isLoading={isLoading}
      />
      <StatCard
        title="Active Services"
        value={serviceCount.toString()}
        subtitle={`across ${regionCount} region${regionCount !== 1 ? 's' : ''}`}
        isLoading={isLoading}
      />
    </div>
  );
};

export default CostOverview;

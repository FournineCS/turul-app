// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React from 'react';
import type { GCPExpandedRecommendationsResult, StoppedVMResult } from '../../../shared/types';

interface RecommendationSummaryCardsProps {
  data: GCPExpandedRecommendationsResult;
  stoppedVMs?: StoppedVMResult | null;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

const CATEGORY_META: Record<string, { label: string; color: string }> = {
  idle_resources: { label: 'Idle Resources', color: '#ef4444' },
  rightsizing: { label: 'Rightsizing', color: '#f59e0b' },
  commitments: { label: 'Commitments', color: '#3b82f6' },
  best_practices: { label: 'Best Practices', color: '#22c55e' },
};

export const RecommendationSummaryCards: React.FC<RecommendationSummaryCardsProps> = ({ data, stoppedVMs }) => {
  const stoppedVMSavings = stoppedVMs?.totalEstimatedMonthlyCost ?? 0;
  const combinedSavings = data.totalPotentialSavings + stoppedVMSavings;
  const stoppedVMCount = stoppedVMs?.vms?.length ?? 0;
  const totalItems = data.recommendations.length + stoppedVMCount;
  const hasSavings = combinedSavings > 0;
  const hasCategories = Object.values(data.byCategory).some(c => c.count > 0);

  // Compact inline display when there are no savings at all
  if (!hasSavings && !hasCategories && stoppedVMCount === 0) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '8px 14px',
          marginBottom: 12,
          borderRadius: 6,
          backgroundColor: 'var(--color-bg-tertiary)',
          border: '1px solid var(--color-border)',
          fontSize: 13,
          color: 'var(--color-text-secondary)',
        }}
      >
        <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>$0/mo</span>
        <span>potential savings &middot; {data.recommendations.length} recommendations</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
      {/* Total savings card */}
      <div
        style={{
          flex: '1 1 180px',
          backgroundColor: 'var(--color-primary)',
          color: 'white',
          padding: '14px 18px',
          borderRadius: 8,
          minWidth: 180,
        }}
      >
        <div style={{ fontSize: 12, opacity: 0.85, marginBottom: 4 }}>Total Potential Savings</div>
        <div style={{ fontSize: 22, fontWeight: 700 }}>
          {formatCurrency(combinedSavings)}/mo
        </div>
        <div style={{ fontSize: 11, opacity: 0.7, marginTop: 4 }}>
          {totalItems} findings
        </div>
      </div>

      {/* Per-category cards */}
      {Object.entries(data.byCategory).map(([key, cat]) => {
        const meta = CATEGORY_META[key];
        if (!meta || cat.count === 0) return null;
        return (
          <div
            key={key}
            style={{
              flex: '1 1 140px',
              backgroundColor: 'var(--color-bg-tertiary)',
              border: '1px solid var(--color-border)',
              padding: '14px 18px',
              borderRadius: 8,
              minWidth: 140,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  backgroundColor: meta.color,
                  display: 'inline-block',
                }}
              />
              <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{meta.label}</span>
            </div>
            <div style={{ fontSize: 18, fontWeight: 600 }}>{cat.count}</div>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
              {formatCurrency(cat.savings)}/mo
            </div>
          </div>
        );
      })}

      {/* Stopped VMs card */}
      {stoppedVMCount > 0 && (
        <div
          style={{
            flex: '1 1 140px',
            backgroundColor: 'var(--color-bg-tertiary)',
            border: '1px solid var(--color-border)',
            padding: '14px 18px',
            borderRadius: 8,
            minWidth: 140,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                backgroundColor: '#f97316',
                display: 'inline-block',
              }}
            />
            <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Stopped VMs</span>
          </div>
          <div style={{ fontSize: 18, fontWeight: 600 }}>{stoppedVMCount}</div>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
            {formatCurrency(stoppedVMSavings)}/mo
          </div>
        </div>
      )}
    </div>
  );
};

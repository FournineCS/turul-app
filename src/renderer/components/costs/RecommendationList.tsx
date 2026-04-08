// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React, { useMemo, useState } from 'react';
import type { CostOptimizationRecommendation, GCPCostRecommendationMeta } from '../../../shared/types';

interface RecommendationListProps {
  recommendations: CostOptimizationRecommendation[];
  meta?: Record<string, GCPCostRecommendationMeta>;
}

type SortKey = 'savings' | 'severity';

const SEVERITY_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };

const SEVERITY_COLORS: Record<string, { bg: string; text: string }> = {
  high: { bg: 'rgba(239, 68, 68, 0.1)', text: '#ef4444' },
  medium: { bg: 'rgba(245, 158, 11, 0.1)', text: '#f59e0b' },
  low: { bg: 'rgba(34, 197, 94, 0.1)', text: '#22c55e' },
};

const SOURCE_LABELS: Record<string, string> = {
  recommender_api: 'Recommender API',
  billing_best_practice: 'Billing Analysis',
  cud_analysis: 'CUD Analysis',
};

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export const RecommendationList: React.FC<RecommendationListProps> = ({ recommendations, meta }) => {
  const [sortBy, setSortBy] = useState<SortKey>('savings');
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = useMemo(() => {
    let recs = [...recommendations];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      recs = recs.filter(
        (r) =>
          r.description.toLowerCase().includes(q) ||
          r.service.toLowerCase().includes(q) ||
          (r.resourceId && r.resourceId.toLowerCase().includes(q))
      );
    }

    recs.sort((a, b) => {
      if (sortBy === 'savings') return b.estimatedMonthlySavings - a.estimatedMonthlySavings;
      return (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9);
    });

    return recs;
  }, [recommendations, sortBy, searchQuery]);

  if (recommendations.length === 0) {
    return (
      <div
        style={{
          padding: 40,
          textAlign: 'center',
          color: 'var(--color-text-secondary)',
          backgroundColor: 'var(--color-bg-tertiary)',
          borderRadius: 8,
        }}
      >
        <div style={{ fontSize: 36, marginBottom: 8 }}>{'\u2713'}</div>
        <p style={{ margin: 0, fontSize: 14 }}>No recommendations in this category.</p>
      </div>
    );
  }

  return (
    <div>
      {/* Controls row */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <label style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Sort:</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortKey)}
            style={{
              padding: '4px 8px',
              fontSize: 12,
              borderRadius: 4,
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-bg-tertiary)',
              color: 'var(--color-text)',
            }}
          >
            <option value="savings">Savings (high to low)</option>
            <option value="severity">Severity</option>
          </select>
        </div>
        <input
          type="text"
          placeholder="Search recommendations..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            flex: '1 1 200px',
            padding: '6px 10px',
            fontSize: 12,
            borderRadius: 4,
            border: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-bg-tertiary)',
            color: 'var(--color-text)',
            minWidth: 160,
          }}
        />
        <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
          {filtered.length} of {recommendations.length}
        </span>
      </div>

      {/* Recommendation cards */}
      {filtered.map((rec) => {
        const sColor = SEVERITY_COLORS[rec.severity] || SEVERITY_COLORS.low;
        const recMeta = meta?.[rec.id];

        return (
          <div
            key={rec.id}
            style={{
              backgroundColor: 'var(--color-bg-tertiary)',
              border: '1px solid var(--color-border)',
              borderRadius: 8,
              padding: 16,
              marginBottom: 10,
            }}
          >
            {/* Header: service + resource name | badges + savings */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                  <span style={{ fontWeight: 600, fontSize: 14 }}>{rec.service}</span>
                  {rec.resourceId && (
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 500,
                        color: 'var(--color-primary)',
                        backgroundColor: 'rgba(59, 130, 246, 0.08)',
                        padding: '1px 8px',
                        borderRadius: 4,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        maxWidth: 300,
                      }}
                    >
                      {rec.resourceId}
                    </span>
                  )}
                </div>
                {rec.region && (
                  <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>{rec.region}</span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                {recMeta && (
                  <span
                    style={{
                      fontSize: 10,
                      padding: '2px 6px',
                      borderRadius: 3,
                      backgroundColor: 'var(--color-bg-secondary)',
                      color: 'var(--color-text-secondary)',
                    }}
                  >
                    {SOURCE_LABELS[recMeta.source] || recMeta.source}
                  </span>
                )}
                <span
                  style={{
                    backgroundColor: sColor.bg,
                    color: sColor.text,
                    padding: '3px 8px',
                    borderRadius: 4,
                    fontSize: 10,
                    fontWeight: 600,
                    textTransform: 'uppercase',
                  }}
                >
                  {rec.severity}
                </span>
              </div>
            </div>

            {/* Description */}
            <p style={{ margin: '0 0 10px', fontSize: 13, lineHeight: 1.5 }}>{rec.description}</p>

            {/* Footer: action + savings badge */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                paddingTop: 10,
                borderTop: '1px solid var(--color-border)',
              }}
            >
              <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', maxWidth: '65%' }}>
                {rec.actionRequired}
              </div>
              <div
                style={{
                  backgroundColor: 'var(--color-success)',
                  color: 'white',
                  padding: '4px 10px',
                  borderRadius: 5,
                  fontSize: 12,
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}
              >
                Save {formatCurrency(rec.estimatedMonthlySavings)}/mo
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

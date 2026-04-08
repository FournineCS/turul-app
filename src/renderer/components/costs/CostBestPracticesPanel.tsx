// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React from 'react';
import type { GCPCostBestPracticesResult } from '../../../shared/types';
import { RecommendationList } from './RecommendationList';

interface CostBestPracticesPanelProps {
  data: GCPCostBestPracticesResult | null;
  isLoading: boolean;
  error: string | null;
}

export const CostBestPracticesPanel: React.FC<CostBestPracticesPanelProps> = ({ data, isLoading, error }) => {
  if (isLoading) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: 'var(--color-text-secondary)' }}>
        Running cost best practices checks against billing data...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 16, backgroundColor: 'rgba(239, 68, 68, 0.05)', borderRadius: 8, color: '#ef4444', fontSize: 13 }}>
        {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: 13 }}>
        <p style={{ margin: 0 }}>BigQuery billing export is required for cost best practices analysis.</p>
        <p style={{ margin: '6px 0 0', fontSize: 12 }}>
          Configure your BQ billing project in the Billing Config card, then click Refresh.
        </p>
      </div>
    );
  }

  // Group findings by category
  const grouped: Record<string, typeof data.recommendations> = {};
  for (const rec of data.recommendations) {
    const cat = rec.category || 'Other';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(rec);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Stats header */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <div
          style={{
            backgroundColor: 'var(--color-bg-tertiary)',
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            padding: '10px 16px',
          }}
        >
          <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Checks Run: </span>
          <span style={{ fontWeight: 600 }}>{data.checksRun}</span>
        </div>
        <div
          style={{
            backgroundColor: 'var(--color-bg-tertiary)',
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            padding: '10px 16px',
          }}
        >
          <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Issues Found: </span>
          <span style={{ fontWeight: 600, color: data.checksWithFindings > 0 ? '#f59e0b' : '#22c55e' }}>
            {data.checksWithFindings}
          </span>
        </div>
        {data.totalPotentialSavings > 0 && (
          <div
            style={{
              backgroundColor: 'var(--color-bg-tertiary)',
              border: '1px solid var(--color-border)',
              borderRadius: 8,
              padding: '10px 16px',
            }}
          >
            <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>Potential Savings: </span>
            <span style={{ fontWeight: 600, color: 'var(--color-success)' }}>
              ${data.totalPotentialSavings.toFixed(2)}/mo
            </span>
          </div>
        )}
      </div>

      {/* Grouped findings */}
      {Object.keys(grouped).length === 0 ? (
        <div style={{ padding: 30, textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: 13 }}>
          No cost issues detected by billing analysis checks.
        </div>
      ) : (
        Object.entries(grouped).map(([category, recs]) => (
          <div key={category}>
            <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>{category} ({recs.length})</h4>
            <RecommendationList recommendations={recs} />
          </div>
        ))
      )}

      {data.errors.length > 0 && (
        <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 8 }}>
          <details>
            <summary>Check Errors ({data.errors.length})</summary>
            <ul style={{ margin: '4px 0', paddingLeft: 20 }}>
              {data.errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </details>
        </div>
      )}
    </div>
  );
};

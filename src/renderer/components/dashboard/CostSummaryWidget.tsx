// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React from 'react';
import type { CostAnalysisResult } from '../../../shared/types';

interface Props {
  data: CostAnalysisResult | null;
  isLoading: boolean;
}

const CostSummaryWidget: React.FC<Props> = ({ data, isLoading }) => {
  if (isLoading) {
    return (
      <div className="card dashboard-widget">
        <h3 className="card-title">Cost Summary</h3>
        <div className="loading-overlay"><div className="spinner" /></div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="card dashboard-widget">
        <h3 className="card-title">Cost Summary</h3>
        <p className="text-secondary">Run a cost analysis to see spending data</p>
      </div>
    );
  }

  const trendUp = data.percentChange > 0;
  const trendColor = trendUp ? 'var(--color-error)' : 'var(--color-success)';
  const trendArrow = trendUp ? '\u2191' : '\u2193';
  const topServices = [...data.byService]
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 3);

  return (
    <div className="card dashboard-widget">
      <h3 className="card-title">Cost Summary</h3>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 16 }}>
        <span style={{ fontSize: 28, fontWeight: 700 }}>
          ${data.totalCost.toFixed(2)}
        </span>
        <span style={{ color: trendColor, fontWeight: 600 }}>
          {trendArrow} {Math.abs(data.percentChange).toFixed(1)}%
        </span>
        <span className="text-secondary" style={{ fontSize: 12 }}>
          vs prior period
        </span>
      </div>
      {topServices.length > 0 && (
        <div>
          <p className="text-secondary" style={{ fontSize: 12, marginBottom: 8 }}>Top Services</p>
          {topServices.map((svc) => (
            <div key={svc.service} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '65%' }}>
                {svc.service}
              </span>
              <span style={{ fontSize: 13, fontWeight: 500 }}>${svc.cost.toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CostSummaryWidget;

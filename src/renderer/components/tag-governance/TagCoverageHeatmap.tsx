// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React from 'react';
import type { TagKeyCompliance } from '../../../shared/types';

interface Props {
  byTagKey: TagKeyCompliance[];
}

const getColor = (pct: number): string => {
  if (pct >= 90) return '#00ba7c';
  if (pct >= 70) return '#4caf50';
  if (pct >= 50) return '#ffad1f';
  if (pct >= 25) return '#ff9800';
  return '#f4212e';
};

const TagCoverageHeatmap: React.FC<Props> = ({ byTagKey }) => {
  return (
    <div className="card mb-4">
      <h3 className="card-title mb-4">Tag Coverage</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
        {byTagKey.map((tk) => (
          <div
            key={tk.tagKey}
            style={{
              padding: 16, borderRadius: 'var(--border-radius)',
              border: '1px solid var(--color-border)',
              background: `linear-gradient(135deg, ${getColor(tk.coveragePercent)}22, transparent)`,
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{tk.tagKey}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: getColor(tk.coveragePercent) }}>
              {tk.coveragePercent}%
            </div>
            <div className="text-secondary" style={{ fontSize: 11 }}>
              {tk.taggedResources} / {tk.totalResources} resources
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TagCoverageHeatmap;

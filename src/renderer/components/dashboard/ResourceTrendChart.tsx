// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React from 'react';
import type { Scan } from '../../../shared/types';

interface Props {
  scans: Scan[];
}

const ResourceTrendChart: React.FC<Props> = ({ scans }) => {
  const completedScans = scans
    .filter((s) => s.status === 'completed' && s.resourceCount > 0)
    .slice(0, 10)
    .reverse();

  if (completedScans.length < 2) {
    return (
      <div className="card dashboard-widget">
        <h3 className="card-title">Resource Trend</h3>
        <p className="text-secondary">Need at least 2 scans to show trends</p>
      </div>
    );
  }

  const counts = completedScans.map((s) => s.resourceCount);
  const maxVal = Math.max(...counts);
  const minVal = Math.min(...counts);
  const range = maxVal - minVal || 1;

  // Build sparkline SVG path
  const width = 280;
  const height = 80;
  const padding = 4;
  const chartW = width - padding * 2;
  const chartH = height - padding * 2;

  const points = counts.map((val, i) => {
    const x = padding + (i / (counts.length - 1)) * chartW;
    const y = padding + chartH - ((val - minVal) / range) * chartH;
    return { x, y };
  });

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  // Area fill
  const areaD = `${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`;

  const latest = counts[counts.length - 1];
  const previous = counts[counts.length - 2];
  const change = latest - previous;

  return (
    <div className="card dashboard-widget">
      <h3 className="card-title">Resource Trend</h3>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 20, fontWeight: 700 }}>{latest}</span>
        <span style={{ fontSize: 12, color: change >= 0 ? 'var(--color-success)' : 'var(--color-error)' }}>
          {change >= 0 ? '+' : ''}{change} from last scan
        </span>
      </div>
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: 'auto' }}>
        <defs>
          <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaD} fill="url(#sparkGrad)" />
        <path d={pathD} fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinejoin="round" />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r="3" fill="var(--color-primary)" />
        ))}
      </svg>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
        <span className="text-secondary" style={{ fontSize: 10 }}>
          {new Date(completedScans[0].startedAt).toLocaleDateString()}
        </span>
        <span className="text-secondary" style={{ fontSize: 10 }}>
          {new Date(completedScans[completedScans.length - 1].startedAt).toLocaleDateString()}
        </span>
      </div>
    </div>
  );
};

export default ResourceTrendChart;

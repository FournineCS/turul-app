// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React from 'react';
import type { AssessmentResult, GCPAssessmentResult } from '../../../shared/types';

interface Props {
  assessment: AssessmentResult | GCPAssessmentResult | null;
}

const COLORS = [
  '#1d9bf0', '#00ba7c', '#ffad1f', '#f4212e', '#794bc4',
  '#ff6b6b', '#51cf66', '#339af0', '#ffd43b', '#cc5de8',
];

const TopServicesPieChart: React.FC<Props> = ({ assessment }) => {
  const byService = assessment && 'resourceSummary' in assessment ? assessment.resourceSummary?.byService : undefined;

  if (!byService || Object.keys(byService).length === 0) {
    return (
      <div className="card dashboard-widget">
        <h3 className="card-title">Resources by Service</h3>
        <p className="text-secondary">Run an assessment to see service breakdown</p>
      </div>
    );
  }

  const entries = Object.entries(byService)
    .sort(([, a], [, b]) => b - a);
  const top = entries.slice(0, 6);
  const otherCount = entries.slice(6).reduce((sum, [, v]) => sum + v, 0);
  if (otherCount > 0) top.push(['Other', otherCount]);

  const total = top.reduce((sum, [, v]) => sum + v, 0);

  // Build SVG donut
  const cx = 60;
  const cy = 60;
  const outerR = 50;
  const innerR = 32;
  let cumulativeAngle = -Math.PI / 2;

  const slices = top.map(([label, value], i) => {
    const angle = (value / total) * 2 * Math.PI;
    const startAngle = cumulativeAngle;
    const endAngle = cumulativeAngle + angle;
    cumulativeAngle = endAngle;

    const largeArc = angle > Math.PI ? 1 : 0;

    const x1o = cx + outerR * Math.cos(startAngle);
    const y1o = cy + outerR * Math.sin(startAngle);
    const x2o = cx + outerR * Math.cos(endAngle);
    const y2o = cy + outerR * Math.sin(endAngle);
    const x1i = cx + innerR * Math.cos(endAngle);
    const y1i = cy + innerR * Math.sin(endAngle);
    const x2i = cx + innerR * Math.cos(startAngle);
    const y2i = cy + innerR * Math.sin(startAngle);

    const d = [
      `M ${x1o} ${y1o}`,
      `A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2o} ${y2o}`,
      `L ${x1i} ${y1i}`,
      `A ${innerR} ${innerR} 0 ${largeArc} 0 ${x2i} ${y2i}`,
      'Z',
    ].join(' ');

    return { d, color: COLORS[i % COLORS.length], label, value };
  });

  return (
    <div className="card dashboard-widget">
      <h3 className="card-title">Resources by Service</h3>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <svg width="120" height="120" viewBox="0 0 120 120">
          {slices.map((s, i) => (
            <path key={i} d={s.d} fill={s.color} />
          ))}
          <text x={cx} y={cy + 4} textAnchor="middle" fill="var(--color-text)" fontSize="16" fontWeight="700">
            {total}
          </text>
        </svg>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0, flex: 1 }}>
          {slices.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color, flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                {s.label}
              </span>
              <span style={{ fontWeight: 500, flexShrink: 0 }}>{s.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TopServicesPieChart;

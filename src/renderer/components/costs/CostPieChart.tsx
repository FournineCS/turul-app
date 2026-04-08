// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React from 'react';

interface PieDataItem {
  label: string;
  value: number;
}

interface CostPieChartProps {
  data: PieDataItem[];
  title: string;
  centerLabel?: string;
  currency?: string;
}

const COLORS = [
  '#1d9bf0', '#00ba7c', '#ffad1f', '#f4212e', '#794bc4',
  '#ff6b6b', '#51cf66', '#339af0', '#ffd43b', '#cc5de8',
];

const formatCurrency = (value: number, currency = 'USD') => {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return value.toFixed(2);
};

const CostPieChart: React.FC<CostPieChartProps> = ({ data, title, centerLabel, currency = 'USD' }) => {
  if (!data || data.length === 0) {
    return (
      <div
        style={{
          flex: '1 1 300px',
          backgroundColor: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border)',
          borderRadius: 8,
          padding: 16,
          minHeight: 200,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <h4 style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--color-text)' }}>{title}</h4>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-secondary)' }}>No data available</p>
      </div>
    );
  }

  // Sort descending, take top 8, bucket the rest as "Other"
  const sorted = [...data].sort((a, b) => b.value - a.value);
  const top = sorted.slice(0, 8);
  const otherValue = sorted.slice(8).reduce((sum, d) => sum + d.value, 0);
  if (otherValue > 0) top.push({ label: 'Other', value: otherValue });

  const total = top.reduce((sum, d) => sum + d.value, 0);
  if (total === 0) {
    return (
      <div
        style={{
          flex: '1 1 300px',
          backgroundColor: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border)',
          borderRadius: 8,
          padding: 16,
          minHeight: 200,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <h4 style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--color-text)' }}>{title}</h4>
        <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-secondary)' }}>$0.00 total</p>
      </div>
    );
  }

  // Build donut slices
  const cx = 70;
  const cy = 70;
  const outerR = 60;
  const innerR = 38;
  let cumulativeAngle = -Math.PI / 2;

  const slices = top.map((item, i) => {
    const angle = (item.value / total) * 2 * Math.PI;
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

    return { d, color: COLORS[i % COLORS.length], label: item.label, value: item.value };
  });

  const displayCenter = centerLabel || `$${formatCurrency(total, currency)}`;

  return (
    <div
      style={{
        flex: '1 1 300px',
        backgroundColor: 'var(--color-bg-secondary)',
        border: '1px solid var(--color-border)',
        borderRadius: 8,
        padding: 16,
      }}
    >
      <h4 style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--color-text)' }}>{title}</h4>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <svg width="140" height="140" viewBox="0 0 140 140" style={{ flexShrink: 0 }}>
          {slices.map((s, i) => (
            <path key={i} d={s.d} fill={s.color} />
          ))}
          <text
            x={cx}
            y={cy + 5}
            textAnchor="middle"
            fill="var(--color-text)"
            fontSize="13"
            fontWeight="700"
          >
            {displayCenter}
          </text>
        </svg>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, flex: 1 }}>
          {slices.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: 2,
                  background: s.color,
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  flex: 1,
                  color: 'var(--color-text)',
                }}
              >
                {s.label}
              </span>
              <span style={{ fontWeight: 500, flexShrink: 0, color: 'var(--color-text-secondary)' }}>
                ${formatCurrency(s.value, currency)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CostPieChart;

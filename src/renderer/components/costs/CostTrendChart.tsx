// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React, { useMemo } from 'react';
import type { CostTrendDataPoint } from '../../../shared/types';

interface CostTrendChartProps {
  data: CostTrendDataPoint[];
  isLoading: boolean;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export const CostTrendChart: React.FC<CostTrendChartProps> = ({ data, isLoading }) => {
  const chartDimensions = useMemo(() => {
    const width = 800;
    const height = 250;
    const padding = { top: 20, right: 20, bottom: 40, left: 70 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;
    return { width, height, padding, chartWidth, chartHeight };
  }, []);

  const chartData = useMemo(() => {
    if (data.length === 0) return { points: [], pathD: '', maxCost: 0, minCost: 0 };

    const costs = data.map((d) => d.cost);
    const maxCost = Math.max(...costs, 1); // Ensure at least 1 to avoid division by zero
    const minCost = Math.min(...costs, 0);
    const range = maxCost - minCost || 1;

    const { chartWidth, chartHeight, padding } = chartDimensions;
    const xStep = chartWidth / Math.max(data.length - 1, 1);

    const points = data.map((d, i) => {
      const x = padding.left + i * xStep;
      const y = padding.top + chartHeight - ((d.cost - minCost) / range) * chartHeight;
      return { x, y, cost: d.cost, date: d.date };
    });

    // Create smooth path
    const pathD = points
      .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
      .join(' ');

    // Create area fill path
    const areaD =
      pathD +
      ` L ${points[points.length - 1]?.x || 0} ${padding.top + chartHeight}` +
      ` L ${padding.left} ${padding.top + chartHeight} Z`;

    return { points, pathD, areaD, maxCost, minCost };
  }, [data, chartDimensions]);

  const yAxisLabels = useMemo(() => {
    const { maxCost, minCost } = chartData;
    const { chartHeight, padding } = chartDimensions;
    const steps = 5;
    const range = maxCost - minCost || 1;
    const labels = [];

    for (let i = 0; i <= steps; i++) {
      const value = minCost + (range * (steps - i)) / steps;
      const y = padding.top + (chartHeight * i) / steps;
      labels.push({ value, y });
    }

    return labels;
  }, [chartData, chartDimensions]);

  const xAxisLabels = useMemo(() => {
    if (data.length === 0) return [];

    const { chartWidth, padding } = chartDimensions;
    const maxLabels = 7;
    const step = Math.max(1, Math.floor(data.length / maxLabels));
    const labels = [];

    for (let i = 0; i < data.length; i += step) {
      const xStep = chartWidth / Math.max(data.length - 1, 1);
      const x = padding.left + i * xStep;
      labels.push({ date: data[i].date, x });
    }

    return labels;
  }, [data, chartDimensions]);

  if (isLoading) {
    return (
      <div
        style={{
          backgroundColor: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border)',
          borderRadius: 8,
          padding: 20,
          marginBottom: 24,
        }}
      >
        <h3 style={{ margin: '0 0 16px 0', fontSize: 16 }}>Cost Trend</h3>
        <div
          style={{
            height: 250,
            backgroundColor: 'var(--color-bg-tertiary)',
            borderRadius: 4,
            animation: 'pulse 1.5s ease-in-out infinite',
          }}
        />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div
        style={{
          backgroundColor: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border)',
          borderRadius: 8,
          padding: 20,
          marginBottom: 24,
        }}
      >
        <h3 style={{ margin: '0 0 16px 0', fontSize: 16 }}>Cost Trend</h3>
        <div
          style={{
            height: 250,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-text-secondary)',
          }}
        >
          No trend data available for the selected period.
        </div>
      </div>
    );
  }

  const { width, height, padding, chartHeight } = chartDimensions;

  return (
    <div
      style={{
        backgroundColor: 'var(--color-bg-secondary)',
        border: '1px solid var(--color-border)',
        borderRadius: 8,
        padding: 20,
        marginBottom: 24,
      }}
    >
      <h3 style={{ margin: '0 0 16px 0', fontSize: 16 }}>Cost Trend</h3>
      <div style={{ overflowX: 'auto' }}>
        <svg width={width} height={height} style={{ display: 'block' }}>
          {/* Grid lines */}
          {yAxisLabels.map((label, i) => (
            <line
              key={i}
              x1={padding.left}
              y1={label.y}
              x2={width - padding.right}
              y2={label.y}
              stroke="var(--color-border)"
              strokeDasharray="4 4"
              strokeOpacity={0.5}
            />
          ))}

          {/* Area fill */}
          <path
            d={chartData.areaD}
            fill="var(--color-primary)"
            fillOpacity={0.1}
          />

          {/* Line */}
          <path
            d={chartData.pathD}
            fill="none"
            stroke="var(--color-primary)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Data points */}
          {chartData.points.map((point, i) => (
            <g key={i}>
              <circle
                cx={point.x}
                cy={point.y}
                r={4}
                fill="var(--color-primary)"
                stroke="var(--color-bg-secondary)"
                strokeWidth={2}
              />
              <title>{`${formatDate(point.date)}: ${formatCurrency(point.cost)}`}</title>
            </g>
          ))}

          {/* Y-axis labels */}
          {yAxisLabels.map((label, i) => (
            <text
              key={i}
              x={padding.left - 10}
              y={label.y}
              textAnchor="end"
              alignmentBaseline="middle"
              fill="var(--color-text-secondary)"
              fontSize={11}
              fontFamily="monospace"
            >
              {formatCurrency(label.value)}
            </text>
          ))}

          {/* X-axis labels */}
          {xAxisLabels.map((label, i) => (
            <text
              key={i}
              x={label.x}
              y={padding.top + chartHeight + 20}
              textAnchor="middle"
              fill="var(--color-text-secondary)"
              fontSize={11}
            >
              {formatDate(label.date)}
            </text>
          ))}

          {/* X-axis line */}
          <line
            x1={padding.left}
            y1={padding.top + chartHeight}
            x2={width - padding.right}
            y2={padding.top + chartHeight}
            stroke="var(--color-border)"
          />
        </svg>
      </div>
    </div>
  );
};

export default CostTrendChart;

// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React from 'react';
import type { GCPCUDCoverageResult } from '../../../shared/types';
import { RecommendationList } from './RecommendationList';
import CostPieChart from './CostPieChart';

const DONUT_COLORS = [
  '#1d9bf0', '#00ba7c', '#ffad1f', '#f4212e', '#794bc4',
  '#ff6b6b', '#51cf66', '#339af0', '#ffd43b', '#cc5de8',
];

interface CUDCoveragePanelProps {
  data: GCPCUDCoverageResult | null;
  isLoading: boolean;
  error: string | null;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatPercent(ratio: number): string {
  return `${(ratio * 100).toFixed(1)}%`;
}

function formatResourceAmount(amount: number, unit: string): string {
  if (unit === 'GB' && amount >= 1024) return `${(amount / 1024).toFixed(1)} TB`;
  if (amount >= 1000) return `${(amount / 1000).toFixed(1)}K ${unit}`;
  return `${amount} ${unit}`;
}

const UtilizationGauge: React.FC<{
  totalFees: number;
  totalCredits: number;
  utilizationRatio: number;
}> = ({ totalFees, totalCredits, utilizationRatio }) => {
  const displayRatio = Math.min(utilizationRatio, 1);
  const pct = displayRatio * 100;
  const color = pct >= 90 ? '#22c55e' : pct >= 70 ? '#f59e0b' : '#ef4444';
  const fullyUtilized = utilizationRatio >= 1;

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
      <h4 style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--color-text)' }}>
        CUD Cost Utilization (30d)
      </h4>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 12 }}>
        <span style={{ color: 'var(--color-text-secondary)' }}>
          Fees paid: {formatCurrency(totalFees)}
        </span>
        <span style={{ color: 'var(--color-text-secondary)' }}>
          Credits applied: {formatCurrency(totalCredits)}
        </span>
      </div>
      <div
        style={{
          height: 20,
          backgroundColor: 'var(--color-bg-tertiary)',
          borderRadius: 10,
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            backgroundColor: color,
            borderRadius: 10,
            transition: 'width 0.4s ease',
          }}
        />
        <span
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            fontSize: 11,
            fontWeight: 700,
            color: pct > 50 ? '#fff' : 'var(--color-text)',
          }}
        >
          {formatPercent(utilizationRatio)}
        </span>
      </div>
      {fullyUtilized && (
        <div style={{ marginTop: 8, fontSize: 12, color: '#22c55e', fontWeight: 600 }}>
          Commitments are fully utilized
        </div>
      )}
      {!fullyUtilized && utilizationRatio > 0 && (
        <div style={{ marginTop: 8, fontSize: 12, color: 'var(--color-text-secondary)' }}>
          {formatCurrency(totalFees - totalCredits)} in commitment fees not offset by credits
        </div>
      )}
    </div>
  );
};

interface ResourceSlice {
  label: string;
  value: number;
  displayValue: string;
}

function buildResourceSlices(commitments: GCPCUDCoverageResult['commitments']): ResourceSlice[] {
  const items: ResourceSlice[] = [];
  for (const c of commitments) {
    for (const r of c.resources) {
      items.push({
        label: `${c.region} — ${r.type}`,
        value: r.amount,
        displayValue: formatResourceAmount(r.amount, r.unit),
      });
    }
  }
  return items.sort((a, b) => b.value - a.value);
}

const ResourceDonut: React.FC<{
  slices: ResourceSlice[];
  title: string;
  centerLabel: string;
}> = ({ slices, title, centerLabel }) => {
  if (slices.length === 0) return null;

  const total = slices.reduce((s, d) => s + d.value, 0);
  const cx = 70, cy = 70, outerR = 60, innerR = 38;
  let cumulativeAngle = -Math.PI / 2;

  const paths = slices.map((item, i) => {
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
    return { d, color: DONUT_COLORS[i % DONUT_COLORS.length], ...item };
  });

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
          {paths.map((s, i) => (
            <path key={i} d={s.d} fill={s.color} />
          ))}
          <text x={cx} y={cy + 5} textAnchor="middle" fill="var(--color-text)" fontSize="13" fontWeight="700">
            {centerLabel}
          </text>
        </svg>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, flex: 1 }}>
          {paths.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color, flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, color: 'var(--color-text)' }}>
                {s.label}
              </span>
              <span style={{ fontWeight: 500, flexShrink: 0, color: 'var(--color-text-secondary)' }}>
                {s.displayValue}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const CommitmentExpiryTimeline: React.FC<{
  commitments: GCPCUDCoverageResult['commitments'];
}> = ({ commitments }) => {
  const active = commitments.filter((c) => c.startTimestamp && c.endTimestamp);
  if (active.length === 0) return null;

  const now = Date.now();
  const allDates = active.flatMap((c) => [new Date(c.startTimestamp).getTime(), new Date(c.endTimestamp).getTime()]);
  const minDate = Math.min(...allDates, now);
  const maxDate = Math.max(...allDates);
  const rangeMs = maxDate - minDate || 1;

  const barHeight = 24;
  const rowGap = 6;
  const labelWidth = 200;
  const chartWidth = 500;
  const dateWidth = 80;
  const totalWidth = labelWidth + chartWidth + dateWidth;
  const totalHeight = active.length * (barHeight + rowGap) + 30;

  const sixMonths = 180 * 24 * 60 * 60 * 1000;
  const threeMonths = 90 * 24 * 60 * 60 * 1000;

  return (
    <div
      style={{
        backgroundColor: 'var(--color-bg-secondary)',
        border: '1px solid var(--color-border)',
        borderRadius: 8,
        padding: 16,
        overflowX: 'auto',
      }}
    >
      <h4 style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--color-text)' }}>
        Commitment Expiry Timeline
      </h4>
      <svg width={totalWidth} height={totalHeight} style={{ display: 'block', minWidth: totalWidth }}>
        {/* Now marker */}
        <line
          x1={labelWidth + ((now - minDate) / rangeMs) * chartWidth}
          y1={0}
          x2={labelWidth + ((now - minDate) / rangeMs) * chartWidth}
          y2={totalHeight - 16}
          stroke="var(--color-text-secondary)"
          strokeDasharray="3,3"
          strokeWidth={1}
        />
        <text
          x={labelWidth + ((now - minDate) / rangeMs) * chartWidth}
          y={totalHeight - 4}
          textAnchor="middle"
          fill="var(--color-text-secondary)"
          fontSize={9}
        >
          Today
        </text>

        {active.map((c, i) => {
          const start = new Date(c.startTimestamp).getTime();
          const end = new Date(c.endTimestamp).getTime();
          const remaining = end - now;
          const x = labelWidth + ((start - minDate) / rangeMs) * chartWidth;
          const w = Math.max(((end - start) / rangeMs) * chartWidth, 2);
          const y = i * (barHeight + rowGap);
          const barColor =
            remaining > sixMonths ? '#22c55e' : remaining > threeMonths ? '#f59e0b' : '#ef4444';
          const endDateStr = new Date(c.endTimestamp).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
          });

          return (
            <g key={i}>
              <text
                x={labelWidth - 8}
                y={y + barHeight / 2 + 4}
                textAnchor="end"
                fill="var(--color-text)"
                fontSize={11}
              >
                {c.name.length > 26 ? c.name.slice(0, 26) + '...' : c.name}
              </text>
              <rect x={x} y={y} width={w} height={barHeight} rx={4} fill={barColor} opacity={0.85} />
              <text
                x={x + w + 6}
                y={y + barHeight / 2 + 4}
                fill="var(--color-text-secondary)"
                fontSize={10}
              >
                {endDateStr}
              </text>
            </g>
          );
        })}
      </svg>
      <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 10, color: 'var(--color-text-secondary)' }}>
        <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: '#22c55e', marginRight: 4 }} />&gt;6 months</span>
        <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: '#f59e0b', marginRight: 4 }} />3-6 months</span>
        <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: '#ef4444', marginRight: 4 }} />&lt;3 months</span>
      </div>
    </div>
  );
};

export const CUDCoveragePanel: React.FC<CUDCoveragePanelProps> = ({ data, isLoading, error }) => {
  if (isLoading) {
    return (
      <div style={{ padding: 20, textAlign: 'center', color: 'var(--color-text-secondary)' }}>
        Loading CUD coverage analysis...
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
        CUD coverage data not yet loaded. Click Refresh to analyze.
      </div>
    );
  }

  const hasBQData = data.coverageRatio >= 0;
  const hasBreakdown = data.commitmentBreakdown && data.commitmentBreakdown.length > 0;
  const hasUtilization = data.costUtilization && data.costUtilization.totalCommitmentFees > 0;
  const hasCommitments = data.commitments.length > 0;

  // BQ-based cost breakdown for donut
  const bqPieData = hasBreakdown
    ? data.commitmentBreakdown.map((b) => ({
        label: b.commitmentLabel || b.skuDescription,
        value: b.commitmentFee,
      }))
    : [];

  // Resource-based breakdown from Compute API (always available when commitments exist)
  const resourceSlices = hasCommitments ? buildResourceSlices(data.commitments) : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Coverage ratio bar */}
      {hasBQData && (
        <div
          style={{
            backgroundColor: 'var(--color-bg-tertiary)',
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            padding: 16,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontWeight: 600, fontSize: 14 }}>CUD Coverage Ratio</span>
            <span style={{ fontWeight: 700, fontSize: 18 }}>{formatPercent(data.coverageRatio)}</span>
          </div>
          <div
            style={{
              height: 12,
              backgroundColor: 'var(--color-bg-secondary)',
              borderRadius: 6,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${Math.min(data.coverageRatio * 100, 100)}%`,
                backgroundColor: data.coverageRatio >= 0.7 ? '#22c55e' : data.coverageRatio >= 0.4 ? '#f59e0b' : '#ef4444',
                borderRadius: 6,
                transition: 'width 0.4s ease',
              }}
            />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, fontSize: 12, color: 'var(--color-text-secondary)' }}>
            <span>Committed: {formatCurrency(data.totalCommittedSpend)}</span>
            <span>On-Demand: {formatCurrency(data.totalEligibleOnDemandSpend)}</span>
          </div>
          {data.potentialSavingsFromCUD > 0 && (
            <div style={{ marginTop: 8, fontSize: 13, color: 'var(--color-success)', fontWeight: 600 }}>
              Potential savings with CUDs: ~{formatCurrency(data.potentialSavingsFromCUD)}/mo
            </div>
          )}
        </div>
      )}

      {!hasBQData && (
        <div style={{ padding: 16, backgroundColor: 'rgba(245, 158, 11, 0.05)', borderRadius: 8, fontSize: 13, color: '#f59e0b' }}>
          BigQuery billing export not configured. Coverage ratio and spend breakdown are unavailable.
          Active commitments and Recommender API suggestions are still shown below.
        </div>
      )}

      {/* Utilization Gauge + Cost Donut (side by side) — when BQ breakdown data is available */}
      {hasBQData && (hasUtilization || hasBreakdown) && (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          {hasUtilization && (
            <UtilizationGauge
              totalFees={data.costUtilization.totalCommitmentFees}
              totalCredits={data.costUtilization.totalCUDCredits}
              utilizationRatio={data.costUtilization.utilizationRatio}
            />
          )}
          {hasBreakdown && (
            <CostPieChart data={bqPieData} title="Commitment Cost Breakdown (30d)" />
          )}
        </div>
      )}

      {/* Resource-based commitment donut — always shown when there are active commitments */}
      {hasCommitments && resourceSlices.length > 0 && (
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <ResourceDonut
            slices={resourceSlices}
            title="Committed Resources by Region"
            centerLabel={`${data.commitments.length} CUDs`}
          />
          {/* Commitment summary cards */}
          <div
            style={{
              flex: '1 1 300px',
              backgroundColor: 'var(--color-bg-secondary)',
              border: '1px solid var(--color-border)',
              borderRadius: 8,
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <h4 style={{ margin: 0, fontSize: 13, color: 'var(--color-text)' }}>Commitment Summary</h4>
            {(() => {
              const totalVCPUs = data.commitments.reduce(
                (sum, c) => sum + c.resources.filter((r) => r.type === 'VCPU').reduce((s, r) => s + r.amount, 0),
                0
              );
              const totalMemGB = data.commitments.reduce(
                (sum, c) => sum + c.resources.filter((r) => r.type === 'MEMORY').reduce((s, r) => s + r.amount, 0),
                0
              );
              const regions = new Set(data.commitments.map((c) => c.region));
              const types = new Set(data.commitments.map((c) => c.type));

              return (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  <div style={{ padding: '10px 12px', backgroundColor: 'var(--color-bg-tertiary)', borderRadius: 6 }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text)' }}>{totalVCPUs}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>Total vCPUs</div>
                  </div>
                  <div style={{ padding: '10px 12px', backgroundColor: 'var(--color-bg-tertiary)', borderRadius: 6 }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text)' }}>
                      {totalMemGB >= 1024 ? `${(totalMemGB / 1024).toFixed(0)} TB` : `${totalMemGB} GB`}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>Total Memory</div>
                  </div>
                  <div style={{ padding: '10px 12px', backgroundColor: 'var(--color-bg-tertiary)', borderRadius: 6 }}>
                    <div style={{ fontSize: 20, fontWeight: 700, color: 'var(--color-text)' }}>{regions.size}</div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>Regions</div>
                  </div>
                  <div style={{ padding: '10px 12px', backgroundColor: 'var(--color-bg-tertiary)', borderRadius: 6 }}>
                    <div style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)', lineHeight: '28px' }}>
                      {Array.from(types).map((t) => t.replace('GENERAL_PURPOSE_', '')).join(', ')}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>Machine Types</div>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Commitment Expiry Timeline */}
      {hasCommitments && (
        <CommitmentExpiryTimeline commitments={data.commitments} />
      )}

      {/* Active commitments table */}
      {hasCommitments && (
        <div>
          <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>Active Commitments ({data.commitments.length})</h4>
          <div style={{ overflowX: 'auto' }}>
            <table
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: 12,
              }}
            >
              <thead>
                <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                  {['Name', 'Region', 'Type', 'Plan', 'Status', 'Resources', 'Ends'].map((h) => (
                    <th
                      key={h}
                      style={{
                        textAlign: 'left',
                        padding: '8px 10px',
                        color: 'var(--color-text-secondary)',
                        fontWeight: 600,
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.commitments.map((c, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '8px 10px', fontWeight: 500 }}>{c.name}</td>
                    <td style={{ padding: '8px 10px' }}>{c.region}</td>
                    <td style={{ padding: '8px 10px' }}>{c.type}</td>
                    <td style={{ padding: '8px 10px' }}>{c.plan}</td>
                    <td style={{ padding: '8px 10px' }}>
                      <span
                        style={{
                          padding: '2px 6px',
                          borderRadius: 3,
                          fontSize: 10,
                          fontWeight: 600,
                          backgroundColor: c.status === 'ACTIVE' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(156, 163, 175, 0.1)',
                          color: c.status === 'ACTIVE' ? '#22c55e' : '#9ca3af',
                        }}
                      >
                        {c.status}
                      </span>
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      {c.resources.map((r) => `${formatResourceAmount(r.amount, r.unit)}`).join(', ')}
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      {c.endTimestamp ? new Date(c.endTimestamp).toLocaleDateString() : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Regional breakdown */}
      {hasBQData && data.byRegion.length > 0 && (
        <div>
          <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>Regional Coverage</h4>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
            {data.byRegion.map((r) => (
              <div
                key={r.region}
                style={{
                  backgroundColor: 'var(--color-bg-tertiary)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 6,
                  padding: '10px 14px',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 4 }}>{r.region}</div>
                <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                  Coverage: {formatPercent(r.coverageRatio)} | Committed: {formatCurrency(r.committedSpend)} | OD: {formatCurrency(r.onDemandSpend)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CUD purchase recommendations */}
      {data.cudRecommendations.length > 0 && (
        <div>
          <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>CUD Purchase Recommendations</h4>
          <RecommendationList recommendations={data.cudRecommendations} />
        </div>
      )}

      {data.commitments.length === 0 && data.cudRecommendations.length === 0 && !hasBQData && (
        <div style={{ padding: 20, textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: 13 }}>
          No active commitments or CUD recommendations found for this project.
        </div>
      )}

      {data.errors.length > 0 && (
        <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 8 }}>
          <details>
            <summary>Warnings ({data.errors.length})</summary>
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

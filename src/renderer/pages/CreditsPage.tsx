// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React, { useEffect } from 'react';
import { useCreditsStore } from '../stores/creditsStore';
import { useProviderStore } from '../stores/providerStore';
import { useProfileStore } from '../stores/profileStore';
import { useGCPProjectStore } from '../stores/gcpProjectStore';
import { DateRangeSelector } from '../components/costs/DateRangeSelector';
import type { CreditsByCategory, CreditsTrendPoint } from '../../shared/types';

const CHART_COLORS = ['#4f8cf7', '#34d399', '#f59e0b', '#ef4444', '#a78bfa', '#f472b6', '#06b6d4', '#84cc16', '#fb923c', '#e879f9'];

const formatCurrency = (amount: number, currency: string) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
};

// Simple bar chart for trend data
const CreditsTrendChart: React.FC<{ trend: CreditsTrendPoint[]; isGCP: boolean }> = ({ trend, isGCP }) => {
  if (trend.length === 0) return null;

  const maxCredits = Math.max(...trend.map(t => t.totalCredits), 1);
  const barWidth = Math.min(60, Math.max(20, Math.floor(600 / trend.length) - 8));
  const chartHeight = 200;
  const chartWidth = trend.length * (barWidth + 8) + 40;

  // Get all unique types for stacked bars (GCP only)
  const allTypes = isGCP ? Array.from(new Set(trend.flatMap(t => Object.keys(t.byType || {})))) : [];

  return (
    <div className="card mb-4">
      <h3 className="card-title mb-4">Credits Trend</h3>
      <div style={{ overflowX: 'auto' }}>
        <svg width={Math.max(chartWidth, 300)} height={chartHeight + 40} style={{ display: 'block' }}>
          {trend.map((point, i) => {
            const x = 40 + i * (barWidth + 8);

            if (isGCP && allTypes.length > 0) {
              // Stacked bars for GCP
              let yOffset = 0;
              return (
                <g key={point.date}>
                  {allTypes.map((type, ti) => {
                    const amount = point.byType?.[type] || 0;
                    const barHeight = (amount / maxCredits) * chartHeight;
                    const y = chartHeight - yOffset - barHeight;
                    yOffset += barHeight;
                    return (
                      <rect key={type} x={x} y={y} width={barWidth} height={Math.max(barHeight, 0)} rx={2}
                        fill={CHART_COLORS[ti % CHART_COLORS.length]} opacity={0.85}>
                        <title>{type}: {formatCurrency(amount, point.currency)}</title>
                      </rect>
                    );
                  })}
                  <text x={x + barWidth / 2} y={chartHeight + 16} textAnchor="middle"
                    fill="var(--color-text-secondary)" fontSize={10}>{point.date.slice(5)}</text>
                </g>
              );
            }

            // Simple bars for AWS
            const barHeight = (point.totalCredits / maxCredits) * chartHeight;
            return (
              <g key={point.date}>
                <rect x={x} y={chartHeight - barHeight} width={barWidth} height={Math.max(barHeight, 0)} rx={2}
                  fill="var(--color-primary)" opacity={0.85}>
                  <title>{formatCurrency(point.totalCredits, point.currency)}</title>
                </rect>
                <text x={x + barWidth / 2} y={chartHeight + 16} textAnchor="middle"
                  fill="var(--color-text-secondary)" fontSize={10}>{point.date.slice(5)}</text>
              </g>
            );
          })}
        </svg>
      </div>
      {isGCP && allTypes.length > 1 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 8 }}>
          {allTypes.map((type, i) => (
            <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11 }}>
              <div style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }} />
              <span className="text-secondary">{type}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Donut chart for type breakdown
const CreditsDonut: React.FC<{ data: CreditsByCategory[]; title: string }> = ({ data, title }) => {
  if (data.length === 0) return null;

  const total = data.reduce((s, d) => s + d.amount, 0);
  if (total === 0) return null;

  const r = 60;
  const cx = 70;
  const cy = 70;
  const circumference = 2 * Math.PI * r;
  let offset = 0;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
      <svg width={140} height={140} viewBox="0 0 140 140" style={{ flexShrink: 0 }}>
        {data.map((item, i) => {
          const pct = item.amount / total;
          const dashLength = pct * circumference;
          const dashOffset = -offset;
          offset += dashLength;
          return (
            <circle key={item.category} cx={cx} cy={cy} r={r} fill="none" stroke={CHART_COLORS[i % CHART_COLORS.length]}
              strokeWidth={20} strokeDasharray={`${dashLength} ${circumference - dashLength}`}
              strokeDashoffset={dashOffset} transform={`rotate(-90 ${cx} ${cy})`}>
              <title>{item.category}: {formatCurrency(item.amount, item.currency)} ({(pct * 100).toFixed(1)}%)</title>
            </circle>
          );
        })}
      </svg>
      <div>
        <h4 style={{ marginBottom: 8, fontSize: 13 }}>{title}</h4>
        {data.slice(0, 8).map((item, i) => (
          <div key={item.category} style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, fontSize: 12 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: CHART_COLORS[i % CHART_COLORS.length], flexShrink: 0 }} />
            <span className="text-secondary" style={{ flex: 1 }}>{item.category}</span>
            <strong>{formatCurrency(item.amount, item.currency)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
};

const CategoryTable: React.FC<{ data: CreditsByCategory[]; label: string }> = ({ data, label }) => {
  if (data.length === 0) return null;

  return (
    <div className="card mb-4">
      <h3 className="card-title mb-4">Credits by {label}</h3>
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>{label}</th>
              <th style={{ textAlign: 'right' }}>Credits</th>
              <th style={{ textAlign: 'right' }}>Entries</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row) => (
              <tr key={row.category}>
                <td><strong>{row.category}</strong></td>
                <td style={{ textAlign: 'right' }}>{formatCurrency(row.amount, row.currency)}</td>
                <td style={{ textAlign: 'right' }}>{row.count.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const CreditsPage: React.FC = () => {
  const selectedProvider = useProviderStore((s) => s.selectedProvider);
  const selectedProfile = useProfileStore((s) => s.selectedProfileName);
  const selectedProjectId = useGCPProjectStore((s) => s.selectedProjectId);

  const {
    credits, dateRange, customStartDate, customEndDate, costScope,
    isLoading, error,
    setDateRange, setCustomDates, setCostScope, refreshCredits, clearError,
  } = useCreditsStore();

  const isGCP = selectedProvider === 'gcp';
  const identity = isGCP ? selectedProjectId : selectedProfile;

  // Auto-load on identity or date range change
  useEffect(() => {
    if (identity && selectedProvider) {
      refreshCredits(selectedProvider, identity);
    }
  }, [identity, selectedProvider, dateRange, customStartDate, customEndDate, costScope]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear stale data on provider/identity change
  useEffect(() => {
    useCreditsStore.setState({ credits: null });
  }, [selectedProvider, identity]);

  const handleRefresh = () => {
    if (identity && selectedProvider) {
      refreshCredits(selectedProvider, identity);
    }
  };

  return (
    <>
      <header className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h1 className="page-title">Credits</h1>
            {isGCP && (
              <div style={{ display: 'flex', borderRadius: 6, overflow: 'hidden', border: '1px solid var(--color-border)' }}>
                {(['project', 'organization'] as const).map((scope) => (
                  <button
                    key={scope}
                    onClick={() => setCostScope(scope)}
                    style={{
                      padding: '6px 14px', fontSize: 12, fontWeight: 500, cursor: 'pointer', border: 'none',
                      backgroundColor: costScope === scope ? 'var(--color-primary)' : 'var(--color-bg-secondary)',
                      color: costScope === scope ? '#fff' : 'var(--color-text-secondary)',
                    }}
                  >
                    {scope === 'project' ? 'Project' : 'Organization'}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <DateRangeSelector
              value={dateRange}
              onChange={setDateRange}
              onCustomDateChange={setCustomDates}
              customStartDate={customStartDate}
              customEndDate={customEndDate}
            />
            <button className="btn btn-primary" onClick={handleRefresh} disabled={!identity || isLoading}>
              {isLoading ? (<><div className="spinner" style={{ width: 16, height: 16 }} /> Loading...</>) : 'Refresh'}
            </button>
          </div>
        </div>
      </header>

      <div className="page-content">
        {error && (
          <div className="card mb-4" style={{ borderColor: 'var(--color-error)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--color-error)' }}>{error}</span>
              <button className="btn btn-sm btn-secondary" onClick={clearError}>Dismiss</button>
            </div>
          </div>
        )}

        {!identity && (
          <div className="empty-state">
            <h3>No {isGCP ? 'Project' : 'Profile'} Selected</h3>
            <p>Select {isGCP ? 'a GCP project' : 'an AWS profile'} from the top bar to view credits.</p>
          </div>
        )}

        {identity && isLoading && !credits && (
          <div className="loading-overlay">
            <div className="spinner" />
            <p>Loading credits data...</p>
          </div>
        )}

        {identity && !isLoading && credits && credits.totalCredits === 0 && (
          <div className="empty-state">
            <h3>No Credits Found</h3>
            <p>No credits were applied to this {isGCP ? 'project' : 'account'} during the selected period.</p>
          </div>
        )}

        {credits && credits.totalCredits > 0 && (
          <>
            {/* Summary Stats */}
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-value" style={{ color: 'var(--color-success)' }}>
                  {formatCurrency(credits.totalCredits, credits.currency)}
                </div>
                <div className="stat-label">Total Credits</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{formatCurrency(credits.totalGrossCost, credits.currency)}</div>
                <div className="stat-label">Gross Cost</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{formatCurrency(credits.totalNetCost, credits.currency)}</div>
                <div className="stat-label">Net Cost</div>
              </div>
              <div className="stat-card">
                <div className="stat-value" style={{
                  color: credits.creditsAsPercentOfGross >= 20 ? 'var(--color-success)' :
                         credits.creditsAsPercentOfGross >= 5 ? 'var(--color-warning)' : 'var(--color-text)',
                }}>
                  {credits.creditsAsPercentOfGross.toFixed(1)}%
                </div>
                <div className="stat-label">Credits % of Gross</div>
              </div>
            </div>

            {/* Cost Waterfall */}
            <div className="card mb-4">
              <h3 className="card-title mb-4">Credits vs Cost</h3>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 24, height: 120 }}>
                {[
                  { label: 'Gross Cost', value: credits.totalGrossCost, color: 'var(--color-text-secondary)' },
                  { label: 'Credits', value: credits.totalCredits, color: 'var(--color-success)' },
                  { label: 'Net Cost', value: credits.totalNetCost, color: 'var(--color-primary)' },
                ].map((bar) => {
                  const maxVal = Math.max(credits.totalGrossCost, 1);
                  const height = Math.max((bar.value / maxVal) * 100, 4);
                  return (
                    <div key={bar.label} style={{ flex: 1, textAlign: 'center' }}>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                        {formatCurrency(bar.value, credits.currency)}
                      </div>
                      <div style={{
                        height, backgroundColor: bar.color, borderRadius: '4px 4px 0 0', opacity: 0.8,
                        transition: 'height 0.3s ease',
                      }} />
                      <div className="text-secondary" style={{ fontSize: 11, marginTop: 4 }}>{bar.label}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Trend Chart */}
            <CreditsTrendChart trend={credits.trend} isGCP={isGCP} />

            {/* Type and Service Breakdown */}
            <div style={{ display: 'grid', gridTemplateColumns: isGCP && credits.byType.length > 1 ? '1fr 1fr' : '1fr', gap: 16, marginBottom: 16 }}>
              {isGCP && credits.byType.length > 1 && (
                <div className="card">
                  <h3 className="card-title mb-4">By Credit Type</h3>
                  <CreditsDonut data={credits.byType} title="Credit Types" />
                </div>
              )}
              {credits.byService.length > 0 && (
                <div className="card">
                  <h3 className="card-title mb-4">By Service</h3>
                  <CreditsDonut data={credits.byService.slice(0, 8)} title="Top Services" />
                </div>
              )}
            </div>

            {/* Detail Tables */}
            {isGCP && credits.byType.length > 0 && (
              <CategoryTable data={credits.byType} label="Credit Type" />
            )}
            <CategoryTable data={credits.byService} label="Service" />
            {!isGCP && credits.byLinkedAccount && credits.byLinkedAccount.length > 0 && (
              <CategoryTable data={credits.byLinkedAccount} label="Linked Account" />
            )}
            {isGCP && credits.byProject && credits.byProject.length > 0 && (
              <CategoryTable data={credits.byProject} label="Project" />
            )}

            <p className="text-secondary text-sm" style={{ marginTop: 12 }}>
              Period: {credits.startDate} to {credits.endDate}
            </p>
          </>
        )}
      </div>
    </>
  );
};

export default CreditsPage;

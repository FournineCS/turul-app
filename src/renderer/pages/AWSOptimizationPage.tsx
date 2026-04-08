// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React, { useState, useCallback } from 'react';
import { useProfileStore } from '../stores/profileStore';
import { useCostStore } from '../stores/costStore';
import type { CostOptimizationResult, CostOptimizationRecommendation } from '../../shared/types';
import { AWS_REGIONS } from '../../shared/types';
import ExportCSVButton from '../components/ExportCSVButton';

type PageTab = 'recommendations' | 'resources';

const SEVERITY_COLORS: Record<string, { bg: string; text: string }> = {
  high: { bg: 'rgba(239, 68, 68, 0.1)', text: '#ef4444' },
  medium: { bg: 'rgba(245, 158, 11, 0.1)', text: '#f59e0b' },
  low: { bg: 'rgba(34, 197, 94, 0.1)', text: '#22c55e' },
};

const CATEGORY_ALL = 'all';
type CategoryFilter = typeof CATEGORY_ALL | string;

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function getCategories(recs: CostOptimizationRecommendation[]): string[] {
  const cats = new Set<string>();
  for (const r of recs) if (r.category) cats.add(r.category);
  return Array.from(cats).sort();
}

function getTypeLabel(type: CostOptimizationRecommendation['type']): string {
  const map: Record<string, string> = {
    unused_resource: 'Unused Resource',
    underutilized: 'Underutilized',
    reserved_instance: 'Reserved Instance',
    savings_plan: 'Savings Plan',
    idle_resource: 'Idle Resource',
    orphaned_resource: 'Orphaned Resource',
    cost_anomaly: 'Cost Anomaly',
    rightsizing: 'Rightsizing',
    commitment_coverage: 'Commitment Coverage',
    best_practice: 'Best Practice',
    egress_optimization: 'Egress Optimization',
  };
  return map[type] || type;
}

const COMMON_REGIONS = ['us-east-1', 'us-east-2', 'us-west-1', 'us-west-2', 'eu-west-1', 'eu-central-1', 'ap-southeast-1'];

const AWSOptimizationPage: React.FC = () => {
  const selectedProfile = useProfileStore((s) => s.selectedProfileName);
  const { optimizations, isLoading, error, clearError } = useCostStore();

  const [selectedRegion, setSelectedRegion] = useState('us-east-1');
  const [isRunning, setIsRunning] = useState(false);
  const [activeTab, setActiveTab] = useState<PageTab>('recommendations');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>(CATEGORY_ALL);

  const handleRunScan = useCallback(async () => {
    if (!selectedProfile || isRunning) return;
    setIsRunning(true);
    clearError();
    try {
      const response = await window.electronAPI?.cost?.getOptimizations(selectedProfile, 30, selectedRegion);
      if (response?.success && response.data) {
        useCostStore.setState({ optimizations: response.data });
      } else {
        useCostStore.setState({ error: response?.error || 'Failed to run optimization scan' });
      }
    } catch (err) {
      useCostStore.setState({ error: err instanceof Error ? err.message : 'Failed to run optimization scan' });
    } finally {
      setIsRunning(false);
    }
  }, [selectedProfile, selectedRegion, isRunning, clearError]);

  const allRecs = optimizations?.recommendations || [];
  const categories = getCategories(allRecs);
  const filteredRecs = categoryFilter === CATEGORY_ALL
    ? allRecs
    : allRecs.filter((r) => r.category === categoryFilter);

  // Split into pattern-based (Savings Plans, anomalies) vs resource-level checks
  const patternRecs = filteredRecs.filter((r) =>
    r.type === 'savings_plan' || r.type === 'reserved_instance' || r.type === 'cost_anomaly' || r.type === 'commitment_coverage'
  );
  const resourceRecs = filteredRecs.filter((r) =>
    r.type !== 'savings_plan' && r.type !== 'reserved_instance' && r.type !== 'cost_anomaly' && r.type !== 'commitment_coverage'
  );

  const displayRecs = activeTab === 'recommendations' ? patternRecs : resourceRecs;

  // Summary stats
  const totalSavings = optimizations?.totalPotentialSavings || 0;
  const highCount = allRecs.filter((r) => r.severity === 'high').length;
  const mediumCount = allRecs.filter((r) => r.severity === 'medium').length;
  const lowCount = allRecs.filter((r) => r.severity === 'low').length;

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '8px 16px',
    fontSize: 13,
    fontWeight: active ? 600 : 400,
    border: 'none',
    borderBottom: active ? '2px solid var(--color-primary)' : '2px solid transparent',
    backgroundColor: 'transparent',
    color: active ? 'var(--color-primary)' : 'var(--color-text-secondary)',
    cursor: 'pointer',
    marginBottom: -2,
  });

  return (
    <>
      <header className="page-header" style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <h1 className="page-title" style={{ margin: 0, flex: 1 }}>AWS Optimization</h1>
        {selectedProfile && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select
              className="global-profile-select"
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              style={{ minWidth: 160, fontSize: 12 }}
            >
              <optgroup label="Common Regions">
                {COMMON_REGIONS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </optgroup>
              <optgroup label="All Regions">
                {AWS_REGIONS.filter((r) => !COMMON_REGIONS.includes(r)).map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </optgroup>
            </select>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleRunScan}
              disabled={isRunning || !selectedProfile}
            >
              {isRunning ? 'Scanning...' : 'Run Scan'}
            </button>
          </div>
        )}
      </header>

      <div className="page-content">
        {!selectedProfile ? (
          <div className="empty-state">
            <h3>No AWS Profile Selected</h3>
            <p>Select an AWS profile from the top bar to run optimization checks.</p>
          </div>
        ) : (
          <>
            {error && (
              <div className="card mb-4" style={{ borderColor: 'var(--color-error)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--color-error)' }}>{error}</span>
                  <button className="btn btn-sm btn-secondary" onClick={clearError}>Dismiss</button>
                </div>
              </div>
            )}

            {/* Summary Cards */}
            {optimizations && (
              <div className="stats-grid" style={{ marginBottom: 20 }}>
                <div className="stat-card">
                  <div className="stat-value" style={{ color: 'var(--color-error)' }}>
                    {formatCurrency(totalSavings)}
                  </div>
                  <div className="stat-label">Potential Monthly Savings</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value">{allRecs.length}</div>
                  <div className="stat-label">Total Recommendations</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value" style={{ color: '#ef4444' }}>{highCount}</div>
                  <div className="stat-label">High Severity</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value" style={{ color: '#f59e0b' }}>{mediumCount}</div>
                  <div className="stat-label">Medium Severity</div>
                </div>
              </div>
            )}

            {/* Tabs */}
            <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid var(--color-border)', marginBottom: 20 }}>
              <button style={tabStyle(activeTab === 'recommendations')} onClick={() => setActiveTab('recommendations')}>
                Cost Recommendations
                {patternRecs.length > 0 && (
                  <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.8 }}>({patternRecs.length})</span>
                )}
              </button>
              <button style={tabStyle(activeTab === 'resources')} onClick={() => setActiveTab('resources')}>
                Resource Checks
                {resourceRecs.length > 0 && (
                  <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.8 }}>({resourceRecs.length})</span>
                )}
              </button>
            </div>

            {/* Category filter */}
            {allRecs.length > 0 && (
              <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
                <button
                  className={`btn btn-sm ${categoryFilter === CATEGORY_ALL ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setCategoryFilter(CATEGORY_ALL)}
                >
                  All
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat}
                    className={`btn btn-sm ${categoryFilter === cat ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setCategoryFilter(cat)}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}

            {/* Results */}
            {isRunning ? (
              <div style={{ padding: 40, textAlign: 'center' }}>
                <div className="spinner" style={{ width: 32, height: 32, margin: '0 auto 16px' }} />
                <p style={{ color: 'var(--color-text-secondary)', fontSize: 14 }}>
                  Running optimization checks on {selectedRegion}...
                </p>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: 12 }}>
                  Checking Savings Plans, Reserved Instances, idle resources, unattached volumes, and more.
                </p>
              </div>
            ) : !optimizations ? (
              <div style={{
                padding: 40,
                textAlign: 'center',
                backgroundColor: 'var(--color-bg-secondary)',
                borderRadius: 8,
                border: '1px solid var(--color-border)',
              }}>
                <h3 style={{ margin: '0 0 8px', color: 'var(--color-text)' }}>Run an Optimization Scan</h3>
                <p style={{ margin: '0 0 8px', color: 'var(--color-text-secondary)', fontSize: 13 }}>
                  Select a region and click <strong>Run Scan</strong> to check for cost savings opportunities.
                </p>
                <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: 12 }}>
                  Checks include: Savings Plan / RI recommendations, cost anomalies, unattached EBS volumes, idle Elastic IPs,
                  old snapshots, idle load balancers, stopped EC2 instances, idle Lambda / RDS / NAT Gateways, and more.
                </p>
              </div>
            ) : displayRecs.length === 0 ? (
              <div style={{
                padding: 40,
                textAlign: 'center',
                backgroundColor: 'var(--color-bg-tertiary)',
                borderRadius: 8,
              }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>{'\u2713'}</div>
                <p style={{ margin: 0, fontSize: 14, color: 'var(--color-text-secondary)' }}>
                  {activeTab === 'recommendations'
                    ? 'No cost pattern recommendations found. Your spend patterns look well-optimized.'
                    : 'No idle or orphaned resources found in this region.'}
                </p>
              </div>
            ) : (
              <>
                {/* Export */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                  <ExportCSVButton
                    data={displayRecs.map((r) => ({
                      type: getTypeLabel(r.type),
                      severity: r.severity,
                      service: r.service,
                      description: r.description,
                      estimatedSavings: r.estimatedMonthlySavings.toFixed(2),
                      action: r.actionRequired,
                      resourceId: r.resourceId || '',
                      region: r.region || '',
                      category: r.category || '',
                    }))}
                    columns={[
                      { key: 'type', label: 'Type' },
                      { key: 'severity', label: 'Severity' },
                      { key: 'service', label: 'Service' },
                      { key: 'description', label: 'Description' },
                      { key: 'estimatedSavings', label: 'Est. Savings ($/mo)' },
                      { key: 'action', label: 'Action Required' },
                      { key: 'resourceId', label: 'Resource ID' },
                      { key: 'region', label: 'Region' },
                      { key: 'category', label: 'Category' },
                    ]}
                    filename={`aws-optimization-${selectedRegion}`}
                    label="Export CSV"
                  />
                </div>

                {/* Recommendation cards */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {displayRecs.map((rec) => {
                    const severity = SEVERITY_COLORS[rec.severity] || SEVERITY_COLORS.low;
                    return (
                      <div
                        key={rec.id}
                        className="card"
                        style={{
                          borderLeft: `4px solid ${severity.text}`,
                          padding: 16,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 6 }}>
                              <span style={{
                                padding: '2px 8px',
                                borderRadius: 4,
                                fontSize: 11,
                                fontWeight: 600,
                                backgroundColor: severity.bg,
                                color: severity.text,
                                textTransform: 'uppercase',
                              }}>
                                {rec.severity}
                              </span>
                              <span style={{
                                padding: '2px 8px',
                                borderRadius: 4,
                                fontSize: 11,
                                backgroundColor: 'var(--color-bg-tertiary)',
                                color: 'var(--color-text-secondary)',
                              }}>
                                {getTypeLabel(rec.type)}
                              </span>
                              {rec.category && (
                                <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
                                  {rec.category}
                                </span>
                              )}
                            </div>
                            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>
                              {rec.service}
                            </div>
                            <p style={{ margin: '0 0 6px', fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                              {rec.description}
                            </p>
                            {rec.resourceId && (
                              <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', fontFamily: 'monospace', marginBottom: 4 }}>
                                {rec.resourceId}
                              </div>
                            )}
                            <div style={{ fontSize: 12, color: 'var(--color-primary)', fontWeight: 500 }}>
                              Action: {rec.actionRequired}
                            </div>
                          </div>
                          <div style={{
                            textAlign: 'right',
                            minWidth: 100,
                            flexShrink: 0,
                          }}>
                            <div style={{
                              fontSize: 18,
                              fontWeight: 700,
                              color: 'var(--color-error)',
                            }}>
                              {formatCurrency(rec.estimatedMonthlySavings)}
                            </div>
                            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>per month</div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </>
  );
};

export default AWSOptimizationPage;

// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React, { useState, useCallback } from 'react';
import { useProfileStore } from '../stores/profileStore';
import type { EKSCostAnalysis, EKSClusterCost, EKSNodeGroupCost, CostDateRange } from '../../shared/types';
import { AWS_REGIONS } from '../../shared/types';
import ExportCSVButton from '../components/ExportCSVButton';

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);
}

function pct(value: number, total: number): string {
  return total > 0 ? `${((value / total) * 100).toFixed(1)}%` : '0%';
}

const COMMON_REGIONS = ['us-east-1', 'us-east-2', 'us-west-1', 'us-west-2', 'eu-west-1', 'eu-central-1', 'ap-southeast-1'];
const DATE_RANGES: { value: CostDateRange; label: string }[] = [
  { value: '7d', label: '7 Days' },
  { value: '30d', label: '30 Days' },
  { value: '90d', label: '90 Days' },
];

function getDateRange(range: CostDateRange): { startDate: string; endDate: string } {
  const end = new Date();
  const start = new Date();
  const days = range === '7d' ? 7 : range === '90d' ? 90 : 30;
  start.setDate(start.getDate() - days);
  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
  };
}

const EKSCostsPage: React.FC = () => {
  const selectedProfile = useProfileStore((s) => s.selectedProfileName);
  const [selectedRegion, setSelectedRegion] = useState('us-east-1');
  const [dateRange, setDateRange] = useState<CostDateRange>('30d');
  const [analysis, setAnalysis] = useState<EKSCostAnalysis | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCluster, setSelectedCluster] = useState<string | null>(null);

  const handleLoad = useCallback(async () => {
    if (!selectedProfile) return;
    setIsLoading(true);
    setError(null);
    try {
      const { startDate, endDate } = getDateRange(dateRange);
      const response = await window.electronAPI?.eks?.getCosts(
        selectedProfile, selectedRegion, startDate, endDate, selectedCluster || undefined
      );
      if (response?.success && response.data) {
        setAnalysis(response.data);
      } else {
        setError(response?.error || 'Failed to load EKS costs');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load EKS costs');
    } finally {
      setIsLoading(false);
    }
  }, [selectedProfile, selectedRegion, dateRange, selectedCluster]);

  const clusters = analysis?.byCluster || [];
  const nodeGroups = selectedCluster
    ? (analysis?.byNodeGroup || []).filter((ng) => ng.cluster === selectedCluster)
    : analysis?.byNodeGroup || [];
  const trend = analysis?.trend || [];
  const totalCost = analysis?.totalCost || 0;

  // Bar chart data for clusters
  const maxClusterCost = Math.max(...clusters.map((c) => c.cost), 1);

  return (
    <>
      <header className="page-header" style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <h1 className="page-title" style={{ margin: 0, flex: 1 }}>EKS Costs</h1>
        {selectedProfile && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <select
              className="global-profile-select"
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              style={{ minWidth: 140, fontSize: 12 }}
            >
              <optgroup label="Common Regions">
                {COMMON_REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </optgroup>
              <optgroup label="All Regions">
                {AWS_REGIONS.filter((r) => !COMMON_REGIONS.includes(r)).map((r) => <option key={r} value={r}>{r}</option>)}
              </optgroup>
            </select>
            <select
              className="global-profile-select"
              value={dateRange}
              onChange={(e) => setDateRange(e.target.value as CostDateRange)}
              style={{ minWidth: 100, fontSize: 12 }}
            >
              {DATE_RANGES.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
            </select>
            <button className="btn btn-primary btn-sm" onClick={handleLoad} disabled={isLoading}>
              {isLoading ? 'Loading...' : 'Load EKS Costs'}
            </button>
          </div>
        )}
      </header>

      <div className="page-content">
        {!selectedProfile ? (
          <div className="empty-state">
            <h3>No AWS Profile Selected</h3>
            <p>Select an AWS profile from the top bar to view EKS costs.</p>
          </div>
        ) : error ? (
          <div className="card mb-4" style={{ borderColor: 'var(--color-error)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--color-error)' }}>{error}</span>
              <button className="btn btn-sm btn-secondary" onClick={() => setError(null)}>Dismiss</button>
            </div>
          </div>
        ) : isLoading ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <div className="spinner" style={{ width: 32, height: 32, margin: '0 auto 16px' }} />
            <p style={{ color: 'var(--color-text-secondary)' }}>Loading EKS costs from Cost Explorer + EKS API...</p>
          </div>
        ) : !analysis ? (
          <div style={{ padding: 40, textAlign: 'center', backgroundColor: 'var(--color-bg-secondary)', borderRadius: 8, border: '1px solid var(--color-border)' }}>
            <h3 style={{ margin: '0 0 8px' }}>Load EKS Cost Analysis</h3>
            <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: 13 }}>
              Select a region and click <strong>Load EKS Costs</strong> to analyze cluster and node group costs.
            </p>
            <p style={{ margin: '8px 0 0', color: 'var(--color-text-secondary)', fontSize: 12 }}>
              Combines AWS Cost Explorer billing data with EKS API for cluster/node group details.
            </p>
          </div>
        ) : (
          <>
            {/* Breadcrumb */}
            {selectedCluster && (
              <div style={{ marginBottom: 16, fontSize: 13, display: 'flex', alignItems: 'center', gap: 4 }}>
                <button
                  style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', padding: 0, fontSize: 13 }}
                  onClick={() => setSelectedCluster(null)}
                >
                  All Clusters
                </button>
                <span style={{ color: 'var(--color-text-secondary)' }}>&gt;</span>
                <span style={{ fontWeight: 600 }}>{selectedCluster}</span>
              </div>
            )}

            {/* Summary Cards */}
            <div className="stats-grid" style={{ marginBottom: 20 }}>
              <div className="stat-card">
                <div className="stat-value" style={{ color: 'var(--color-error)' }}>{formatCurrency(totalCost)}</div>
                <div className="stat-label">Total EKS Spend ({dateRange})</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{clusters.length}</div>
                <div className="stat-label">Clusters</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{nodeGroups.length}</div>
                <div className="stat-label">Node Groups</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">
                  {nodeGroups.reduce((sum, ng) => sum + ng.desiredSize, 0)}
                </div>
                <div className="stat-label">Total Nodes</div>
              </div>
            </div>

            {/* Related Services Breakdown */}
            {analysis.relatedServices.length > 0 && (
              <div className="card" style={{ marginBottom: 20, padding: 16 }}>
                <h3 style={{ margin: '0 0 12px', fontSize: 14 }}>Cost by AWS Service</h3>
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  {analysis.relatedServices.sort((a, b) => b.cost - a.cost).map((s) => (
                    <div key={s.service} style={{ padding: '8px 16px', backgroundColor: 'var(--color-bg-tertiary)', borderRadius: 6, fontSize: 13 }}>
                      <div style={{ fontWeight: 600 }}>{formatCurrency(s.cost)}</div>
                      <div style={{ color: 'var(--color-text-secondary)', fontSize: 11 }}>{s.service}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Daily Trend */}
            {trend.length > 0 && (
              <div className="card" style={{ marginBottom: 20, padding: 16 }}>
                <h3 style={{ margin: '0 0 12px', fontSize: 14 }}>Daily Cost Trend</h3>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 1, height: 120 }}>
                  {(() => {
                    const maxCost = Math.max(...trend.map((t) => t.cost), 0.01);
                    return trend.map((t, i) => (
                      <div
                        key={i}
                        title={`${t.date}: ${formatCurrency(t.cost)}`}
                        style={{
                          flex: 1,
                          height: `${(t.cost / maxCost) * 100}%`,
                          minHeight: 2,
                          backgroundColor: 'var(--color-primary)',
                          borderRadius: '2px 2px 0 0',
                          opacity: 0.8,
                        }}
                      />
                    ));
                  })()}
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--color-text-secondary)', marginTop: 4 }}>
                  <span>{trend[0]?.date}</span>
                  <span>{trend[trend.length - 1]?.date}</span>
                </div>
              </div>
            )}

            {/* Clusters Table */}
            <div className="card" style={{ marginBottom: 20, padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 14 }}>Clusters</h3>
                <ExportCSVButton
                  data={clusters.map((c) => ({
                    cluster: c.cluster, version: c.version, status: c.status,
                    nodeGroups: c.nodeGroupCount, totalNodes: c.totalNodes,
                    cost: c.cost.toFixed(2), share: pct(c.cost, totalCost),
                  }))}
                  columns={[
                    { key: 'cluster', label: 'Cluster' }, { key: 'version', label: 'Version' },
                    { key: 'status', label: 'Status' }, { key: 'nodeGroups', label: 'Node Groups' },
                    { key: 'totalNodes', label: 'Nodes' }, { key: 'cost', label: 'Cost ($)' },
                    { key: 'share', label: '% of Total' },
                  ]}
                  filename="eks-clusters"
                  label="CSV"
                />
              </div>
              {clusters.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: 13 }}>
                  No EKS clusters found in {selectedRegion}.
                </div>
              ) : (
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Cluster</th>
                        <th>Version</th>
                        <th>Status</th>
                        <th>Node Groups</th>
                        <th>Nodes</th>
                        <th>Est. Cost</th>
                        <th>Share</th>
                        <th style={{ width: 120 }}>Distribution</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clusters.sort((a, b) => b.cost - a.cost).map((c) => (
                        <tr
                          key={c.cluster}
                          onClick={() => setSelectedCluster(c.cluster === selectedCluster ? null : c.cluster)}
                          style={{
                            cursor: 'pointer',
                            backgroundColor: selectedCluster === c.cluster ? 'var(--color-primary-glow)' : undefined,
                          }}
                        >
                          <td><strong>{c.cluster}</strong></td>
                          <td>{c.version}</td>
                          <td>
                            <span style={{
                              padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600,
                              backgroundColor: c.status === 'ACTIVE' ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)',
                              color: c.status === 'ACTIVE' ? '#22c55e' : '#f59e0b',
                            }}>
                              {c.status}
                            </span>
                          </td>
                          <td>{c.nodeGroupCount}</td>
                          <td>{c.totalNodes}</td>
                          <td style={{ fontWeight: 600 }}>{formatCurrency(c.cost)}</td>
                          <td>{pct(c.cost, totalCost)}</td>
                          <td>
                            <div style={{ width: '100%', height: 8, backgroundColor: 'var(--color-bg-tertiary)', borderRadius: 4, overflow: 'hidden' }}>
                              <div style={{ width: `${(c.cost / maxClusterCost) * 100}%`, height: '100%', backgroundColor: 'var(--color-primary)', borderRadius: 4 }} />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Node Groups Table */}
            <div className="card" style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 14 }}>
                  Node Groups {selectedCluster ? `— ${selectedCluster}` : ''}
                </h3>
                <ExportCSVButton
                  data={nodeGroups.map((ng) => ({
                    name: ng.name, cluster: ng.cluster, instanceTypes: ng.instanceTypes.join(', '),
                    capacityType: ng.capacityType, desired: ng.desiredSize, min: ng.minSize, max: ng.maxSize,
                    diskGB: ng.diskSize, amiType: ng.amiType, status: ng.status,
                    cost: ng.estimatedMonthlyCost.toFixed(2),
                  }))}
                  columns={[
                    { key: 'name', label: 'Name' }, { key: 'cluster', label: 'Cluster' },
                    { key: 'instanceTypes', label: 'Instance Types' }, { key: 'capacityType', label: 'Capacity' },
                    { key: 'desired', label: 'Desired' }, { key: 'min', label: 'Min' }, { key: 'max', label: 'Max' },
                    { key: 'diskGB', label: 'Disk (GB)' }, { key: 'status', label: 'Status' },
                    { key: 'cost', label: 'Est. Cost ($)' },
                  ]}
                  filename="eks-nodegroups"
                  label="CSV"
                />
              </div>
              {nodeGroups.length === 0 ? (
                <div style={{ padding: 20, textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: 13 }}>
                  No node groups found.
                </div>
              ) : (
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Node Group</th>
                        {!selectedCluster && <th>Cluster</th>}
                        <th>Instance Types</th>
                        <th>Capacity</th>
                        <th>Nodes (min/desired/max)</th>
                        <th>Disk</th>
                        <th>Status</th>
                        <th>Est. Monthly Cost</th>
                      </tr>
                    </thead>
                    <tbody>
                      {nodeGroups.sort((a, b) => b.estimatedMonthlyCost - a.estimatedMonthlyCost).map((ng) => (
                        <tr key={`${ng.cluster}-${ng.name}`}>
                          <td><strong>{ng.name}</strong></td>
                          {!selectedCluster && <td>{ng.cluster}</td>}
                          <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{ng.instanceTypes.join(', ')}</td>
                          <td>
                            <span style={{
                              padding: '2px 6px', borderRadius: 4, fontSize: 11,
                              backgroundColor: ng.capacityType === 'SPOT' ? 'rgba(139,92,246,0.1)' : 'rgba(59,130,246,0.1)',
                              color: ng.capacityType === 'SPOT' ? '#8b5cf6' : '#3b82f6',
                            }}>
                              {ng.capacityType}
                            </span>
                          </td>
                          <td>{ng.minSize} / {ng.desiredSize} / {ng.maxSize}</td>
                          <td>{ng.diskSize} GB</td>
                          <td>
                            <span style={{
                              padding: '2px 6px', borderRadius: 10, fontSize: 11,
                              backgroundColor: ng.status === 'ACTIVE' ? 'rgba(34,197,94,0.1)' : 'rgba(245,158,11,0.1)',
                              color: ng.status === 'ACTIVE' ? '#22c55e' : '#f59e0b',
                            }}>
                              {ng.status}
                            </span>
                          </td>
                          <td style={{ fontWeight: 600, color: 'var(--color-error)' }}>
                            {formatCurrency(ng.estimatedMonthlyCost)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
};

export default EKSCostsPage;

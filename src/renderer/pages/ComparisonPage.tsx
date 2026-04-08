// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React, { useState, useEffect, useMemo } from 'react';
import { useScanStore } from '../stores/scanStore';
import { useProfileStore } from '../stores/profileStore';
import { useProviderStore } from '../stores/providerStore';
import { useGCPProjectStore } from '../stores/gcpProjectStore';
import { useComparisonStore } from '../stores/comparisonStore';
import type { CloudProvider } from '../../shared/types';
import ExportCSVButton from '../components/ExportCSVButton';
import type { DiffResource } from '../../shared/types';

type ViewTab = 'summary' | 'added' | 'removed' | 'changed';

const DiffResourceTable: React.FC<{
  resources: DiffResource[];
  label: string;
  color: string;
}> = ({ resources, label, color }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (resources.length === 0) {
    return (
      <div className="empty-state">
        <p>No {label.toLowerCase()} resources.</p>
      </div>
    );
  }

  return (
    <div className="table-container">
      <table className="table">
        <thead>
          <tr>
            <th>Resource</th>
            <th>Service</th>
            <th>Region</th>
            {label === 'Changed' && <th>Changes</th>}
          </tr>
        </thead>
        <tbody>
          {resources.map((r) => (
            <React.Fragment key={r.resourceId}>
              <tr
                onClick={() =>
                  r.changedFields.length > 0 &&
                  setExpandedId(expandedId === r.resourceId ? null : r.resourceId)
                }
                style={{
                  cursor: r.changedFields.length > 0 ? 'pointer' : 'default',
                  borderLeft: `3px solid ${color}`,
                }}
              >
                <td>
                  <strong>{r.name}</strong>
                  <div className="text-secondary text-sm" style={{ wordBreak: 'break-all' }}>
                    {r.resourceId}
                  </div>
                </td>
                <td>{r.service}</td>
                <td>{r.region}</td>
                {label === 'Changed' && (
                  <td>
                    <span className="badge badge-warning">
                      {r.changedFields.length} field{r.changedFields.length !== 1 ? 's' : ''}
                    </span>
                  </td>
                )}
              </tr>
              {expandedId === r.resourceId && r.changedFields.length > 0 && (
                <tr>
                  <td colSpan={label === 'Changed' ? 4 : 3} style={{ padding: 0 }}>
                    <div style={{
                      backgroundColor: 'var(--color-bg-secondary)',
                      padding: 12,
                      margin: 0,
                    }}>
                      <table style={{ width: '100%', fontSize: 12 }}>
                        <thead>
                          <tr>
                            <th style={{ textAlign: 'left', padding: '4px 8px' }}>Field</th>
                            <th style={{ textAlign: 'left', padding: '4px 8px' }}>Before</th>
                            <th style={{ textAlign: 'left', padding: '4px 8px' }}>After</th>
                          </tr>
                        </thead>
                        <tbody>
                          {r.changedFields.map((cf) => (
                            <tr key={cf.field}>
                              <td style={{ padding: '4px 8px', fontFamily: 'monospace' }}>{cf.field}</td>
                              <td style={{
                                padding: '4px 8px',
                                color: 'var(--color-error)',
                                maxWidth: 200,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}>
                                {JSON.stringify(cf.oldValue) ?? 'undefined'}
                              </td>
                              <td style={{
                                padding: '4px 8px',
                                color: 'var(--color-success)',
                                maxWidth: 200,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}>
                                {JSON.stringify(cf.newValue) ?? 'undefined'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const ComparisonPage: React.FC = () => {
  const { scans, loadScans } = useScanStore();
  const selectedProfileName = useProfileStore((s) => s.selectedProfileName);
  const selectedProvider = useProviderStore((s) => s.selectedProvider) as CloudProvider;
  const selectedProjectId = useGCPProjectStore((s) => s.selectedProjectId);
  const activeIdentity = selectedProvider === 'gcp' ? selectedProjectId : selectedProfileName;
  const { result, isLoading, error, diffScans, clearError } = useComparisonStore();
  const [scanIdA, setScanIdA] = useState('');
  const [scanIdB, setScanIdB] = useState('');
  const [activeTab, setActiveTab] = useState<ViewTab>('summary');

  useEffect(() => {
    loadScans(selectedProvider);
  }, [loadScans, selectedProvider]);

  const completedScans = scans
    .filter((s) => s.status === 'completed')
    .filter((s) => !activeIdentity || s.profile === activeIdentity);

  const handleCompare = () => {
    if (scanIdA && scanIdB && scanIdA !== scanIdB) {
      diffScans(scanIdA, scanIdB);
      setActiveTab('summary');
    }
  };

  const tabs: { id: ViewTab; label: string; count?: number; color: string }[] = [
    { id: 'summary', label: 'Summary', color: '' },
    { id: 'added', label: 'Added', count: result?.summary.addedCount, color: 'var(--color-success)' },
    { id: 'removed', label: 'Removed', count: result?.summary.removedCount, color: 'var(--color-error)' },
    { id: 'changed', label: 'Changed', count: result?.summary.changedCount, color: 'var(--color-warning)' },
  ];

  return (
    <>
      <header className="page-header">
        <h1 className="page-title">Scan Comparison</h1>
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

        {/* Scan selectors */}
        <div className="card mb-4">
          <h3 className="card-title mb-4">Compare Scans</h3>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
            <div>
              <label className="form-label text-sm">Baseline (Before)</label>
              <select
                className="form-select"
                value={scanIdA}
                onChange={(e) => setScanIdA(e.target.value)}
                style={{ minWidth: 300 }}
              >
                <option value="">Select scan A...</option>
                {completedScans.map((scan) => (
                  <option key={scan.id} value={scan.id} disabled={scan.id === scanIdB}>
                    {scan.profile} - {new Date(scan.startedAt).toLocaleString()} ({scan.resourceCount} resources)
                  </option>
                ))}
              </select>
            </div>
            <div style={{ fontSize: 20, paddingTop: 20, color: 'var(--color-text-secondary)' }}>
              vs
            </div>
            <div>
              <label className="form-label text-sm">Current (After)</label>
              <select
                className="form-select"
                value={scanIdB}
                onChange={(e) => setScanIdB(e.target.value)}
                style={{ minWidth: 300 }}
              >
                <option value="">Select scan B...</option>
                {completedScans.map((scan) => (
                  <option key={scan.id} value={scan.id} disabled={scan.id === scanIdA}>
                    {scan.profile} - {new Date(scan.startedAt).toLocaleString()} ({scan.resourceCount} resources)
                  </option>
                ))}
              </select>
            </div>
            <div style={{ paddingTop: 20 }}>
              <button
                className="btn btn-primary"
                onClick={handleCompare}
                disabled={!scanIdA || !scanIdB || scanIdA === scanIdB || isLoading}
              >
                {isLoading ? (
                  <>
                    <div className="spinner" style={{ width: 16, height: 16 }} />
                    Comparing...
                  </>
                ) : (
                  'Compare'
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Results */}
        {result && (
          <>
            {/* Export */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
              <ExportCSVButton
                data={[
                  ...result.added.map((r) => ({ status: 'Added', name: r.name, resourceId: r.resourceId, service: r.service, region: r.region, changes: '' })),
                  ...result.removed.map((r) => ({ status: 'Removed', name: r.name, resourceId: r.resourceId, service: r.service, region: r.region, changes: '' })),
                  ...result.changed.map((r) => ({ status: 'Changed', name: r.name, resourceId: r.resourceId, service: r.service, region: r.region, changes: r.changedFields.map((f) => f.field).join('; ') })),
                ]}
                columns={[
                  { key: 'status', label: 'Diff Status' },
                  { key: 'name', label: 'Name' },
                  { key: 'resourceId', label: 'Resource ID' },
                  { key: 'service', label: 'Service' },
                  { key: 'region', label: 'Region' },
                  { key: 'changes', label: 'Changed Fields' },
                ]}
                filename="scan-comparison"
                label="Export Diff CSV"
              />
            </div>

            {/* Summary stats */}
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-value" style={{ color: 'var(--color-success)' }}>
                  {result.summary.addedCount}
                </div>
                <div className="stat-label">Added</div>
              </div>
              <div className="stat-card">
                <div className="stat-value" style={{ color: 'var(--color-error)' }}>
                  {result.summary.removedCount}
                </div>
                <div className="stat-label">Removed</div>
              </div>
              <div className="stat-card">
                <div className="stat-value" style={{ color: 'var(--color-warning)' }}>
                  {result.summary.changedCount}
                </div>
                <div className="stat-label">Changed</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">
                  {result.summary.unchangedCount}
                </div>
                <div className="stat-label">Unchanged</div>
              </div>
            </div>

            {/* Tabs */}
            <div className="card">
              <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--color-border)', marginBottom: 16 }}>
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    style={{
                      padding: '10px 20px',
                      background: 'none',
                      border: 'none',
                      borderBottom: activeTab === tab.id ? '2px solid var(--color-primary)' : '2px solid transparent',
                      color: activeTab === tab.id ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                      cursor: 'pointer',
                      fontSize: 14,
                      fontWeight: activeTab === tab.id ? 600 : 400,
                    }}
                  >
                    {tab.label}
                    {tab.count !== undefined && (
                      <span style={{
                        marginLeft: 6,
                        backgroundColor: tab.color || 'var(--color-bg-secondary)',
                        color: tab.color ? 'white' : undefined,
                        padding: '2px 6px',
                        borderRadius: 10,
                        fontSize: 11,
                      }}>
                        {tab.count}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {activeTab === 'summary' && (
                <div>
                  <p className="text-secondary" style={{ marginBottom: 16 }}>
                    Scan A: {result.summary.totalA} resources | Scan B: {result.summary.totalB} resources |
                    Net change: {result.summary.totalB - result.summary.totalA >= 0 ? '+' : ''}{result.summary.totalB - result.summary.totalA}
                  </p>

                  {/* Quick breakdown by type */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                    <div
                      style={{
                        padding: 12,
                        borderRadius: 8,
                        border: '1px solid var(--color-success)',
                        backgroundColor: 'rgba(52, 199, 89, 0.05)',
                      }}
                    >
                      <h4 style={{ color: 'var(--color-success)', marginBottom: 4 }}>
                        +{result.summary.addedCount} Added
                      </h4>
                      <p className="text-secondary text-sm">New resources in scan B</p>
                    </div>
                    <div
                      style={{
                        padding: 12,
                        borderRadius: 8,
                        border: '1px solid var(--color-error)',
                        backgroundColor: 'rgba(255, 59, 48, 0.05)',
                      }}
                    >
                      <h4 style={{ color: 'var(--color-error)', marginBottom: 4 }}>
                        -{result.summary.removedCount} Removed
                      </h4>
                      <p className="text-secondary text-sm">Resources no longer present</p>
                    </div>
                    <div
                      style={{
                        padding: 12,
                        borderRadius: 8,
                        border: '1px solid var(--color-warning)',
                        backgroundColor: 'rgba(255, 159, 10, 0.05)',
                      }}
                    >
                      <h4 style={{ color: 'var(--color-warning)', marginBottom: 4 }}>
                        ~{result.summary.changedCount} Changed
                      </h4>
                      <p className="text-secondary text-sm">Resources with modified properties</p>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'added' && (
                <DiffResourceTable
                  resources={result.added}
                  label="Added"
                  color="var(--color-success)"
                />
              )}

              {activeTab === 'removed' && (
                <DiffResourceTable
                  resources={result.removed}
                  label="Removed"
                  color="var(--color-error)"
                />
              )}

              {activeTab === 'changed' && (
                <DiffResourceTable
                  resources={result.changed}
                  label="Changed"
                  color="var(--color-warning)"
                />
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
};

export default ComparisonPage;

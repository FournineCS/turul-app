// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React, { useState, useEffect, useCallback } from 'react';
import { useGCPProjectStore } from '../stores/gcpProjectStore';
import { useCostStore } from '../stores/costStore';
import { useGCPOptimizationStore } from '../stores/gcpOptimizationStore';
import { GCPRecommendationsPanel } from '../components/costs/GCPRecommendationsPanel';
import { IdleResourcePanel } from '../components/costs/IdleResourcePanel';
import GCPInsightsPanel from '../components/costs/GCPInsightsPanel';

type OptScope = 'project' | 'org';
type PageTab = 'live' | 'resources' | 'insights' | 'history';

const ScopeToggle: React.FC<{ value: OptScope; onChange: (s: OptScope) => void }> = ({ value, onChange }) => {
  const btnStyle = (active: boolean): React.CSSProperties => ({
    padding: '5px 14px',
    fontSize: 13,
    border: '1px solid var(--color-border)',
    background: active ? 'var(--color-primary)' : 'var(--color-bg-secondary)',
    color: active ? 'var(--color-bg)' : 'var(--color-text-secondary)',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  });
  return (
    <div style={{ display: 'inline-flex', borderRadius: 6, overflow: 'hidden' }}>
      <button style={{ ...btnStyle(value === 'project'), borderRadius: '6px 0 0 6px' }} onClick={() => onChange('project')}>
        Project
      </button>
      <button style={{ ...btnStyle(value === 'org'), borderRadius: '0 6px 6px 0', borderLeft: 'none' }} onClick={() => onChange('org')}>
        Organization
      </button>
    </div>
  );
};

const GCPOptimizationPage: React.FC = () => {
  const [scope, setScope] = useState<OptScope>('project');
  const [activeTab, setActiveTab] = useState<PageTab>('live');
  const [isRunning, setIsRunning] = useState(false);

  const { selectedProjectId, selectedOrgId } = useGCPProjectStore();
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  const {
    refreshGCPRecommendations,
    refreshGCPOrgRecommendations,
    gcpExpandedRecsLoading,
    gcpOrgExpandedRecsLoading,
    gcpStoppedVMsLoading,
    gcpOrgStoppedVMsLoading,
    gcpExpandedRecs,
    gcpStoppedVMs,
  } = useCostStore();
  const {
    resourceFindings,
    resourceFindingsLoading,
    resourceFindingsError,
    snapshots,
    snapshotsLoading,
    selectedSnapshot,
    runResourceAnalysis,
    loadHistory,
    viewSnapshot,
    clearSelectedSnapshot,
    deleteSnapshot,
    saveCurrentSnapshot,
  } = useGCPOptimizationStore();

  const identity = scope === 'project' ? selectedProjectId : selectedOrgId;
  const noIdentity = !identity;

  // Load history when identity or scope changes
  useEffect(() => {
    if (identity) loadHistory(identity);
  }, [identity]);

  const handleRunFullScan = async () => {
    if (!identity || isRunning) return;
    setIsRunning(true);
    try {
      // Run both API-based recommendations and resource-based idle detection in parallel
      const apiPromise = scope === 'org'
        ? refreshGCPOrgRecommendations(identity)
        : refreshGCPRecommendations(identity);
      const resourcePromise = runResourceAnalysis(identity);
      await Promise.allSettled([apiPromise, resourcePromise]);
      // Auto-save snapshot
      await saveCurrentSnapshot(identity, scope);
      // Reload history
      await loadHistory(identity);
    } finally {
      setIsRunning(false);
    }
  };

  const handleViewSnapshot = async (id: string) => {
    await viewSnapshot(id);
    setActiveTab('live');
  };

  const viewingSnapshot = !!selectedSnapshot;
  const exportLabel = `${identity ?? 'gcp'}-${new Date().toISOString().split('T')[0]}`;

  // Use snapshot data when viewing history, otherwise live store data
  const exportRecs = viewingSnapshot ? (selectedSnapshot?.expandedRecs ?? null) : gcpExpandedRecs;
  const exportVMs = viewingSnapshot ? (selectedSnapshot?.stoppedVMs ?? null) : gcpStoppedVMs;
  const exportIdle = viewingSnapshot ? (selectedSnapshot?.resourceFindings ?? null) : resourceFindings;
  const hasExportData = !!(exportRecs || exportVMs || exportIdle);

  const handleExportExcel = useCallback(async () => {
    if (!window.electronAPI?.gcp?.optimization?.exportExcel || !hasExportData) return;
    setExportingExcel(true);
    try {
      await window.electronAPI.gcp.optimization.exportExcel(
        { recs: exportRecs, vms: exportVMs, idle: exportIdle },
        exportLabel,
      );
    } finally {
      setExportingExcel(false);
    }
  }, [exportRecs, exportVMs, exportIdle, exportLabel, hasExportData]);

  const handleExportPdf = useCallback(async () => {
    if (!window.electronAPI?.gcp?.optimization?.exportPdf || !hasExportData) return;
    setExportingPdf(true);
    try {
      await window.electronAPI.gcp.optimization.exportPdf(
        { recs: exportRecs, vms: exportVMs, idle: exportIdle },
        exportLabel,
      );
    } finally {
      setExportingPdf(false);
    }
  }, [exportRecs, exportVMs, exportIdle, exportLabel, hasExportData]);

  const isApiLoading = scope === 'org'
    ? (gcpOrgExpandedRecsLoading || gcpOrgStoppedVMsLoading)
    : (gcpExpandedRecsLoading || gcpStoppedVMsLoading);

  const isBusy = isRunning || isApiLoading || resourceFindingsLoading;

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
      {/* Sticky header — outside page-content so it doesn't scroll */}
      <header className="page-header" style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <h1 className="page-title" style={{ margin: 0, flex: 1 }}>GCP Optimization</h1>
        <ScopeToggle value={scope} onChange={(s) => { setScope(s); clearSelectedSnapshot(); }} />
        {!noIdentity && (
          <div style={{ display: 'flex', gap: 8 }}>
            {viewingSnapshot && (
              <button className="btn btn-secondary btn-sm" onClick={clearSelectedSnapshot}>
                ← Live Results
              </button>
            )}
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleExportExcel}
              disabled={!hasExportData || exportingExcel}
              title="Export to Excel"
              style={{ color: hasExportData ? 'var(--color-success)' : undefined }}
            >
              {exportingExcel ? 'Exporting…' : 'Excel'}
            </button>
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleExportPdf}
              disabled={!hasExportData || exportingPdf}
              title="Export to PDF"
              style={{ color: hasExportData ? 'var(--color-error)' : undefined }}
            >
              {exportingPdf ? 'Exporting…' : 'PDF'}
            </button>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleRunFullScan}
              disabled={isBusy || noIdentity}
            >
              {isBusy ? 'Scanning…' : '▶ Run Scan'}
            </button>
          </div>
        )}
      </header>

      <div className="page-content">

      {viewingSnapshot && (
        <div
          style={{
            padding: '8px 14px',
            marginBottom: 12,
            backgroundColor: 'var(--color-primary-glow)',
            border: '1px solid var(--color-primary)',
            borderRadius: 6,
            fontSize: 12,
            color: 'var(--color-text-secondary)',
          }}
        >
          Viewing historical snapshot from {new Date(selectedSnapshot!.scannedAt).toLocaleString()}
        </div>
      )}

      {noIdentity ? (
        <div
          style={{
            backgroundColor: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            padding: 40,
            textAlign: 'center',
          }}
        >
          <h3 style={{ margin: '0 0 8px', color: 'var(--color-text)' }}>
            {scope === 'project' ? 'No GCP Project Selected' : 'No GCP Organization Selected'}
          </h3>
          <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
            {scope === 'project'
              ? 'Select a GCP project from the top bar to view optimization recommendations.'
              : 'Select a GCP organization from the top bar to view org-wide recommendations.'}
          </p>
        </div>
      ) : (
        <>
          {/* Tabs */}
          <div
            style={{
              display: 'flex',
              gap: 0,
              borderBottom: '2px solid var(--color-border)',
              marginBottom: 20,
            }}
          >
            <button style={tabStyle(activeTab === 'live')} onClick={() => setActiveTab('live')}>
              Live Results
            </button>
            <button style={tabStyle(activeTab === 'resources')} onClick={() => setActiveTab('resources')}>
              Resource Analysis
              {resourceFindings && resourceFindings.totalFindings > 0 && (
                <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.8 }}>
                  ({resourceFindings.totalFindings})
                </span>
              )}
            </button>
            {scope === 'project' && (
              <button style={tabStyle(activeTab === 'insights')} onClick={() => setActiveTab('insights')}>
                Insights
              </button>
            )}
            <button style={tabStyle(activeTab === 'history')} onClick={() => setActiveTab('history')}>
              History
              {snapshots.length > 0 && (
                <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.8 }}>({snapshots.length})</span>
              )}
            </button>
          </div>

          {/* Tab content */}
          {activeTab === 'live' && (
            <GCPRecommendationsPanel
              scope={scope}
              orgId={scope === 'org' ? (selectedOrgId ?? undefined) : undefined}
              overrideSnapshot={viewingSnapshot ? selectedSnapshot ?? undefined : undefined}
            />
          )}

          {activeTab === 'resources' && (
            <div
              style={{
                backgroundColor: 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border)',
                borderRadius: 8,
                padding: 20,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 16 }}>Idle Resource Detection</h3>
                <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                  Uses local scan data — no API calls
                </span>
              </div>
              <IdleResourcePanel
                data={viewingSnapshot ? (selectedSnapshot?.resourceFindings ?? null) : resourceFindings}
                isLoading={resourceFindingsLoading}
                error={resourceFindingsError}
              />
            </div>
          )}

          {activeTab === 'insights' && scope === 'project' && (
            <div
              style={{
                backgroundColor: 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border)',
                borderRadius: 8,
                padding: 20,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ margin: 0, fontSize: 16 }}>Diagnostic Insights</h3>
                <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                  Cloud SQL utilization · BigQuery table stats · project utilization
                </span>
              </div>
              <GCPInsightsPanel projectId={selectedProjectId} />
            </div>
          )}

          {activeTab === 'history' && (
            <div
              style={{
                backgroundColor: 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border)',
                borderRadius: 8,
                padding: 20,
              }}
            >
              <h3 style={{ margin: '0 0 16px', fontSize: 16 }}>Scan History</h3>
              {snapshotsLoading ? (
                <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: 13 }}>
                  Loading history…
                </div>
              ) : snapshots.length === 0 ? (
                <div style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: 13 }}>
                  No scan history yet. Click <strong>Run Scan</strong> to save your first snapshot.
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                      {['Date', 'Scope', 'Recommendations', 'Stopped VMs', 'Idle Resources', 'Est. Savings', 'Actions'].map((h) => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--color-text-secondary)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {snapshots.map((snap) => (
                      <tr
                        key={snap.id}
                        style={{
                          borderBottom: '1px solid var(--color-border)',
                          backgroundColor: selectedSnapshot?.id === snap.id ? 'var(--color-primary-glow)' : 'transparent',
                        }}
                      >
                        <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                          {new Date(snap.scannedAt).toLocaleString()}
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{
                            padding: '2px 8px',
                            borderRadius: 10,
                            fontSize: 11,
                            fontWeight: 600,
                            backgroundColor: snap.scope === 'org' ? 'var(--color-info-glow, rgba(139, 92, 246, 0.1))' : 'var(--color-primary-glow)',
                            color: snap.scope === 'org' ? 'var(--color-info)' : 'var(--color-primary)',
                          }}>
                            {snap.scope === 'org' ? 'Org' : 'Project'}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px' }}>{snap.recCount}</td>
                        <td style={{ padding: '8px 12px' }}>{snap.vmCount}</td>
                        <td style={{ padding: '8px 12px' }}>{snap.resourceFindingsCount}</td>
                        <td style={{ padding: '8px 12px', fontWeight: 600, color: 'var(--color-error)' }}>
                          ${snap.totalSavings.toFixed(2)}
                        </td>
                        <td style={{ padding: '8px 12px' }}>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button className="btn btn-secondary btn-sm" onClick={() => handleViewSnapshot(snap.id)}>
                              View
                            </button>
                            <button className="btn btn-danger btn-sm" onClick={() => deleteSnapshot(snap.id, identity!)}>
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      )}
    </div>
    </>
  );
};

export default GCPOptimizationPage;

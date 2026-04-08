// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React, { useEffect } from 'react';
import { useNetworkAnalysisStore } from '../stores/networkAnalysisStore';
import { useProfileStore } from '../stores/profileStore';
import { useProviderStore } from '../stores/providerStore';
import { useGCPProjectStore } from '../stores/gcpProjectStore';

const severityColor = (severity: string) => {
  switch (severity) {
    case 'CRITICAL': return 'var(--color-error)';
    case 'HIGH': return 'var(--color-warning)';
    case 'MEDIUM': return 'var(--color-info)';
    default: return 'var(--color-text-secondary)';
  }
};

const severityBadge = (severity: string) => {
  const classMap: Record<string, string> = {
    CRITICAL: 'badge-error',
    HIGH: 'badge-warning',
    MEDIUM: 'badge-info',
    LOW: 'badge-success',
  };
  return `badge ${classMap[severity] || 'badge-info'}`;
};

const NetworkAnalysisPage: React.FC = () => {
  const selectedProvider = useProviderStore((s) => s.selectedProvider);
  const selectedProjectId = useGCPProjectStore((s) => s.selectedProjectId);
  const selectedProfile = useProfileStore((s) => s.selectedProfileName);
  const {
    gcpResult, gcpHistory, isLoading, error,
    runGCPAnalysis, loadGCPHistory, loadGCPAnalysisById, clearError,
    awsHistory, loadAWSHistory, loadAWSScanById,
  } = useNetworkAnalysisStore();

  // Subscribe to AWS network completed event
  useEffect(() => {
    if (selectedProvider !== 'aws') return;
    if (!window.electronAPI?.network?.onCompleted) return;
    const unsubscribe = window.electronAPI.network.onCompleted((result: any) => {
      useNetworkAnalysisStore.setState({ isLoading: false });
      if (selectedProfile) loadAWSHistory(selectedProfile);
    });
    return () => unsubscribe();
  }, [selectedProvider, selectedProfile, loadAWSHistory]);

  // Subscribe to AWS network failed event
  useEffect(() => {
    if (selectedProvider !== 'aws') return;
    if (!window.electronAPI?.network?.onFailed) return;
    const unsubscribe = window.electronAPI.network.onFailed(({ error: err }: { error: string }) => {
      useNetworkAnalysisStore.setState({ error: err, isLoading: false });
    });
    return () => unsubscribe();
  }, [selectedProvider]);

  // Load AWS history when profile changes
  useEffect(() => {
    if (selectedProvider === 'aws' && selectedProfile) {
      loadAWSHistory(selectedProfile);
    }
  }, [selectedProvider, selectedProfile, loadAWSHistory]);

  // Navigation persistence — auto-load most recent AWS result
  useEffect(() => {
    if (selectedProvider === 'aws' && !isLoading && awsHistory.length > 0) {
      loadAWSScanById(awsHistory[0].id);
    }
  }, [selectedProvider, isLoading, awsHistory, loadAWSScanById]);

  // Subscribe to GCP completed event
  useEffect(() => {
    if (!window.electronAPI?.gcp?.network?.onCompleted) return;
    const unsubscribe = window.electronAPI.gcp.network.onCompleted((result) => {
      useNetworkAnalysisStore.setState({ gcpResult: result, isLoading: false });
      if (selectedProjectId) loadGCPHistory(selectedProjectId);
    });
    return () => unsubscribe();
  }, [selectedProjectId, loadGCPHistory]);

  // Subscribe to failed event
  useEffect(() => {
    if (!window.electronAPI?.gcp?.network?.onFailed) return;
    const unsubscribe = window.electronAPI.gcp.network.onFailed(({ error: err }) => {
      useNetworkAnalysisStore.setState({ error: err, isLoading: false });
    });
    return () => unsubscribe();
  }, []);

  // Clear stale data + load history on project change
  useEffect(() => {
    if (selectedProvider === 'gcp' && selectedProjectId) {
      if (gcpResult && gcpResult.projectId !== selectedProjectId) {
        useNetworkAnalysisStore.setState({ gcpResult: null });
      }
      loadGCPHistory(selectedProjectId);
    }
  }, [selectedProvider, selectedProjectId, loadGCPHistory]); // eslint-disable-line react-hooks/exhaustive-deps

  // Navigation persistence — auto-load most recent result
  useEffect(() => {
    if (selectedProvider === 'gcp' && !gcpResult && !isLoading && gcpHistory.length > 0) {
      loadGCPAnalysisById(gcpHistory[0].id);
    }
  }, [selectedProvider, gcpResult, isLoading, gcpHistory, loadGCPAnalysisById]);

  const handleRun = () => {
    if (selectedProjectId) {
      runGCPAnalysis(selectedProjectId);
    }
  };

  return (
    <>
      <header className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h1 className="page-title">Network Analysis</h1>
            <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: 12, fontSize: 12, fontWeight: 600, backgroundColor: 'var(--color-primary-glow)', color: 'var(--color-primary)' }}>Google Cloud</span>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {gcpHistory.length > 0 && (
              <select
                className="global-profile-select"
                value={gcpResult?.id || ''}
                onChange={(e) => e.target.value && loadGCPAnalysisById(e.target.value)}
                style={{ minWidth: 260, fontSize: 12 }}
              >
                <option value="" disabled>Past analyses ({gcpHistory.length})...</option>
                {gcpHistory.map((h) => (
                  <option key={h.id} value={h.id}>
                    {new Date(h.analyzedAt).toLocaleString()} — {h.totalFindings} findings
                  </option>
                ))}
              </select>
            )}
            {selectedProvider === 'aws' && awsHistory.length > 0 && (
              <select
                className="global-profile-select"
                value=""
                onChange={(e) => e.target.value && loadAWSScanById(e.target.value)}
                style={{ minWidth: 260, fontSize: 12 }}
              >
                <option value="" disabled>Past analyses ({awsHistory.length})...</option>
                {awsHistory.map((h: any) => (
                  <option key={h.id} value={h.id}>
                    {new Date(h.analyzedAt).toLocaleString()} — {h.totalFindings} findings
                  </option>
                ))}
              </select>
            )}
            <button
              className="btn btn-primary"
              onClick={handleRun}
              disabled={!selectedProjectId || isLoading}
            >
              {isLoading ? 'Analyzing...' : 'Run Analysis'}
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

        {/* Loading overlay */}
        {isLoading && !gcpResult && (
          <div className="loading-overlay">
            <div className="spinner" />
            <p>Analyzing network configuration...</p>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !gcpResult && gcpHistory.length === 0 && (
          <div className="empty-state">
            <h3>No network analysis yet</h3>
            <p>Run a network analysis to discover firewall issues, exposed resources, and VPC configuration problems.</p>
            {!selectedProjectId && (
              <p className="text-secondary text-sm">Select a GCP project first.</p>
            )}
          </div>
        )}

        {/* Results */}
        {gcpResult && (
          <>
            {/* Summary stats */}
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-value">{gcpResult.totalNetworks}</div>
                <div className="stat-label">VPC Networks</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{gcpResult.totalFirewallRules}</div>
                <div className="stat-label">Firewall Rules</div>
              </div>
              <div className="stat-card">
                <div className="stat-value" style={{ color: 'var(--color-error)' }}>{gcpResult.criticalCount}</div>
                <div className="stat-label">Critical</div>
              </div>
              <div className="stat-card">
                <div className="stat-value" style={{ color: 'var(--color-warning)' }}>{gcpResult.highCount}</div>
                <div className="stat-label">High</div>
              </div>
              <div className="stat-card">
                <div className="stat-value" style={{ color: 'var(--color-info)' }}>{gcpResult.mediumCount}</div>
                <div className="stat-label">Medium</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{gcpResult.lowCount}</div>
                <div className="stat-label">Low</div>
              </div>
            </div>

            {/* Firewall Findings */}
            {gcpResult.firewallFindings.length > 0 && (
              <div className="card mb-4">
                <h3 className="card-title mb-4">Firewall Findings ({gcpResult.firewallFindings.length})</h3>
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Rule Name</th>
                        <th>Network</th>
                        <th>Direction</th>
                        <th>Source Ranges</th>
                        <th>Severity</th>
                        <th>Issue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gcpResult.firewallFindings.map((f, i) => (
                        <tr key={i}>
                          <td>
                            <strong>{f.ruleName}</strong>
                            {f.disabled && <span className="badge badge-warning" style={{ marginLeft: 6, fontSize: 10 }}>Disabled</span>}
                          </td>
                          <td>{f.network}</td>
                          <td>{f.direction}</td>
                          <td>
                            <span className="text-sm" style={{ fontFamily: 'var(--font-mono)', wordBreak: 'break-all' }}>
                              {f.sourceRanges.join(', ') || '—'}
                            </span>
                          </td>
                          <td><span className={severityBadge(f.severity)}>{f.severity}</span></td>
                          <td>{f.issue}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Exposed Resources */}
            {gcpResult.exposedResources.length > 0 && (
              <div className="card mb-4">
                <h3 className="card-title mb-4">Exposed Resources ({gcpResult.exposedResources.length})</h3>
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Type</th>
                        <th>Zone</th>
                        <th>External IP</th>
                        <th>Open Ports</th>
                        <th>Severity</th>
                        <th>Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gcpResult.exposedResources.map((r, i) => (
                        <tr key={i}>
                          <td><strong>{r.name}</strong></td>
                          <td>{r.resourceType}</td>
                          <td>{r.zone}</td>
                          <td>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13 }}>
                              {r.externalIp || '—'}
                            </span>
                          </td>
                          <td>
                            {r.openPorts.map((p, j) => (
                              <span key={j} className="badge badge-warning" style={{ marginRight: 4, marginBottom: 2, fontSize: 11 }}>
                                {p.protocol}:{p.port}
                              </span>
                            ))}
                          </td>
                          <td><span className={severityBadge(r.severity)}>{r.severity}</span></td>
                          <td>{r.exposureDetails}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* VPC Analysis */}
            {gcpResult.vpcAnalysis.length > 0 && (
              <div className="card mb-4">
                <h3 className="card-title mb-4">VPC Networks ({gcpResult.vpcAnalysis.length})</h3>
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Network</th>
                        <th>Mode</th>
                        <th>Subnets</th>
                        <th>Peering</th>
                        <th>Properties</th>
                      </tr>
                    </thead>
                    <tbody>
                      {gcpResult.vpcAnalysis.map((vpc, i) => (
                        <tr key={i}>
                          <td><strong>{vpc.networkName}</strong></td>
                          <td>{vpc.networkMode}</td>
                          <td>{vpc.subnetCount}</td>
                          <td>{vpc.peeringConnections.length}</td>
                          <td>
                            {vpc.isDefault && <span className="badge badge-warning" style={{ marginRight: 4, fontSize: 11 }}>Default</span>}
                            {vpc.isSharedVpc && <span className="badge badge-info" style={{ marginRight: 4, fontSize: 11 }}>Shared VPC</span>}
                            {vpc.privateGoogleAccess && <span className="badge badge-success" style={{ marginRight: 4, fontSize: 11 }}>Private Access</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Errors */}
            {gcpResult.errors.length > 0 && (
              <div className="card mb-4" style={{ borderColor: 'var(--color-warning)' }}>
                <h3 className="card-title mb-4">Analysis Warnings</h3>
                {gcpResult.errors.map((err, i) => (
                  <p key={i} className="text-secondary text-sm" style={{ marginBottom: 4 }}>{err}</p>
                ))}
              </div>
            )}

            <p className="text-secondary text-sm" style={{ marginTop: 12 }}>
              Analyzed at {new Date(gcpResult.analyzedAt).toLocaleString()} | Project: {gcpResult.projectId}
            </p>
          </>
        )}
      </div>
    </>
  );
};

export default NetworkAnalysisPage;

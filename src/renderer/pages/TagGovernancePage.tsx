// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React, { useEffect, useState } from 'react';
import { useTagGovernanceStore } from '../stores/tagGovernanceStore';
import { useScanStore } from '../stores/scanStore';
import { useProviderStore } from '../stores/providerStore';
import { useProfileStore } from '../stores/profileStore';
import { useGCPProjectStore } from '../stores/gcpProjectStore';
import RequiredTagsConfig from '../components/tag-governance/RequiredTagsConfig';
import TagComplianceReport from '../components/tag-governance/TagComplianceReport';
import TagCoverageHeatmap from '../components/tag-governance/TagCoverageHeatmap';
import UntaggedResourcesList from '../components/tag-governance/UntaggedResourcesList';
import ExportCSVButton from '../components/ExportCSVButton';

const TagGovernancePage: React.FC = () => {
  const selectedProvider = useProviderStore((s) => s.selectedProvider);
  const selectedProfileName = useProfileStore((s) => s.selectedProfileName);
  const selectedProjectId = useGCPProjectStore((s) => s.selectedProjectId);
  const {
    config, compliance, isLoading, isSaving, error,
    loadConfig, saveConfig, loadCompliance, clearError,
    gcpConfig, gcpCompliance, loadGCPConfig, saveGCPConfig, checkGCPCompliance,
    gcpHistory, loadGCPHistory, loadGCPComplianceById,
  } = useTagGovernanceStore();
  const { scans, loadScans } = useScanStore();
  const [selectedScanId, setSelectedScanId] = useState<string>('');
  const [gcpLabelInput, setGcpLabelInput] = useState('');

  useEffect(() => {
    if (selectedProvider === 'gcp') {
      loadGCPConfig();
    } else {
      loadConfig();
      loadScans();
    }
    setSelectedScanId('');
  }, [selectedProvider, selectedProfileName, loadConfig, loadScans, loadGCPConfig]);

  const completedScans = scans.filter((s) => s.status === 'completed').filter((s) => !selectedProfileName || s.profile === selectedProfileName);

  useEffect(() => {
    if (completedScans.length > 0 && !selectedScanId) {
      setSelectedScanId(completedScans[0].id);
    }
  }, [completedScans, selectedScanId]);

  // GCP: Subscribe to completed event
  useEffect(() => {
    if (!window.electronAPI?.gcp?.labels?.onCompleted) return;
    const unsubscribe = window.electronAPI.gcp.labels.onCompleted((result) => {
      useTagGovernanceStore.setState({ gcpCompliance: result, isLoading: false });
      if (selectedProjectId) loadGCPHistory(selectedProjectId);
    });
    return () => unsubscribe();
  }, [selectedProjectId, loadGCPHistory]);

  // GCP: Subscribe to failed event
  useEffect(() => {
    if (!window.electronAPI?.gcp?.labels?.onFailed) return;
    const unsubscribe = window.electronAPI.gcp.labels.onFailed(({ error: err }) => {
      useTagGovernanceStore.setState({ error: err, isLoading: false });
    });
    return () => unsubscribe();
  }, []);

  // GCP: Clear stale data + load history on project change
  useEffect(() => {
    if (selectedProvider === 'gcp' && selectedProjectId) {
      if (gcpCompliance && gcpCompliance.projectId !== selectedProjectId) {
        useTagGovernanceStore.setState({ gcpCompliance: null });
      }
      loadGCPHistory(selectedProjectId);
    }
  }, [selectedProvider, selectedProjectId, loadGCPHistory]); // eslint-disable-line react-hooks/exhaustive-deps

  // GCP: Navigation persistence — auto-load most recent result
  useEffect(() => {
    if (selectedProvider === 'gcp' && !gcpCompliance && !isLoading && gcpHistory.length > 0) {
      loadGCPComplianceById(gcpHistory[0].id);
    }
  }, [selectedProvider, gcpCompliance, isLoading, gcpHistory, loadGCPComplianceById]);

  const handleRunCompliance = () => {
    if (selectedScanId) {
      loadCompliance(selectedScanId);
    }
  };

  if (selectedProvider === 'gcp') {
    const handleAddLabel = () => {
      const label = gcpLabelInput.trim().toLowerCase();
      if (label && !(gcpConfig?.requiredLabels || []).includes(label)) {
        saveGCPConfig([...(gcpConfig?.requiredLabels || []), label]);
      }
      setGcpLabelInput('');
    };

    const handleRemoveLabel = (label: string) => {
      saveGCPConfig((gcpConfig?.requiredLabels || []).filter(l => l !== label));
    };

    const handleCheckCompliance = () => {
      if (selectedProjectId) {
        checkGCPCompliance(selectedProjectId);
      }
    };

    return (
      <>
        <header className="page-header">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <h1 className="page-title">Label Governance</h1>
              <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: 12, fontSize: 12, fontWeight: 600, backgroundColor: 'var(--color-primary-glow)', color: 'var(--color-primary)' }}>Google Cloud</span>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              {gcpHistory.length > 0 && (
                <select
                  className="global-profile-select"
                  value={gcpCompliance?.id || ''}
                  onChange={(e) => e.target.value && loadGCPComplianceById(e.target.value)}
                  style={{ minWidth: 260, fontSize: 12 }}
                >
                  <option value="" disabled>Past checks ({gcpHistory.length})...</option>
                  {gcpHistory.map((h) => (
                    <option key={h.id} value={h.id}>
                      {new Date(h.analyzedAt).toLocaleString()} — {h.overallCompliancePercent}% compliant
                    </option>
                  ))}
                </select>
              )}
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
          {isLoading && !gcpCompliance && (
            <div className="loading-overlay">
              <div className="spinner" />
              <p>Checking label compliance...</p>
            </div>
          )}

          {/* Required Labels Config */}
          <div className="card mb-4">
            <h3 className="card-title mb-4">Required Labels</h3>
            <p className="text-secondary text-sm" style={{ marginBottom: 16 }}>
              Define labels that all GCP resources should have. Resources missing these labels will be flagged as non-compliant.
            </p>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input
                className="input"
                type="text"
                placeholder="e.g., env, team, cost-center"
                value={gcpLabelInput}
                onChange={(e) => setGcpLabelInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddLabel()}
                style={{ flex: 1, maxWidth: 300 }}
              />
              <button className="btn btn-secondary" onClick={handleAddLabel} disabled={isSaving}>Add</button>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {(gcpConfig?.requiredLabels || []).map((label) => (
                <span key={label} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '4px 12px', borderRadius: 16,
                  backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)',
                  fontSize: 13,
                }}>
                  {label}
                  <button onClick={() => handleRemoveLabel(label)} style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--color-text-secondary)', fontSize: 16, padding: 0, lineHeight: 1,
                  }}>&times;</button>
                </span>
              ))}
              {(gcpConfig?.requiredLabels || []).length === 0 && (
                <span className="text-secondary text-sm">No required labels configured yet.</span>
              )}
            </div>
          </div>

          {/* Run Compliance */}
          <div className="card mb-4">
            <h3 className="card-title mb-4">Check Label Compliance</h3>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <button
                className="btn btn-primary"
                onClick={handleCheckCompliance}
                disabled={!selectedProjectId || isLoading || !(gcpConfig?.requiredLabels?.length)}
              >
                {isLoading ? 'Analyzing...' : 'Check Compliance'}
              </button>
              {!selectedProjectId && <span className="text-secondary text-sm">Select a GCP project first.</span>}
            </div>
          </div>

          {/* Results */}
          {gcpCompliance && (
            <>
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-value">{gcpCompliance.totalResources}</div>
                  <div className="stat-label">Total Resources</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value" style={{
                    color: gcpCompliance.overallCompliancePercent >= 80 ? 'var(--color-success)' :
                           gcpCompliance.overallCompliancePercent >= 50 ? 'var(--color-warning)' : 'var(--color-error)',
                  }}>{gcpCompliance.overallCompliancePercent}%</div>
                  <div className="stat-label">Overall Compliance</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value" style={{ color: 'var(--color-success)' }}>{gcpCompliance.fullyCompliantResources}</div>
                  <div className="stat-label">Fully Compliant</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value" style={{ color: 'var(--color-error)' }}>{gcpCompliance.unlabeledResources.length}</div>
                  <div className="stat-label">Non-Compliant</div>
                </div>
              </div>

              {/* Coverage by label key */}
              <div className="card mb-4">
                <h3 className="card-title mb-4">Label Coverage</h3>
                <div className="table-container">
                  <table className="table">
                    <thead><tr><th>Label Key</th><th>Coverage</th><th>Labeled</th><th>Total</th></tr></thead>
                    <tbody>
                      {gcpCompliance.byLabelKey.map((lk) => (
                        <tr key={lk.labelKey}>
                          <td><strong>{lk.labelKey}</strong></td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ width: 100, height: 6, backgroundColor: 'var(--color-bg-secondary)', borderRadius: 3, overflow: 'hidden' }}>
                                <div style={{
                                  width: `${lk.coveragePercent}%`, height: '100%', borderRadius: 3,
                                  backgroundColor: lk.coveragePercent >= 80 ? 'var(--color-success)' : lk.coveragePercent >= 50 ? 'var(--color-warning)' : 'var(--color-error)',
                                }} />
                              </div>
                              <span style={{ fontSize: 13, fontWeight: 600,
                                color: lk.coveragePercent >= 80 ? 'var(--color-success)' : lk.coveragePercent >= 50 ? 'var(--color-warning)' : 'var(--color-error)',
                              }}>{lk.coveragePercent}%</span>
                            </div>
                          </td>
                          <td>{lk.labeledResources}</td>
                          <td>{lk.totalResources}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Compliance by service */}
              <div className="card mb-4">
                <h3 className="card-title mb-4">Compliance by Service</h3>
                <div className="table-container">
                  <table className="table">
                    <thead><tr><th>Service</th><th>Compliance</th><th>Compliant</th><th>Total</th></tr></thead>
                    <tbody>
                      {gcpCompliance.byService.map((svc) => (
                        <tr key={svc.service}>
                          <td><strong>{svc.service}</strong></td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ width: 100, height: 6, backgroundColor: 'var(--color-bg-secondary)', borderRadius: 3, overflow: 'hidden' }}>
                                <div style={{
                                  width: `${svc.compliancePercent}%`, height: '100%', borderRadius: 3,
                                  backgroundColor: svc.compliancePercent >= 80 ? 'var(--color-success)' : svc.compliancePercent >= 50 ? 'var(--color-warning)' : 'var(--color-error)',
                                }} />
                              </div>
                              <span style={{ fontSize: 13, fontWeight: 600,
                                color: svc.compliancePercent >= 80 ? 'var(--color-success)' : svc.compliancePercent >= 50 ? 'var(--color-warning)' : 'var(--color-error)',
                              }}>{svc.compliancePercent}%</span>
                            </div>
                          </td>
                          <td>{svc.compliantResources}</td>
                          <td>{svc.totalResources}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Non-compliant resources */}
              {gcpCompliance.unlabeledResources.length > 0 && (
                <div className="card mb-4">
                  <h3 className="card-title mb-4">Non-Compliant Resources ({gcpCompliance.unlabeledResources.length})</h3>
                  <div className="table-container">
                    <table className="table">
                      <thead><tr><th>Name</th><th>Service</th><th>Region</th><th>Missing Labels</th></tr></thead>
                      <tbody>
                        {gcpCompliance.unlabeledResources.map((r) => (
                          <tr key={r.id}>
                            <td><strong>{r.name}</strong><div className="text-secondary text-sm" style={{ wordBreak: 'break-all' }}>{r.id}</div></td>
                            <td>{r.service}</td>
                            <td>{r.region}</td>
                            <td>
                              {r.missingLabels.map((l) => (
                                <span key={l} className="badge badge-error" style={{ marginRight: 4, fontSize: 11 }}>{l}</span>
                              ))}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <p className="text-secondary text-sm" style={{ marginTop: 12 }}>
                Analyzed at {new Date(gcpCompliance.analyzedAt).toLocaleString()} | Project: {gcpCompliance.projectId}
              </p>
            </>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <header className="page-header">
        <h1 className="page-title">Tag Governance</h1>
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

        <RequiredTagsConfig
          requiredTags={config?.requiredTags || []}
          isSaving={isSaving}
          onSave={saveConfig}
        />

        {/* Compliance Analysis */}
        <div className="card mb-4">
          <h3 className="card-title mb-4">Run Compliance Check</h3>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <select
              className="global-profile-select"
              style={{ minWidth: 300 }}
              value={selectedScanId}
              onChange={(e) => setSelectedScanId(e.target.value)}
            >
              <option value="">Select a scan...</option>
              {completedScans.map((scan) => (
                <option key={scan.id} value={scan.id}>
                  {scan.profile} - {new Date(scan.startedAt).toLocaleString()} ({scan.resourceCount} resources)
                </option>
              ))}
            </select>
            <button
              className="btn btn-primary"
              onClick={handleRunCompliance}
              disabled={!selectedScanId || isLoading || !config?.requiredTags?.length}
            >
              {isLoading ? 'Analyzing...' : 'Check Compliance'}
            </button>
          </div>
        </div>

        {/* Results */}
        {compliance && (
          <>
            {/* Summary stats */}
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-value">{compliance.totalResources}</div>
                <div className="stat-label">Total Resources</div>
              </div>
              <div className="stat-card">
                <div className="stat-value" style={{
                  color: compliance.overallCompliancePercent >= 80 ? 'var(--color-success)' :
                         compliance.overallCompliancePercent >= 50 ? 'var(--color-warning)' : 'var(--color-error)',
                }}>
                  {compliance.overallCompliancePercent}%
                </div>
                <div className="stat-label">Overall Compliance</div>
              </div>
              <div className="stat-card">
                <div className="stat-value" style={{ color: 'var(--color-success)' }}>
                  {compliance.fullyCompliantResources}
                </div>
                <div className="stat-label">Fully Compliant</div>
              </div>
              <div className="stat-card">
                <div className="stat-value" style={{ color: 'var(--color-error)' }}>
                  {compliance.untaggedResources.length}
                </div>
                <div className="stat-label">Non-Compliant</div>
              </div>
            </div>

            <TagCoverageHeatmap byTagKey={compliance.byTagKey} />
            <TagComplianceReport
              byService={compliance.byService}
              overallPercent={compliance.overallCompliancePercent}
            />
            {compliance.untaggedResources.length > 0 && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <h3 style={{ margin: 0 }}>Non-Compliant Resources</h3>
                  <ExportCSVButton
                    data={compliance.untaggedResources.map((r) => ({
                      ...r,
                      missingTags: r.missingTags.join('; '),
                    }))}
                    columns={[
                      { key: 'name', label: 'Name' },
                      { key: 'service', label: 'Service' },
                      { key: 'region', label: 'Region' },
                      { key: 'missingTags', label: 'Missing Tags' },
                    ]}
                    filename="untagged-resources"
                  />
                </div>
                <UntaggedResourcesList resources={compliance.untaggedResources} />
              </>
            )}
          </>
        )}
      </div>
    </>
  );
};

export default TagGovernancePage;

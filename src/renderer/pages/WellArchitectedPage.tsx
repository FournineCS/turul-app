// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React, { useEffect, useCallback } from 'react';
import { useWellArchitectedStore } from '../stores/wellArchitectedStore';
import { useProfileStore } from '../stores/profileStore';
import { useProviderStore } from '../stores/providerStore';
import { useGCPProjectStore } from '../stores/gcpProjectStore';
import { WorkloadList } from '../components/well-architected/WorkloadList';
import { PillarReviewCard } from '../components/well-architected/PillarReviewCard';
import { ImprovementsList } from '../components/well-architected/ImprovementsList';
import { WABPScanOverview } from '../components/well-architected/WABPScanOverview';
import ExportCSVButton from '../components/ExportCSVButton';
import type { WABPScanMode, GCPWAScanResult, GCPWAPillarSummary, GCPWellArchitectedSummary } from '../../shared/types';

const AWS_REGIONS = [
  'us-east-1',
  'us-east-2',
  'us-west-1',
  'us-west-2',
  'af-south-1',
  'ap-east-1',
  'ap-south-1',
  'ap-south-2',
  'ap-southeast-1',
  'ap-southeast-2',
  'ap-southeast-3',
  'ap-southeast-4',
  'ap-northeast-1',
  'ap-northeast-2',
  'ap-northeast-3',
  'ca-central-1',
  'eu-central-1',
  'eu-central-2',
  'eu-west-1',
  'eu-west-2',
  'eu-west-3',
  'eu-south-1',
  'eu-south-2',
  'eu-north-1',
  'me-south-1',
  'me-central-1',
  'sa-east-1',
] as const;

const GCPPillarCard: React.FC<{ pillar: GCPWAPillarSummary; expanded: boolean; onToggle: () => void }> = ({ pillar, expanded, onToggle }) => {
  const total = pillar.totalChecks;
  const pct = total > 0 ? Math.round((pillar.passCount / total) * 100) : 0;

  return (
    <div className="card mb-4">
      <div onClick={onToggle} style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h4 style={{ margin: 0 }}>{pillar.pillarName}</h4>
          <div className="text-secondary text-sm" style={{ marginTop: 4 }}>
            {pillar.passCount} passed, {pillar.failCount} failed{pillar.errorCount > 0 ? `, ${pillar.errorCount} errors` : ''}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 120, height: 8, backgroundColor: 'var(--color-bg-secondary)', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{
              width: `${pct}%`, height: '100%', borderRadius: 4, transition: 'width 0.3s',
              backgroundColor: pct >= 80 ? 'var(--color-success)' : pct >= 50 ? 'var(--color-warning)' : 'var(--color-error)',
            }} />
          </div>
          <span style={{ fontSize: 14, fontWeight: 600, minWidth: 40, textAlign: 'right',
            color: pct >= 80 ? 'var(--color-success)' : pct >= 50 ? 'var(--color-warning)' : 'var(--color-error)',
          }}>{pct}%</span>
          <span style={{ fontSize: 18, color: 'var(--color-text-secondary)' }}>{expanded ? '\u25B2' : '\u25BC'}</span>
        </div>
      </div>
      {expanded && (
        <div className="table-container" style={{ marginTop: 16 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Check</th>
                <th>Service</th>
                <th>Severity</th>
                <th>Status</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {pillar.findings.map((f, i) => (
                <tr key={f.check.id + '-' + i}>
                  <td>
                    <strong>{f.check.title}</strong>
                    <div className="text-secondary text-sm">{f.check.description}</div>
                  </td>
                  <td>{f.check.service}</td>
                  <td>
                    <span className={`badge ${f.check.severity === 'HIGH' ? 'badge-error' : f.check.severity === 'MEDIUM' ? 'badge-warning' : 'badge-info'}`}>
                      {f.check.severity}
                    </span>
                  </td>
                  <td>
                    <span className={`badge ${f.status === 'PASS' ? 'badge-success' : f.status === 'FAIL' ? 'badge-error' : 'badge-warning'}`}>
                      {f.status}
                    </span>
                  </td>
                  <td>
                    {f.detail && <div className="text-sm">{f.detail}</div>}
                    {f.resources.length > 0 && (
                      <div className="text-secondary text-sm">{f.resources.length} resource(s) affected</div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const GCPArchitectureFrameworkView: React.FC<{
  projectId: string | null;
  scanResult: GCPWAScanResult | null;
  scanProgress: any;
  isScanning: boolean;
  error: string | null;
  onRunScan: () => void;
  onClearError: () => void;
  gcpHistory: GCPWellArchitectedSummary[];
  loadById: (id: string) => void;
}> = ({ projectId, scanResult, scanProgress, isScanning, error, onRunScan, onClearError, gcpHistory, loadById }) => {
  const [expandedPillars, setExpandedPillars] = React.useState<Set<string>>(new Set());

  const togglePillar = (pillar: string) => {
    setExpandedPillars(prev => {
      const next = new Set(prev);
      if (next.has(pillar)) next.delete(pillar); else next.add(pillar);
      return next;
    });
  };

  return (
    <>
      <header className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h1 className="page-title">Architecture Framework Review</h1>
            <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: 12, fontSize: 12, fontWeight: 600, backgroundColor: 'var(--color-primary-glow)', color: 'var(--color-primary)' }}>Google Cloud</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {gcpHistory.length > 0 && (
              <select
                className="global-profile-select"
                value={scanResult?.id || ''}
                onChange={(e) => e.target.value && loadById(e.target.value)}
                style={{ minWidth: 260, fontSize: 12 }}
              >
                <option value="" disabled>Past scans ({gcpHistory.length})...</option>
                {gcpHistory.map((h) => (
                  <option key={h.id} value={h.id}>
                    {new Date(h.timestamp).toLocaleString()} — {h.totalPass}/{h.totalChecks} passed
                  </option>
                ))}
              </select>
            )}
            <button className="btn btn-primary" onClick={onRunScan} disabled={!projectId || isScanning}>
              {isScanning ? (<><div className="spinner" style={{ width: 16, height: 16 }} /> Scanning...</>) : 'Run Scan'}
            </button>
          </div>
        </div>
      </header>

      <div className="page-content">
        {error && (
          <div className="card mb-4" style={{ borderColor: 'var(--color-error)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--color-error)' }}>{error}</span>
              <button className="btn btn-sm btn-secondary" onClick={onClearError}>Dismiss</button>
            </div>
          </div>
        )}

        {!projectId && (
          <div style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: 8, padding: 40, textAlign: 'center' }}>
            <h3 style={{ margin: '0 0 8px', color: 'var(--color-text)' }}>No GCP Project Selected</h3>
            <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>Select a GCP project from the top bar to run architecture framework review.</p>
          </div>
        )}

        {isScanning && !scanResult && (
          <div className="loading-overlay">
            <div className="spinner" />
            <p>Running architecture framework scan...</p>
            {scanProgress && (
              <p style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                {scanProgress.phase === 'Complete' ? 'Finalizing...' : `${scanProgress.phase}: ${scanProgress.pillar}`} — {scanProgress.percent}%
              </p>
            )}
          </div>
        )}

        {projectId && !scanResult && !isScanning && (
          <div style={{ backgroundColor: 'var(--color-primary-glow)', border: '1px solid var(--color-primary)', borderRadius: 8, padding: 24, marginBottom: 24, textAlign: 'center' }}>
            <h3 style={{ margin: '0 0 8px', color: 'var(--color-text)' }}>Google Cloud Architecture Framework</h3>
            <p style={{ margin: '0 0 16px', color: 'var(--color-text-secondary)' }}>
              Scan your GCP resources against the Google Cloud Architecture Framework across 5 pillars: Operational Excellence, Security, Reliability, Performance & Cost Optimization, and System Design.
            </p>
            <button className="btn btn-primary" onClick={onRunScan} disabled={isScanning}>
              Run Architecture Scan
            </button>
          </div>
        )}

        {isScanning && scanResult && (
          <div style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: 8, padding: 24, marginBottom: 24, textAlign: 'center' }}>
            <h3 style={{ margin: '0 0 16px', color: 'var(--color-text)' }}>Scanning Resources...</h3>
            {scanProgress && (
              <>
                <div style={{ marginBottom: 8, fontSize: 13, color: 'var(--color-text-secondary)' }}>
                  {scanProgress.phase === 'Complete' ? 'Finalizing results...' : `${scanProgress.phase}: ${scanProgress.pillar}`}
                </div>
                <div style={{ height: 8, borderRadius: 4, backgroundColor: 'var(--color-border)', overflow: 'hidden', maxWidth: 400, margin: '0 auto' }}>
                  <div style={{ height: '100%', width: `${scanProgress.percent}%`, backgroundColor: 'var(--color-primary)', borderRadius: 4, transition: 'width 0.3s ease' }} />
                </div>
                <div style={{ marginTop: 6, fontSize: 12, color: 'var(--color-text-secondary)' }}>{scanProgress.percent}%</div>
              </>
            )}
            {!scanProgress && <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>Initializing scan...</div>}
          </div>
        )}

        {scanResult && !isScanning && (
          <>
            {/* Summary stats */}
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-value">{scanResult.totalChecks}</div>
                <div className="stat-label">Total Checks</div>
              </div>
              <div className="stat-card">
                <div className="stat-value" style={{ color: 'var(--color-success)' }}>{scanResult.totalPass}</div>
                <div className="stat-label">Passed</div>
              </div>
              <div className="stat-card">
                <div className="stat-value" style={{ color: 'var(--color-error)' }}>{scanResult.totalFail}</div>
                <div className="stat-label">Failed</div>
              </div>
              <div className="stat-card">
                <div className="stat-value" style={{ color: 'var(--color-text-secondary)' }}>{scanResult.totalError}</div>
                <div className="stat-label">Errors</div>
              </div>
            </div>

            {/* Pillar details */}
            {scanResult.pillarSummaries.map((pillar) => (
              <GCPPillarCard
                key={pillar.pillar}
                pillar={pillar}
                expanded={expandedPillars.has(pillar.pillar)}
                onToggle={() => togglePillar(pillar.pillar)}
              />
            ))}

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
              <p className="text-secondary text-sm" style={{ margin: 0 }}>
                Scanned at {new Date(scanResult.timestamp).toLocaleString()} | Duration: {(scanResult.duration / 1000).toFixed(1)}s
              </p>
              <button className="btn btn-secondary btn-sm" onClick={onRunScan} disabled={isScanning}>
                Re-scan
              </button>
            </div>
          </>
        )}
      </div>
    </>
  );
};

const WellArchitectedPage: React.FC = () => {
  const selectedProvider = useProviderStore((s) => s.selectedProvider);

  const {
    workloads,
    selectedWorkload,
    lensReview,
    improvements,
    selectedRegion,
    isLoading,
    isLoadingReview,
    isLoadingImprovements,
    error,
    scanMode,
    bpScanResult,
    bpScanProgress,
    isScanning,
    gcpScanResult,
    gcpScanProgress,
    gcpHistory,
    awsHistory,
    loadAWSHistory,
    loadAWSScanById,
    setSelectedRegion,
    setScanMode,
    loadWorkloads,
    selectWorkload,
    loadLensReview,
    loadImprovements,
    runBestPracticesScan,
    runGCPArchitectureScan,
    setBPScanProgress,
    setGCPScanProgress,
    loadGCPHistory,
    loadGCPWellArchitectedById,
    clearError,
    clearSelection,
  } = useWellArchitectedStore();

  const selectedProfile = useProfileStore((s) => s.selectedProfileName);
  const selectedProjectId = useGCPProjectStore((s) => s.selectedProjectId);

  // Subscribe to AWS well-architected completed event
  useEffect(() => {
    if (selectedProvider !== 'aws') return;
    if (!window.electronAPI?.wellArchitected?.onCompleted) return;
    const unsubscribe = window.electronAPI.wellArchitected.onCompleted((result: any) => {
      useWellArchitectedStore.setState({ bpScanResult: result, isScanning: false });
      if (selectedProfile) loadAWSHistory(selectedProfile);
    });
    return () => unsubscribe();
  }, [selectedProvider, selectedProfile, loadAWSHistory]);

  // Subscribe to AWS well-architected failed event
  useEffect(() => {
    if (selectedProvider !== 'aws') return;
    if (!window.electronAPI?.wellArchitected?.onFailed) return;
    const unsubscribe = window.electronAPI.wellArchitected.onFailed(({ error: err }: { error: string }) => {
      useWellArchitectedStore.setState({ error: err, isScanning: false });
    });
    return () => unsubscribe();
  }, [selectedProvider]);

  // Load AWS history when profile changes
  useEffect(() => {
    if (selectedProvider === 'aws' && selectedProfile) {
      loadAWSHistory(selectedProfile);
    }
  }, [selectedProvider, selectedProfile, loadAWSHistory]);

  // Clear stale AWS result when profile changes
  useEffect(() => {
    if (selectedProvider === 'aws') {
      useWellArchitectedStore.setState({ bpScanResult: null });
    }
  }, [selectedProvider, selectedProfile]);

  // Navigation persistence — auto-load most recent AWS result
  useEffect(() => {
    if (selectedProvider === 'aws' && !bpScanResult && !isScanning && awsHistory.length > 0) {
      loadAWSScanById(awsHistory[0].id);
    }
  }, [selectedProvider, bpScanResult, isScanning, awsHistory, loadAWSScanById]);

  // Load workloads when profile or region changes (only in workloads mode)
  useEffect(() => {
    if (selectedProfile && scanMode === 'workloads') {
      loadWorkloads(selectedProfile, selectedRegion);
      clearSelection();
    }
  }, [selectedProfile, selectedRegion, scanMode, loadWorkloads, clearSelection]);

  // Load lens review and improvements when workload is selected
  useEffect(() => {
    if (selectedProfile && selectedWorkload) {
      loadLensReview(selectedProfile, selectedRegion, selectedWorkload.workloadId);
      loadImprovements(selectedProfile, selectedRegion, selectedWorkload.workloadId);
    }
  }, [selectedProfile, selectedRegion, selectedWorkload, loadLensReview, loadImprovements]);

  // Subscribe to best practices scan progress events
  useEffect(() => {
    if (!window.electronAPI?.wellArchitected?.onBestPracticesProgress) return;
    const unsubscribe = window.electronAPI.wellArchitected.onBestPracticesProgress((progress) => {
      setBPScanProgress(progress);
    });
    return () => unsubscribe();
  }, [setBPScanProgress]);

  // Subscribe to GCP scan progress events
  useEffect(() => {
    if (!window.electronAPI?.gcp?.wellArchitected?.onProgress) return;
    const unsubscribe = window.electronAPI.gcp.wellArchitected.onProgress((progress: any) => {
      setGCPScanProgress(progress);
    });
    return () => unsubscribe();
  }, [setGCPScanProgress]);

  // Subscribe to GCP well-architected completed event
  useEffect(() => {
    if (!window.electronAPI?.gcp?.wellArchitected?.onCompleted) return;
    const unsubscribe = window.electronAPI.gcp.wellArchitected.onCompleted((result) => {
      useWellArchitectedStore.setState({ gcpScanResult: result, isScanning: false, gcpScanProgress: null });
      if (selectedProjectId) loadGCPHistory(selectedProjectId);
    });
    return () => unsubscribe();
  }, [selectedProjectId, loadGCPHistory]);

  // Subscribe to GCP well-architected failed event
  useEffect(() => {
    if (!window.electronAPI?.gcp?.wellArchitected?.onFailed) return;
    const unsubscribe = window.electronAPI.gcp.wellArchitected.onFailed(({ error: err }) => {
      useWellArchitectedStore.setState({ error: err, isScanning: false, gcpScanProgress: null });
    });
    return () => unsubscribe();
  }, []);

  // Stale data clear + history load on project change
  useEffect(() => {
    if (selectedProvider === 'gcp' && selectedProjectId) {
      if (gcpScanResult && gcpScanResult.projectId !== selectedProjectId) {
        useWellArchitectedStore.setState({ gcpScanResult: null });
      }
      loadGCPHistory(selectedProjectId);
    }
  }, [selectedProvider, selectedProjectId, loadGCPHistory]);

  // Navigation persistence — load latest result if none loaded
  useEffect(() => {
    if (selectedProvider === 'gcp' && !gcpScanResult && !isScanning && gcpHistory.length > 0) {
      loadGCPWellArchitectedById(gcpHistory[0].id);
    }
  }, [selectedProvider, gcpScanResult, isScanning, gcpHistory, loadGCPWellArchitectedById]);

  const handleRegionChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setSelectedRegion(e.target.value);
    },
    [setSelectedRegion]
  );

  const handleScanModeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setScanMode(e.target.value as WABPScanMode);
    },
    [setScanMode]
  );

  const handleRefresh = useCallback(() => {
    if (selectedProfile) {
      if (scanMode === 'best_practices') {
        runBestPracticesScan(selectedProfile, selectedRegion);
      } else {
        loadWorkloads(selectedProfile, selectedRegion);
        if (selectedWorkload) {
          loadLensReview(selectedProfile, selectedRegion, selectedWorkload.workloadId);
          loadImprovements(selectedProfile, selectedRegion, selectedWorkload.workloadId);
        }
      }
    }
  }, [selectedProfile, selectedRegion, selectedWorkload, scanMode, loadWorkloads, loadLensReview, loadImprovements, runBestPracticesScan]);

  const handleRunScan = useCallback(() => {
    if (selectedProfile) {
      runBestPracticesScan(selectedProfile, selectedRegion);
    }
  }, [selectedProfile, selectedRegion, runBestPracticesScan]);

  const handleSelectWorkload = useCallback(
    (workload: typeof selectedWorkload) => {
      selectWorkload(workload);
    },
    [selectWorkload]
  );

  if (selectedProvider === 'gcp') {
    return <GCPArchitectureFrameworkView
      projectId={selectedProjectId}
      scanResult={gcpScanResult}
      scanProgress={gcpScanProgress}
      isScanning={isScanning}
      error={error}
      onRunScan={() => selectedProjectId && runGCPArchitectureScan(selectedProjectId)}
      onClearError={clearError}
      gcpHistory={gcpHistory}
      loadById={loadGCPWellArchitectedById}
    />;
  }

  return (
    <>
      <header className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 className="page-title">Well-Architected Review</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <select
              className="global-profile-select"
              value={selectedRegion}
              onChange={handleRegionChange}
              style={{ minWidth: 160 }}
            >
              {AWS_REGIONS.map((region) => (
                <option key={region} value={region}>
                  {region}
                </option>
              ))}
            </select>
            <select
              className="global-profile-select"
              value={scanMode}
              onChange={handleScanModeChange}
              style={{ minWidth: 180 }}
            >
              <option value="workloads">WAF Workloads</option>
              <option value="best_practices">Best Practices Scan</option>
            </select>
            {awsHistory.length > 0 && (
              <select
                className="global-profile-select"
                value={bpScanResult?.id || ''}
                onChange={(e) => e.target.value && loadAWSScanById(e.target.value)}
                style={{ minWidth: 260, fontSize: 12 }}
              >
                <option value="" disabled>Past scans ({awsHistory.length})...</option>
                {awsHistory.map((h: any) => (
                  <option key={h.id} value={h.id}>
                    {new Date(h.timestamp).toLocaleString()} — {h.passCount}/{h.totalChecks} passed
                  </option>
                ))}
              </select>
            )}
            {scanMode === 'best_practices' && (
              <button
                className="btn btn-secondary"
                onClick={handleRunScan}
                disabled={isScanning || !selectedProfile}
              >
                {isScanning ? 'Scanning...' : 'Run Scan'}
              </button>
            )}
            <button
              className="btn btn-primary"
              onClick={handleRefresh}
              disabled={isLoading || isScanning || !selectedProfile}
            >
              {isLoading || isScanning ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>
      </header>

      <div className="page-content">

        {/* Error display */}
        {error && (
          <div className="card mb-4" style={{ borderColor: 'var(--color-error)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--color-error)' }}>{error}</span>
              <button className="btn btn-sm btn-secondary" onClick={clearError}>Dismiss</button>
            </div>
          </div>
        )}

        {/* No profile selected message */}
        {!selectedProfile && (
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
              No Profile Selected
            </h3>
            <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
              Select an AWS profile from the top bar to view Well-Architected workloads.
            </p>
          </div>
        )}

        {/* ===== WAF WORKLOADS MODE ===== */}
        {selectedProfile && scanMode === 'workloads' && (
          <>
            {/* Workload List */}
            <WorkloadList
              workloads={workloads}
              selectedWorkload={selectedWorkload}
              onSelectWorkload={handleSelectWorkload}
              isLoading={isLoading}
            />

            {/* Selected Workload Details */}
            {selectedWorkload && (
              <>
                <div
                  style={{
                    backgroundColor: 'var(--color-primary-glow)',
                    border: '1px solid var(--color-primary)',
                    borderRadius: 8,
                    padding: 16,
                    marginBottom: 24,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                >
                  <div>
                    <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                      Selected Workload:
                    </span>
                    <h3 style={{ margin: '4px 0 0', color: 'var(--color-text)', fontSize: 16 }}>
                      {selectedWorkload.workloadName}
                    </h3>
                  </div>
                  <button className="btn btn-sm btn-secondary" onClick={clearSelection}>
                    Clear Selection
                  </button>
                </div>

                {/* Pillar Review */}
                <PillarReviewCard lensReview={lensReview} isLoading={isLoadingReview} />

                {/* Improvements */}
                {improvements.length > 0 && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                    <ExportCSVButton
                      data={improvements.map((i) => ({
                        pillar: i.pillarId,
                        question: i.questionTitle,
                        risk: i.risk,
                        plans: i.improvementPlans.map((p) => p.displayText).join('; '),
                      }))}
                      columns={[
                        { key: 'pillar', label: 'Pillar' },
                        { key: 'question', label: 'Question' },
                        { key: 'risk', label: 'Risk' },
                        { key: 'plans', label: 'Improvement Plans' },
                      ]}
                      filename="wa-improvements"
                      label="Export Improvements CSV"
                    />
                  </div>
                )}
                <ImprovementsList
                  improvements={improvements}
                  isLoading={isLoadingImprovements}
                />
              </>
            )}
          </>
        )}

        {/* ===== BEST PRACTICES SCAN MODE ===== */}
        {selectedProfile && scanMode === 'best_practices' && (
          <>
            {/* Prompt to run scan if no results yet */}
            {!bpScanResult && !isScanning && !error && (
              <div
                style={{
                  backgroundColor: 'var(--color-primary-glow)',
                  border: '1px solid var(--color-primary)',
                  borderRadius: 8,
                  padding: 24,
                  marginBottom: 24,
                  textAlign: 'center',
                }}
              >
                <h3 style={{ margin: '0 0 8px', color: 'var(--color-text)' }}>
                  Best Practices Scan Mode
                </h3>
                <p style={{ margin: '0 0 16px', color: 'var(--color-text-secondary)' }}>
                  This mode scans your AWS resources against Well-Architected Framework best practices
                  across all 6 pillars: Operational Excellence, Security, Reliability, Performance
                  Efficiency, Cost Optimization, and Sustainability.
                  <br />
                  <br />
                  25 checks covering CloudTrail, CloudWatch, Auto Scaling, S3, EC2, RDS, IAM,
                  ElastiCache, and more.
                </p>
                <button
                  className="btn btn-primary"
                  onClick={handleRunScan}
                  disabled={isScanning}
                >
                  Run Best Practices Scan
                </button>
              </div>
            )}

            {/* Scanning progress */}
            {isScanning && (
              <div
                style={{
                  backgroundColor: 'var(--color-bg-secondary)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 8,
                  padding: 24,
                  marginBottom: 24,
                  textAlign: 'center',
                }}
              >
                <h3 style={{ margin: '0 0 16px', color: 'var(--color-text)' }}>
                  Scanning Resources...
                </h3>
                {bpScanProgress && (
                  <>
                    <div style={{ marginBottom: 8, fontSize: 13, color: 'var(--color-text-secondary)' }}>
                      {bpScanProgress.phase === 'Complete'
                        ? 'Finalizing results...'
                        : `${bpScanProgress.phase}: ${bpScanProgress.pillar}`}
                    </div>
                    <div
                      style={{
                        height: 8,
                        borderRadius: 4,
                        backgroundColor: 'var(--color-border)',
                        overflow: 'hidden',
                        maxWidth: 400,
                        margin: '0 auto',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${bpScanProgress.percent}%`,
                          backgroundColor: 'var(--color-primary)',
                          borderRadius: 4,
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </div>
                    <div style={{ marginTop: 6, fontSize: 12, color: 'var(--color-text-secondary)' }}>
                      {bpScanProgress.percent}%
                    </div>
                  </>
                )}
                {!bpScanProgress && (
                  <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                    Initializing scan...
                  </div>
                )}
              </div>
            )}

            {/* Scan results */}
            {bpScanResult && !isScanning && (
              <>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8 }}>
                  <ExportCSVButton
                    data={(bpScanResult.pillarSummaries || []).flatMap((p) =>
                      (p.findings || []).map((f) => ({
                        pillar: p.pillarName,
                        checkId: f.checkId,
                        title: f.title,
                        status: f.status,
                        severity: f.severity,
                        service: f.service,
                        resourceId: f.resourceId || '',
                        region: f.region,
                        description: f.description,
                      }))
                    )}
                    columns={[
                      { key: 'pillar', label: 'Pillar' },
                      { key: 'checkId', label: 'Check ID' },
                      { key: 'title', label: 'Title' },
                      { key: 'status', label: 'Status' },
                      { key: 'severity', label: 'Severity' },
                      { key: 'service', label: 'Service' },
                      { key: 'resourceId', label: 'Resource' },
                      { key: 'region', label: 'Region' },
                      { key: 'description', label: 'Description' },
                    ]}
                    filename="wa-best-practices-findings"
                    label="Export Findings CSV"
                  />
                </div>
                <WABPScanOverview scanResult={bpScanResult} />
              </>
            )}
          </>
        )}
      </div>
    </>
  );
};

export default WellArchitectedPage;

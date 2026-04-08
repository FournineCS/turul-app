// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React, { useEffect, useCallback, useState } from 'react';
import { useAssessmentStore } from '../stores/assessmentStore';
import { useProfileStore } from '../stores/profileStore';
import { useToastStore } from '../stores/toastStore';
import { useProviderStore } from '../stores/providerStore';
import { useGCPProjectStore } from '../stores/gcpProjectStore';
import { AssessmentConfigForm } from '../components/assessment/AssessmentConfig';
import { AssessmentDashboard } from '../components/assessment/AssessmentDashboard';
import type { AssessmentConfig, GCPAssessmentResult, GCPDomainScore } from '../../shared/types';

const gradeColor = (grade: string) => {
  switch (grade) {
    case 'A': return 'var(--color-success)';
    case 'B': return '#4ade80';
    case 'C': return 'var(--color-warning)';
    case 'D': return '#f97316';
    default: return 'var(--color-error)';
  }
};

const domainLabels: Record<string, string> = {
  cost: 'Cost Optimization',
  security: 'Security',
  reliability: 'Reliability',
  compliance: 'Compliance',
  iam: 'IAM & Access',
};

const GCPAssessmentDashboard: React.FC<{
  result: GCPAssessmentResult;
  onReset: () => void;
  onRerun: () => void;
  onGenerateReport?: () => void;
  isGeneratingReport?: boolean;
  gcpHistory: { id: string; timestamp: string; overallGrade: string; overallScore: number }[];
  onLoadHistory: (id: string) => void;
}> = ({ result, onReset, onRerun, onGenerateReport, isGeneratingReport, gcpHistory, onLoadHistory }) => {
  const [expandedDomain, setExpandedDomain] = useState<string | null>(null);

  return (
    <>
      <header className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
          <h1 className="page-title">GCP Assessment</h1>
          <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: 12, fontSize: 12, fontWeight: 600, backgroundColor: 'var(--color-primary-glow)', color: 'var(--color-primary)' }}>Google Cloud</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {gcpHistory.length > 0 && (
            <select
              className="global-profile-select"
              style={{ minWidth: 260, fontSize: 12 }}
              value={result.id || ''}
              onChange={(e) => e.target.value && e.target.value !== result.id && onLoadHistory(e.target.value)}
            >
              <option value="" disabled>Past assessments ({gcpHistory.length})...</option>
              {gcpHistory.map((h) => (
                <option key={h.id} value={h.id}>
                  {new Date(h.timestamp).toLocaleString()} — {h.overallGrade} ({h.overallScore}/100)
                </option>
              ))}
            </select>
          )}
          {onGenerateReport && (
            <button className="btn btn-primary" onClick={onGenerateReport} disabled={isGeneratingReport}>
              {isGeneratingReport ? 'Generating...' : 'Generate PDF Report'}
            </button>
          )}
          <button className="btn btn-secondary" onClick={onRerun}>Re-run</button>
          <button className="btn btn-secondary" onClick={onReset}>New Assessment</button>
        </div>
      </header>
      <div className="page-content">

      {/* Overall grade */}
      <div style={{ display: 'flex', gap: 24, marginBottom: 24, flexWrap: 'wrap' }}>
        <div className="card" style={{ flex: '0 0 200px', textAlign: 'center', padding: 24 }}>
          <div style={{ fontSize: 72, fontWeight: 700, color: gradeColor(result.overallGrade), lineHeight: 1 }}>{result.overallGrade}</div>
          <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--color-text)', marginTop: 4 }}>{result.overallScore}/100</div>
          <div className="text-secondary text-sm" style={{ marginTop: 4 }}>Overall Grade</div>
        </div>
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 12 }}>
          <div className="stat-card">
            <div className="stat-value">{result.totalRecommendations}</div>
            <div className="stat-label">Recommendations</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--color-error)' }}>{result.criticalCount}</div>
            <div className="stat-label">Critical</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--color-warning)' }}>{result.highCount}</div>
            <div className="stat-label">High</div>
          </div>
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--color-warning)' }}>{result.mediumCount}</div>
            <div className="stat-label">Medium</div>
          </div>
        </div>
      </div>

      {/* Domain scores */}
      <h3 style={{ marginBottom: 16 }}>Domain Scores</h3>
      {result.domainScores.map((ds) => (
        <div key={ds.domain} className="card mb-4">
          <div onClick={() => setExpandedDomain(expandedDomain === ds.domain ? null : ds.domain)}
            style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h4 style={{ margin: 0 }}>{domainLabels[ds.domain] || ds.domain}</h4>
              <div className="text-secondary text-sm" style={{ marginTop: 4 }}>
                Weight: {Math.round(ds.weight * 100)}% | {ds.findings} findings | {ds.recommendations.length} recommendations
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ width: 120, height: 8, backgroundColor: 'var(--color-bg-secondary)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ width: `${ds.score}%`, height: '100%', borderRadius: 4, transition: 'width 0.3s',
                  backgroundColor: gradeColor(ds.grade) }} />
              </div>
              <span style={{ fontSize: 24, fontWeight: 700, color: gradeColor(ds.grade), minWidth: 30 }}>{ds.grade}</span>
              <span style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>{expandedDomain === ds.domain ? '\u25B2' : '\u25BC'}</span>
            </div>
          </div>

          {expandedDomain === ds.domain && ds.recommendations.length > 0 && (
            <div style={{ marginTop: 16 }}>
              <table className="table">
                <thead><tr><th>Recommendation</th><th>Severity</th><th>Impact</th></tr></thead>
                <tbody>
                  {ds.recommendations.map((rec) => (
                    <tr key={rec.id}>
                      <td>
                        <strong>{rec.title}</strong>
                        <div className="text-secondary text-sm">{rec.description}</div>
                      </td>
                      <td>
                        <span className={`badge ${rec.severity === 'CRITICAL' ? 'badge-error' : rec.severity === 'HIGH' ? 'badge-error' : rec.severity === 'MEDIUM' ? 'badge-warning' : 'badge-info'}`}>
                          {rec.severity}
                        </span>
                      </td>
                      <td className="text-sm">{rec.impact}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {expandedDomain === ds.domain && ds.recommendations.length === 0 && (
            <div style={{ marginTop: 16 }} className="text-secondary text-sm">No recommendations for this domain.</div>
          )}
        </div>
      ))}

      {result.errors.length > 0 && (
        <div className="card mb-4" style={{ borderColor: 'var(--color-warning)' }}>
          <h4 style={{ color: 'var(--color-warning)', marginBottom: 8 }}>Partial Results</h4>
          {result.errors.map((err, i) => (<p key={i} className="text-secondary text-sm">{err}</p>))}
        </div>
      )}

      <p className="text-secondary text-sm" style={{ marginTop: 12 }}>
        Assessed at {new Date(result.timestamp).toLocaleString()} | Project: {result.projectId} | Duration: {(result.duration / 1000).toFixed(1)}s
      </p>
      </div>
    </>
  );
};

const AssessmentPage: React.FC = () => {
  const {
    result,
    progress,
    isRunning,
    error,
    assessmentHistory,
    runAssessment,
    generateReport,
    loadHistory,
    loadAssessment,
    reset,
    setProgress,
    clearError,
  } = useAssessmentStore();

  const selectedProfileName = useProfileStore((s) => s.selectedProfileName);
  const selectedProvider = useProviderStore((s) => s.selectedProvider);
  const selectedProjectId = useGCPProjectStore((s) => s.selectedProjectId);
  const {
    gcpResult,
    gcpProgress,
    gcpHistory,
    runGCPAssessment,
    generateGCPReport,
    setGCPProgress,
    loadGCPHistory,
    loadGCPAssessmentById,
  } = useAssessmentStore();
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const addToast = useToastStore((s) => s.addToast);

  // Load assessment history on mount
  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  // When global profile changes, load the most recent assessment for that profile
  // or reset to config form if none exists
  useEffect(() => {
    if (isRunning) return;
    if (!selectedProfileName) {
      reset();
      return;
    }
    // If current result already matches the selected profile, keep it
    if (result && result.profile === selectedProfileName) return;
    // Find the most recent assessment for this profile (history is sorted by timestamp DESC)
    const match = assessmentHistory.find((a) => a.profile === selectedProfileName);
    if (match) {
      loadAssessment(match.id);
    } else {
      reset();
    }
  }, [selectedProfileName, assessmentHistory, isRunning]);

  // Subscribe to assessment progress
  useEffect(() => {
    if (window.electronAPI?.assessment?.onProgress) {
      const unsubscribe = window.electronAPI.assessment.onProgress(setProgress);
      return () => unsubscribe();
    }
  }, [setProgress]);

  // Subscribe to GCP assessment progress
  useEffect(() => {
    if (window.electronAPI?.gcp?.assessment?.onProgress) {
      const unsubscribe = window.electronAPI.gcp.assessment.onProgress(setGCPProgress);
      return () => unsubscribe();
    }
  }, [setGCPProgress]);

  // Subscribe to GCP assessment completed event
  useEffect(() => {
    if (!window.electronAPI?.gcp?.assessment?.onCompleted) return;
    const unsubscribe = window.electronAPI.gcp.assessment.onCompleted((result) => {
      useAssessmentStore.setState({ gcpResult: result, isRunning: false, gcpProgress: null });
      if (selectedProjectId) loadGCPHistory(selectedProjectId);
    });
    return () => unsubscribe();
  }, [selectedProjectId, loadGCPHistory]);

  // Subscribe to GCP assessment failed event
  useEffect(() => {
    if (!window.electronAPI?.gcp?.assessment?.onFailed) return;
    const unsubscribe = window.electronAPI.gcp.assessment.onFailed(({ error }) => {
      useAssessmentStore.setState({ error, isRunning: false, gcpProgress: null });
    });
    return () => unsubscribe();
  }, []);

  // Clear stale GCP result & load history when project changes
  useEffect(() => {
    if (selectedProvider === 'gcp' && selectedProjectId) {
      // Clear result if it belongs to a different project
      if (gcpResult && gcpResult.projectId !== selectedProjectId) {
        useAssessmentStore.setState({ gcpResult: null });
      }
      loadGCPHistory(selectedProjectId);
    }
  }, [selectedProvider, selectedProjectId, loadGCPHistory]); // eslint-disable-line react-hooks/exhaustive-deps

  // Navigation persistence — auto-load most recent GCP result
  useEffect(() => {
    if (selectedProvider === 'gcp' && !gcpResult && !isRunning && gcpHistory.length > 0) {
      loadGCPAssessmentById(gcpHistory[0].id);
    }
  }, [selectedProvider, gcpHistory, gcpResult, isRunning, loadGCPAssessmentById]);

  const handleSubmit = useCallback((config: AssessmentConfig) => {
    clearError();
    runAssessment(config);
  }, [runAssessment, clearError]);

  const handleGenerateReport = useCallback(async () => {
    if (!window.electronAPI?.app?.selectDirectory) return;

    const dir = await window.electronAPI.app.selectDirectory();
    if (!dir) return;

    setIsGeneratingReport(true);
    try {
      const filePath = await generateReport(dir);
      if (filePath) {
        addToast('success', `Report saved to ${filePath}`);
      }
    } catch (err) {
      addToast('error', `Failed to generate report: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsGeneratingReport(false);
    }
  }, [generateReport, addToast]);

  const handleGCPGenerateReport = useCallback(async () => {
    if (!window.electronAPI?.app?.selectDirectory) return;

    const dir = await window.electronAPI.app.selectDirectory();
    if (!dir) return;

    setIsGeneratingReport(true);
    try {
      const filePath = await generateGCPReport(dir);
      if (filePath) {
        addToast('success', `Report saved to ${filePath}`);
      }
    } catch (err) {
      addToast('error', `Failed to generate report: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setIsGeneratingReport(false);
    }
  }, [generateGCPReport, addToast]);

  const handleReset = useCallback(() => {
    reset();
  }, [reset]);

  // GCP assessment view
  if (selectedProvider === 'gcp') {
    // Running GCP assessment
    if (isRunning) {
      return (
        <>
          <header className="page-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <h1 className="page-title">GCP Assessment</h1>
              <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: 12, fontSize: 12, fontWeight: 600, backgroundColor: 'var(--color-primary-glow)', color: 'var(--color-primary)' }}>Google Cloud</span>
            </div>
          </header>
          <div className="page-content">
          <div style={{ maxWidth: 500, margin: '60px auto', textAlign: 'center', padding: 40, background: 'var(--color-bg-secondary)', borderRadius: 12, border: '1px solid var(--color-border)' }}>
            <div style={{ width: 80, height: 80, margin: '0 auto 20px', border: '4px solid var(--color-border)', borderTop: '4px solid var(--color-primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            {gcpProgress ? (
              <>
                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text)', marginBottom: 8 }}>{gcpProgress.message}</div>
                <div style={{ height: 8, borderRadius: 4, background: 'var(--color-bg-tertiary)', overflow: 'hidden', marginBottom: 8 }}>
                  <div style={{ height: '100%', borderRadius: 4, background: 'var(--color-primary)', width: `${gcpProgress.percent}%`, transition: 'width 0.3s ease' }} />
                </div>
                <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>{gcpProgress.percent}% complete</div>
              </>
            ) : (
              <div style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>Initializing assessment...</div>
            )}
          </div>
          </div>
        </>
      );
    }

    // GCP results
    if (gcpResult) {
      return (
        <GCPAssessmentDashboard
          result={gcpResult}
          onReset={reset}
          onRerun={() => selectedProjectId && runGCPAssessment(selectedProjectId)}
          onGenerateReport={handleGCPGenerateReport}
          isGeneratingReport={isGeneratingReport}
          gcpHistory={gcpHistory}
          onLoadHistory={loadGCPAssessmentById}
        />
      );
    }

    // GCP config form (just a run button)
    return (
      <>
        <header className="page-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <h1 className="page-title">GCP Assessment</h1>
            <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: 12, fontSize: 12, fontWeight: 600, backgroundColor: 'var(--color-primary-glow)', color: 'var(--color-primary)' }}>Google Cloud</span>
          </div>
        </header>
        <div className="page-content">
          {error && (
            <div className="card mb-4" style={{ borderColor: 'var(--color-error)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--color-error)', fontSize: 13 }}>{error}</span>
                <button className="btn btn-sm btn-secondary" onClick={clearError}>Dismiss</button>
              </div>
            </div>
          )}
          <div style={{ maxWidth: 600, margin: '0 auto' }}>
            <div className="card" style={{ padding: 32 }}>
              <h2 style={{ marginBottom: 8 }}>Multi-Dimensional Assessment</h2>
              <p className="text-secondary" style={{ marginBottom: 24 }}>
                Evaluate your GCP project across 5 domains: Cost, Security, Reliability, Compliance, and IAM. Each domain receives a score and grade (A-F) with actionable recommendations.
              </p>
              {gcpHistory.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <label className="text-secondary text-sm" style={{ display: 'block', marginBottom: 6 }}>Load past assessment</label>
                  <select
                    className="global-profile-select"
                    style={{ width: '100%', minWidth: 'unset' }}
                    value=""
                    onChange={(e) => e.target.value && loadGCPAssessmentById(e.target.value)}
                  >
                    <option value="">{gcpHistory.length} past assessment{gcpHistory.length !== 1 ? 's' : ''} available...</option>
                    {gcpHistory.map((h) => (
                      <option key={h.id} value={h.id}>
                        {new Date(h.timestamp).toLocaleString()} — Grade: {h.overallGrade} ({h.overallScore}/100)
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <button className="btn btn-primary" style={{ width: '100%', padding: '12px 24px', fontSize: 16 }}
                onClick={() => selectedProjectId && runGCPAssessment(selectedProjectId)}
                disabled={!selectedProjectId || isRunning}>
                {!selectedProjectId ? 'Select a GCP Project First' : 'Run Assessment'}
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  // Running state — show progress
  if (isRunning) {
    return (
      <>
        <header className="page-header">
          <h1 className="page-title">Running Assessment</h1>
        </header>
        <div className="page-content">
          <div style={{
            maxWidth: 500, margin: '60px auto', textAlign: 'center',
            padding: 40, background: 'var(--color-bg-secondary)', borderRadius: 12, border: '1px solid var(--color-border)',
          }}>
            <div style={{
              width: 80, height: 80, margin: '0 auto 20px',
              border: '4px solid var(--color-border)', borderTop: '4px solid var(--color-primary)',
              borderRadius: '50%', animation: 'spin 1s linear infinite',
            }} />

            {progress && (
              <>
                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text)', marginBottom: 8 }}>
                  {progress.message}
                </div>
                <div style={{
                  height: 8, borderRadius: 4, background: 'var(--color-bg-tertiary)', overflow: 'hidden', marginBottom: 8,
                }}>
                  <div style={{
                    height: '100%', borderRadius: 4, background: 'var(--color-primary)',
                    width: `${progress.percent}%`, transition: 'width 0.3s ease',
                  }} />
                </div>
                <div style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                  {progress.percent}% complete
                </div>
              </>
            )}
            {!progress && (
              <div style={{ fontSize: 14, color: 'var(--color-text-secondary)' }}>Initializing assessment...</div>
            )}
          </div>
        </div>
      </>
    );
  }

  // Results state — show dashboard
  if (result) {
    return (
      <>
        <header className="page-header">
          <h1 className="page-title">Assessment Results</h1>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {assessmentHistory.length > 0 && (
              <select
                className="global-profile-select"
                value={result.id || ''}
                onChange={(e) => e.target.value && e.target.value !== result.id && loadAssessment(e.target.value)}
                style={{ minWidth: 260, fontSize: 12 }}
              >
                <option value="" disabled>Past assessments ({assessmentHistory.length})...</option>
                {assessmentHistory.map((h) => (
                  <option key={h.id} value={h.id}>
                    {new Date(h.timestamp).toLocaleString()} — {h.overallGrade} ({h.overallScore}/100)
                  </option>
                ))}
              </select>
            )}
          </div>
        </header>
        <div className="page-content">
          {error && (
            <div className="card mb-4" style={{ borderColor: 'var(--color-error)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--color-error)', fontSize: 13 }}>{error}</span>
                <button className="btn btn-sm btn-secondary" onClick={clearError}>Dismiss</button>
              </div>
            </div>
          )}
          <AssessmentDashboard
            result={result}
            onGenerateReport={handleGenerateReport}
            onReset={handleReset}
            isGeneratingReport={isGeneratingReport}
          />
        </div>
      </>
    );
  }

  // Config state — show form
  return (
    <>
      <header className="page-header">
        <h1 className="page-title">Assessment</h1>
      </header>
      <div className="page-content">
        {error && (
          <div className="card mb-4" style={{ borderColor: 'var(--color-error)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--color-error)', fontSize: 13 }}>{error}</span>
              <button className="btn btn-sm btn-secondary" onClick={clearError}>Dismiss</button>
            </div>
          </div>
        )}
        <AssessmentConfigForm onSubmit={handleSubmit} isRunning={isRunning} />
      </div>
    </>
  );
};

export default AssessmentPage;

// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React, { useState, useEffect } from 'react';
import { useProfileStore } from '../stores/profileStore';
import { useComplianceStore } from '../stores/complianceStore';
import { useProviderStore } from '../stores/providerStore';
import { useGCPProjectStore } from '../stores/gcpProjectStore';

import ExportCSVButton from '../components/ExportCSVButton';
import type { ComplianceSectionResult, ComplianceControlResult } from '../../shared/types';

const statusLabels: Record<string, string> = {
  PASS: 'Pass',
  FAIL: 'Fail',
  NOT_CHECKED: 'N/A',
};

const SectionCard: React.FC<{
  section: ComplianceSectionResult;
  expanded: boolean;
  onToggle: () => void;
}> = ({ section, expanded, onToggle }) => {
  const pct = section.totalControls - section.notCheckedControls > 0
    ? Math.round(
        (section.passedControls / (section.totalControls - section.notCheckedControls)) * 100
      )
    : 0;

  return (
    <div className="card mb-4">
      <div
        onClick={onToggle}
        style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <div>
          <h4 style={{ margin: 0 }}>{section.section}</h4>
          <div className="text-secondary text-sm" style={{ marginTop: 4 }}>
            {section.passedControls} passed, {section.failedControls} failed
            {section.notCheckedControls > 0 ? `, ${section.notCheckedControls} not checked` : ''}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 120,
            height: 8,
            backgroundColor: 'var(--color-bg-secondary)',
            borderRadius: 4,
            overflow: 'hidden',
          }}>
            <div style={{
              width: `${pct}%`,
              height: '100%',
              backgroundColor: pct >= 80 ? 'var(--color-success)' : pct >= 50 ? 'var(--color-warning)' : 'var(--color-error)',
              borderRadius: 4,
              transition: 'width 0.3s',
            }} />
          </div>
          <span style={{
            fontSize: 14,
            fontWeight: 600,
            color: pct >= 80 ? 'var(--color-success)' : pct >= 50 ? 'var(--color-warning)' : 'var(--color-error)',
            minWidth: 40,
            textAlign: 'right',
          }}>
            {pct}%
          </span>
          <span style={{ fontSize: 18, color: 'var(--color-text-secondary)' }}>
            {expanded ? '\u25B2' : '\u25BC'}
          </span>
        </div>
      </div>

      {expanded && (
        <div className="table-container" style={{ marginTop: 16 }}>
          <table className="table">
            <thead>
              <tr>
                <th>Control</th>
                <th>Title</th>
                <th>Level</th>
                <th>Status</th>
                <th>Findings</th>
              </tr>
            </thead>
            <tbody>
              {section.controls.map((cr: ComplianceControlResult) => (
                <tr key={cr.control.id}>
                  <td><code>{cr.control.id}</code></td>
                  <td>{cr.control.title}</td>
                  <td>L{cr.control.level}</td>
                  <td>
                    <span
                      className={`badge ${cr.status === 'PASS' ? 'badge-success' : cr.status === 'FAIL' ? 'badge-error' : 'badge-warning'}`}
                    >
                      {statusLabels[cr.status]}
                    </span>
                  </td>
                  <td>
                    {cr.findingCount > 0 ? (
                      <span style={{ color: 'var(--color-error)' }}>{cr.findingCount}</span>
                    ) : (
                      '-'
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

const CompliancePage: React.FC = () => {
  const selectedProfile = useProfileStore((s) => s.selectedProfileName);
  const selectedProvider = useProviderStore((s) => s.selectedProvider);
  const selectedProjectId = useGCPProjectStore((s) => s.selectedProjectId);
  const { frameworks, result, isLoading, error, loadFrameworks, runAssessment, clearError,
    gcpFrameworks, gcpResult, loadGCPFrameworks, runGCPAssessment,
    gcpHistory, loadGCPHistory, loadGCPComplianceById,
    awsHistory, loadAWSHistory, loadAWSScanById } =
    useComplianceStore();
  const [selectedRegion, setSelectedRegion] = useState('us-east-1');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (selectedProvider === 'gcp') {
      loadGCPFrameworks();
    } else {
      loadFrameworks();
    }
  }, [selectedProvider, loadFrameworks, loadGCPFrameworks]);

  // Subscribe to AWS compliance completed event
  useEffect(() => {
    if (selectedProvider !== 'aws') return;
    if (!window.electronAPI?.compliance?.onCompleted) return;
    const unsubscribe = window.electronAPI.compliance.onCompleted((res: any) => {
      useComplianceStore.setState({ result: res, isLoading: false });
      if (selectedProfile) loadAWSHistory(selectedProfile);
    });
    return () => unsubscribe();
  }, [selectedProvider, selectedProfile, loadAWSHistory]);

  // Subscribe to AWS compliance failed event
  useEffect(() => {
    if (selectedProvider !== 'aws') return;
    if (!window.electronAPI?.compliance?.onFailed) return;
    const unsubscribe = window.electronAPI.compliance.onFailed(({ error: err }: { error: string }) => {
      useComplianceStore.setState({ error: err, isLoading: false });
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
      useComplianceStore.setState({ result: null });
    }
  }, [selectedProvider, selectedProfile]);

  // Navigation persistence — auto-load most recent AWS result
  useEffect(() => {
    if (selectedProvider === 'aws' && !result && !isLoading && awsHistory.length > 0) {
      loadAWSScanById(awsHistory[0].id);
    }
  }, [selectedProvider, result, isLoading, awsHistory, loadAWSScanById]);

  // Subscribe to GCP compliance completed event
  useEffect(() => {
    if (!window.electronAPI?.gcp?.compliance?.onCompleted) return;
    const unsubscribe = window.electronAPI.gcp.compliance.onCompleted((result) => {
      useComplianceStore.setState({ gcpResult: result, isLoading: false });
      if (selectedProjectId) loadGCPHistory(selectedProjectId);
    });
    return () => unsubscribe();
  }, [selectedProjectId, loadGCPHistory]);

  // Subscribe to GCP compliance failed event
  useEffect(() => {
    if (!window.electronAPI?.gcp?.compliance?.onFailed) return;
    const unsubscribe = window.electronAPI.gcp.compliance.onFailed(({ error: err }) => {
      useComplianceStore.setState({ error: err, isLoading: false });
    });
    return () => unsubscribe();
  }, []);

  // Clear stale GCP result & load history when project changes
  useEffect(() => {
    if (selectedProvider === 'gcp' && selectedProjectId) {
      if (gcpResult && gcpResult.projectId !== selectedProjectId) {
        useComplianceStore.setState({ gcpResult: null });
      }
      loadGCPHistory(selectedProjectId);
    }
  }, [selectedProvider, selectedProjectId, loadGCPHistory]); // eslint-disable-line react-hooks/exhaustive-deps

  // Navigation persistence — auto-load most recent GCP result
  useEffect(() => {
    if (selectedProvider === 'gcp' && !gcpResult && !isLoading && gcpHistory.length > 0) {
      loadGCPComplianceById(gcpHistory[0].id);
    }
  }, [selectedProvider, gcpResult, isLoading, gcpHistory, loadGCPComplianceById]);

  const handleRun = () => {
    if (selectedProfile) {
      runAssessment(selectedProfile!, selectedRegion, 'cis-aws-v3');
      setExpandedSections(new Set());
    }
  };

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const regions = ['us-east-1', 'us-east-2', 'us-west-1', 'us-west-2', 'eu-west-1', 'eu-central-1', 'ap-southeast-1'];

  if (selectedProvider === 'gcp') {
    const handleGCPRun = () => {
      if (selectedProjectId) {
        runGCPAssessment(selectedProjectId);
        setExpandedSections(new Set());
      }
    };

    return (
      <>
        <header className="page-header">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <h1 className="page-title">Compliance</h1>
              <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: 12, fontSize: 12, fontWeight: 600, backgroundColor: 'var(--color-primary-glow)', color: 'var(--color-primary)' }}>Google Cloud</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {gcpHistory.length > 0 && (
                <select
                  className="global-profile-select"
                  value={gcpResult?.id || ''}
                  onChange={(e) => e.target.value && loadGCPComplianceById(e.target.value)}
                  style={{ minWidth: 260, fontSize: 12 }}
                >
                  <option value="" disabled>Past assessments ({gcpHistory.length})...</option>
                  {gcpHistory.map((h) => (
                    <option key={h.id} value={h.id}>
                      {new Date(h.assessedAt).toLocaleString()} — {h.overallScore}% ({h.passedControls}/{h.totalControls})
                    </option>
                  ))}
                </select>
              )}
              <button className="btn btn-primary" onClick={handleGCPRun} disabled={!selectedProjectId || isLoading}>
                {isLoading ? (<><div className="spinner" style={{ width: 16, height: 16 }} /> Assessing...</>) : 'Run Assessment'}
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

          {isLoading && !gcpResult && (
            <div className="loading-overlay">
              <div className="spinner" />
              <p>Running compliance assessment...</p>
            </div>
          )}

          {!gcpResult && !isLoading && (
            <div className="card mb-4">
              <h3 className="card-title mb-4">CIS Google Cloud Platform Benchmark v2.0</h3>
              <p className="text-secondary text-sm" style={{ marginBottom: 16 }}>
                Assess your GCP project against CIS Google Cloud Platform Foundation Benchmark controls covering IAM, Logging, Networking, VM Instances, Storage, Cloud SQL, BigQuery, and KMS.
                {gcpFrameworks.length > 0 && ` (${gcpFrameworks[0].controlCount} controls)`}
              </p>
              {!selectedProjectId && (
                <p className="text-secondary text-sm">Select a GCP project from the top bar to run assessment.</p>
              )}
            </div>
          )}

          {gcpResult && (
            <>
              {gcpResult.error && (
                <div className="card mb-4" style={{ borderColor: 'var(--color-warning)' }}>
                  <p className="text-secondary text-sm">{gcpResult.error}</p>
                </div>
              )}

              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-value" style={{
                    fontSize: 36,
                    color: gcpResult.overallScore >= 80 ? 'var(--color-success)' : gcpResult.overallScore >= 50 ? 'var(--color-warning)' : 'var(--color-error)',
                  }}>{gcpResult.overallScore}%</div>
                  <div className="stat-label">Overall Score</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value" style={{ color: 'var(--color-success)' }}>{gcpResult.passedControls}</div>
                  <div className="stat-label">Passed</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value" style={{ color: 'var(--color-error)' }}>{gcpResult.failedControls}</div>
                  <div className="stat-label">Failed</div>
                </div>
                <div className="stat-card">
                  <div className="stat-value" style={{ color: 'var(--color-text-secondary)' }}>{gcpResult.notCheckedControls}</div>
                  <div className="stat-label">Not Checked</div>
                </div>
              </div>

              {gcpResult.sections.map((section) => (
                <SectionCard
                  key={section.section}
                  section={section}
                  expanded={expandedSections.has(section.section)}
                  onToggle={() => toggleSection(section.section)}
                />
              ))}

              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
                <p className="text-secondary text-sm" style={{ margin: 0 }}>
                  Assessed at {new Date(gcpResult.assessedAt).toLocaleString()} | {gcpResult.framework.name} v{gcpResult.framework.version}
                  {gcpResult.duration ? ` | Duration: ${(gcpResult.duration / 1000).toFixed(1)}s` : ''}
                </p>
                <ExportCSVButton
                  data={gcpResult.sections.flatMap((s) =>
                    s.controls.map((c) => ({
                      section: s.section,
                      controlId: c.control.id,
                      title: c.control.title,
                      level: c.control.level,
                      status: c.status,
                      findings: c.findingCount,
                    }))
                  )}
                  columns={[
                    { key: 'section', label: 'Section' },
                    { key: 'controlId', label: 'Control ID' },
                    { key: 'title', label: 'Title' },
                    { key: 'level', label: 'Level' },
                    { key: 'status', label: 'Status' },
                    { key: 'findings', label: 'Findings' },
                  ]}
                  filename="cis-gcp-compliance-results"
                />
              </div>
            </>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <header className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 className="page-title">Compliance</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <select
              className="global-profile-select"
              value={selectedRegion}
              onChange={(e) => setSelectedRegion(e.target.value)}
              style={{ minWidth: 160 }}
            >
              {regions.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            {awsHistory.length > 0 && (
              <select
                className="global-profile-select"
                value={result?.id || ''}
                onChange={(e) => e.target.value && loadAWSScanById(e.target.value)}
                style={{ minWidth: 260, fontSize: 12 }}
              >
                <option value="" disabled>Past assessments ({awsHistory.length})...</option>
                {awsHistory.map((h: any) => (
                  <option key={h.id} value={h.id}>
                    {new Date(h.timestamp).toLocaleString()} — {h.totalControls > 0 ? Math.round((h.passCount / h.totalControls) * 100) : 0}% ({h.passCount}/{h.totalControls})
                  </option>
                ))}
              </select>
            )}
            <button
              className="btn btn-primary"
              onClick={handleRun}
              disabled={!selectedProfile || isLoading}
            >
              {isLoading ? (
                <>
                  <div className="spinner" style={{ width: 16, height: 16 }} />
                  Assessing...
                </>
              ) : (
                'Run Assessment'
              )}
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

        {/* No profile prompt */}
        {!selectedProfile && !result && (
          <div className="empty-state">
            <h3>No Profile Selected</h3>
            <p>Select an AWS profile from the top bar to assess your account against CIS AWS Foundations Benchmark v3.0{frameworks.length > 0 ? ` (${frameworks[0].controlCount} controls)` : ''}.</p>
          </div>
        )}

        {/* Results */}
        {result && (
          <>
            {result.error && (
              <div className="card mb-4" style={{ borderColor: 'var(--color-warning)' }}>
                <p className="text-secondary text-sm">{result.error}</p>
              </div>
            )}

            {/* Score overview */}
            <div className="stats-grid">
              <div className="stat-card">
                <div
                  className="stat-value"
                  style={{
                    fontSize: 36,
                    color: result.overallScore >= 80
                      ? 'var(--color-success)'
                      : result.overallScore >= 50
                      ? 'var(--color-warning)'
                      : 'var(--color-error)',
                  }}
                >
                  {result.overallScore}%
                </div>
                <div className="stat-label">Overall Score</div>
              </div>
              <div className="stat-card">
                <div className="stat-value" style={{ color: 'var(--color-success)' }}>
                  {result.passedControls}
                </div>
                <div className="stat-label">Passed</div>
              </div>
              <div className="stat-card">
                <div className="stat-value" style={{ color: 'var(--color-error)' }}>
                  {result.failedControls}
                </div>
                <div className="stat-label">Failed</div>
              </div>
              <div className="stat-card">
                <div className="stat-value" style={{ color: 'var(--color-text-secondary)' }}>
                  {result.notCheckedControls}
                </div>
                <div className="stat-label">Not Checked</div>
              </div>
            </div>

            {/* Section details */}
            {(result.sections || []).map((section) => (
              <SectionCard
                key={section.section}
                section={section}
                expanded={expandedSections.has(section.section)}
                onToggle={() => toggleSection(section.section)}
              />
            ))}

            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 12 }}>
              <p className="text-secondary text-sm" style={{ margin: 0 }}>
                Assessed at {new Date(result.assessedAt).toLocaleString()} | {result.framework?.name} v{result.framework?.version}
              </p>
              <ExportCSVButton
                data={(result.sections || []).flatMap((s) =>
                  (s.controls || []).map((c) => ({
                    section: s.section,
                    controlId: c.control.id,
                    title: c.control.title,
                    level: c.control.level,
                    status: c.status,
                    findings: c.findingCount,
                  }))
                )}
                columns={[
                  { key: 'section', label: 'Section' },
                  { key: 'controlId', label: 'Control ID' },
                  { key: 'title', label: 'Title' },
                  { key: 'level', label: 'Level' },
                  { key: 'status', label: 'Status' },
                  { key: 'findings', label: 'Findings' },
                ]}
                filename="cis-compliance-results"
              />
            </div>
          </>
        )}
      </div>
    </>
  );
};

export default CompliancePage;

// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSecurityStore, getFilteredFindings } from '../stores/securityStore';
import { useProfileStore } from '../stores/profileStore';
import { useProviderStore } from '../stores/providerStore';
import { useGCPProjectStore } from '../stores/gcpProjectStore';
import { useSettingsStore } from '../stores/settingsStore';
import { SecurityOverview } from '../components/security/SecurityOverview';
import { FindingsSeverityChart } from '../components/security/FindingsSeverityChart';
import { FindingsBySourceChart } from '../components/security/FindingsBySourceChart';
import { ComplianceStatusPanel } from '../components/security/ComplianceStatusPanel';
import { FindingsTable } from '../components/security/FindingsTable';
import { FindingDetailModal } from '../components/security/FindingDetailModal';
import { SecurityFilters } from '../components/security/SecurityFilters';
import NetworkReachability from '../components/security/NetworkReachability';
import ExportCSVButton from '../components/ExportCSVButton';
import type { NetworkReachabilityResult } from '../../shared/types';

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

type SecurityTab = 'posture' | 'network';

const SecurityPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<SecurityTab>('posture');
  const [networkResult, setNetworkResult] = useState<NetworkReachabilityResult | null>(null);
  const [networkLoading, setNetworkLoading] = useState(false);
  const [networkError, setNetworkError] = useState<string | null>(null);

  const {
    analysis,
    selectedFinding,
    selectedRegion,
    filters,
    scanMode,
    isLoading,
    isScanning,
    error,
    gcpHistory,
    setSelectedRegion,
    setFilters,
    setSelectedFinding,
    setScanMode,
    loadPosture,
    runProviderBestPractices,
    clearAnalysis,
    clearError,
    loadGCPHistory,
    loadGCPScanById,
    awsHistory,
    loadAWSHistory,
    loadAWSScanById,
  } = useSecurityStore();

  const selectedProfile = useProfileStore((s) => s.selectedProfileName);
  const selectedProvider = useProviderStore((s) => s.selectedProvider);
  const selectedProjectId = useGCPProjectStore((s) => s.selectedProjectId);
  const sccDefaultProject = useSettingsStore((s) => s.settings.gcpSccProjectId);
  const sccDefaultOrgId = useSettingsStore((s) => s.settings.gcpSccOrgId);
  const loadGCPSecurityPosture = useSecurityStore((s) => s.loadGCPSecurityPosture);

  const activeIdentity = selectedProvider === 'gcp' ? selectedProjectId : selectedProfile;
  const noIdentity = !activeIdentity;

  // Clear stale data when provider or project/profile changes
  useEffect(() => {
    clearAnalysis();
  }, [selectedProvider, activeIdentity, clearAnalysis]);

  // Subscribe to AWS security completed event
  useEffect(() => {
    if (selectedProvider !== 'aws') return;
    if (!window.electronAPI?.security?.onCompleted) return;
    const unsubscribe = window.electronAPI.security.onCompleted((result: any) => {
      useSecurityStore.setState({ analysis: result, isScanning: false });
      if (selectedProfile) loadAWSHistory(selectedProfile);
    });
    return () => unsubscribe();
  }, [selectedProvider, selectedProfile, loadAWSHistory]);

  // Subscribe to AWS security failed event
  useEffect(() => {
    if (selectedProvider !== 'aws') return;
    if (!window.electronAPI?.security?.onFailed) return;
    const unsubscribe = window.electronAPI.security.onFailed(({ error: err }: { error: string }) => {
      useSecurityStore.setState({ error: err, isScanning: false });
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
    if (selectedProvider === 'aws' && !analysis && !isLoading && !isScanning && awsHistory.length > 0) {
      loadAWSScanById(awsHistory[0].id);
    }
  }, [selectedProvider, analysis, isLoading, isScanning, awsHistory, loadAWSScanById]);

  // Load GCP history when project changes
  useEffect(() => {
    if (selectedProvider === 'gcp' && selectedProjectId) {
      loadGCPHistory(selectedProjectId);
    }
  }, [selectedProvider, selectedProjectId, loadGCPHistory]);

  // Navigation persistence — auto-load most recent GCP result
  useEffect(() => {
    if (selectedProvider === 'gcp' && !analysis && !isLoading && !isScanning && gcpHistory.length > 0) {
      loadGCPScanById(gcpHistory[0].id);
    }
  }, [selectedProvider, analysis, isLoading, isScanning, gcpHistory, loadGCPScanById]);

  // Subscribe to GCP security completed/failed events
  useEffect(() => {
    if (!window.electronAPI?.gcp?.security?.onCompleted) return;
    const unsubscribe = window.electronAPI.gcp.security.onCompleted((result) => {
      if (result.error) {
        useSecurityStore.setState({ analysis: result, error: result.error, isLoading: false, isScanning: false });
      } else {
        useSecurityStore.setState({ analysis: result, isLoading: false, isScanning: false });
      }
      if (selectedProjectId) loadGCPHistory(selectedProjectId);
    });
    return () => unsubscribe();
  }, [selectedProjectId, loadGCPHistory]);

  useEffect(() => {
    if (!window.electronAPI?.gcp?.security?.onFailed) return;
    const unsubscribe = window.electronAPI.gcp.security.onFailed(({ error: err }) => {
      useSecurityStore.setState({ error: err, isLoading: false, isScanning: false });
    });
    return () => unsubscribe();
  }, []);

  // Get filtered findings
  const state = useSecurityStore();
  const filteredFindings = useMemo(() => getFilteredFindings(state), [state]);

  const handleRegionChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setSelectedRegion(e.target.value);
    },
    [setSelectedRegion]
  );

  const handleRefresh = useCallback(() => {
    if (!activeIdentity) return;
    if (scanMode === 'best_practices') {
      runProviderBestPractices(selectedProvider, activeIdentity, selectedRegion);
      return;
    }
    if (selectedProvider === 'gcp') {
      // SCC honors two Settings overrides:
      //   - "Default SCC Project" → quota project + project-scope fallback
      //   - "Default SCC Organization ID" → org-scope listFindings parent
      const sccTarget = sccDefaultProject || activeIdentity;
      loadGCPSecurityPosture(sccTarget, { orgId: sccDefaultOrgId || undefined });
      return;
    }
    loadPosture(selectedProvider, activeIdentity, selectedRegion);
  }, [activeIdentity, selectedProvider, selectedRegion, scanMode, sccDefaultProject, sccDefaultOrgId, loadPosture, loadGCPSecurityPosture, runProviderBestPractices]);

  const handleScanModeChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      setScanMode(e.target.value as 'security_hub' | 'best_practices');
    },
    [setScanMode]
  );

  const handleRunScan = useCallback(() => {
    if (!activeIdentity) return;
    runProviderBestPractices(selectedProvider, activeIdentity, selectedRegion);
  }, [activeIdentity, selectedProvider, selectedRegion, runProviderBestPractices]);

  const handleSelectFinding = useCallback(
    (finding: typeof selectedFinding) => {
      setSelectedFinding(finding);
    },
    [setSelectedFinding]
  );

  const handleCloseModal = useCallback(() => {
    setSelectedFinding(null);
  }, [setSelectedFinding]);

  const handleAnalyzeNetwork = useCallback(async () => {
    if (!activeIdentity || selectedProvider !== 'aws' || !window.electronAPI?.network) return;
    setNetworkLoading(true);
    setNetworkError(null);
    try {
      const response = await window.electronAPI.network.analyzeReachability(activeIdentity, selectedRegion);
      if (response.success && response.data) {
        setNetworkResult(response.data);
      } else {
        setNetworkError(response.error || 'Failed to analyze network');
      }
    } catch (err) {
      setNetworkError(err instanceof Error ? err.message : 'Network analysis failed');
    } finally {
      setNetworkLoading(false);
    }
  }, [activeIdentity, selectedProvider, selectedRegion]);

  return (
    <>
      <header className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 className="page-title">Security Posture</h1>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            {/* Scan Mode Selector */}
            {!noIdentity && (
              <select
                className="global-profile-select"
                value={scanMode}
                onChange={handleScanModeChange}
                style={{ minWidth: 200 }}
              >
                <option value="security_hub">
                  {selectedProvider === 'gcp' ? 'Security Command Center' : 'Security Hub'}
                </option>
                <option value="best_practices">Best Practices Scan</option>
              </select>
            )}
            {/* Region Selector (AWS only) */}
            {!noIdentity && selectedProvider === 'aws' && (
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
            )}
            {/* GCP History Dropdown */}
            {selectedProvider === 'gcp' && gcpHistory.length > 0 && (
              <select
                className="global-profile-select"
                value={analysis?.id || ''}
                onChange={(e) => e.target.value && loadGCPScanById(e.target.value)}
                style={{ minWidth: 260, fontSize: 12 }}
              >
                <option value="" disabled>Past scans ({gcpHistory.length})...</option>
                {gcpHistory.map((h) => (
                  <option key={h.id} value={h.id}>
                    {new Date(h.timestamp).toLocaleString()} — {h.scanMode === 'best_practices' ? 'BP' : 'SCC'} ({h.totalFindings} findings)
                  </option>
                ))}
              </select>
            )}
            {/* AWS History Dropdown */}
            {selectedProvider === 'aws' && awsHistory.length > 0 && (
              <select
                className="global-profile-select"
                value={analysis?.id || ''}
                onChange={(e) => e.target.value && loadAWSScanById(e.target.value)}
                style={{ minWidth: 260, fontSize: 12 }}
              >
                <option value="" disabled>Past scans ({awsHistory.length})...</option>
                {awsHistory.map((h: any) => (
                  <option key={h.id} value={h.id}>
                    {new Date(h.timestamp).toLocaleString()} — {h.scanMode === 'best_practices' ? 'BP' : 'SH'} ({h.totalFindings} findings)
                  </option>
                ))}
              </select>
            )}
            {scanMode === 'best_practices' && !noIdentity && (
              <button
                className="btn btn-secondary"
                onClick={handleRunScan}
                disabled={isScanning}
              >
                {isScanning ? 'Scanning...' : 'Run Scan'}
              </button>
            )}
            <button
              className="btn btn-primary"
              onClick={handleRefresh}
              disabled={isLoading || isScanning || noIdentity}
            >
              {(isLoading || isScanning) ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>
      </header>

      <div className="page-content">
        {/* No identity selected */}
        {noIdentity && (
          <div style={{ backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)', borderRadius: 8, padding: 40, textAlign: 'center' }}>
            <h3 style={{ margin: '0 0 8px', color: 'var(--color-text)' }}>
              {selectedProvider === 'gcp' ? 'No GCP Project Selected' : 'No Profile Selected'}
            </h3>
            <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
              {selectedProvider === 'gcp'
                ? 'Select a GCP project from the top bar to view security data.'
                : 'Select an AWS profile from the top bar to view security data.'}
            </p>
          </div>
        )}

        {/* Tab Bar (AWS has network tab, GCP only posture) */}
        {!noIdentity && (
        <>
        <div className="tabs">
          <button
            className={`tab ${activeTab === 'posture' ? 'active' : ''}`}
            onClick={() => setActiveTab('posture')}
          >
            Security Posture
          </button>
          {selectedProvider === 'aws' && (
          <button
            className={`tab ${activeTab === 'network' ? 'active' : ''}`}
            onClick={() => setActiveTab('network')}
          >
            Network Reachability
          </button>
          )}
        </div>

        {/* Network Reachability Tab (AWS only) */}
        {activeTab === 'network' && selectedProvider === 'aws' && activeIdentity && (
          <NetworkReachability
            result={networkResult}
            isLoading={networkLoading}
            onAnalyze={handleAnalyzeNetwork}
            error={networkError}
          />
        )}

        {/* Security Posture Tab */}
        {activeTab === 'posture' && (
          <>
        {/* Error display */}
        {error && (
          <div
            style={{
              backgroundColor: 'var(--color-error-glow)',
              border: '1px solid var(--color-error)',
              borderRadius: 8,
              padding: 16,
              marginBottom: 24,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
            }}
          >
            <div>
              <strong style={{ color: 'var(--color-error)' }}>Error:</strong>{' '}
              <span style={{ color: 'var(--color-text)' }}>{error}</span>
              {selectedProvider === 'aws' && error.includes('not enabled') && scanMode === 'security_hub' && (
                <p
                  style={{
                    margin: '8px 0 0',
                    fontSize: 12,
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  To enable Security Hub, go to the{' '}
                  <a
                    href={`https://${selectedRegion}.console.aws.amazon.com/securityhub/home?region=${selectedRegion}#/enable`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--color-primary)' }}
                  >
                    AWS Security Hub Console
                  </a>
                  , or{' '}
                  <button
                    onClick={() => setScanMode('best_practices')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: 'var(--color-primary)',
                      cursor: 'pointer',
                      padding: 0,
                      fontSize: 'inherit',
                      textDecoration: 'underline',
                    }}
                  >
                    switch to Best Practices mode
                  </button>{' '}
                  to scan resources directly.
                </p>
              )}
            </div>
            <button
              onClick={clearError}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--color-error)',
                cursor: 'pointer',
                fontSize: 18,
                padding: 4,
                lineHeight: 1,
              }}
            >
              &times;
            </button>
          </div>
        )}

        {/* Best Practices mode - prompt to run scan if no analysis */}
        {scanMode === 'best_practices' && !analysis && !isScanning && !error && (
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
              {selectedProvider === 'gcp'
                ? 'This mode scans your GCP resources directly against security best practices.'
                : 'This mode scans your AWS resources directly against security best practices.'}
              <br />
              {selectedProvider === 'aws' && 'Checks include: Security Groups, S3 buckets, IAM users, RDS instances, and EBS volumes.'}
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

        {/* Security Hub / SCC mode - prompt if no analysis */}
        {scanMode === 'security_hub' && !analysis && !isLoading && !error && (
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
              {selectedProvider === 'gcp' ? 'Security Command Center' : 'Security Hub'}
            </h3>
            <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
              Click Refresh to load security findings.
            </p>
          </div>
        )}

        {/* Security content */}
        {(analysis || isLoading || isScanning) && (
          <>
            {/* Overview Stats */}
            <SecurityOverview summary={analysis?.summary ?? null} isLoading={isLoading || isScanning} />

            {/* Charts Row */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))',
                gap: 24,
                marginBottom: 24,
              }}
            >
              <FindingsSeverityChart summary={analysis?.summary ?? null} isLoading={isLoading || isScanning} />
              <FindingsBySourceChart summary={analysis?.summary ?? null} isLoading={isLoading || isScanning} />
            </div>

            {/* Compliance Panel (AWS only - has standards) */}
            {selectedProvider === 'aws' && (
              <ComplianceStatusPanel
                scores={analysis?.summary?.complianceScores ?? []}
                standards={analysis?.enabledStandards ?? []}
                isLoading={isLoading || isScanning}
              />
            )}

            {/* Filters */}
            <SecurityFilters filters={filters} onFiltersChange={setFilters} />

            {/* Export + Findings Table */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
              <ExportCSVButton
                data={filteredFindings.map((f) => ({
                  title: f.title,
                  severity: f.severity,
                  status: f.status,
                  resource: f.resourceId || '',
                  source: f.source || '',
                  description: f.description || '',
                }))}
                columns={[
                  { key: 'title', label: 'Title' },
                  { key: 'severity', label: 'Severity' },
                  { key: 'status', label: 'Status' },
                  { key: 'resource', label: 'Resource' },
                  { key: 'source', label: 'Source' },
                  { key: 'description', label: 'Description' },
                ]}
                filename="security-findings"
              />
            </div>

            {/* Findings Table */}
            <FindingsTable
              findings={filteredFindings}
              isLoading={isLoading || isScanning}
              onSelectFinding={handleSelectFinding}
            />
          </>
        )}
          </>
        )}
        </>
        )}
      </div>

      {/* Finding Detail Modal */}
      <FindingDetailModal finding={selectedFinding} onClose={handleCloseModal} />
    </>
  );
};

export default SecurityPage;

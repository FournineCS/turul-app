// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React, { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useScanStore } from '../stores/scanStore';
import { useAssessmentStore } from '../stores/assessmentStore';
import { useProfileStore } from '../stores/profileStore';
import { useProviderStore } from '../stores/providerStore';
import { useGCPProjectStore } from '../stores/gcpProjectStore';
import { useToastStore } from '../stores/toastStore';
import type { CloudProvider } from '../../shared/types';
import ExportCSVButton from '../components/ExportCSVButton';
import type { AssessmentSummary } from '../../shared/types';

type HistoryTab = 'scans' | 'assessments';
type ScanSortColumn = 'date' | 'profile' | 'regions' | 'services' | 'resources' | 'duration' | 'status';
type AssessmentSortColumn = 'date' | 'profile' | 'region' | 'grade' | 'score' | 'duration';
type StatusFilter = 'all' | 'completed' | 'running' | 'failed' | 'cancelled';

const GRADE_COLORS: Record<string, string> = {
  A: 'var(--color-success)',
  B: 'var(--color-success)',
  C: 'var(--color-warning)',
  D: 'var(--color-warning)',
  F: 'var(--color-error)',
};

const GRADE_ORDER: Record<string, number> = { A: 5, B: 4, C: 3, D: 2, F: 1 };

const HistoryPage: React.FC = () => {
  const { scans, isLoading, loadScans, deleteScan } = useScanStore();
  const {
    assessmentHistory,
    isLoadingHistory,
    loadHistory,
    loadAssessment,
    deleteAssessment,
  } = useAssessmentStore();
  const navigate = useNavigate();
  const selectedProfileName = useProfileStore((s) => s.selectedProfileName);
  const selectedProvider = useProviderStore((s) => s.selectedProvider) as CloudProvider;
  const selectedProjectId = useGCPProjectStore((s) => s.selectedProjectId);
  const activeIdentity = selectedProvider === 'gcp' ? selectedProjectId : selectedProfileName;
  const addToast = useToastStore((s) => s.addToast);
  const [activeTab, setActiveTab] = useState<HistoryTab>('scans');
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [assessmentDeleteConfirm, setAssessmentDeleteConfirm] = useState<string | null>(null);
  const [generatingPdfId, setGeneratingPdfId] = useState<string | null>(null);

  // Sorting state
  const [scanSortColumn, setScanSortColumn] = useState<ScanSortColumn>('date');
  const [scanSortDir, setScanSortDir] = useState<'asc' | 'desc'>('desc');
  const [assessmentSortColumn, setAssessmentSortColumn] = useState<AssessmentSortColumn>('date');
  const [assessmentSortDir, setAssessmentSortDir] = useState<'asc' | 'desc'>('desc');

  // Status filter
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  useEffect(() => {
    loadScans(selectedProvider);
    loadHistory();
  }, [loadScans, loadHistory, selectedProvider]);

  const handleDelete = async (scanId: string) => {
    await deleteScan(scanId);
    setDeleteConfirm(null);
  };

  const handleAssessmentDelete = async (id: string) => {
    await deleteAssessment(id);
    setAssessmentDeleteConfirm(null);
  };

  const handleViewAssessment = async (id: string) => {
    await loadAssessment(id);
    navigate('/assessment');
  };

  const handleAssessmentPdf = async (assessment: AssessmentSummary) => {
    if (!window.electronAPI?.assessment || !window.electronAPI?.app) return;

    setGeneratingPdfId(assessment.id);
    try {
      const outputDir = await window.electronAPI.app.selectDirectory();
      if (!outputDir) {
        setGeneratingPdfId(null);
        return;
      }

      const response = await window.electronAPI.assessment.getById(assessment.id);
      if (response.success && response.data) {
        const result = await window.electronAPI.assessment.generateReport(response.data, outputDir);
        if (result) {
          addToast('success', `Report saved to ${outputDir}`);
        }
      }
    } catch (err) {
      addToast('error', `Failed to generate PDF: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
    setGeneratingPdfId(null);
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'completed':
        return 'badge-success';
      case 'running':
        return 'badge-info';
      case 'failed':
        return 'badge-error';
      case 'cancelled':
        return 'badge-warning';
      default:
        return 'badge-info';
    }
  };

  const getDurationMs = (startedAt: string, completedAt?: string) => {
    if (!completedAt) return Infinity;
    return new Date(completedAt).getTime() - new Date(startedAt).getTime();
  };

  const formatDuration = (startedAt: string, completedAt?: string) => {
    if (!completedAt) return 'In progress';
    const durationMs = getDurationMs(startedAt, completedAt);
    if (durationMs < 1000) return '< 1s';
    if (durationMs < 60000) return `${Math.round(durationMs / 1000)}s`;
    if (durationMs < 3600000) return `${Math.round(durationMs / 60000)}m`;
    return `${Math.round(durationMs / 3600000)}h`;
  };

  const formatAssessmentDuration = (ms: number) => {
    const seconds = Math.round(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remaining = seconds % 60;
    return `${minutes}m ${remaining}s`;
  };

  // Filter by global profile/project identity
  const profileScans = useMemo(() => {
    if (!activeIdentity) return [];
    return scans.filter((s) => s.profile === activeIdentity);
  }, [scans, activeIdentity]);

  const profileAssessments = useMemo(() => {
    if (!activeIdentity) return [];
    return assessmentHistory.filter((a) => a.profile === activeIdentity);
  }, [assessmentHistory, activeIdentity]);

  // Filtered scans (status filter on top of profile filter)
  const filteredScans = useMemo(() => {
    if (statusFilter === 'all') return profileScans;
    return profileScans.filter((s) => s.status === statusFilter);
  }, [profileScans, statusFilter]);

  // Sorted scans
  const sortedScans = useMemo(() => {
    return [...filteredScans].sort((a, b) => {
      let cmp = 0;
      switch (scanSortColumn) {
        case 'date':
          cmp = new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime();
          break;
        case 'profile':
          cmp = a.profile.localeCompare(b.profile);
          break;
        case 'regions':
          cmp = a.regions.length - b.regions.length;
          break;
        case 'services':
          cmp = a.services.length - b.services.length;
          break;
        case 'resources':
          cmp = a.resourceCount - b.resourceCount;
          break;
        case 'duration':
          cmp = getDurationMs(a.startedAt, a.completedAt) - getDurationMs(b.startedAt, b.completedAt);
          break;
        case 'status':
          cmp = a.status.localeCompare(b.status);
          break;
      }
      return scanSortDir === 'asc' ? cmp : -cmp;
    });
  }, [filteredScans, scanSortColumn, scanSortDir]);

  // Sorted assessments
  const sortedAssessments = useMemo(() => {
    return [...profileAssessments].sort((a, b) => {
      let cmp = 0;
      switch (assessmentSortColumn) {
        case 'date':
          cmp = new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
          break;
        case 'profile':
          cmp = a.profile.localeCompare(b.profile);
          break;
        case 'region':
          cmp = a.region.localeCompare(b.region);
          break;
        case 'grade':
          cmp = (GRADE_ORDER[a.overallGrade] || 0) - (GRADE_ORDER[b.overallGrade] || 0);
          break;
        case 'score':
          cmp = a.overallScore - b.overallScore;
          break;
        case 'duration':
          cmp = a.duration - b.duration;
          break;
      }
      return assessmentSortDir === 'asc' ? cmp : -cmp;
    });
  }, [profileAssessments, assessmentSortColumn, assessmentSortDir]);

  const handleScanSort = (col: ScanSortColumn) => {
    if (scanSortColumn === col) {
      setScanSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setScanSortColumn(col);
      setScanSortDir('desc');
    }
  };

  const handleAssessmentSort = (col: AssessmentSortColumn) => {
    if (assessmentSortColumn === col) {
      setAssessmentSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setAssessmentSortColumn(col);
      setAssessmentSortDir('desc');
    }
  };

  const scanSortIcon = (col: ScanSortColumn) =>
    scanSortColumn === col ? (scanSortDir === 'asc' ? ' ▲' : ' ▼') : '';

  const assessmentSortIcon = (col: AssessmentSortColumn) =>
    assessmentSortColumn === col ? (assessmentSortDir === 'asc' ? ' ▲' : ' ▼') : '';

  // Quick stats
  const totalResources = useMemo(
    () => profileScans.filter((s) => s.status === 'completed').reduce((sum, s) => sum + s.resourceCount, 0),
    [profileScans]
  );

  return (
    <>
      <header className="page-header">
        <div className="flex justify-between items-center">
          <h1 className="page-title">History</h1>
          <div className="flex gap-2">
            <Link to="/scan" className="btn btn-primary">
              New Scan
            </Link>
            <Link to="/assessment" className="btn btn-secondary">
              New Assessment
            </Link>
          </div>
        </div>
      </header>

      <div className="page-content">
        <div className="tabs">
          <button
            className={`tab ${activeTab === 'scans' ? 'active' : ''}`}
            onClick={() => { setActiveTab('scans'); setAssessmentDeleteConfirm(null); setDeleteConfirm(null); }}
          >
            Scans ({profileScans.length})
          </button>
          <button
            className={`tab ${activeTab === 'assessments' ? 'active' : ''}`}
            onClick={() => { setActiveTab('assessments'); setAssessmentDeleteConfirm(null); setDeleteConfirm(null); }}
          >
            Assessments ({profileAssessments.length})
          </button>
        </div>

        {activeTab === 'scans' && (
          <>
            {/* Quick stats + filters bar */}
            {profileScans.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {(['all', 'completed', 'running', 'failed', 'cancelled'] as StatusFilter[]).map((status) => {
                      const count = status === 'all' ? profileScans.length : profileScans.filter((s) => s.status === status).length;
                      if (count === 0 && status !== 'all') return null;
                      return (
                        <button
                          key={status}
                          className={`btn btn-sm ${statusFilter === status ? 'btn-primary' : 'btn-secondary'}`}
                          onClick={() => setStatusFilter(status)}
                          style={{ textTransform: 'capitalize' }}
                        >
                          {status} ({count})
                        </button>
                      );
                    })}
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                    {totalResources.toLocaleString()} total resources discovered
                  </span>
                </div>
                <ExportCSVButton
                  data={sortedScans.map((s) => ({
                    date: new Date(s.startedAt).toLocaleString(),
                    profile: s.profile,
                    regions: s.regions.join(', '),
                    services: s.services.join(', '),
                    resources: String(s.resourceCount),
                    duration: formatDuration(s.startedAt, s.completedAt),
                    status: s.status,
                  }))}
                  columns={[
                    { key: 'date', label: 'Date' },
                    { key: 'profile', label: 'Profile' },
                    { key: 'regions', label: 'Regions' },
                    { key: 'services', label: 'Services' },
                    { key: 'resources', label: 'Resources' },
                    { key: 'duration', label: 'Duration' },
                    { key: 'status', label: 'Status' },
                  ]}
                  filename="scan-history"
                  label="Export Scans CSV"
                />
              </div>
            )}

            {isLoading ? (
              <div className="loading-overlay">
                <div className="spinner" />
                <p>Loading scan history...</p>
              </div>
            ) : !activeIdentity ? (
              <div className="empty-state">
                <h3>No profile selected</h3>
                <p>Select a {selectedProvider === 'gcp' ? 'GCP project' : 'AWS profile'} from the top bar to view scan history</p>
              </div>
            ) : profileScans.length === 0 ? (
              <div className="empty-state">
                <h3>No scans for this profile</h3>
                <p>No scans found for {activeIdentity}</p>
                <Link to="/scan" className="btn btn-primary mt-4">
                  Start Scan
                </Link>
              </div>
            ) : sortedScans.length === 0 ? (
              <div className="empty-state">
                <h3>No matching scans</h3>
                <p>No scans match the selected status filter</p>
                <button className="btn btn-secondary mt-4" onClick={() => setStatusFilter('all')}>
                  Clear Filter
                </button>
              </div>
            ) : (
              <div className="card">
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th className="sortable" onClick={() => handleScanSort('date')} style={{ cursor: 'pointer' }}>
                          Date{scanSortIcon('date')}
                        </th>
                        <th className="sortable" onClick={() => handleScanSort('profile')} style={{ cursor: 'pointer' }}>
                          Profile{scanSortIcon('profile')}
                        </th>
                        <th className="sortable" onClick={() => handleScanSort('regions')} style={{ cursor: 'pointer' }}>
                          Regions{scanSortIcon('regions')}
                        </th>
                        <th className="sortable" onClick={() => handleScanSort('services')} style={{ cursor: 'pointer' }}>
                          Services{scanSortIcon('services')}
                        </th>
                        <th className="sortable" onClick={() => handleScanSort('resources')} style={{ cursor: 'pointer' }}>
                          Resources{scanSortIcon('resources')}
                        </th>
                        <th className="sortable" onClick={() => handleScanSort('duration')} style={{ cursor: 'pointer' }}>
                          Duration{scanSortIcon('duration')}
                        </th>
                        <th className="sortable" onClick={() => handleScanSort('status')} style={{ cursor: 'pointer' }}>
                          Status{scanSortIcon('status')}
                        </th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedScans.map((scan) => (
                        <tr key={scan.id}>
                          <td>
                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                {new Date(scan.startedAt).toLocaleDateString()}
                                <span
                                  className="badge"
                                  style={{
                                    fontSize: 10,
                                    padding: '1px 6px',
                                    backgroundColor: 'var(--color-primary-glow)',
                                    color: 'var(--color-primary)',
                                  }}
                                >
                                  {(scan.cloudProvider || 'aws').toUpperCase()}
                                </span>
                              </div>
                              <div className="text-secondary text-sm">
                                {new Date(scan.startedAt).toLocaleTimeString()}
                              </div>
                            </div>
                          </td>
                          <td>{scan.profile}</td>
                          <td>
                            <span title={scan.regions.join(', ')}>
                              {scan.regions.length} region(s)
                            </span>
                          </td>
                          <td>
                            <span title={scan.services.join(', ')}>
                              {scan.services.length} service(s)
                            </span>
                          </td>
                          <td>{scan.resourceCount}</td>
                          <td>{formatDuration(scan.startedAt, scan.completedAt)}</td>
                          <td>
                            <span className={`badge ${getStatusBadgeClass(scan.status)}`}>
                              {scan.status}
                            </span>
                            {scan.error && (
                              <div className="text-sm" style={{ color: 'var(--color-error)', marginTop: 4 }}>
                                {scan.error}
                              </div>
                            )}
                          </td>
                          <td>
                            <div className="flex gap-2">
                              {scan.status === 'completed' && (
                                <>
                                  <Link
                                    to={`/resources/${scan.id}`}
                                    className="btn btn-sm btn-secondary"
                                  >
                                    Resources
                                  </Link>
                                  <Link
                                    to={`/topology/${scan.id}`}
                                    className="btn btn-sm btn-secondary"
                                  >
                                    Topology
                                  </Link>
                                </>
                              )}
                              {deleteConfirm === scan.id ? (
                                <>
                                  <button
                                    className="btn btn-sm btn-danger"
                                    onClick={() => handleDelete(scan.id)}
                                  >
                                    Confirm
                                  </button>
                                  <button
                                    className="btn btn-sm btn-secondary"
                                    onClick={() => setDeleteConfirm(null)}
                                  >
                                    Cancel
                                  </button>
                                </>
                              ) : (
                                <button
                                  className="btn btn-sm btn-secondary"
                                  onClick={() => setDeleteConfirm(scan.id)}
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'assessments' && (
          <>
            {/* Export bar */}
            {assessmentHistory.length > 0 && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                <ExportCSVButton
                  data={sortedAssessments.map((a) => ({
                    date: new Date(a.timestamp).toLocaleString(),
                    profile: a.profile,
                    region: a.region,
                    grade: a.overallGrade,
                    score: String(a.overallScore),
                    critical: String(a.criticalCount),
                    high: String(a.highCount),
                    medium: String(a.mediumCount),
                    low: String(a.lowCount),
                    duration: formatAssessmentDuration(a.duration),
                  }))}
                  columns={[
                    { key: 'date', label: 'Date' },
                    { key: 'profile', label: 'Profile' },
                    { key: 'region', label: 'Region' },
                    { key: 'grade', label: 'Grade' },
                    { key: 'score', label: 'Score' },
                    { key: 'critical', label: 'Critical' },
                    { key: 'high', label: 'High' },
                    { key: 'medium', label: 'Medium' },
                    { key: 'low', label: 'Low' },
                    { key: 'duration', label: 'Duration' },
                  ]}
                  filename="assessment-history"
                  label="Export Assessments CSV"
                />
              </div>
            )}

            {isLoadingHistory ? (
              <div className="loading-overlay">
                <div className="spinner" />
                <p>Loading assessment history...</p>
              </div>
            ) : !activeIdentity ? (
              <div className="empty-state">
                <h3>No profile selected</h3>
                <p>Select a {selectedProvider === 'gcp' ? 'GCP project' : 'AWS profile'} from the top bar to view assessment history</p>
              </div>
            ) : profileAssessments.length === 0 ? (
              <div className="empty-state">
                <h3>No assessments for this profile</h3>
                <p>No assessments found for {activeIdentity}</p>
                <Link to="/assessment" className="btn btn-primary mt-4">
                  Run Assessment
                </Link>
              </div>
            ) : (
              <div className="card">
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th className="sortable" onClick={() => handleAssessmentSort('date')} style={{ cursor: 'pointer' }}>
                          Date{assessmentSortIcon('date')}
                        </th>
                        <th className="sortable" onClick={() => handleAssessmentSort('profile')} style={{ cursor: 'pointer' }}>
                          Profile{assessmentSortIcon('profile')}
                        </th>
                        <th className="sortable" onClick={() => handleAssessmentSort('region')} style={{ cursor: 'pointer' }}>
                          Region{assessmentSortIcon('region')}
                        </th>
                        <th className="sortable" onClick={() => handleAssessmentSort('grade')} style={{ cursor: 'pointer' }}>
                          Grade{assessmentSortIcon('grade')}
                        </th>
                        <th className="sortable" onClick={() => handleAssessmentSort('score')} style={{ cursor: 'pointer' }}>
                          Score{assessmentSortIcon('score')}
                        </th>
                        <th>Recommendations</th>
                        <th className="sortable" onClick={() => handleAssessmentSort('duration')} style={{ cursor: 'pointer' }}>
                          Duration{assessmentSortIcon('duration')}
                        </th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedAssessments.map((a) => (
                        <tr key={a.id}>
                          <td>
                            <div>
                              <div>{new Date(a.timestamp).toLocaleDateString()}</div>
                              <div className="text-secondary text-sm">
                                {new Date(a.timestamp).toLocaleTimeString()}
                              </div>
                            </div>
                          </td>
                          <td>{a.profile}</td>
                          <td>{a.region}</td>
                          <td>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: 32,
                                height: 32,
                                borderRadius: '50%',
                                background: GRADE_COLORS[a.overallGrade] || 'var(--color-text-secondary)',
                                color: 'var(--color-bg)',
                                fontWeight: 700,
                                fontSize: 14,
                              }}
                            >
                              {a.overallGrade}
                            </span>
                          </td>
                          <td>{a.overallScore}/100</td>
                          <td>
                            <div className="flex gap-1" style={{ flexWrap: 'wrap' }}>
                              {a.criticalCount > 0 && (
                                <span className="badge badge-error">{a.criticalCount} critical</span>
                              )}
                              {a.highCount > 0 && (
                                <span className="badge badge-warning">{a.highCount} high</span>
                              )}
                              {a.mediumCount > 0 && (
                                <span className="badge badge-info">{a.mediumCount} med</span>
                              )}
                              {a.lowCount > 0 && (
                                <span className="badge" style={{ background: 'var(--color-bg-tertiary)' }}>{a.lowCount} low</span>
                              )}
                              {a.totalRecommendations === 0 && (
                                <span className="badge badge-success">None</span>
                              )}
                            </div>
                          </td>
                          <td>{formatAssessmentDuration(a.duration)}</td>
                          <td>
                            <div className="flex gap-2">
                              <button
                                className="btn btn-sm btn-primary"
                                onClick={() => handleViewAssessment(a.id)}
                              >
                                View
                              </button>
                              <button
                                className="btn btn-sm btn-secondary"
                                disabled={generatingPdfId === a.id}
                                onClick={() => handleAssessmentPdf(a)}
                              >
                                {generatingPdfId === a.id ? 'Generating...' : 'PDF'}
                              </button>
                              {assessmentDeleteConfirm === a.id ? (
                                <>
                                  <button
                                    className="btn btn-sm btn-danger"
                                    onClick={() => handleAssessmentDelete(a.id)}
                                  >
                                    Confirm
                                  </button>
                                  <button
                                    className="btn btn-sm btn-secondary"
                                    onClick={() => setAssessmentDeleteConfirm(null)}
                                  >
                                    Cancel
                                  </button>
                                </>
                              ) : (
                                <button
                                  className="btn btn-sm btn-secondary"
                                  onClick={() => setAssessmentDeleteConfirm(a.id)}
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
};

export default HistoryPage;

// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useScanStore } from '../stores/scanStore';
import { useAssessmentStore } from '../stores/assessmentStore';
import { useCostStore } from '../stores/costStore';
import { useProfileStore } from '../stores/profileStore';
import { useProviderStore } from '../stores/providerStore';
import { useGCPProjectStore } from '../stores/gcpProjectStore';
import CostSummaryWidget from '../components/dashboard/CostSummaryWidget';
import SecurityPostureGauge from '../components/dashboard/SecurityPostureGauge';
import AssessmentGradeCard from '../components/dashboard/AssessmentGradeCard';
import ResourceTrendChart from '../components/dashboard/ResourceTrendChart';
import TopServicesPieChart from '../components/dashboard/TopServicesPieChart';
import QuickAssessCard from '../components/dashboard/QuickAssessCard';
import FullAssessmentProgress from '../components/dashboard/FullAssessmentProgress';

const DashboardPage: React.FC = () => {
  const { scans, isLoading, loadScans, scanProgress, isScanning } = useScanStore();
  const {
    assessmentHistory, result: assessmentResult, loadHistory, loadAssessment,
    gcpHistory, gcpResult, loadGCPHistory, loadGCPAssessmentById,
  } = useAssessmentStore();
  const { analysis: costAnalysis, isLoading: costLoading, loadCostAnalysis, clearAnalysis, loadGCPCostAnalysis } = useCostStore();
  const selectedProfile = useProfileStore((s) => s.selectedProfileName);
  const selectedProvider = useProviderStore((s) => s.selectedProvider);
  const selectedProjectId = useGCPProjectStore((s) => s.selectedProjectId);
  const activeIdentity = selectedProvider === 'gcp' ? selectedProjectId : selectedProfile;

  // Load scans + assessment history (provider-aware)
  useEffect(() => {
    loadScans(selectedProvider);
    if (selectedProvider === 'aws') {
      loadHistory();
    } else if (selectedProjectId) {
      loadGCPHistory(selectedProjectId);
    }
  }, [loadScans, loadHistory, loadGCPHistory, selectedProvider, selectedProjectId]);

  // Filter data by global profile/project identity
  const profileScans = activeIdentity
    ? scans.filter((s) => s.profile === activeIdentity)
    : [];
  const profileAssessments = selectedProvider === 'aws' && activeIdentity
    ? assessmentHistory.filter((a) => a.profile === activeIdentity)
    : [];

  // The active assessment result — provider-aware
  const activeAssessment = selectedProvider === 'gcp' ? gcpResult : assessmentResult;

  // Load the latest AWS assessment result for the selected profile
  useEffect(() => {
    if (selectedProvider === 'aws' && profileAssessments.length > 0 && !assessmentResult) {
      loadAssessment(profileAssessments[0].id);
    }
  }, [selectedProvider, profileAssessments, assessmentResult, loadAssessment]);

  // Load the latest GCP assessment result for the selected project
  useEffect(() => {
    if (selectedProvider === 'gcp' && gcpHistory.length > 0 && !gcpResult) {
      loadGCPAssessmentById(gcpHistory[0].id);
    }
  }, [selectedProvider, gcpHistory, gcpResult, loadGCPAssessmentById]);

  // Clear stale assessment data when identity changes
  useEffect(() => {
    if (selectedProvider === 'aws') {
      // Clear GCP data; clear AWS result so it reloads for new profile
      useAssessmentStore.setState({ gcpResult: null, result: null });
    } else {
      // Clear AWS data; clear GCP result so it reloads for new project
      useAssessmentStore.setState({ result: null, gcpResult: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIdentity, selectedProvider]);

  // Auto-load cost data — provider-aware
  useEffect(() => {
    if (selectedProvider === 'aws') {
      if (selectedProfile) {
        loadCostAnalysis(selectedProfile);
      }
    } else {
      // Clear AWS cost data so it doesn't bleed into the GCP dashboard
      clearAnalysis();
      // Attempt GCP cost load (gracefully no-ops if BigQuery not configured)
      if (selectedProjectId) {
        loadGCPCostAnalysis(selectedProjectId);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProvider, selectedProfile, selectedProjectId]);

  const latestScan = profileScans[0];
  const completedScans = profileScans.filter((s) => s.status === 'completed');
  const totalResources = completedScans.reduce((sum, s) => sum + s.resourceCount, 0);
  const hasAnyData =
    profileScans.length > 0 ||
    profileAssessments.length > 0 ||
    (selectedProvider === 'gcp' && gcpHistory.length > 0);
  const showQuickAssessHero = !!activeIdentity && !hasAnyData;

  return (
    <>
      <FullAssessmentProgress />
      <header
        className="page-header"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}
      >
        <h1 className="page-title" style={{ margin: 0 }}>
          Dashboard
          <span
            style={{
              fontSize: 12,
              fontWeight: 600,
              marginLeft: 12,
              padding: '4px 12px',
              borderRadius: 12,
              backgroundColor: 'var(--color-primary-glow)',
              color: 'var(--color-primary)',
              verticalAlign: 'middle',
            }}
          >
            {selectedProvider === 'gcp' ? 'Google Cloud' : 'AWS'}
          </span>
        </h1>
        {!showQuickAssessHero && activeIdentity && <QuickAssessCard variant="compact" />}
      </header>

      <div className="page-content">
        {showQuickAssessHero && <QuickAssessCard />}
        {/* Active Scan Progress */}
        {isScanning && scanProgress && (
          <div className="card mb-4">
            <div className="card-header">
              <h3 className="card-title">Scan in Progress</h3>
              <span className="badge badge-info">Running</span>
            </div>
            <div className="progress-info">
              <p>
                Region: <strong>{scanProgress.currentRegion}</strong> (
                {scanProgress.completedRegions}/{scanProgress.totalRegions})
              </p>
              <p>
                Service: <strong>{scanProgress.currentService}</strong> (
                {scanProgress.completedServices}/{scanProgress.totalServices})
              </p>
              <p>Resources Found: <strong>{scanProgress.resourcesFound}</strong></p>
            </div>
            <div className="progress-bar mt-4">
              <div
                className="progress-bar-fill"
                style={{
                  width: `${(scanProgress.completedRegions / scanProgress.totalRegions) * 100}%`,
                }}
              />
            </div>
            {scanProgress.errors.length > 0 && (
              <div className="mt-4">
                <p className="text-secondary">Errors: {scanProgress.errors.length}</p>
              </div>
            )}
          </div>
        )}

        {/* Stats */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-value">{profileScans.length}</div>
            <div className="stat-label">Total Scans</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{completedScans.length}</div>
            <div className="stat-label">Completed Scans</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">{totalResources}</div>
            <div className="stat-label">Total Resources</div>
          </div>
          <div className="stat-card">
            <div className="stat-value">
              {latestScan ? new Date(latestScan.startedAt).toLocaleDateString() : 'N/A'}
            </div>
            <div className="stat-label">Last Scan</div>
          </div>
        </div>

        {/* Dashboard Widgets */}
        <div className="dashboard-widgets-grid">
          <AssessmentGradeCard assessment={activeAssessment} />
          <SecurityPostureGauge assessment={activeAssessment} />
          <CostSummaryWidget data={costAnalysis} isLoading={costLoading} />
          <ResourceTrendChart scans={profileScans} />
          <TopServicesPieChart assessment={activeAssessment} />
        </div>

        {/* Quick Actions */}
        <div className="card mb-4">
          <h3 className="card-title mb-4">Quick Actions</h3>
          <div className="flex gap-4">
            <Link to="/scan" className="btn btn-primary">
              Start New Scan
            </Link>
            {latestScan && (
              <>
                <Link to={`/resources/${latestScan.id}`} className="btn btn-secondary">
                  View Latest Resources
                </Link>
                <Link to={`/topology/${latestScan.id}`} className="btn btn-secondary">
                  View Latest Topology
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Recent Scans */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Recent Scans</h3>
            <Link to="/history" className="btn btn-sm btn-secondary">
              View All
            </Link>
          </div>

          {isLoading ? (
            <div className="loading-overlay">
              <div className="spinner" />
              <p>Loading scans...</p>
            </div>
          ) : !activeIdentity ? (
            <div className="empty-state">
              <h3>No profile selected</h3>
              <p>Select a {selectedProvider === 'gcp' ? 'GCP project' : 'AWS profile'} from the top bar to view scan history</p>
            </div>
          ) : profileScans.length === 0 ? (
            <div className="empty-state">
              <h3>No scans for this profile yet</h3>
              <p>
                Click <strong>Assess my account fully</strong> above to populate this section
                — or start a custom scan from the <Link to="/scan">Scan page</Link>.
              </p>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>Profile</th>
                    <th>Regions</th>
                    <th>Resources</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {profileScans.slice(0, 5).map((scan) => (
                    <tr key={scan.id}>
                      <td>{scan.profile}</td>
                      <td>{scan.regions.length} region(s)</td>
                      <td>{scan.resourceCount}</td>
                      <td>
                        <span
                          className={`badge ${
                            scan.status === 'completed'
                              ? 'badge-success'
                              : scan.status === 'running'
                              ? 'badge-info'
                              : scan.status === 'failed'
                              ? 'badge-error'
                              : 'badge-warning'
                          }`}
                        >
                          {scan.status}
                        </span>
                      </td>
                      <td>{new Date(scan.startedAt).toLocaleString()}</td>
                      <td>
                        <div className="flex gap-2">
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
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default DashboardPage;

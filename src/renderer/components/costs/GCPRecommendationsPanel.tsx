// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React from 'react';
import type { GCPCostCategory, GCPOptimizationSnapshot } from '../../../shared/types';
import { useCostStore } from '../../stores/costStore';
import { useGCPProjectStore } from '../../stores/gcpProjectStore';
import { RecommendationSummaryCards } from './RecommendationSummaryCards';
import { RecommendationList } from './RecommendationList';
import { CUDCoveragePanel } from './CUDCoveragePanel';
import { CostBestPracticesPanel } from './CostBestPracticesPanel';
import { StoppedVMPanel } from './StoppedVMPanel';

type TabKey = GCPCostCategory | 'all';

const PROJECT_TABS: { key: TabKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'idle_resources', label: 'Idle Resources' },
  { key: 'rightsizing', label: 'Rightsizing' },
  { key: 'commitments', label: 'Commitments' },
  { key: 'best_practices', label: 'Best Practices' },
  { key: 'stopped_vms', label: 'Stopped VMs' },
];

const ORG_TABS: { key: TabKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'idle_resources', label: 'Idle Resources' },
  { key: 'rightsizing', label: 'Rightsizing' },
  { key: 'commitments', label: 'Commitments' },
  { key: 'best_practices', label: 'Best Practices' },
  { key: 'stopped_vms', label: 'Stopped VMs' },
];

interface Props {
  scope?: 'project' | 'org';
  orgId?: string;
  overrideSnapshot?: GCPOptimizationSnapshot;
}

export const GCPRecommendationsPanel: React.FC<Props> = ({ scope = 'project', orgId, overrideSnapshot }) => {
  const {
    gcpExpandedRecs,
    gcpExpandedRecsLoading,
    gcpExpandedRecsError,
    gcpCostBestPractices,
    gcpCostBPLoading,
    gcpCostBPError,
    gcpCUDCoverage,
    gcpCUDLoading,
    gcpCUDError,
    gcpStoppedVMs,
    gcpStoppedVMsLoading,
    gcpStoppedVMsError,
    gcpOrgExpandedRecs,
    gcpOrgExpandedRecsLoading,
    gcpOrgExpandedRecsError,
    gcpOrgScanProgress,
    gcpOrgStoppedVMs,
    gcpOrgStoppedVMsLoading,
    gcpOrgStoppedVMsError,
    gcpRecsTab,
    setGCPRecsTab,
    refreshGCPRecommendations,
    refreshGCPOrgRecommendations,
  } = useCostStore();

  const { selectedProjectId } = useGCPProjectStore();
  const isOrg = scope === 'org';

  const expandedRecs = overrideSnapshot?.expandedRecs ?? (isOrg ? gcpOrgExpandedRecs : gcpExpandedRecs);
  const expandedRecsLoading = overrideSnapshot ? false : (isOrg ? gcpOrgExpandedRecsLoading : gcpExpandedRecsLoading);
  const expandedRecsError = overrideSnapshot ? null : (isOrg ? gcpOrgExpandedRecsError : gcpExpandedRecsError);
  const stoppedVMs = overrideSnapshot?.stoppedVMs ?? (isOrg ? gcpOrgStoppedVMs : gcpStoppedVMs);
  const stoppedVMsLoading = overrideSnapshot ? false : (isOrg ? gcpOrgStoppedVMsLoading : gcpStoppedVMsLoading);
  const stoppedVMsError = overrideSnapshot ? null : (isOrg ? gcpOrgStoppedVMsError : gcpStoppedVMsError);

  const isAnyLoading = isOrg
    ? (gcpOrgExpandedRecsLoading || gcpOrgStoppedVMsLoading)
    : (gcpExpandedRecsLoading || gcpCostBPLoading || gcpCUDLoading || gcpStoppedVMsLoading);

  const canRefresh = isOrg ? !!orgId : !!selectedProjectId;
  const TABS = isOrg ? ORG_TABS : PROJECT_TABS;

  const handleRefresh = () => {
    if (isOrg && orgId) {
      refreshGCPOrgRecommendations(orgId);
    } else if (!isOrg && selectedProjectId) {
      refreshGCPRecommendations(selectedProjectId);
    }
  };

  const filteredRecs = React.useMemo(() => {
    if (!expandedRecs) return [];
    if (gcpRecsTab === 'all') return expandedRecs.recommendations;
    return expandedRecs.recommendations.filter((rec) => {
      const recMeta = expandedRecs.meta[rec.id];
      return recMeta?.uiCategory === gcpRecsTab;
    });
  }, [expandedRecs, gcpRecsTab]);

  return (
    <div>
      {/* Summary cards */}
      {expandedRecs && !expandedRecsLoading && (
        <RecommendationSummaryCards data={expandedRecs} stoppedVMs={stoppedVMs} />
      )}

      {expandedRecsLoading && (
        <div style={{ marginBottom: 16, padding: 16, textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: 13 }}>
          {isOrg && gcpOrgScanProgress ? (
            <div>
              <div style={{ marginBottom: 8 }}>
                Scanned {gcpOrgScanProgress.projectsCompleted} of {gcpOrgScanProgress.totalProjects} projects...
                ({Math.round(gcpOrgScanProgress.projectsCompleted / gcpOrgScanProgress.totalProjects * 100)}%)
              </div>
              <div style={{ width: '100%', height: 6, backgroundColor: 'var(--color-border)', borderRadius: 3, overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${Math.round(gcpOrgScanProgress.projectsCompleted / gcpOrgScanProgress.totalProjects * 100)}%`,
                    backgroundColor: 'var(--color-primary)',
                    borderRadius: 3,
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>
            </div>
          ) : isOrg ? (
            'Scanning billing-enabled projects across the organization...'
          ) : (
            'Scanning 16 recommender types across zones, regions, and global...'
          )}
        </div>
      )}

      {expandedRecsError && (
        <div style={{ marginBottom: 16, padding: 12, backgroundColor: 'rgba(239, 68, 68, 0.05)', borderRadius: 8, color: '#ef4444', fontSize: 13 }}>
          {expandedRecsError}
        </div>
      )}

      {/* Category tabs */}
      <div
        style={{
          display: 'flex',
          gap: 4,
          marginBottom: 16,
          borderBottom: '2px solid var(--color-border)',
          paddingBottom: 0,
          flexWrap: 'wrap',
        }}
      >
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setGCPRecsTab(tab.key)}
            style={{
              padding: '8px 14px',
              fontSize: 12,
              fontWeight: gcpRecsTab === tab.key ? 600 : 400,
              border: 'none',
              borderBottom: gcpRecsTab === tab.key ? '2px solid var(--color-primary)' : '2px solid transparent',
              backgroundColor: 'transparent',
              color: gcpRecsTab === tab.key ? 'var(--color-primary)' : 'var(--color-text-secondary)',
              cursor: 'pointer',
              marginBottom: -2,
            }}
          >
            {tab.label}
            {tab.key !== 'all' && (
              <span style={{ marginLeft: 4, opacity: 0.7 }}>
                {tab.key === 'stopped_vms'
                  ? `(${stoppedVMs?.vms?.length ?? 0})`
                  : expandedRecs
                    ? `(${tab.key === 'commitments' && !isOrg
                        ? (expandedRecs.byCategory[tab.key as GCPCostCategory]?.count || 0) + (gcpCUDCoverage?.commitments?.length || 0)
                        : expandedRecs.byCategory[tab.key as GCPCostCategory]?.count || 0})`
                    : ''}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {gcpRecsTab === 'stopped_vms' ? (
        <StoppedVMPanel data={stoppedVMs} isLoading={stoppedVMsLoading} error={stoppedVMsError} showProjectColumn={isOrg} />
      ) : gcpRecsTab === 'commitments' && !isOrg ? (
        <CUDCoveragePanel data={gcpCUDCoverage} isLoading={gcpCUDLoading} error={gcpCUDError} />
      ) : gcpRecsTab === 'best_practices' && !isOrg ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <CostBestPracticesPanel data={gcpCostBestPractices} isLoading={gcpCostBPLoading} error={gcpCostBPError} />
          {filteredRecs.length > 0 && (
            <div>
              <h4 style={{ margin: '0 0 8px', fontSize: 14 }}>Recommender API ({filteredRecs.length})</h4>
              <RecommendationList recommendations={filteredRecs} meta={expandedRecs?.meta} />
            </div>
          )}
        </div>
      ) : (
        <RecommendationList recommendations={filteredRecs} meta={expandedRecs?.meta} />
      )}

      {/* Scan metadata */}
      {expandedRecs && !expandedRecsLoading && (
        <div style={{ marginTop: 16, fontSize: 11, color: 'var(--color-text-secondary)' }}>
          {isOrg
            ? `Scanned all accessible projects across ${expandedRecs.recommenderTypesScanned.length} recommender types.`
            : `Scanned ${expandedRecs.regionsScanned.length} locations (zones + regions + global) across ${expandedRecs.recommenderTypesScanned.length} recommender types.`}
          {stoppedVMs && ` Found ${stoppedVMs.vms.length} stopped/suspended VM(s).`}
          {expandedRecs.errors.length > 0 && (
            <div
              style={{
                marginTop: 8,
                padding: '8px 12px',
                backgroundColor: 'rgba(245, 158, 11, 0.08)',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: 6,
                color: 'var(--color-text)',
                fontSize: 12,
              }}
            >
              <strong style={{ color: '#f59e0b' }}>API Warnings ({expandedRecs.errors.length})</strong>
              <ul style={{ margin: '4px 0 0', paddingLeft: 20, color: 'var(--color-text-secondary)' }}>
                {expandedRecs.errors.slice(0, 5).map((e, i) => (
                  <li key={i}>{e}</li>
                ))}
                {expandedRecs.errors.length > 5 && (
                  <li>...and {expandedRecs.errors.length - 5} more</li>
                )}
              </ul>
            </div>
          )}
          {expandedRecs.recommendations.length === 0 && expandedRecs.errors.length === 0 && (
            <div style={{ marginTop: 8, fontStyle: 'italic' }}>
              No recommendations found. Ensure the Recommender API is enabled in your project.
            </div>
          )}
        </div>
      )}
    </div>
  );
};

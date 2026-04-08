// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useCostStore } from '../stores/costStore';
import type { CostScope } from '../stores/costStore';
import { useProfileStore } from '../stores/profileStore';
import { useProviderStore } from '../stores/providerStore';
import { useGCPProjectStore } from '../stores/gcpProjectStore';
import { DateRangeSelector } from '../components/costs/DateRangeSelector';
import { CostOverview } from '../components/costs/CostOverview';
import { CostTrendChart } from '../components/costs/CostTrendChart';
import { ServiceCostBreakdown } from '../components/costs/ServiceCostBreakdown';
import { CostOptimizations } from '../components/costs/CostOptimizations';
import { ProjectCostBreakdown } from '../components/costs/ProjectCostBreakdown';
import ExportCSVButton from '../components/ExportCSVButton';
import GCPCostFiltersBar from '../components/costs/GCPCostFilters';
import CostPieChart from '../components/costs/CostPieChart';
import SkuCostTable from '../components/costs/SkuCostTable';
import ResourceCostTable from '../components/costs/ResourceCostTable';

const ScopeToggle: React.FC<{ value: CostScope; onChange: (scope: CostScope) => void }> = ({
  value,
  onChange,
}) => {
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
      <button
        style={{ ...btnStyle(value === 'project'), borderRadius: '6px 0 0 6px' }}
        onClick={() => onChange('project')}
      >
        Project
      </button>
      <button
        style={{ ...btnStyle(value === 'organization'), borderRadius: '0 6px 6px 0', borderLeft: 'none' }}
        onClick={() => onChange('organization')}
      >
        Organization
      </button>
    </div>
  );
};

const CostsPage: React.FC = () => {
  const activeTab = 'overview';
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [showCacheDropdown, setShowCacheDropdown] = useState(false);
  const cacheDropdownRef = useRef<HTMLDivElement>(null);
  const cacheBtnRef = useRef<HTMLButtonElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!showCacheDropdown) return;
    const handler = (e: MouseEvent) => {
      if (cacheDropdownRef.current && !cacheDropdownRef.current.contains(e.target as Node) &&
          cacheBtnRef.current && !cacheBtnRef.current.contains(e.target as Node)) {
        setShowCacheDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showCacheDropdown]);

  const {
    analysis,
    optimizations,
    dateRange,
    customStartDate,
    customEndDate,
    costScope,
    isLoading,
    error,
    gcpFilters,
    gcpFilterOptions,
    setDateRange,
    setCustomDates,
    setCostScope,
    setGCPFilters,
    clearGCPFilters,
    refreshProvider,
    clearAnalysis,
    clearError,
    costCacheHistory,
    viewingCacheId,
    loadCostCacheHistory,
    viewCachedCostEntry,
    deleteCachedCostEntry,
    clearCacheView,
    restoreLatestCache,
    awsCostCacheHistory,
    awsViewingCacheId,
    loadAWSCostCacheHistory,
    viewAWSCachedCostEntry,
    deleteAWSCachedCostEntry,
    clearAWSCacheView,
    restoreLatestAWSCache,
  } = useCostStore();

  const selectedProfile = useProfileStore((s) => s.selectedProfileName);
  const selectedProvider = useProviderStore((s) => s.selectedProvider);
  const selectedProjectId = useGCPProjectStore((s) => s.selectedProjectId);
  const selectedOrgId = useGCPProjectStore((s) => s.selectedOrgId);
  const billingConfig = useGCPProjectStore((s) => s.billingConfig);
  const loadBillingConfig = useGCPProjectStore((s) => s.loadBillingConfig);

  const isOrgScope = selectedProvider === 'gcp' && costScope === 'organization';

  // For org scope, we need org + billing config but not necessarily a project
  // For project scope, we need a project
  const activeIdentity = selectedProvider === 'gcp'
    ? (isOrgScope ? (selectedOrgId || null) : selectedProjectId)
    : selectedProfile;

  const noIdentity = selectedProvider === 'gcp'
    ? (isOrgScope ? !selectedOrgId : !selectedProjectId)
    : !selectedProfile;

  // For org scope, also check billing config
  const orgMissingConfig = isOrgScope && selectedOrgId && !billingConfig?.bqProject;

  // Load billing config on mount for GCP
  useEffect(() => {
    if (selectedProvider === 'gcp') loadBillingConfig();
  }, [selectedProvider, loadBillingConfig]);

  // Clear stale data when provider or scope changes, then auto-restore from cache
  useEffect(() => {
    clearAnalysis();
    // After clearing, trigger restore + history load for the new provider
    if (selectedProvider === 'gcp' && activeIdentity) {
      restoreLatestCache(activeIdentity);
      loadCostCacheHistory(activeIdentity);
    } else if (selectedProvider === 'aws' && activeIdentity) {
      restoreLatestAWSCache(activeIdentity);
      loadAWSCostCacheHistory(activeIdentity);
    }
  }, [selectedProvider, costScope, activeIdentity]);

  // Build a short label for file names: e.g. "shipwire-2026-02" or "org-2026-02"
  const exportLabel = analysis
    ? `${(activeIdentity || 'export').replace(/[^a-zA-Z0-9-]/g, '-')}-${analysis.startDate.slice(0, 7)}`
    : 'cost';

  const handleExportPdf = useCallback(async () => {
    if (!window.electronAPI?.gcp?.cost?.exportPdf || !analysis) return;
    setExportingPdf(true);
    try {
      await window.electronAPI.gcp.cost.exportPdf(analysis, exportLabel);
    } finally {
      setExportingPdf(false);
    }
  }, [analysis, exportLabel]);

  const handleExportExcel = useCallback(async () => {
    if (!window.electronAPI?.gcp?.cost?.exportExcel || !analysis) return;
    setExportingExcel(true);
    try {
      await window.electronAPI.gcp.cost.exportExcel(analysis, exportLabel);
    } finally {
      setExportingExcel(false);
    }
  }, [analysis, exportLabel]);

  const handleRefresh = useCallback(async (forceRefresh?: boolean) => {
    if (selectedProvider === 'gcp') {
      clearCacheView();
    } else {
      clearAWSCacheView();
    }
    // Reload billing config so latest region setting is used immediately after saving in Settings
    if (selectedProvider === 'gcp') await loadBillingConfig();
    if (isOrgScope && selectedOrgId) {
      await refreshProvider('gcp', selectedOrgId, forceRefresh);
    } else if (activeIdentity) {
      await refreshProvider(selectedProvider, activeIdentity, forceRefresh);
    }
    // Reload cache history after fresh data is saved
    if (selectedProvider === 'gcp' && activeIdentity) {
      loadCostCacheHistory(activeIdentity);
    } else if (selectedProvider === 'aws' && activeIdentity) {
      loadAWSCostCacheHistory(activeIdentity);
    }
  }, [activeIdentity, selectedOrgId, isOrgScope, selectedProvider, refreshProvider, loadBillingConfig, clearCacheView, clearAWSCacheView, loadCostCacheHistory, loadAWSCostCacheHistory]);

  return (
    <>
      <header className="page-header">
        <h1 className="page-title">Cost Explorer</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {((selectedProvider === 'gcp' && costCacheHistory.length > 0) ||
            (selectedProvider === 'aws' && awsCostCacheHistory.length > 0)) && (
              <button
                ref={cacheBtnRef}
                className="btn btn-secondary"
                onClick={() => setShowCacheDropdown(!showCacheDropdown)}
                title="View cached cost data history"
                style={{ fontSize: 12 }}
              >
                History ({selectedProvider === 'gcp' ? costCacheHistory.length : awsCostCacheHistory.length})
              </button>
          )}
          <button
            className="btn btn-primary"
            onClick={() => handleRefresh()}
            disabled={isLoading || noIdentity || !!orgMissingConfig}
            title="Load cost data (uses cache if available)"
          >
            {isLoading ? 'Loading...' : 'Refresh'}
          </button>
          {selectedProvider === 'gcp' && (
            <button
              className="btn btn-secondary"
              onClick={() => handleRefresh(true)}
              disabled={isLoading || noIdentity || !!orgMissingConfig}
              title="Force reload from BigQuery (bypasses cache)"
              style={{ fontSize: 12 }}
            >
              Force Reload
            </button>
          )}
          {analysis && (
            <>
              <button
                className="btn btn-secondary"
                onClick={handleExportPdf}
                disabled={exportingPdf}
                title="Export cost dashboard as PDF (captures current view)"
                style={{ fontSize: 12 }}
              >
                {exportingPdf ? 'Exporting...' : '⬇ PDF'}
              </button>
              <button
                className="btn btn-secondary"
                onClick={handleExportExcel}
                disabled={exportingExcel}
                title="Export cost data to Excel (Service, Region, SKU, Resource sheets)"
                style={{ fontSize: 12 }}
              >
                {exportingExcel ? 'Exporting...' : '⬇ Excel'}
              </button>
            </>
          )}
        </div>
      </header>

      <div className="page-content">
        {/* Cached data banner */}
        {((viewingCacheId && selectedProvider === 'gcp') || (awsViewingCacheId && selectedProvider === 'aws')) && (
          <div style={{
            backgroundColor: 'var(--color-primary-glow)', border: '1px solid var(--color-primary)',
            borderRadius: 8, padding: '10px 16px', marginBottom: 16,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13,
          }}>
            <span>
              Viewing cached data from {(() => {
                const cacheId = selectedProvider === 'gcp' ? viewingCacheId : awsViewingCacheId;
                const history = selectedProvider === 'gcp' ? costCacheHistory : awsCostCacheHistory;
                const entry = history.find(e => e.id === cacheId);
                return entry ? new Date(entry.fetchedAt).toLocaleString() : 'cache';
              })()}
            </span>
            <button
              className="btn btn-primary"
              onClick={() => handleRefresh(true)}
              disabled={isLoading || noIdentity}
              style={{ fontSize: 12, padding: '4px 12px' }}
            >
              Load Fresh
            </button>
          </div>
        )}
        {/* Controls */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 24,
            flexWrap: 'wrap',
            gap: 16,
          }}
        >
          {/* Scope toggle — only for GCP */}
          <div>
            {selectedProvider === 'gcp' && (
              <ScopeToggle value={costScope} onChange={setCostScope} />
            )}
          </div>
          <DateRangeSelector
            value={dateRange}
            onChange={setDateRange}
            onCustomDateChange={setCustomDates}
            customStartDate={customStartDate}
            customEndDate={customEndDate}
          />
        </div>

        {/* GCP Cost Filters — shown when GCP provider is active and identity is selected */}
        {selectedProvider === 'gcp' && !noIdentity && !orgMissingConfig && (
          <GCPCostFiltersBar
            filters={gcpFilters}
            options={gcpFilterOptions}
            costScope={costScope}
            onFiltersChange={setGCPFilters}
            onApply={() => handleRefresh()}
            onClear={clearGCPFilters}
            isLoading={isLoading}
          />
        )}

        {/* Org scope: warn if billing config missing */}
        {orgMissingConfig && (
          <div
            style={{
              backgroundColor: 'var(--color-warning-glow, rgba(245, 158, 11, 0.1))',
              border: '1px solid var(--color-warning)',
              borderRadius: 8,
              padding: 16,
              marginBottom: 24,
            }}
          >
            <strong style={{ color: 'var(--color-text)' }}>BigQuery billing project required</strong>
            <p style={{ margin: '8px 0 0', color: 'var(--color-text-secondary)', fontSize: 13 }}>
              Organization-level cost analysis requires a configured BigQuery billing project.
              Set the BQ Project in the configuration card above, then click Refresh.
            </p>
          </div>
        )}


        {/* Error display — show setup guide for GCP BigQuery requirement */}
        {error && (
          error.includes('BigQuery billing export') || error.includes('Cost Explorer API') ? (
            <div
              style={{
                backgroundColor: 'var(--color-primary-glow)',
                border: '1px solid var(--color-primary)',
                borderRadius: 8,
                padding: 24,
                marginBottom: 24,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <h3 style={{ margin: '0 0 12px', color: 'var(--color-text)' }}>
                  GCP Cost Data Setup Required
                </h3>
                <button
                  onClick={clearError}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-text-secondary)',
                    cursor: 'pointer',
                    fontSize: 18,
                    padding: 4,
                  }}
                >
                  x
                </button>
              </div>
              <p style={{ margin: '0 0 12px', color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                GCP does not provide a Cost Explorer API like AWS. Cost data is only available through
                BigQuery billing export.
              </p>
              <div style={{
                backgroundColor: 'var(--color-bg-secondary)',
                borderRadius: 6,
                padding: 16,
                marginBottom: 12,
              }}>
                <p style={{ margin: '0 0 8px', fontWeight: 600, color: 'var(--color-text)' }}>Setup steps:</p>
                <ol style={{ margin: 0, paddingLeft: 20, color: 'var(--color-text-secondary)', lineHeight: 2 }}>
                  <li>Go to <strong>GCP Console &gt; Billing &gt; Billing export</strong></li>
                  <li>Enable <strong>"Detailed usage cost"</strong> export to BigQuery</li>
                  <li>Set the dataset name to <strong>"billing_export"</strong></li>
                  <li>Wait 24-48 hours for data to populate</li>
                </ol>
              </div>
              {error.includes('Billing account:') && (
                <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: 13 }}>
                  {error.split('\n').find(line => line.includes('Billing account:'))}
                </p>
              )}
              {error.includes('Billing is NOT enabled') && (
                <p style={{ margin: 0, color: 'var(--color-warning)', fontSize: 13, fontWeight: 600 }}>
                  {error.split('\n').find(line => line.includes('Billing is NOT enabled'))}
                </p>
              )}
            </div>
          ) : (
            <div
              style={{
                backgroundColor: 'var(--color-error-glow, rgba(239, 68, 68, 0.1))',
                border: '1px solid var(--color-error)',
                borderRadius: 8,
                padding: 16,
                marginBottom: 24,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
              }}
            >
              <div>
                <strong style={{ color: 'var(--color-error)' }}>Error:</strong>{' '}
                <span style={{ color: 'var(--color-text)' }}>{error}</span>
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
                }}
              >
                x
              </button>
            </div>
          )
        )}

        {/* No identity selected */}
        {noIdentity && (
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
              {selectedProvider === 'gcp'
                ? (isOrgScope ? 'No GCP Organization Selected' : 'No GCP Project Selected')
                : 'No Profile Selected'}
            </h3>
            <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
              {selectedProvider === 'gcp'
                ? (isOrgScope
                    ? 'Select a GCP organization from the top bar to view org-wide cost data.'
                    : 'Select a GCP project from the top bar to view cost data.')
                : 'Select an AWS profile from the top bar to view cost data.'}
            </p>
          </div>
        )}

        {/* Prompt to load data */}
        {!noIdentity && !orgMissingConfig && !analysis && !isLoading && !error && (
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
              {selectedProvider === 'gcp'
                ? (isOrgScope ? 'GCP Organization Cost Explorer' : 'GCP Cost Explorer')
                : 'Cost Explorer'}
            </h3>
            <p style={{ margin: 0, color: 'var(--color-text-secondary)' }}>
              Click Refresh to load cost data
              {selectedProvider === 'gcp'
                ? (isOrgScope ? ' across all projects in the organization.' : ` for project ${selectedProjectId}.`)
                : '.'}
            </p>
          </div>
        )}

        {/* GCP Cost Recommendations (shown even without BigQuery cost data, on overview only) */}
        {!noIdentity && selectedProvider === 'gcp' && activeTab === 'overview' && !analysis && !isLoading && optimizations && (
          <CostOptimizations optimizations={optimizations} isLoading={false} />
        )}

        {/* Cost analysis content (both AWS and GCP via shared components) */}
        {!noIdentity && (analysis || isLoading) && (
          <>
            {activeTab === 'overview' ? (
              <>
                <CostOverview analysis={analysis} isLoading={isLoading} />

                {/* Pie charts for cost breakdown */}
                {analysis && (
                  <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
                    <CostPieChart
                      title="Cost by Service"
                      data={(analysis.byService || []).map((s) => ({ label: s.service, value: s.cost }))}
                      currency={analysis.currency}
                    />
                    <CostPieChart
                      title="Cost by Region"
                      data={(analysis.byRegion || []).map((r) => ({ label: r.region, value: r.cost }))}
                      currency={analysis.currency}
                    />
                    {isOrgScope && analysis.byProject && (
                      <CostPieChart
                        title="Cost by Project"
                        data={analysis.byProject.map((p) => ({ label: p.projectName || p.projectId, value: p.cost }))}
                        currency={analysis.currency}
                      />
                    )}
                    {analysis.byResource && analysis.byResource.length > 0 && (
                      <CostPieChart
                        title="Top Resources by Cost"
                        data={analysis.byResource.slice(0, 10).map((r) => ({ label: r.shortName, value: r.cost }))}
                        currency={analysis.currency}
                      />
                    )}
                  </div>
                )}

                <CostTrendChart data={analysis?.trend || []} isLoading={isLoading} />

                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 8, gap: 8 }}>
                  {analysis?.byService && analysis.byService.length > 0 && (
                    <ExportCSVButton
                      data={analysis.byService.map((s) => ({
                        service: s.service,
                        cost: s.cost.toFixed(2),
                        previousPeriodCost: s.previousPeriodCost.toFixed(2),
                        percentChange: s.percentChange.toFixed(1),
                        currency: s.currency,
                      }))}
                      columns={[
                        { key: 'service', label: 'Service' },
                        { key: 'cost', label: 'Cost' },
                        { key: 'previousPeriodCost', label: 'Previous Period' },
                        { key: 'percentChange', label: '% Change' },
                        { key: 'currency', label: 'Currency' },
                      ]}
                      filename="cost-by-service"
                      label="Export Costs CSV"
                    />
                  )}
                  {selectedProvider === 'aws' && optimizations?.recommendations && optimizations.recommendations.length > 0 && (
                    <ExportCSVButton
                      data={optimizations.recommendations.map((r) => ({
                        service: r.service,
                        type: r.type,
                        severity: r.severity,
                        description: r.description,
                        estimatedMonthlySavings: r.estimatedMonthlySavings.toFixed(2),
                        currency: r.currency,
                      }))}
                      columns={[
                        { key: 'service', label: 'Service' },
                        { key: 'type', label: 'Type' },
                        { key: 'severity', label: 'Severity' },
                        { key: 'description', label: 'Description' },
                        { key: 'estimatedMonthlySavings', label: 'Est. Monthly Savings' },
                        { key: 'currency', label: 'Currency' },
                      ]}
                      filename="cost-optimizations"
                      label="Export Optimizations CSV"
                    />
                  )}
                </div>

                {/* Project cost breakdown — only for org-level GCP analysis */}
                {isOrgScope && analysis?.byProject && (
                  <ProjectCostBreakdown
                    byProject={analysis.byProject}
                    isLoading={isLoading}
                  />
                )}

                <ServiceCostBreakdown
                  byService={analysis?.byService || []}
                  byRegion={analysis?.byRegion || []}
                  isLoading={isLoading}
                />

                {/* SKU-level cost breakdown */}
                {analysis?.bySku && analysis.bySku.length > 0 && (
                  <SkuCostTable data={analysis.bySku} isLoading={isLoading} />
                )}

                {/* Resource-level cost breakdown */}
                {analysis?.byResource && analysis.byResource.length > 0 && (
                  <ResourceCostTable
                    data={analysis.byResource}
                    isLoading={isLoading}
                    showProject={isOrgScope}
                  />
                )}

              </>
            ) : null}
          </>
        )}
      </div>
      {/* Cache history dropdown — rendered outside header to avoid clipping */}
      {showCacheDropdown && cacheBtnRef.current && (() => {
        const rect = cacheBtnRef.current!.getBoundingClientRect();
        return (
          <div
            ref={cacheDropdownRef}
            style={{
              position: 'fixed', top: rect.bottom + 4, left: rect.right - 360, zIndex: 9999,
              width: 360, maxHeight: 320, overflowY: 'auto',
              backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)',
              borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.25)', padding: 6,
            }}
          >
            <div style={{ padding: '6px 10px 8px', fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', borderBottom: '1px solid var(--color-border)', marginBottom: 4 }}>
              Cached Cost Data
            </div>
            {(selectedProvider === 'gcp' ? costCacheHistory : awsCostCacheHistory).map((entry) => {
              const activeCacheId = selectedProvider === 'gcp' ? viewingCacheId : awsViewingCacheId;
              const viewEntry = selectedProvider === 'gcp' ? viewCachedCostEntry : viewAWSCachedCostEntry;
              const deleteEntry = selectedProvider === 'gcp' ? deleteCachedCostEntry : deleteAWSCachedCostEntry;
              return (
              <div
                key={entry.id}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 10px', borderRadius: 6, cursor: 'pointer',
                  backgroundColor: activeCacheId === entry.id ? 'var(--color-primary-glow)' : 'transparent',
                }}
                onMouseEnter={(e) => { if (activeCacheId !== entry.id) (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)'); }}
                onMouseLeave={(e) => { if (activeCacheId !== entry.id) (e.currentTarget.style.backgroundColor = 'transparent'); }}
                onClick={() => { viewEntry(entry.id); setShowCacheDropdown(false); }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                    {new Date(entry.fetchedAt).toLocaleString()} &middot; ${entry.totalCost.toFixed(2)} &middot; {entry.serviceCount} services
                  </div>
                </div>
                <button
                  style={{ background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: 16, padding: '2px 8px', flexShrink: 0, lineHeight: 1 }}
                  title="Delete cached entry"
                  onClick={(e) => { e.stopPropagation(); deleteEntry(entry.id, activeIdentity || ''); }}
                >
                  &times;
                </button>
              </div>
              );
            })}
          </div>
        );
      })()}
    </>
  );
};

export default CostsPage;

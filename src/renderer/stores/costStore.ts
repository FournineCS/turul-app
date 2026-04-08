// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { create } from 'zustand';
import type {
  CostAnalysisResult,
  CostOptimizationResult,
  CostDateRange,
  CostGranularity,
  CloudProvider,
  GCPCostFilters,
  GCPExpandedRecommendationsResult,
  GCPCostBestPracticesResult,
  GCPCUDCoverageResult,
  GCPCostCategory,
  StoppedVMResult,
  GCPCostCacheEntry,
} from '../../shared/types';
import { useGCPProjectStore } from './gcpProjectStore';

export type CostScope = 'project' | 'organization';

export interface GCPFilterOptions {
  services: string[];
  skus: { service: string; sku: string }[];
  regions: string[];
  projectIds: { id: string; name: string }[];
  labels: { key: string; values: string[] }[];
}

interface CostState {
  analysis: CostAnalysisResult | null;
  optimizations: CostOptimizationResult | null;
  dateRange: CostDateRange;
  customStartDate: string | null;
  customEndDate: string | null;
  costScope: CostScope;
  isLoading: boolean;
  error: string | null;
  gcpFilters: GCPCostFilters;
  gcpFilterOptions: GCPFilterOptions;

  // GCP Expanded Recommendations
  gcpExpandedRecs: GCPExpandedRecommendationsResult | null;
  gcpExpandedRecsLoading: boolean;
  gcpExpandedRecsError: string | null;

  // GCP Cost Best Practices (BQ-based)
  gcpCostBestPractices: GCPCostBestPracticesResult | null;
  gcpCostBPLoading: boolean;
  gcpCostBPError: string | null;

  // GCP CUD Coverage
  gcpCUDCoverage: GCPCUDCoverageResult | null;
  gcpCUDLoading: boolean;
  gcpCUDError: string | null;

  // GCP Stopped VMs
  gcpStoppedVMs: StoppedVMResult | null;
  gcpStoppedVMsLoading: boolean;
  gcpStoppedVMsError: string | null;

  // GCP Org-wide Recommendations
  gcpOrgExpandedRecs: GCPExpandedRecommendationsResult | null;
  gcpOrgExpandedRecsLoading: boolean;
  gcpOrgExpandedRecsError: string | null;
  gcpOrgScanProgress: { projectsCompleted: number; totalProjects: number } | null;
  gcpOrgStoppedVMs: StoppedVMResult | null;
  gcpOrgStoppedVMsLoading: boolean;
  gcpOrgStoppedVMsError: string | null;

  // Recommendations tab state
  gcpRecsTab: GCPCostCategory | 'all';

  // Cost cache (shared for both AWS and GCP)
  costCacheHistory: GCPCostCacheEntry[];
  costCacheLoading: boolean;
  viewingCacheId: string | null;

  // AWS cost cache
  awsCostCacheHistory: GCPCostCacheEntry[];
  awsCostCacheLoading: boolean;
  awsViewingCacheId: string | null;

  setDateRange: (range: CostDateRange) => void;
  setCustomDates: (startDate: string, endDate: string) => void;
  setCostScope: (scope: CostScope) => void;
  setGCPFilters: (filters: GCPCostFilters) => void;
  clearGCPFilters: () => void;
  setGCPRecsTab: (tab: GCPCostCategory | 'all') => void;
  loadCostAnalysis: (profileName: string) => Promise<void>;
  loadOptimizations: (profileName: string) => Promise<void>;
  refreshAll: (profileName: string) => Promise<void>;
  loadGCPCostAnalysis: (projectId: string, forceRefresh?: boolean) => Promise<void>;
  loadGCPOrgCostAnalysis: (forceRefresh?: boolean) => Promise<void>;
  loadGCPRecommendations: (projectId: string) => Promise<void>;
  loadGCPExpandedRecommendations: (projectId: string) => Promise<void>;
  loadGCPCostBestPractices: (projectId: string) => Promise<void>;
  loadGCPCUDCoverage: (projectId: string) => Promise<void>;
  loadGCPStoppedVMs: (projectId: string) => Promise<void>;
  loadGCPOrgExpandedRecommendations: (orgId: string) => Promise<void>;
  loadGCPOrgStoppedVMs: (orgId: string) => Promise<void>;
  refreshGCPOrgRecommendations: (orgId: string) => Promise<void>;
  refreshGCPRecommendations: (projectId: string) => Promise<void>;
  refreshGCP: (projectId: string, forceRefresh?: boolean) => Promise<void>;
  /** Unified dispatch: refreshes cost data for the given provider + identity. */
  refreshProvider: (provider: CloudProvider, identity: string, forceRefresh?: boolean) => Promise<void>;
  clearAnalysis: () => void;
  clearError: () => void;
  loadCostCacheHistory: (identity: string) => Promise<void>;
  viewCachedCostEntry: (id: string) => Promise<void>;
  deleteCachedCostEntry: (id: string, identity: string) => Promise<void>;
  clearCacheView: () => void;
  restoreLatestCache: (identity: string) => Promise<void>;

  // AWS cost cache methods
  loadAWSCostCacheHistory: (identity: string) => Promise<void>;
  viewAWSCachedCostEntry: (id: string) => Promise<void>;
  deleteAWSCachedCostEntry: (id: string, identity: string) => Promise<void>;
  clearAWSCacheView: () => void;
  restoreLatestAWSCache: (identity: string) => Promise<void>;
}

function getDateRangeParams(
  dateRange: CostDateRange,
  customStartDate: string | null,
  customEndDate: string | null
): { startDate: string; endDate: string; days: number; granularity: CostGranularity } {
  const endDate = new Date();
  let startDate = new Date();
  let days: number;
  let granularity: CostGranularity = 'DAILY';

  switch (dateRange) {
    case '7d':
      days = 7;
      startDate.setDate(startDate.getDate() - 7);
      granularity = 'DAILY';
      break;
    case '30d':
      days = 30;
      startDate.setDate(startDate.getDate() - 30);
      granularity = 'DAILY';
      break;
    case '90d':
      days = 90;
      startDate.setDate(startDate.getDate() - 90);
      granularity = 'MONTHLY';
      break;
    case '12m':
      days = 365;
      startDate.setDate(startDate.getDate() - 365);
      granularity = 'MONTHLY';
      break;
    case 'custom':
      if (customStartDate && customEndDate) {
        const start = new Date(customStartDate);
        const end = new Date(customEndDate);
        days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        granularity = days > 60 ? 'MONTHLY' : 'DAILY';
        return {
          startDate: customStartDate,
          endDate: customEndDate,
          days,
          granularity,
        };
      }
      days = 30;
      startDate.setDate(startDate.getDate() - 30);
      break;
    default:
      days = 30;
      startDate.setDate(startDate.getDate() - 30);
  }

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
    days,
    granularity,
  };
}

const EMPTY_FILTER_OPTIONS: GCPFilterOptions = {
  services: [],
  skus: [],
  regions: [],
  projectIds: [],
  labels: [],
};

function hasActiveFilters(filters: GCPCostFilters): boolean {
  return !!(
    (filters.services && filters.services.length > 0) ||
    (filters.skus && filters.skus.length > 0) ||
    (filters.regions && filters.regions.length > 0) ||
    (filters.projectIds && filters.projectIds.length > 0) ||
    (filters.labels && filters.labels.length > 0) ||
    (filters.resourceName && filters.resourceName.trim())
  );
}

function extractFilterOptions(analysis: CostAnalysisResult): GCPFilterOptions {
  const services = (analysis.byService || []).map((s) => s.service).filter(Boolean);
  const skus = (analysis.bySku || []).map((s) => ({ service: s.service, sku: s.sku }));
  const regions = (analysis.byRegion || []).map((r) => r.region).filter(Boolean);
  const projectIds = (analysis.byProject || []).map((p) => ({ id: p.projectId, name: p.projectName }));
  const labels = analysis.availableLabels || [];
  return { services, skus, regions, projectIds, labels };
}

// Cache freshness: skip re-fetch if data was loaded within this window
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const _lastFetchTime: Record<string, number> = {};
const _pendingRequests: Record<string, Promise<void>> = {};

function isCacheFresh(key: string): boolean {
  const t = _lastFetchTime[key];
  return !!t && Date.now() - t < CACHE_TTL_MS;
}

export const useCostStore = create<CostState>((set, get) => ({
  analysis: null,
  optimizations: null,
  dateRange: '30d',
  customStartDate: null,
  customEndDate: null,
  costScope: 'project',
  isLoading: false,
  error: null,
  gcpFilters: {},
  gcpFilterOptions: EMPTY_FILTER_OPTIONS,
  gcpExpandedRecs: null,
  gcpExpandedRecsLoading: false,
  gcpExpandedRecsError: null,
  gcpCostBestPractices: null,
  gcpCostBPLoading: false,
  gcpCostBPError: null,
  gcpCUDCoverage: null,
  gcpCUDLoading: false,
  gcpCUDError: null,
  gcpStoppedVMs: null,
  gcpStoppedVMsLoading: false,
  gcpStoppedVMsError: null,
  gcpOrgExpandedRecs: null,
  gcpOrgExpandedRecsLoading: false,
  gcpOrgExpandedRecsError: null,
  gcpOrgScanProgress: null,
  gcpOrgStoppedVMs: null,
  gcpOrgStoppedVMsLoading: false,
  gcpOrgStoppedVMsError: null,
  gcpRecsTab: 'all',
  costCacheHistory: [],
  costCacheLoading: false,
  viewingCacheId: null,
  awsCostCacheHistory: [],
  awsCostCacheLoading: false,
  awsViewingCacheId: null,

  setDateRange: (range) => {
    set({ dateRange: range });
  },

  setCostScope: (scope) => {
    set({ costScope: scope, analysis: null, optimizations: null, error: null, gcpFilters: {}, gcpFilterOptions: EMPTY_FILTER_OPTIONS });
  },

  setGCPFilters: (filters) => {
    set({ gcpFilters: filters });
  },

  clearGCPFilters: () => {
    set({ gcpFilters: {} });
  },

  setGCPRecsTab: (tab) => {
    set({ gcpRecsTab: tab });
  },

  setCustomDates: (startDate, endDate) => {
    set({ customStartDate: startDate, customEndDate: endDate, dateRange: 'custom' });
  },

  loadCostAnalysis: async (profileName) => {
    if (!window.electronAPI?.cost) {
      set({ error: 'Electron API not available', isLoading: false });
      return;
    }

    const cacheKey = `aws-cost-${profileName}-${get().dateRange}`;

    // Skip if data is fresh
    if (get().analysis && isCacheFresh(cacheKey)) return;

    // Dedup: return existing in-flight request
    if (_pendingRequests[cacheKey]) {
      await _pendingRequests[cacheKey];
      return;
    }

    set({ isLoading: true, error: null });

    const promise = (async () => {
      try {
        const { dateRange, customStartDate, customEndDate } = get();
        const { startDate, endDate, granularity } = getDateRangeParams(
          dateRange,
          customStartDate,
          customEndDate
        );

        const response = await window.electronAPI.cost.getAnalysis(
          profileName,
          startDate,
          endDate,
          granularity
        );

        if (response.success && response.data) {
          _lastFetchTime[cacheKey] = Date.now();
          set({ analysis: response.data, isLoading: false, awsViewingCacheId: null });
          // Auto-save to SQLite cache (awaited so history list is accurate)
          const { dateRange } = get();
          const { startDate: sd, endDate: ed } = getDateRangeParams(dateRange, get().customStartDate, get().customEndDate);
          try {
            await window.electronAPI?.cost?.costCache?.save({
              id: crypto.randomUUID(),
              dataType: 'cost_analysis',
              scope: 'project',
              identity: profileName,
              fetchedAt: new Date().toISOString(),
              startDate: sd,
              endDate: ed,
              dateRangeLabel: dateRange,
              label: `${dateRange} analysis from ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
              totalCost: response.data.totalCost ?? 0,
              serviceCount: response.data.byService?.length ?? 0,
              data: response.data,
            });
            // Reload cache history after successful save
            get().loadAWSCostCacheHistory(profileName);
          } catch { /* ignore save errors */ }
        } else {
          set({ error: response.error || 'Failed to load cost analysis', isLoading: false });
        }
      } catch (error) {
        set({
          error: error instanceof Error ? error.message : 'Failed to load cost analysis',
          isLoading: false,
        });
      } finally {
        delete _pendingRequests[cacheKey];
      }
    })();

    _pendingRequests[cacheKey] = promise;
    await promise;
  },

  loadOptimizations: async (profileName) => {
    if (!window.electronAPI?.cost) {
      set({ error: 'Electron API not available', isLoading: false });
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const { dateRange, customStartDate, customEndDate } = get();
      const { days } = getDateRangeParams(dateRange, customStartDate, customEndDate);

      const response = await window.electronAPI.cost.getOptimizations(profileName, days);

      if (response.success && response.data) {
        set({ optimizations: response.data, isLoading: false });
      } else {
        set({ error: response.error || 'Failed to load optimizations', isLoading: false });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load optimizations',
        isLoading: false,
      });
    }
  },

  refreshAll: async (profileName) => {
    if (!window.electronAPI?.cost) {
      set({ error: 'Electron API not available', isLoading: false });
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const { dateRange, customStartDate, customEndDate } = get();
      const { startDate, endDate, days, granularity } = getDateRangeParams(
        dateRange,
        customStartDate,
        customEndDate
      );

      const [analysisResponse, optimizationsResponse] = await Promise.all([
        window.electronAPI.cost.getAnalysis(profileName, startDate, endDate, granularity),
        window.electronAPI.cost.getOptimizations(profileName, days),
      ]);

      const updates: Partial<CostState> = { isLoading: false };

      if (analysisResponse.success && analysisResponse.data) {
        updates.analysis = analysisResponse.data;
      } else {
        updates.error = analysisResponse.error || 'Failed to load cost analysis';
      }

      if (optimizationsResponse.success && optimizationsResponse.data) {
        updates.optimizations = optimizationsResponse.data;
      }

      set(updates);
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to refresh cost data',
        isLoading: false,
      });
    }
  },

  loadGCPCostAnalysis: async (projectId, forceRefresh) => {
    if (!window.electronAPI?.gcp?.cost?.getAnalysis) {
      set({ error: 'GCP cost API not available', isLoading: false });
      return;
    }

    const cacheKey = `gcp-cost-${projectId}-${get().dateRange}`;

    // Skip if data is fresh and not force-refreshing
    if (!forceRefresh && get().analysis && isCacheFresh(cacheKey)) return;

    // Dedup: return existing in-flight request
    if (_pendingRequests[cacheKey]) {
      await _pendingRequests[cacheKey];
      return;
    }

    set({ isLoading: true, error: null });

    const promise = (async () => {
    try {
      const { dateRange, customStartDate, customEndDate, gcpFilters } = get();
      const { startDate, endDate } = getDateRangeParams(dateRange, customStartDate, customEndDate);

      // Read billing config from gcpProjectStore
      const { billingConfig } = useGCPProjectStore.getState();
      const bqProject = billingConfig?.bqProject || undefined;
      const bqDataset = billingConfig?.bqDataset || undefined;

      const filtersArg = hasActiveFilters(gcpFilters) ? gcpFilters : undefined;
      const bqRegion = billingConfig?.bqRegion || undefined;
      const response = await window.electronAPI.gcp.cost.getAnalysis(projectId, startDate, endDate, bqProject, bqDataset, filtersArg, forceRefresh, bqRegion);

      if (response.success && response.data) {
        _lastFetchTime[cacheKey] = Date.now();
        const updates: Partial<CostState> = { analysis: response.data, isLoading: false, viewingCacheId: null };
        // Only update filter options when no filters are active (preserve full dropdown list)
        if (!hasActiveFilters(gcpFilters)) {
          updates.gcpFilterOptions = extractFilterOptions(response.data);
        }
        set(updates);
        // Auto-save to SQLite cache
        window.electronAPI?.gcp?.costCache?.save({
          id: crypto.randomUUID(),
          dataType: 'cost_analysis',
          scope: 'project',
          identity: projectId,
          fetchedAt: new Date().toISOString(),
          startDate,
          endDate,
          dateRangeLabel: dateRange,
          label: `${dateRange} analysis from ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
          totalCost: response.data.totalCost ?? 0,
          serviceCount: response.data.byService?.length ?? 0,
          filters: filtersArg,
          data: response.data,
        }).catch(() => {});
      } else {
        set({ error: response.error || 'Failed to load GCP cost analysis', isLoading: false });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load GCP cost analysis',
        isLoading: false,
      });
    } finally {
      delete _pendingRequests[cacheKey];
    }
    })();

    _pendingRequests[cacheKey] = promise;
    await promise;
  },

  loadGCPOrgCostAnalysis: async (forceRefresh) => {
    if (!window.electronAPI?.gcp?.cost?.getOrgAnalysis) {
      set({ error: 'GCP org cost API not available', isLoading: false });
      return;
    }

    const { billingConfig } = useGCPProjectStore.getState();
    if (!billingConfig?.bqProject) {
      set({ error: 'BigQuery billing project is not configured. Set it in the Billing Config card above.', isLoading: false });
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const { dateRange, customStartDate, customEndDate, gcpFilters } = get();
      const { startDate, endDate } = getDateRangeParams(dateRange, customStartDate, customEndDate);

      const filtersArg = hasActiveFilters(gcpFilters) ? gcpFilters : undefined;
      const response = await window.electronAPI.gcp.cost.getOrgAnalysis(
        startDate, endDate, billingConfig.bqProject, billingConfig.bqDataset || undefined, filtersArg, forceRefresh, billingConfig.bqRegion || undefined
      );

      if (response.success && response.data) {
        const updates: Partial<CostState> = { analysis: response.data, isLoading: false, viewingCacheId: null };
        if (!hasActiveFilters(gcpFilters)) {
          updates.gcpFilterOptions = extractFilterOptions(response.data);
        }
        set(updates);
        // Auto-save to SQLite cache
        const { selectedOrgId } = useGCPProjectStore.getState();
        const orgIdentity = selectedOrgId || billingConfig.bqProject;
        window.electronAPI?.gcp?.costCache?.save({
          id: crypto.randomUUID(),
          dataType: 'cost_analysis',
          scope: 'org',
          identity: orgIdentity,
          fetchedAt: new Date().toISOString(),
          startDate,
          endDate,
          dateRangeLabel: dateRange,
          label: `${dateRange} org analysis from ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
          totalCost: response.data.totalCost ?? 0,
          serviceCount: response.data.byService?.length ?? 0,
          filters: filtersArg,
          data: response.data,
        }).catch(() => {});
      } else {
        set({ error: response.error || 'Failed to load GCP org cost analysis', isLoading: false });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load GCP org cost analysis',
        isLoading: false,
      });
    }
  },

  loadGCPRecommendations: async (projectId) => {
    if (!window.electronAPI?.gcp?.cost?.getRecommendations) {
      return; // Silently skip — recommendations are optional
    }

    try {
      const response = await window.electronAPI.gcp.cost.getRecommendations(projectId);
      if (response.success && response.data) {
        set({ optimizations: response.data });
      }
    } catch {
      // Recommendations are best-effort, don't set error
    }
  },

  loadGCPExpandedRecommendations: async (projectId) => {
    if (!window.electronAPI?.gcp?.cost?.getExpandedRecommendations) return;

    set({ gcpExpandedRecsLoading: true, gcpExpandedRecsError: null });
    try {
      const response = await window.electronAPI.gcp.cost.getExpandedRecommendations(projectId);
      if (response.success && response.data) {
        set({
          gcpExpandedRecs: response.data,
          gcpExpandedRecsLoading: false,
          // Also populate legacy optimizations for backward compat
          optimizations: {
            recommendations: response.data.recommendations,
            totalPotentialSavings: response.data.totalPotentialSavings,
            currency: response.data.currency,
          },
        });
      } else {
        set({ gcpExpandedRecsError: response.error || 'Failed to load expanded recommendations', gcpExpandedRecsLoading: false });
      }
    } catch (error) {
      set({ gcpExpandedRecsError: error instanceof Error ? error.message : 'Failed', gcpExpandedRecsLoading: false });
    }
  },

  loadGCPCostBestPractices: async (projectId) => {
    const { billingConfig } = useGCPProjectStore.getState();
    if (!billingConfig?.bqProject) return; // Requires BQ
    if (!window.electronAPI?.gcp?.cost?.getBestPractices) return;

    set({ gcpCostBPLoading: true, gcpCostBPError: null });
    try {
      const response = await window.electronAPI.gcp.cost.getBestPractices(
        projectId,
        billingConfig.bqProject,
        billingConfig.bqDataset || undefined
      );
      if (response.success && response.data) {
        set({ gcpCostBestPractices: response.data, gcpCostBPLoading: false });
      } else {
        set({ gcpCostBPError: response.error || 'Failed to load cost best practices', gcpCostBPLoading: false });
      }
    } catch (error) {
      set({ gcpCostBPError: error instanceof Error ? error.message : 'Failed', gcpCostBPLoading: false });
    }
  },

  loadGCPCUDCoverage: async (projectId) => {
    if (!window.electronAPI?.gcp?.cost?.getCUDCoverage) return;

    const { billingConfig } = useGCPProjectStore.getState();

    set({ gcpCUDLoading: true, gcpCUDError: null });
    try {
      const response = await window.electronAPI.gcp.cost.getCUDCoverage(
        projectId,
        billingConfig?.bqProject || undefined,
        billingConfig?.bqDataset || undefined
      );
      if (response.success && response.data) {
        set({ gcpCUDCoverage: response.data, gcpCUDLoading: false });
      } else {
        set({ gcpCUDError: response.error || 'Failed to load CUD coverage', gcpCUDLoading: false });
      }
    } catch (error) {
      set({ gcpCUDError: error instanceof Error ? error.message : 'Failed', gcpCUDLoading: false });
    }
  },

  loadGCPStoppedVMs: async (projectId) => {
    if (!window.electronAPI?.gcp?.cost?.getStoppedVMs) return;
    set({ gcpStoppedVMsLoading: true, gcpStoppedVMsError: null });
    try {
      const response = await window.electronAPI.gcp.cost.getStoppedVMs(projectId);
      if (response.success && response.data) {
        set({ gcpStoppedVMs: response.data, gcpStoppedVMsLoading: false });
      } else {
        set({ gcpStoppedVMsError: response.error || 'Failed to load stopped VMs', gcpStoppedVMsLoading: false });
      }
    } catch (error) {
      set({ gcpStoppedVMsError: error instanceof Error ? error.message : 'Failed', gcpStoppedVMsLoading: false });
    }
  },

  loadGCPOrgExpandedRecommendations: async (orgId) => {
    if (!window.electronAPI?.gcp?.cost?.getExpandedRecommendationsOrg) return;
    set({ gcpOrgExpandedRecsLoading: true, gcpOrgExpandedRecsError: null, gcpOrgScanProgress: null });

    // Subscribe to streaming progress events before invoking
    const unsubscribe = window.electronAPI.gcp.cost.onOrgScanProgress?.((progress) => {
      set({
        gcpOrgExpandedRecs: progress.partial,
        gcpOrgScanProgress: { projectsCompleted: progress.projectsCompleted, totalProjects: progress.totalProjects },
      });
    });

    try {
      const response = await window.electronAPI.gcp.cost.getExpandedRecommendationsOrg(orgId);
      if (response.success && response.data) {
        set({ gcpOrgExpandedRecs: response.data, gcpOrgExpandedRecsLoading: false, gcpOrgScanProgress: null });
      } else {
        set({ gcpOrgExpandedRecsError: response.error || 'Failed to load org-wide recommendations', gcpOrgExpandedRecsLoading: false, gcpOrgScanProgress: null });
      }
    } catch (error) {
      set({ gcpOrgExpandedRecsError: error instanceof Error ? error.message : 'Failed', gcpOrgExpandedRecsLoading: false, gcpOrgScanProgress: null });
    } finally {
      unsubscribe?.();
    }
  },

  loadGCPOrgStoppedVMs: async (orgId) => {
    if (!window.electronAPI?.gcp?.cost?.getStoppedVMsOrg) return;
    set({ gcpOrgStoppedVMsLoading: true, gcpOrgStoppedVMsError: null });
    try {
      const response = await window.electronAPI.gcp.cost.getStoppedVMsOrg(orgId);
      if (response.success && response.data) {
        set({ gcpOrgStoppedVMs: response.data, gcpOrgStoppedVMsLoading: false });
      } else {
        set({ gcpOrgStoppedVMsError: response.error || 'Failed to load org-wide stopped VMs', gcpOrgStoppedVMsLoading: false });
      }
    } catch (error) {
      set({ gcpOrgStoppedVMsError: error instanceof Error ? error.message : 'Failed', gcpOrgStoppedVMsLoading: false });
    }
  },

  refreshGCPOrgRecommendations: async (orgId) => {
    await Promise.all([
      get().loadGCPOrgExpandedRecommendations(orgId),
      get().loadGCPOrgStoppedVMs(orgId),
    ]);
  },

  refreshGCPRecommendations: async (projectId) => {
    // Load all 4 recommendation sources in parallel
    await Promise.all([
      get().loadGCPExpandedRecommendations(projectId),
      get().loadGCPCostBestPractices(projectId),
      get().loadGCPCUDCoverage(projectId),
      get().loadGCPStoppedVMs(projectId),
    ]);
  },

  refreshGCP: async (projectId, forceRefresh) => {
    if (!window.electronAPI?.gcp?.cost) {
      set({ error: 'GCP cost API not available', isLoading: false });
      return;
    }

    const { costScope } = get();

    // Organization-level scope
    if (costScope === 'organization') {
      await get().loadGCPOrgCostAnalysis(forceRefresh);
      return;
    }

    set({ isLoading: true, error: null, optimizations: null });

    // Load cost analysis (BigQuery) and recommendations (Recommender API) in parallel.
    // Recommendations work without BigQuery, so they provide a fallback.
    const { dateRange, customStartDate, customEndDate, gcpFilters } = get();
    const { startDate, endDate } = getDateRangeParams(dateRange, customStartDate, customEndDate);

    // Read billing config from gcpProjectStore
    const { billingConfig } = useGCPProjectStore.getState();
    const bqProject = billingConfig?.bqProject || undefined;
    const bqDataset = billingConfig?.bqDataset || undefined;

    const filtersArg = hasActiveFilters(gcpFilters) ? gcpFilters : undefined;
    const promises: Promise<void>[] = [];

    // BigQuery cost analysis
    if (window.electronAPI.gcp.cost.getAnalysis) {
      promises.push(
        window.electronAPI.gcp.cost.getAnalysis(projectId, startDate, endDate, bqProject, bqDataset, filtersArg, forceRefresh, billingConfig?.bqRegion || undefined).then((response) => {
          if (response.success && response.data) {
            const updates: Partial<CostState> = { analysis: response.data };
            if (!hasActiveFilters(gcpFilters)) {
              updates.gcpFilterOptions = extractFilterOptions(response.data);
            }
            set(updates);
          } else {
            set({ error: response.error || 'Failed to load GCP cost data' });
          }
        })
      );
    }

    // Expanded Recommender API + Best Practices + CUD (all best-effort)
    promises.push(
      get().refreshGCPRecommendations(projectId).catch(() => { /* best-effort */ })
    );

    try {
      await Promise.all(promises);
    } catch {
      // Individual promise errors are handled above
    } finally {
      set({ isLoading: false });
    }
  },

  refreshProvider: async (provider, identity, forceRefresh) => {
    if (provider === 'gcp') {
      await get().refreshGCP(identity, forceRefresh);
    } else {
      await get().refreshAll(identity);
    }
  },

  clearAnalysis: () => set({
    analysis: null,
    optimizations: null,
    gcpExpandedRecs: null,
    gcpExpandedRecsLoading: false,
    gcpExpandedRecsError: null,
    gcpCostBestPractices: null,
    gcpCostBPLoading: false,
    gcpCostBPError: null,
    gcpCUDCoverage: null,
    gcpCUDLoading: false,
    gcpCUDError: null,
    gcpStoppedVMs: null,
    gcpStoppedVMsLoading: false,
    gcpStoppedVMsError: null,
    gcpOrgExpandedRecs: null,
    gcpOrgExpandedRecsLoading: false,
    gcpOrgExpandedRecsError: null,
    gcpOrgScanProgress: null,
    gcpOrgStoppedVMs: null,
    gcpOrgStoppedVMsLoading: false,
    gcpOrgStoppedVMsError: null,
  }),

  clearError: () => set({ error: null }),

  loadCostCacheHistory: async (identity) => {
    if (!window.electronAPI?.gcp?.costCache?.list) return;
    set({ costCacheLoading: true });
    try {
      const response = await window.electronAPI.gcp.costCache.list(identity, 'cost_analysis');
      if (response.success && response.data) {
        set({ costCacheHistory: response.data });
      }
    } catch { /* best-effort */ }
    set({ costCacheLoading: false });
  },

  viewCachedCostEntry: async (id) => {
    if (!window.electronAPI?.gcp?.costCache?.get) return;
    try {
      const response = await window.electronAPI.gcp.costCache.get(id);
      if (response.success && response.data?.data) {
        set({
          analysis: response.data.data as CostAnalysisResult,
          viewingCacheId: id,
          isLoading: false,
        });
      }
    } catch { /* best-effort */ }
  },

  deleteCachedCostEntry: async (id, identity) => {
    if (!window.electronAPI?.gcp?.costCache?.delete) return;
    try {
      await window.electronAPI.gcp.costCache.delete(id);
      if (get().viewingCacheId === id) set({ viewingCacheId: null });
      await get().loadCostCacheHistory(identity);
    } catch { /* best-effort */ }
  },

  clearCacheView: () => set({ viewingCacheId: null }),

  restoreLatestCache: async (identity) => {
    if (!window.electronAPI?.gcp?.costCache?.getLatest) return;
    if (get().analysis) return; // already have data
    try {
      const response = await window.electronAPI.gcp.costCache.getLatest(identity, 'cost_analysis');
      if (response.success && response.data?.data) {
        set({
          analysis: response.data.data as CostAnalysisResult,
          viewingCacheId: response.data.id,
        });
      }
    } catch { /* best-effort */ }
  },

  // ── AWS Cost Cache Methods ──

  loadAWSCostCacheHistory: async (identity) => {
    if (!window.electronAPI?.cost?.costCache?.list) return;
    set({ awsCostCacheLoading: true });
    try {
      const response = await window.electronAPI.cost.costCache.list(identity, 'cost_analysis');
      if (response.success && response.data) {
        set({ awsCostCacheHistory: response.data });
      }
    } catch { /* best-effort */ }
    set({ awsCostCacheLoading: false });
  },

  viewAWSCachedCostEntry: async (id) => {
    if (!window.electronAPI?.cost?.costCache?.get) return;
    try {
      const response = await window.electronAPI.cost.costCache.get(id);
      if (response.success && response.data?.data) {
        set({
          analysis: response.data.data as CostAnalysisResult,
          awsViewingCacheId: id,
          isLoading: false,
        });
      }
    } catch { /* best-effort */ }
  },

  deleteAWSCachedCostEntry: async (id, identity) => {
    if (!window.electronAPI?.cost?.costCache?.delete) return;
    try {
      await window.electronAPI.cost.costCache.delete(id);
      if (get().awsViewingCacheId === id) set({ awsViewingCacheId: null });
      await get().loadAWSCostCacheHistory(identity);
    } catch { /* best-effort */ }
  },

  clearAWSCacheView: () => set({ awsViewingCacheId: null }),

  restoreLatestAWSCache: async (identity) => {
    if (!window.electronAPI?.cost?.costCache?.getLatest) return;
    if (get().analysis) return; // already have data
    try {
      const response = await window.electronAPI.cost.costCache.getLatest(identity, 'cost_analysis');
      if (response.success && response.data?.data) {
        set({
          analysis: response.data.data as CostAnalysisResult,
          awsViewingCacheId: response.data.id,
        });
      }
    } catch { /* best-effort */ }
  },
}));

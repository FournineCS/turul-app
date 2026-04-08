// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { create } from 'zustand';
import type { GKECostAnalysis, CostDateRange, GCPCostCacheEntry } from '../../shared/types';
import { useGCPProjectStore } from './gcpProjectStore';

export type GKECostScope = 'project' | 'organization';

function getDateRange(range: CostDateRange, customStart?: string, customEnd?: string): { startDate: string; endDate: string } {
  const endDate = new Date().toISOString().split('T')[0];
  if (range === 'custom' && customStart && customEnd) {
    return { startDate: customStart, endDate: customEnd };
  }
  const days = range === '7d' ? 7 : range === '90d' ? 90 : range === '12m' ? 365 : 30;
  const startDate = new Date(Date.now() - days * 86400000).toISOString().split('T')[0];
  return { startDate, endDate };
}

interface GKECostState {
  analysis: GKECostAnalysis | null;
  isLoading: boolean;
  error: string | null;
  selectedCluster: string | null;
  selectedNamespace: string | null;
  scope: GKECostScope;
  dateRange: CostDateRange;
  customStartDate: string | null;
  customEndDate: string | null;

  // GKE cost cache
  gkeCacheHistory: GCPCostCacheEntry[];
  gkeCacheLoading: boolean;
  viewingCacheId: string | null;

  loadGKECosts: (identity: string) => Promise<void>;
  loadGKECostsOrg: () => Promise<void>;
  setSelectedCluster: (cluster: string | null) => void;
  setSelectedNamespace: (ns: string | null) => void;
  setScope: (scope: GKECostScope) => void;
  setDateRange: (range: CostDateRange) => void;
  setCustomDates: (startDate: string, endDate: string) => void;
  reset: () => void;
  loadGKECacheHistory: (identity: string) => Promise<void>;
  viewCachedGKEEntry: (id: string) => Promise<void>;
  deleteCachedGKEEntry: (id: string, identity: string) => Promise<void>;
  clearCacheView: () => void;
  restoreLatestGKECache: (identity: string) => Promise<void>;
}

export const useGKECostStore = create<GKECostState>((set, get) => ({
  analysis: null,
  isLoading: false,
  error: null,
  selectedCluster: null,
  selectedNamespace: null,
  scope: 'project',
  dateRange: '30d',
  customStartDate: null,
  customEndDate: null,
  gkeCacheHistory: [],
  gkeCacheLoading: false,
  viewingCacheId: null,

  loadGKECosts: async (projectId: string) => {
    set({ isLoading: true, error: null });
    try {
      const { billingConfig } = useGCPProjectStore.getState();
      const bqProject = billingConfig?.bqProject || undefined;
      const bqDataset = billingConfig?.bqDataset || undefined;
      const bqRegion = billingConfig?.bqRegion || undefined;

      const { dateRange, customStartDate, customEndDate, selectedCluster, selectedNamespace } = get();
      const { startDate, endDate } = getDateRange(dateRange, customStartDate || undefined, customEndDate || undefined);

      const response = await window.electronAPI.gcp.cost.getGKECosts(
        projectId, startDate, endDate, bqProject, bqDataset,
        selectedCluster || undefined, selectedNamespace || undefined,
        bqRegion
      );

      if (response.success && response.data) {
        set({ analysis: response.data, isLoading: false, viewingCacheId: null });
        // Auto-save to SQLite cache
        const { dateRange: dr } = get();
        window.electronAPI?.gcp?.costCache?.save({
          id: crypto.randomUUID(),
          dataType: 'gke_cost',
          scope: 'project',
          identity: projectId,
          fetchedAt: new Date().toISOString(),
          startDate,
          endDate,
          dateRangeLabel: dr,
          label: `${dr} GKE costs from ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
          totalCost: response.data.totalCost ?? 0,
          serviceCount: response.data.byCluster?.length ?? 0,
          data: response.data,
        }).catch(() => {});
      } else {
        set({ error: response.error || 'Failed to load GKE costs', isLoading: false });
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err), isLoading: false });
    }
  },

  loadGKECostsOrg: async () => {
    set({ isLoading: true, error: null });
    try {
      const { billingConfig } = useGCPProjectStore.getState();
      if (!billingConfig?.bqProject) {
        set({ error: 'BigQuery billing project is required for organization-level GKE cost analysis. Configure it in Settings > Billing Config.', isLoading: false });
        return;
      }

      const { dateRange, customStartDate, customEndDate, selectedCluster, selectedNamespace } = get();
      const { startDate, endDate } = getDateRange(dateRange, customStartDate || undefined, customEndDate || undefined);

      const response = await window.electronAPI.gcp.cost.getGKECostsOrg(
        startDate, endDate, billingConfig.bqProject,
        billingConfig.bqDataset || undefined,
        selectedCluster || undefined, selectedNamespace || undefined,
        billingConfig.bqRegion || undefined
      );

      if (response.success && response.data) {
        set({ analysis: response.data, isLoading: false, viewingCacheId: null });
        // Auto-save to SQLite cache
        const { selectedOrgId } = useGCPProjectStore.getState();
        const orgIdentity = selectedOrgId || billingConfig.bqProject;
        const { dateRange: dr } = get();
        window.electronAPI?.gcp?.costCache?.save({
          id: crypto.randomUUID(),
          dataType: 'gke_cost',
          scope: 'org',
          identity: orgIdentity,
          fetchedAt: new Date().toISOString(),
          startDate,
          endDate,
          dateRangeLabel: dr,
          label: `${dr} GKE org costs from ${new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`,
          totalCost: response.data.totalCost ?? 0,
          serviceCount: response.data.byCluster?.length ?? 0,
          data: response.data,
        }).catch(() => {});
      } else {
        set({ error: response.error || 'Failed to load org-level GKE costs', isLoading: false });
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err), isLoading: false });
    }
  },

  setSelectedCluster: (cluster) => set({ selectedCluster: cluster, selectedNamespace: null }),
  setSelectedNamespace: (ns) => set({ selectedNamespace: ns }),
  setScope: (scope) => set({ scope, analysis: null, selectedCluster: null, selectedNamespace: null, error: null }),
  setDateRange: (range) => set({ dateRange: range }),
  setCustomDates: (startDate, endDate) => set({ customStartDate: startDate, customEndDate: endDate }),
  reset: () => set({ analysis: null, isLoading: false, error: null, selectedCluster: null, selectedNamespace: null }),

  loadGKECacheHistory: async (identity) => {
    if (!window.electronAPI?.gcp?.costCache?.list) return;
    set({ gkeCacheLoading: true });
    try {
      const response = await window.electronAPI.gcp.costCache.list(identity, 'gke_cost');
      if (response.success && response.data) {
        set({ gkeCacheHistory: response.data });
      }
    } catch { /* best-effort */ }
    set({ gkeCacheLoading: false });
  },

  viewCachedGKEEntry: async (id) => {
    if (!window.electronAPI?.gcp?.costCache?.get) return;
    try {
      const response = await window.electronAPI.gcp.costCache.get(id);
      if (response.success && response.data?.data) {
        set({
          analysis: response.data.data as GKECostAnalysis,
          viewingCacheId: id,
          isLoading: false,
        });
      }
    } catch { /* best-effort */ }
  },

  deleteCachedGKEEntry: async (id, identity) => {
    if (!window.electronAPI?.gcp?.costCache?.delete) return;
    try {
      await window.electronAPI.gcp.costCache.delete(id);
      if (get().viewingCacheId === id) set({ viewingCacheId: null });
      await get().loadGKECacheHistory(identity);
    } catch { /* best-effort */ }
  },

  clearCacheView: () => set({ viewingCacheId: null }),

  restoreLatestGKECache: async (identity) => {
    if (!window.electronAPI?.gcp?.costCache?.getLatest) return;
    if (get().analysis) return;
    try {
      const response = await window.electronAPI.gcp.costCache.getLatest(identity, 'gke_cost');
      if (response.success && response.data?.data) {
        set({
          analysis: response.data.data as GKECostAnalysis,
          viewingCacheId: response.data.id,
        });
      }
    } catch { /* best-effort */ }
  },
}));

// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { create } from 'zustand';
import type {
  ResourceIdleAnalysisResult,
  GCPOptimizationSnapshot,
} from '../../shared/types';
import { useCostStore } from './costStore';

interface GCPOptimizationState {
  // Current resource analysis results (in-memory)
  resourceFindings: ResourceIdleAnalysisResult | null;
  resourceFindingsLoading: boolean;
  resourceFindingsError: string | null;

  // History
  snapshots: GCPOptimizationSnapshot[];
  snapshotsLoading: boolean;
  selectedSnapshot: GCPOptimizationSnapshot | null;

  // Actions
  runResourceAnalysis: (identity: string) => Promise<void>;
  loadHistory: (identity: string) => Promise<void>;
  viewSnapshot: (id: string) => Promise<void>;
  clearSelectedSnapshot: () => void;
  deleteSnapshot: (id: string, identity: string) => Promise<void>;
  saveCurrentSnapshot: (
    identity: string,
    scope: 'project' | 'org'
  ) => Promise<void>;
}

export const useGCPOptimizationStore = create<GCPOptimizationState>((set, get) => ({
  resourceFindings: null,
  resourceFindingsLoading: false,
  resourceFindingsError: null,
  snapshots: [],
  snapshotsLoading: false,
  selectedSnapshot: null,

  runResourceAnalysis: async (identity: string) => {
    set({ resourceFindingsLoading: true, resourceFindingsError: null });
    try {
      const api = window.electronAPI;
      const res = await api.gcp.optimization.analyzeResources(identity);
      if (res.success && res.data) {
        set({ resourceFindings: res.data, resourceFindingsLoading: false });
      } else {
        set({ resourceFindingsError: res.error ?? 'Unknown error', resourceFindingsLoading: false });
      }
    } catch (err) {
      set({
        resourceFindingsError: err instanceof Error ? err.message : String(err),
        resourceFindingsLoading: false,
      });
    }
  },

  loadHistory: async (identity: string) => {
    set({ snapshotsLoading: true });
    try {
      const api = window.electronAPI;
      const res = await api.gcp.optimization.listSnapshots(identity);
      if (res.success && res.data) {
        set({ snapshots: res.data, snapshotsLoading: false });
      } else {
        set({ snapshotsLoading: false });
      }
    } catch {
      set({ snapshotsLoading: false });
    }
  },

  viewSnapshot: async (id: string) => {
    try {
      const api = window.electronAPI;
      const res = await api.gcp.optimization.getSnapshot(id);
      if (res.success && res.data) {
        set({ selectedSnapshot: res.data });
      }
    } catch {
      // ignore
    }
  },

  clearSelectedSnapshot: () => set({ selectedSnapshot: null }),

  deleteSnapshot: async (id: string, identity: string) => {
    try {
      const api = window.electronAPI;
      await api.gcp.optimization.deleteSnapshot(id);
      // Reload list
      const res = await api.gcp.optimization.listSnapshots(identity);
      if (res.success && res.data) {
        set({ snapshots: res.data });
      }
      // Clear selection if deleted
      if (get().selectedSnapshot?.id === id) {
        set({ selectedSnapshot: null });
      }
    } catch {
      // ignore
    }
  },

  saveCurrentSnapshot: async (identity: string, scope: 'project' | 'org') => {
    const costState = useCostStore.getState();
    const { resourceFindings } = get();

    const expandedRecs = scope === 'org' ? costState.gcpOrgExpandedRecs : costState.gcpExpandedRecs;
    const stoppedVMs = scope === 'org' ? costState.gcpOrgStoppedVMs : costState.gcpStoppedVMs;

    const snapshot: GCPOptimizationSnapshot = {
      id: globalThis.crypto.randomUUID(),
      scope,
      identity,
      scannedAt: new Date().toISOString(),
      totalSavings:
        (expandedRecs?.totalPotentialSavings ?? 0) +
        (resourceFindings?.estimatedMonthlySavings ?? 0),
      recCount: expandedRecs?.recommendations?.length ?? 0,
      vmCount: stoppedVMs?.vms?.length ?? 0,
      resourceFindingsCount: resourceFindings?.totalFindings ?? 0,
      expandedRecs: expandedRecs ?? undefined,
      stoppedVMs: stoppedVMs ?? undefined,
      resourceFindings: resourceFindings ?? undefined,
    };

    try {
      const api = window.electronAPI;
      await api.gcp.optimization.saveSnapshot(snapshot);
      // Refresh history
      const res = await api.gcp.optimization.listSnapshots(identity);
      if (res.success && res.data) {
        set({ snapshots: res.data });
      }
    } catch {
      // ignore — snapshot save failure is non-critical
    }
  },
}));

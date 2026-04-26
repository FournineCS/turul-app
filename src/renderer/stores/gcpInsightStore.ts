// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { create } from 'zustand';
import type {
  GCPCostInsight,
  GCPCostInsightSeverity,
} from '../../shared/types';

interface GCPInsightState {
  insights: GCPCostInsight[];
  byType: Record<string, number>;
  bySeverity: Record<GCPCostInsightSeverity, number>;
  insightTypesScanned: string[];
  locationsScanned: string[];
  errors: string[];
  isLoading: boolean;
  error: string | null;
  lastLoadedProjectId: string | null;

  loadInsights: (projectId: string) => Promise<void>;
  reset: () => void;
}

export const useGCPInsightStore = create<GCPInsightState>((set) => ({
  insights: [],
  byType: {},
  bySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
  insightTypesScanned: [],
  locationsScanned: [],
  errors: [],
  isLoading: false,
  error: null,
  lastLoadedProjectId: null,

  loadInsights: async (projectId: string) => {
    if (!projectId) return;
    set({ isLoading: true, error: null });
    try {
      const resp = await window.electronAPI.gcp.cost.getInsights(projectId);
      if (!resp.success || !resp.data) {
        set({ isLoading: false, error: resp.error ?? 'Insights query failed' });
        return;
      }
      const d = resp.data;
      set({
        insights: d.insights,
        byType: d.byType,
        bySeverity: d.bySeverity,
        insightTypesScanned: d.insightTypesScanned,
        locationsScanned: d.locationsScanned,
        errors: d.errors,
        isLoading: false,
        error: null,
        lastLoadedProjectId: projectId,
      });
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },

  reset: () => set({
    insights: [],
    byType: {},
    bySeverity: { critical: 0, high: 0, medium: 0, low: 0 },
    insightTypesScanned: [],
    locationsScanned: [],
    errors: [],
    isLoading: false,
    error: null,
    lastLoadedProjectId: null,
  }),
}));

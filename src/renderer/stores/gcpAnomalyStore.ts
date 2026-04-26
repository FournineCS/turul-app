// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { create } from 'zustand';
import type { GCPCostAnomaly, GCPCostAnomalyOptions } from '../../shared/types';

interface GCPAnomalyState {
  anomalies: GCPCostAnomaly[];
  windowStart: string | null;
  windowEnd: string | null;
  baselineStart: string | null;
  baselineEnd: string | null;
  servicesEvaluated: number;
  thresholds: { minDeviationPct: number; minImpactUsd: number; windowDays: number } | null;
  isLoading: boolean;
  error: string | null;
  errors: string[];
  lastLoadedKey: string | null;

  detect: (
    projectId: string,
    bqProject: string,
    bqDataset: string,
    bqRegion?: string,
    options?: GCPCostAnomalyOptions
  ) => Promise<void>;
  reset: () => void;
}

export const useGCPAnomalyStore = create<GCPAnomalyState>((set) => ({
  anomalies: [],
  windowStart: null,
  windowEnd: null,
  baselineStart: null,
  baselineEnd: null,
  servicesEvaluated: 0,
  thresholds: null,
  isLoading: false,
  error: null,
  errors: [],
  lastLoadedKey: null,

  detect: async (projectId, bqProject, bqDataset, bqRegion, options) => {
    if (!projectId || !bqProject || !bqDataset) return;
    const key = `${projectId}|${bqProject}|${bqDataset}|${bqRegion ?? ''}|${options?.windowDays ?? 7}|${options?.minDeviationPct ?? 30}|${options?.minImpactUsd ?? 25}`;
    set({ isLoading: true, error: null });
    try {
      const resp = await window.electronAPI.gcp.cost.detectAnomalies(
        projectId,
        bqProject,
        bqDataset,
        bqRegion,
        options
      );
      if (!resp.success || !resp.data) {
        set({ isLoading: false, error: resp.error ?? 'Anomaly detection failed' });
        return;
      }
      const d = resp.data;
      set({
        anomalies: d.anomalies,
        windowStart: d.windowStart,
        windowEnd: d.windowEnd,
        baselineStart: d.baselineStart,
        baselineEnd: d.baselineEnd,
        servicesEvaluated: d.servicesEvaluated,
        thresholds: d.thresholds,
        errors: d.errors,
        isLoading: false,
        error: null,
        lastLoadedKey: key,
      });
    } catch (err) {
      set({
        isLoading: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },

  reset: () => set({
    anomalies: [],
    windowStart: null,
    windowEnd: null,
    baselineStart: null,
    baselineEnd: null,
    servicesEvaluated: 0,
    thresholds: null,
    isLoading: false,
    error: null,
    errors: [],
    lastLoadedKey: null,
  }),
}));

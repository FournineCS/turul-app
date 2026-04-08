// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { create } from 'zustand';
import type { CreditsAnalysisResult, CostDateRange } from '../../shared/types';
import { useGCPProjectStore } from './gcpProjectStore';

type CostScope = 'project' | 'organization';

interface CreditsState {
  credits: CreditsAnalysisResult | null;
  dateRange: CostDateRange;
  customStartDate: string | null;
  customEndDate: string | null;
  costScope: CostScope;
  isLoading: boolean;
  error: string | null;

  setDateRange: (range: CostDateRange) => void;
  setCustomDates: (start: string, end: string) => void;
  setCostScope: (scope: CostScope) => void;
  refreshCredits: (provider: 'aws' | 'gcp', identity: string) => Promise<void>;
  clearCredits: () => void;
  clearError: () => void;
}

function getDateRangeParams(
  dateRange: CostDateRange,
  customStartDate: string | null,
  customEndDate: string | null
): { startDate: string; endDate: string } {
  const endDate = new Date();
  let startDate = new Date();

  switch (dateRange) {
    case '7d':
      startDate.setDate(startDate.getDate() - 7);
      break;
    case '30d':
      startDate.setDate(startDate.getDate() - 30);
      break;
    case '90d':
      startDate.setDate(startDate.getDate() - 90);
      break;
    case '12m':
      startDate.setDate(startDate.getDate() - 365);
      break;
    case 'custom':
      if (customStartDate && customEndDate) {
        return { startDate: customStartDate, endDate: customEndDate };
      }
      startDate.setDate(startDate.getDate() - 30);
      break;
  }

  const fmt = (d: Date) => d.toISOString().split('T')[0];
  return { startDate: fmt(startDate), endDate: fmt(endDate) };
}

export const useCreditsStore = create<CreditsState>((set, get) => ({
  credits: null,
  dateRange: '12m',
  customStartDate: null,
  customEndDate: null,
  costScope: 'project',
  isLoading: false,
  error: null,

  setDateRange: (range) => set({ dateRange: range }),
  setCustomDates: (start, end) => set({ customStartDate: start, customEndDate: end }),
  setCostScope: (scope) => set({ costScope: scope, credits: null }),

  refreshCredits: async (provider, identity) => {
    set({ isLoading: true, error: null });
    const { dateRange, customStartDate, customEndDate, costScope } = get();
    const { startDate, endDate } = getDateRangeParams(dateRange, customStartDate, customEndDate);

    try {
      if (provider === 'aws') {
        const resp = await window.electronAPI?.credits?.getAnalysis(identity, startDate, endDate);
        if (resp?.success && resp.data) {
          set({ credits: resp.data, isLoading: false });
        } else {
          set({ error: resp?.error || 'Failed to load AWS credits', isLoading: false });
        }
      } else {
        const gcpState = useGCPProjectStore.getState();
        const bqProject = gcpState.billingConfig?.bqProject;
        const bqDataset = gcpState.billingConfig?.bqDataset;
        const bqRegion = gcpState.billingConfig?.bqRegion;

        let resp;
        if (costScope === 'organization') {
          if (!bqProject) {
            set({ error: 'BigQuery billing project is required for organization-level credits analysis.', isLoading: false });
            return;
          }
          resp = await window.electronAPI?.gcp?.credits?.getOrgAnalysis(startDate, endDate, bqProject, bqDataset, bqRegion);
        } else {
          resp = await window.electronAPI?.gcp?.credits?.getAnalysis(identity, startDate, endDate, bqProject, bqDataset, bqRegion);
        }

        if (resp?.success && resp.data) {
          set({ credits: resp.data, isLoading: false });
        } else {
          set({ error: resp?.error || 'Failed to load GCP credits', isLoading: false });
        }
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to load credits', isLoading: false });
    }
  },

  clearCredits: () => set({ credits: null, error: null }),
  clearError: () => set({ error: null }),
}));

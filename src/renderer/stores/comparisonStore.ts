// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { create } from 'zustand';
import type { ScanDiffResult } from '../../shared/types';

interface ComparisonState {
  result: ScanDiffResult | null;
  isLoading: boolean;
  error: string | null;

  diffScans: (scanIdA: string, scanIdB: string) => Promise<void>;
  clearError: () => void;
  clearResult: () => void;
}

export const useComparisonStore = create<ComparisonState>((set) => ({
  result: null,
  isLoading: false,
  error: null,

  diffScans: async (scanIdA, scanIdB) => {
    if (!window.electronAPI?.comparison) {
      set({ error: 'API not available' });
      return;
    }
    set({ isLoading: true, error: null, result: null });
    try {
      const response = await window.electronAPI.comparison.diffScans(scanIdA, scanIdB);
      if (response.success && response.data) {
        set({ result: response.data, isLoading: false });
      } else {
        set({ error: response.error || 'Failed to diff scans', isLoading: false });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to diff scans',
        isLoading: false,
      });
    }
  },

  clearError: () => set({ error: null }),
  clearResult: () => set({ result: null }),
}));

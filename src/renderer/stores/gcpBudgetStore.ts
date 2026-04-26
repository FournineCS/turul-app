// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { create } from 'zustand';
import type { GCPBudget } from '../../shared/types';

interface GCPBudgetState {
  billingAccountName: string | null;
  budgets: GCPBudget[];
  errors: string[];
  isLoading: boolean;
  error: string | null;
  lastLoadedProjectId: string | null;

  loadBudgets: (projectId: string) => Promise<void>;
  reset: () => void;
}

export const useGCPBudgetStore = create<GCPBudgetState>((set, get) => ({
  billingAccountName: null,
  budgets: [],
  errors: [],
  isLoading: false,
  error: null,
  lastLoadedProjectId: null,

  loadBudgets: async (projectId: string) => {
    if (!projectId) return;
    set({ isLoading: true, error: null });
    try {
      const accountResp = await window.electronAPI.gcp.cost.resolveBillingAccount(projectId);
      if (!accountResp.success) {
        set({
          isLoading: false,
          error: accountResp.error ?? 'Failed to resolve billing account',
          billingAccountName: null,
          budgets: [],
          lastLoadedProjectId: projectId,
        });
        return;
      }
      const billingAccountName = accountResp.data?.billingAccountName ?? null;
      if (!billingAccountName) {
        set({
          isLoading: false,
          billingAccountName: null,
          budgets: [],
          errors: [],
          lastLoadedProjectId: projectId,
        });
        return;
      }
      const budgetsResp = await window.electronAPI.gcp.cost.listBudgets(projectId, billingAccountName);
      if (!budgetsResp.success || !budgetsResp.data) {
        set({
          isLoading: false,
          billingAccountName,
          budgets: [],
          errors: [],
          error: budgetsResp.error ?? 'Failed to list budgets',
          lastLoadedProjectId: projectId,
        });
        return;
      }
      set({
        isLoading: false,
        billingAccountName,
        budgets: budgetsResp.data.budgets,
        errors: budgetsResp.data.errors,
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

  reset: () => {
    set({
      billingAccountName: null,
      budgets: [],
      errors: [],
      isLoading: false,
      error: null,
      lastLoadedProjectId: null,
    });
    void get; // keep linter quiet
  },
}));

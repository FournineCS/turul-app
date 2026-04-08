// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { create } from 'zustand';
import type { TagGovernanceConfig, TagComplianceResult, GCPLabelComplianceResult, GCPLabelComplianceSummary } from '../../shared/types';

interface TagGovernanceState {
  config: TagGovernanceConfig | null;
  compliance: TagComplianceResult | null;
  gcpConfig: { requiredLabels: string[] } | null;
  gcpCompliance: GCPLabelComplianceResult | null;
  gcpHistory: GCPLabelComplianceSummary[];
  isLoadingGCPHistory: boolean;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;

  loadConfig: () => Promise<void>;
  saveConfig: (requiredTags: string[]) => Promise<void>;
  loadCompliance: (scanId: string) => Promise<void>;
  loadGCPConfig: () => Promise<void>;
  saveGCPConfig: (requiredLabels: string[]) => Promise<void>;
  checkGCPCompliance: (projectId: string) => Promise<void>;
  loadGCPHistory: (projectId: string) => Promise<void>;
  loadGCPComplianceById: (id: string) => Promise<void>;
  deleteGCPCompliance: (id: string) => Promise<void>;
  clearError: () => void;
}

export const useTagGovernanceStore = create<TagGovernanceState>((set, get) => ({
  config: null,
  compliance: null,
  gcpConfig: null,
  gcpCompliance: null,
  gcpHistory: [],
  isLoadingGCPHistory: false,
  isLoading: false,
  isSaving: false,
  error: null,

  loadConfig: async () => {
    if (!window.electronAPI?.tags) {
      set({ error: 'Electron API not available' });
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const response = await window.electronAPI.tags.getConfig();
      if (response.success && response.data) {
        set({ config: response.data, isLoading: false });
      } else {
        set({ error: response.error || 'Failed to load config', isLoading: false });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load config',
        isLoading: false,
      });
    }
  },

  saveConfig: async (requiredTags) => {
    if (!window.electronAPI?.tags) {
      set({ error: 'Electron API not available' });
      return;
    }

    set({ isSaving: true, error: null });
    try {
      const response = await window.electronAPI.tags.saveConfig(requiredTags);
      if (response.success) {
        set({ config: { requiredTags }, isSaving: false });
      } else {
        set({ error: response.error || 'Failed to save config', isSaving: false });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to save config',
        isSaving: false,
      });
    }
  },

  loadCompliance: async (scanId) => {
    if (!window.electronAPI?.tags) {
      set({ error: 'Electron API not available' });
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const response = await window.electronAPI.tags.getCompliance(scanId);
      if (response.success && response.data) {
        set({ compliance: response.data, isLoading: false });
      } else {
        set({ error: response.error || 'Failed to load compliance', isLoading: false });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load compliance',
        isLoading: false,
      });
    }
  },

  loadGCPConfig: async () => {
    if (!window.electronAPI?.gcp?.labels) return;
    set({ isLoading: true, error: null });
    try {
      const response = await window.electronAPI.gcp.labels.getConfig();
      if (response.success && response.data) {
        set({ gcpConfig: response.data, isLoading: false });
      } else {
        set({ error: response.error || 'Failed to load GCP label config', isLoading: false });
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to load GCP label config', isLoading: false });
    }
  },

  saveGCPConfig: async (requiredLabels) => {
    if (!window.electronAPI?.gcp?.labels) return;
    set({ isSaving: true, error: null });
    try {
      const response = await window.electronAPI.gcp.labels.saveConfig(requiredLabels);
      if (response.success) {
        set({ gcpConfig: { requiredLabels }, isSaving: false });
      } else {
        set({ error: response.error || 'Failed to save GCP label config', isSaving: false });
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to save GCP label config', isSaving: false });
    }
  },

  checkGCPCompliance: async (projectId) => {
    if (!window.electronAPI?.gcp?.labels) return;
    const { gcpConfig } = get();
    const requiredLabels = gcpConfig?.requiredLabels || [];
    if (requiredLabels.length === 0) {
      set({ error: 'No required labels configured' });
      return;
    }
    set({ isLoading: true, error: null, gcpCompliance: null });
    try {
      const response = await window.electronAPI.gcp.labels.checkCompliance(projectId, requiredLabels);
      if (!response.success) {
        set({ error: response.error || 'Failed to start label compliance check', isLoading: false });
      }
      // Result arrives via onCompleted event
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to check GCP label compliance', isLoading: false });
    }
  },

  loadGCPHistory: async (projectId) => {
    if (!window.electronAPI?.gcp?.labels?.getAll) return;
    set({ isLoadingGCPHistory: true });
    try {
      const response = await window.electronAPI.gcp.labels.getAll(projectId, 20);
      if (response.success && response.data) {
        set({ gcpHistory: response.data, isLoadingGCPHistory: false });
      } else {
        set({ isLoadingGCPHistory: false });
      }
    } catch {
      set({ isLoadingGCPHistory: false });
    }
  },

  loadGCPComplianceById: async (id) => {
    if (!window.electronAPI?.gcp?.labels?.getById) return;
    set({ isLoading: true, error: null });
    try {
      const response = await window.electronAPI.gcp.labels.getById(id);
      if (response.success && response.data) {
        set({ gcpCompliance: response.data, isLoading: false });
      } else {
        set({ error: response.error || 'Failed to load result', isLoading: false });
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to load result', isLoading: false });
    }
  },

  deleteGCPCompliance: async (id) => {
    if (!window.electronAPI?.gcp?.labels?.delete) return;
    try {
      await window.electronAPI.gcp.labels.delete(id);
      const { gcpHistory } = get();
      set({ gcpHistory: gcpHistory.filter((h) => h.id !== id) });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to delete' });
    }
  },

  clearError: () => set({ error: null }),
}));

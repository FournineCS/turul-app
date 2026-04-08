// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { create } from 'zustand';
import type { GCPNetworkAnalysisResult, GCPNetworkAnalysisSummary } from '../../shared/types';

interface NetworkAnalysisState {
  gcpResult: GCPNetworkAnalysisResult | null;
  gcpHistory: GCPNetworkAnalysisSummary[];
  isLoadingGCPHistory: boolean;
  isLoading: boolean;
  error: string | null;
  awsHistory: any[];
  isLoadingAWSHistory: boolean;

  runGCPAnalysis: (projectId: string) => Promise<void>;
  loadGCPHistory: (projectId: string) => Promise<void>;
  loadGCPAnalysisById: (id: string) => Promise<void>;
  deleteGCPAnalysis: (id: string) => Promise<void>;
  loadAWSHistory: (profileName?: string) => Promise<void>;
  loadAWSScanById: (id: string) => Promise<void>;
  deleteAWSScan: (id: string) => Promise<void>;
  clearError: () => void;
}

export const useNetworkAnalysisStore = create<NetworkAnalysisState>((set, get) => ({
  gcpResult: null,
  gcpHistory: [],
  isLoadingGCPHistory: false,
  isLoading: false,
  error: null,
  awsHistory: [],
  isLoadingAWSHistory: false,

  runGCPAnalysis: async (projectId) => {
    if (!window.electronAPI?.gcp?.network?.analyze) {
      set({ error: 'Network Analysis API not available' });
      return;
    }
    set({ isLoading: true, error: null, gcpResult: null });
    try {
      const response = await window.electronAPI.gcp.network.analyze(projectId);
      if (!response.success) {
        set({ error: response.error || 'Failed to start network analysis', isLoading: false });
      }
      // Result arrives via onCompleted event
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to start network analysis', isLoading: false });
    }
  },

  loadGCPHistory: async (projectId) => {
    if (!window.electronAPI?.gcp?.network?.getAll) return;
    set({ isLoadingGCPHistory: true });
    try {
      const response = await window.electronAPI.gcp.network.getAll(projectId, 20);
      if (response.success && response.data) {
        set({ gcpHistory: response.data, isLoadingGCPHistory: false });
      } else {
        set({ isLoadingGCPHistory: false });
      }
    } catch {
      set({ isLoadingGCPHistory: false });
    }
  },

  loadGCPAnalysisById: async (id) => {
    if (!window.electronAPI?.gcp?.network?.getById) return;
    set({ isLoading: true, error: null });
    try {
      const response = await window.electronAPI.gcp.network.getById(id);
      if (response.success && response.data) {
        set({ gcpResult: response.data, isLoading: false });
      } else {
        set({ error: response.error || 'Failed to load result', isLoading: false });
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to load result', isLoading: false });
    }
  },

  deleteGCPAnalysis: async (id) => {
    if (!window.electronAPI?.gcp?.network?.delete) return;
    try {
      await window.electronAPI.gcp.network.delete(id);
      const { gcpHistory } = get();
      set({ gcpHistory: gcpHistory.filter((h) => h.id !== id) });
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to delete' });
    }
  },

  loadAWSHistory: async (profileName?) => {
    if (!window.electronAPI?.network?.getAll) return;
    set({ isLoadingAWSHistory: true });
    try {
      const response = await window.electronAPI.network.getAll(profileName, 20);
      if (response.success && response.data) {
        set({ awsHistory: response.data, isLoadingAWSHistory: false });
      } else {
        set({ isLoadingAWSHistory: false });
      }
    } catch {
      set({ isLoadingAWSHistory: false });
    }
  },

  loadAWSScanById: async (id) => {
    if (!window.electronAPI?.network?.getById) return;
    try {
      const response = await window.electronAPI.network.getById(id);
      if (response.success && response.data) {
        set({ gcpResult: null, error: null });
        // Network analysis for AWS uses a different result shape; store generically
        set({ error: null } as any);
      } else {
        set({ error: response.error || 'Failed to load network analysis' });
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to load network analysis' });
    }
  },

  deleteAWSScan: async (id) => {
    if (!window.electronAPI?.network?.delete) return;
    try {
      await window.electronAPI.network.delete(id);
      set((state) => ({
        awsHistory: state.awsHistory.filter((h: any) => h.id !== id),
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to delete network analysis' });
    }
  },

  clearError: () => set({ error: null }),
}));

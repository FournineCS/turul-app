// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { create } from 'zustand';
import type { IAMAnalysisResult, GCPIAMAnalysisResult, GCPIAMAnalysisSummary } from '../../shared/types';

interface IAMAnalysisState {
  result: IAMAnalysisResult | null;
  gcpResult: GCPIAMAnalysisResult | null;
  isLoading: boolean;
  error: string | null;
  gcpHistory: GCPIAMAnalysisSummary[];
  isLoadingGCPHistory: boolean;
  awsHistory: any[];
  isLoadingAWSHistory: boolean;

  runAnalysis: (profileName: string) => Promise<void>;
  runGCPAnalysis: (projectId: string) => Promise<void>;
  loadGCPHistory: (projectId: string) => Promise<void>;
  loadGCPAnalysisById: (id: string) => Promise<void>;
  deleteGCPAnalysis: (id: string) => Promise<void>;
  loadAWSHistory: (profileName?: string) => Promise<void>;
  loadAWSScanById: (id: string) => Promise<void>;
  deleteAWSScan: (id: string) => Promise<void>;
  clearError: () => void;
  clearResult: () => void;
}

export const useIAMAnalysisStore = create<IAMAnalysisState>((set) => ({
  result: null,
  gcpResult: null,
  isLoading: false,
  error: null,
  gcpHistory: [],
  isLoadingGCPHistory: false,
  awsHistory: [],
  isLoadingAWSHistory: false,

  runAnalysis: async (profileName) => {
    if (!window.electronAPI?.iam) {
      set({ error: 'API not available' });
      return;
    }
    set({ isLoading: true, error: null, result: null });
    try {
      const response = await window.electronAPI.iam.runAnalysis(profileName);
      if (!response.success) {
        set({ error: response.error || 'Failed to run IAM analysis', isLoading: false });
      }
      // Result will arrive via iam:completed event
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to run IAM analysis',
        isLoading: false,
      });
    }
  },

  runGCPAnalysis: async (projectId) => {
    if (!window.electronAPI?.gcp?.iam) {
      set({ error: 'GCP IAM API not available' });
      return;
    }
    set({ isLoading: true, error: null, gcpResult: null });
    try {
      const response = await window.electronAPI.gcp.iam.runAnalysis(projectId);
      if (!response.success) {
        set({ error: response.error || 'Failed to start GCP IAM analysis', isLoading: false });
      }
      // Result will arrive via onCompleted event
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to run GCP IAM analysis',
        isLoading: false,
      });
    }
  },

  loadGCPHistory: async (projectId) => {
    if (!window.electronAPI?.gcp?.iam?.getAll) return;

    set({ isLoadingGCPHistory: true });
    try {
      const response = await window.electronAPI.gcp.iam.getAll(projectId, 20);
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
    if (!window.electronAPI?.gcp?.iam?.getById) return;

    try {
      const response = await window.electronAPI.gcp.iam.getById(id);
      if (response.success && response.data) {
        set({ gcpResult: response.data, error: null });
      } else {
        set({ error: response.error || 'Failed to load GCP IAM analysis' });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load GCP IAM analysis',
      });
    }
  },

  deleteGCPAnalysis: async (id) => {
    if (!window.electronAPI?.gcp?.iam?.delete) return;

    try {
      await window.electronAPI.gcp.iam.delete(id);
      set((state) => ({
        gcpHistory: state.gcpHistory.filter((h) => h.id !== id),
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to delete GCP IAM analysis',
      });
    }
  },

  loadAWSHistory: async (profileName?) => {
    if (!window.electronAPI?.iam?.getAll) return;
    set({ isLoadingAWSHistory: true });
    try {
      const response = await window.electronAPI.iam.getAll(profileName, 20);
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
    if (!window.electronAPI?.iam?.getById) return;
    try {
      const response = await window.electronAPI.iam.getById(id);
      if (response.success && response.data) {
        set({ result: response.data, error: null });
      } else {
        set({ error: response.error || 'Failed to load IAM analysis' });
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to load IAM analysis' });
    }
  },

  deleteAWSScan: async (id) => {
    if (!window.electronAPI?.iam?.delete) return;
    try {
      await window.electronAPI.iam.delete(id);
      set((state) => ({
        awsHistory: state.awsHistory.filter((h: any) => h.id !== id),
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to delete IAM analysis' });
    }
  },

  clearError: () => set({ error: null }),
  clearResult: () => set({ result: null, gcpResult: null }),
}));

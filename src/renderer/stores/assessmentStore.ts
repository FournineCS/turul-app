// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { create } from 'zustand';
import type {
  AssessmentConfig,
  AssessmentResult,
  AssessmentProgress,
  AssessmentSummary,
  GCPAssessmentConfig,
  GCPAssessmentResult,
  GCPAssessmentProgress,
  GCPAssessmentSummary,
} from '../../shared/types';

interface AssessmentState {
  config: AssessmentConfig | null;
  result: AssessmentResult | null;
  progress: AssessmentProgress | null;
  gcpResult: GCPAssessmentResult | null;
  gcpProgress: GCPAssessmentProgress | null;
  isRunning: boolean;
  error: string | null;
  assessmentHistory: AssessmentSummary[];
  isLoadingHistory: boolean;
  gcpHistory: GCPAssessmentSummary[];
  isLoadingGCPHistory: boolean;

  runAssessment: (config: AssessmentConfig) => Promise<void>;
  runGCPAssessment: (projectId: string) => Promise<void>;
  generateReport: (outputDir: string) => Promise<string | null>;
  generateGCPReport: (outputDir: string) => Promise<string | null>;
  loadHistory: () => Promise<void>;
  loadAssessment: (id: string) => Promise<void>;
  deleteAssessment: (id: string) => Promise<void>;
  loadGCPHistory: (projectId: string) => Promise<void>;
  loadGCPAssessmentById: (id: string) => Promise<void>;
  deleteGCPAssessment: (id: string) => Promise<void>;
  reset: () => void;
  setProgress: (progress: AssessmentProgress) => void;
  setGCPProgress: (progress: GCPAssessmentProgress) => void;
  clearError: () => void;
}

export const useAssessmentStore = create<AssessmentState>((set, get) => ({
  config: null,
  result: null,
  progress: null,
  gcpResult: null,
  gcpProgress: null,
  isRunning: false,
  error: null,
  assessmentHistory: [],
  isLoadingHistory: false,
  gcpHistory: [],
  isLoadingGCPHistory: false,

  runGCPAssessment: async (projectId) => {
    if (!window.electronAPI?.gcp?.assessment) {
      set({ error: 'GCP Assessment API not available', isRunning: false });
      return;
    }
    set({ isRunning: true, error: null, gcpResult: null, gcpProgress: null });
    try {
      const response = await window.electronAPI.gcp.assessment.run({ projectId, domains: [] });
      if (!response.success) {
        set({ error: response.error || 'Failed to start GCP assessment', isRunning: false });
      }
      // Result will arrive via onCompleted event — don't set isRunning: false here
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to run GCP assessment',
        isRunning: false,
      });
    }
  },

  runAssessment: async (config) => {
    if (!window.electronAPI?.assessment) {
      set({ error: 'Electron API not available', isRunning: false });
      return;
    }

    set({ isRunning: true, error: null, result: null, progress: null, config });

    try {
      const response = await window.electronAPI.assessment.run(config);

      if (response.success && response.data) {
        set({ result: response.data, isRunning: false, progress: null });
        // Refresh history after successful run
        get().loadHistory();
      } else {
        set({ error: response.error || 'Failed to run assessment', isRunning: false });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to run assessment',
        isRunning: false,
      });
    }
  },

  generateReport: async (outputDir) => {
    const { result } = get();
    if (!result || !window.electronAPI?.assessment) {
      set({ error: 'No assessment result or Electron API not available' });
      return null;
    }

    try {
      const response = await window.electronAPI.assessment.generateReport(result, outputDir);
      if (response.success && response.data) {
        return response.data.filePath;
      } else {
        set({ error: response.error || 'Failed to generate report' });
        return null;
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to generate report',
      });
      return null;
    }
  },

  generateGCPReport: async (outputDir) => {
    const { gcpResult } = get();
    if (!gcpResult || !window.electronAPI?.gcp?.assessment?.generateReport) {
      set({ error: 'No GCP assessment result or API not available' });
      return null;
    }

    try {
      const response = await window.electronAPI.gcp.assessment.generateReport(gcpResult, outputDir);
      if (response.success && response.data) {
        return response.data.filePath;
      } else {
        set({ error: response.error || 'Failed to generate GCP report' });
        return null;
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to generate GCP report',
      });
      return null;
    }
  },

  loadHistory: async () => {
    if (!window.electronAPI?.assessment) return;

    set({ isLoadingHistory: true });
    try {
      const response = await window.electronAPI.assessment.getAll();
      if (response.success && response.data) {
        set({ assessmentHistory: response.data, isLoadingHistory: false });
      } else {
        set({ isLoadingHistory: false });
      }
    } catch {
      set({ isLoadingHistory: false });
    }
  },

  loadAssessment: async (id) => {
    if (!window.electronAPI?.assessment) {
      set({ error: 'Electron API not available' });
      return;
    }

    try {
      const response = await window.electronAPI.assessment.getById(id);
      if (response.success && response.data) {
        set({ result: response.data, error: null });
      } else {
        set({ error: response.error || 'Failed to load assessment' });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load assessment',
      });
    }
  },

  deleteAssessment: async (id) => {
    if (!window.electronAPI?.assessment) return;

    try {
      const response = await window.electronAPI.assessment.delete(id);
      if (response.success) {
        set((state) => ({
          assessmentHistory: state.assessmentHistory.filter((a) => a.id !== id),
        }));
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to delete assessment',
      });
    }
  },

  loadGCPHistory: async (projectId) => {
    if (!window.electronAPI?.gcp?.assessment?.getAll) return;

    set({ isLoadingGCPHistory: true });
    try {
      const response = await window.electronAPI.gcp.assessment.getAll(projectId, 20);
      if (response.success && response.data) {
        set({ gcpHistory: response.data, isLoadingGCPHistory: false });
      } else {
        set({ isLoadingGCPHistory: false });
      }
    } catch {
      set({ isLoadingGCPHistory: false });
    }
  },

  loadGCPAssessmentById: async (id) => {
    if (!window.electronAPI?.gcp?.assessment?.getById) return;

    try {
      const response = await window.electronAPI.gcp.assessment.getById(id);
      if (response.success && response.data) {
        set({ gcpResult: response.data, error: null });
      } else {
        set({ error: response.error || 'Failed to load GCP assessment' });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load GCP assessment',
      });
    }
  },

  deleteGCPAssessment: async (id) => {
    if (!window.electronAPI?.gcp?.assessment?.delete) return;

    try {
      await window.electronAPI.gcp.assessment.delete(id);
      set((state) => ({
        gcpHistory: state.gcpHistory.filter((h) => h.id !== id),
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to delete GCP assessment',
      });
    }
  },

  reset: () => set({
    config: null,
    result: null,
    progress: null,
    gcpResult: null,
    gcpProgress: null,
    isRunning: false,
    error: null,
  }),

  setProgress: (progress) => set({ progress }),
  setGCPProgress: (progress) => set({ gcpProgress: progress }),

  clearError: () => set({ error: null }),
}));

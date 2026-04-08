// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { create } from 'zustand';
import type { ComplianceFrameworkMeta, ComplianceAssessmentResult, GCPComplianceSummary } from '../../shared/types';

interface ComplianceState {
  frameworks: ComplianceFrameworkMeta[];
  gcpFrameworks: ComplianceFrameworkMeta[];
  result: ComplianceAssessmentResult | null;
  gcpResult: ComplianceAssessmentResult | null;
  isLoading: boolean;
  error: string | null;
  gcpHistory: GCPComplianceSummary[];
  isLoadingGCPHistory: boolean;
  awsHistory: any[];
  isLoadingAWSHistory: boolean;

  loadFrameworks: () => Promise<void>;
  loadGCPFrameworks: () => Promise<void>;
  runAssessment: (profileName: string, region: string, frameworkId: string) => Promise<void>;
  runGCPAssessment: (projectId: string, frameworkId?: string) => Promise<void>;
  loadGCPHistory: (projectId: string) => Promise<void>;
  loadGCPComplianceById: (id: string) => Promise<void>;
  deleteGCPCompliance: (id: string) => Promise<void>;
  loadAWSHistory: (profileName?: string) => Promise<void>;
  loadAWSScanById: (id: string) => Promise<void>;
  deleteAWSScan: (id: string) => Promise<void>;
  clearError: () => void;
  clearResult: () => void;
}

export const useComplianceStore = create<ComplianceState>((set) => ({
  frameworks: [],
  gcpFrameworks: [],
  result: null,
  gcpResult: null,
  isLoading: false,
  error: null,
  gcpHistory: [],
  isLoadingGCPHistory: false,
  awsHistory: [],
  isLoadingAWSHistory: false,

  loadFrameworks: async () => {
    if (!window.electronAPI?.compliance) return;
    try {
      const response = await window.electronAPI.compliance.getFrameworks();
      if (response.success && response.data) {
        set({ frameworks: response.data });
      }
    } catch {
      // Silent fail for frameworks load
    }
  },

  loadGCPFrameworks: async () => {
    if (!window.electronAPI?.gcp?.compliance) return;
    try {
      const response = await window.electronAPI.gcp.compliance.getFrameworks();
      if (response.success && response.data) {
        set({ gcpFrameworks: response.data });
      }
    } catch {
      // Silent fail
    }
  },

  runAssessment: async (profileName, region, frameworkId) => {
    if (!window.electronAPI?.compliance) {
      set({ error: 'API not available' });
      return;
    }
    set({ isLoading: true, error: null, result: null });
    try {
      const response = await window.electronAPI.compliance.runAssessment(
        profileName,
        region,
        frameworkId
      );
      if (!response.success) {
        set({ error: response.error || 'Failed to run assessment', isLoading: false });
      }
      // Result will arrive via compliance:completed event
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to run assessment',
        isLoading: false,
      });
    }
  },

  runGCPAssessment: async (projectId, frameworkId) => {
    if (!window.electronAPI?.gcp?.compliance) {
      set({ error: 'GCP Compliance API not available' });
      return;
    }
    set({ isLoading: true, error: null, gcpResult: null });
    try {
      const response = await window.electronAPI.gcp.compliance.runAssessment(projectId, frameworkId);
      if (!response.success) {
        set({ error: response.error || 'Failed to start GCP compliance assessment', isLoading: false });
      }
      // Result will arrive via onCompleted event — don't set isLoading: false here
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to run GCP compliance assessment',
        isLoading: false,
      });
    }
  },

  loadGCPHistory: async (projectId) => {
    if (!window.electronAPI?.gcp?.compliance?.getAll) return;
    set({ isLoadingGCPHistory: true });
    try {
      const response = await window.electronAPI.gcp.compliance.getAll(projectId, 20);
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
    if (!window.electronAPI?.gcp?.compliance?.getById) return;
    try {
      const response = await window.electronAPI.gcp.compliance.getById(id);
      if (response.success && response.data) {
        set({ gcpResult: response.data, error: null });
      } else {
        set({ error: response.error || 'Failed to load compliance assessment' });
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to load compliance assessment' });
    }
  },

  deleteGCPCompliance: async (id) => {
    if (!window.electronAPI?.gcp?.compliance?.delete) return;
    try {
      await window.electronAPI.gcp.compliance.delete(id);
      set((state) => ({
        gcpHistory: state.gcpHistory.filter((h) => h.id !== id),
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to delete compliance assessment' });
    }
  },

  loadAWSHistory: async (profileName?) => {
    if (!window.electronAPI?.compliance?.getAll) return;
    set({ isLoadingAWSHistory: true });
    try {
      const response = await window.electronAPI.compliance.getAll(profileName, 20);
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
    if (!window.electronAPI?.compliance?.getById) return;
    try {
      const response = await window.electronAPI.compliance.getById(id);
      if (response.success && response.data) {
        set({ result: response.data, error: null });
      } else {
        set({ error: response.error || 'Failed to load compliance assessment' });
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to load compliance assessment' });
    }
  },

  deleteAWSScan: async (id) => {
    if (!window.electronAPI?.compliance?.delete) return;
    try {
      await window.electronAPI.compliance.delete(id);
      set((state) => ({
        awsHistory: state.awsHistory.filter((h: any) => h.id !== id),
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to delete compliance assessment' });
    }
  },

  clearError: () => set({ error: null }),
  clearResult: () => set({ result: null, gcpResult: null }),
}));

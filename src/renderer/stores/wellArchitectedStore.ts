// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { create } from 'zustand';
import { useProfileStore } from './profileStore';
import type {
  WAWorkloadSummary,
  WALensReview,
  WAImprovementItem,
  WAAnalysisResult,
  WABPScanMode,
  WABPScanResult,
  WABPScanProgress,
  GCPWAScanResult,
  GCPWAScanProgress,
  GCPWellArchitectedSummary,
} from '../../shared/types';

interface WellArchitectedState {
  workloads: WAWorkloadSummary[];
  selectedWorkload: WAWorkloadSummary | null;
  lensReview: WALensReview | null;
  improvements: WAImprovementItem[];
  selectedRegion: string;
  isLoading: boolean;
  isLoadingReview: boolean;
  isLoadingImprovements: boolean;
  error: string | null;

  // Best practices scan state
  scanMode: WABPScanMode;
  bpScanResult: WABPScanResult | null;
  bpScanProgress: WABPScanProgress | null;
  isScanning: boolean;

  // GCP Architecture Framework state
  gcpScanResult: GCPWAScanResult | null;
  gcpScanProgress: GCPWAScanProgress | null;

  // AWS history state
  awsHistory: any[];
  isLoadingAWSHistory: boolean;
  loadAWSHistory: (profileName?: string) => Promise<void>;
  loadAWSScanById: (id: string) => Promise<void>;
  deleteAWSScan: (id: string) => Promise<void>;

  // GCP history state
  gcpHistory: GCPWellArchitectedSummary[];
  isLoadingGCPHistory: boolean;
  loadGCPHistory: (projectId: string) => Promise<void>;
  loadGCPWellArchitectedById: (id: string) => Promise<void>;
  deleteGCPWellArchitected: (id: string) => Promise<void>;

  setSelectedRegion: (region: string) => void;
  setScanMode: (mode: WABPScanMode) => void;
  loadWorkloads: (profileName: string, region: string) => Promise<void>;
  selectWorkload: (workload: WAWorkloadSummary | null) => void;
  loadLensReview: (profileName: string, region: string, workloadId: string, lensAlias?: string) => Promise<void>;
  loadImprovements: (profileName: string, region: string, workloadId: string, lensAlias?: string) => Promise<void>;
  runBestPracticesScan: (profileName: string, region: string) => Promise<void>;
  runGCPArchitectureScan: (projectId: string) => Promise<void>;
  setBPScanProgress: (progress: WABPScanProgress | null) => void;
  setGCPScanProgress: (progress: GCPWAScanProgress | null) => void;
  refresh: () => Promise<void>;
  clearError: () => void;
  clearSelection: () => void;
}

export const useWellArchitectedStore = create<WellArchitectedState>((set, get) => ({
  workloads: [],
  selectedWorkload: null,
  lensReview: null,
  improvements: [],
  selectedRegion: 'us-west-2',
  isLoading: false,
  isLoadingReview: false,
  isLoadingImprovements: false,
  error: null,

  // Best practices scan state
  scanMode: 'workloads',
  bpScanResult: null,
  bpScanProgress: null,
  isScanning: false,

  // GCP Architecture Framework state
  gcpScanResult: null,
  gcpScanProgress: null,

  // AWS history state
  awsHistory: [],
  isLoadingAWSHistory: false,

  // GCP history state
  gcpHistory: [],
  isLoadingGCPHistory: false,

  setSelectedRegion: (region) => {
    set({ selectedRegion: region });
  },

  setScanMode: (mode) => {
    set({ scanMode: mode, error: null });
  },

  loadWorkloads: async (profileName, region) => {
    if (!window.electronAPI?.wellArchitected) {
      set({ error: 'Electron API not available', isLoading: false });
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const response = await window.electronAPI.wellArchitected.listWorkloads(profileName, region);

      if (response.success && response.data) {
        if (response.data.error) {
          set({
            workloads: response.data.workloads,
            error: response.data.error,
            isLoading: false,
          });
        } else {
          set({ workloads: response.data.workloads, isLoading: false });
        }
      } else {
        set({ error: response.error || 'Failed to load workloads', isLoading: false });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load workloads',
        isLoading: false,
      });
    }
  },

  selectWorkload: (workload) => {
    set({
      selectedWorkload: workload,
      lensReview: null,
      improvements: [],
    });
  },

  loadLensReview: async (profileName, region, workloadId, lensAlias = 'wellarchitected') => {
    if (!window.electronAPI?.wellArchitected) {
      set({ error: 'Electron API not available' });
      return;
    }

    set({ isLoadingReview: true });

    try {
      const response = await window.electronAPI.wellArchitected.getLensReview(
        profileName,
        region,
        workloadId,
        lensAlias
      );

      if (response.success) {
        set({ lensReview: response.data, isLoadingReview: false });
      } else {
        set({ error: response.error || 'Failed to load lens review', isLoadingReview: false });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load lens review',
        isLoadingReview: false,
      });
    }
  },

  loadImprovements: async (profileName, region, workloadId, lensAlias = 'wellarchitected') => {
    if (!window.electronAPI?.wellArchitected) {
      set({ error: 'Electron API not available' });
      return;
    }

    set({ isLoadingImprovements: true });

    try {
      const response = await window.electronAPI.wellArchitected.getImprovements(
        profileName,
        region,
        workloadId,
        lensAlias
      );

      if (response.success && response.data) {
        set({ improvements: response.data, isLoadingImprovements: false });
      } else {
        set({ error: response.error || 'Failed to load improvements', isLoadingImprovements: false });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load improvements',
        isLoadingImprovements: false,
      });
    }
  },

  runBestPracticesScan: async (profileName, region) => {
    if (!window.electronAPI?.wellArchitected) {
      set({ error: 'Electron API not available', isScanning: false });
      return;
    }

    set({ isScanning: true, error: null, bpScanResult: null, bpScanProgress: null });

    try {
      const response = await window.electronAPI.wellArchitected.runBestPracticesScan(profileName, region);

      if (!response.success) {
        set({
          error: response.error || 'Failed to run best practices scan',
          isScanning: false,
          bpScanProgress: null,
        });
      }
      // Result will arrive via wellarchitected:completed event
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to run best practices scan',
        isScanning: false,
        bpScanProgress: null,
      });
    }
  },

  runGCPArchitectureScan: async (projectId) => {
    if (!window.electronAPI?.gcp?.wellArchitected) {
      set({ error: 'GCP Well-Architected API not available', isScanning: false });
      return;
    }
    set({ isScanning: true, error: null, gcpScanResult: null, gcpScanProgress: null });
    try {
      const response = await window.electronAPI.gcp.wellArchitected.run(projectId);
      if (!response.success) {
        set({ error: response.error || 'Failed to start GCP architecture scan', isScanning: false, gcpScanProgress: null });
      }
      // Result will arrive via onCompleted event — don't set isScanning: false here
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to run GCP architecture scan',
        isScanning: false,
        gcpScanProgress: null,
      });
    }
  },

  loadAWSHistory: async (profileName?) => {
    if (!window.electronAPI?.wellArchitected?.getAll) return;
    set({ isLoadingAWSHistory: true });
    try {
      const response = await window.electronAPI.wellArchitected.getAll(profileName, 20);
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
    if (!window.electronAPI?.wellArchitected?.getById) return;
    try {
      const response = await window.electronAPI.wellArchitected.getById(id);
      if (response.success && response.data) {
        set({ bpScanResult: response.data, error: null });
      } else {
        set({ error: response.error || 'Failed to load well-architected scan' });
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to load well-architected scan' });
    }
  },

  deleteAWSScan: async (id) => {
    if (!window.electronAPI?.wellArchitected?.delete) return;
    try {
      await window.electronAPI.wellArchitected.delete(id);
      set((state) => ({
        awsHistory: state.awsHistory.filter((h: any) => h.id !== id),
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to delete well-architected scan' });
    }
  },

  loadGCPHistory: async (projectId) => {
    if (!window.electronAPI?.gcp?.wellArchitected?.getAll) return;
    set({ isLoadingGCPHistory: true });
    try {
      const response = await window.electronAPI.gcp.wellArchitected.getAll(projectId, 20);
      if (response.success && response.data) {
        set({ gcpHistory: response.data, isLoadingGCPHistory: false });
      } else {
        set({ isLoadingGCPHistory: false });
      }
    } catch {
      set({ isLoadingGCPHistory: false });
    }
  },

  loadGCPWellArchitectedById: async (id) => {
    if (!window.electronAPI?.gcp?.wellArchitected?.getById) return;
    try {
      const response = await window.electronAPI.gcp.wellArchitected.getById(id);
      if (response.success && response.data) {
        set({ gcpScanResult: response.data, error: null });
      } else {
        set({ error: response.error || 'Failed to load well-architected result' });
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to load well-architected result' });
    }
  },

  deleteGCPWellArchitected: async (id) => {
    if (!window.electronAPI?.gcp?.wellArchitected?.delete) return;
    try {
      await window.electronAPI.gcp.wellArchitected.delete(id);
      set((state) => ({
        gcpHistory: state.gcpHistory.filter((h) => h.id !== id),
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to delete result' });
    }
  },

  setBPScanProgress: (progress) => {
    set({ bpScanProgress: progress });
  },

  setGCPScanProgress: (progress) => {
    set({ gcpScanProgress: progress });
  },

  refresh: async () => {
    const profileName = useProfileStore.getState().selectedProfileName;
    const { selectedRegion, selectedWorkload, scanMode, loadWorkloads, loadLensReview, loadImprovements, runBestPracticesScan } = get();
    if (profileName) {
      if (scanMode === 'best_practices') {
        await runBestPracticesScan(profileName, selectedRegion);
      } else {
        await loadWorkloads(profileName, selectedRegion);
        if (selectedWorkload) {
          await loadLensReview(profileName, selectedRegion, selectedWorkload.workloadId);
          await loadImprovements(profileName, selectedRegion, selectedWorkload.workloadId);
        }
      }
    }
  },

  clearError: () => set({ error: null }),

  clearSelection: () => set({
    selectedWorkload: null,
    lensReview: null,
    improvements: [],
  }),
}));

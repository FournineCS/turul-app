// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { create } from 'zustand';
import { useProfileStore } from './profileStore';
import type {
  SecurityAnalysisResult,
  SecurityFinding,
  SecurityFilters,
  SecurityScanMode,
  CloudProvider,
  GCPSecurityScanSummary,
} from '../../shared/types';

interface SecurityState {
  analysis: SecurityAnalysisResult | null;
  selectedFinding: SecurityFinding | null;
  selectedRegion: string;
  filters: SecurityFilters;
  scanMode: SecurityScanMode;
  isLoading: boolean;
  isScanning: boolean;
  error: string | null;
  gcpHistory: GCPSecurityScanSummary[];
  isLoadingGCPHistory: boolean;
  awsHistory: any[];
  isLoadingAWSHistory: boolean;

  setSelectedRegion: (region: string) => void;
  setFilters: (filters: Partial<SecurityFilters>) => void;
  setSelectedFinding: (finding: SecurityFinding | null) => void;
  setScanMode: (mode: SecurityScanMode) => void;
  loadSecurityPosture: (profileName: string, region?: string) => Promise<void>;
  loadFindingDetails: (profileName: string, findingId: string, region?: string) => Promise<void>;
  runBestPracticesScan: (profileName: string, region?: string) => Promise<void>;
  loadGCPSecurityPosture: (projectId: string, options?: { orgId?: string }) => Promise<void>;
  runGCPBestPractices: (projectId: string) => Promise<void>;
  loadGCPHistory: (projectId: string) => Promise<void>;
  loadGCPScanById: (id: string) => Promise<void>;
  deleteGCPScan: (id: string) => Promise<void>;
  loadAWSHistory: (profileName?: string) => Promise<void>;
  loadAWSScanById: (id: string) => Promise<void>;
  deleteAWSScan: (id: string) => Promise<void>;
  /** Unified dispatch: loads posture for the given provider + identity. */
  loadPosture: (provider: CloudProvider, identity: string, region?: string) => Promise<void>;
  /** Unified dispatch: runs best-practices scan for the given provider + identity. */
  runProviderBestPractices: (provider: CloudProvider, identity: string, region?: string) => Promise<void>;
  clearAnalysis: () => void;
  refresh: () => Promise<void>;
  clearError: () => void;
}

const defaultFilters: SecurityFilters = {
  severities: [],
  sources: [],
  searchQuery: '',
  includeArchived: false,
};

export const useSecurityStore = create<SecurityState>((set, get) => ({
  analysis: null,
  selectedFinding: null,
  selectedRegion: 'us-east-1',
  filters: defaultFilters,
  scanMode: 'security_hub',
  isLoading: false,
  isScanning: false,
  error: null,
  gcpHistory: [],
  isLoadingGCPHistory: false,
  awsHistory: [],
  isLoadingAWSHistory: false,

  setSelectedRegion: (region) => {
    set({ selectedRegion: region });
  },

  setFilters: (newFilters) => {
    set((state) => ({
      filters: { ...state.filters, ...newFilters },
    }));
  },

  setSelectedFinding: (finding) => {
    set({ selectedFinding: finding });
  },

  setScanMode: (mode) => {
    set({ scanMode: mode, analysis: null, error: null });
  },

  loadSecurityPosture: async (profileName, region) => {
    if (!window.electronAPI?.security) {
      set({ error: 'Electron API not available', isLoading: false });
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const { filters, selectedRegion } = get();
      const targetRegion = region || selectedRegion;

      const response = await window.electronAPI.security.getPosture(
        profileName,
        targetRegion,
        filters.includeArchived
      );

      if (response.success && response.data) {
        // Check if the result contains an error message from Security Hub
        if (response.data.error) {
          set({
            analysis: response.data,
            error: response.data.error,
            isLoading: false,
          });
        } else {
          set({ analysis: response.data, isLoading: false });
        }
      } else {
        set({ error: response.error || 'Failed to load security posture', isLoading: false });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load security posture',
        isLoading: false,
      });
    }
  },

  loadFindingDetails: async (profileName, findingId, region) => {
    if (!window.electronAPI?.security) {
      set({ error: 'Electron API not available' });
      return;
    }

    try {
      const { selectedRegion } = get();
      const targetRegion = region || selectedRegion;

      const response = await window.electronAPI.security.getFindingDetails(
        profileName,
        findingId,
        targetRegion
      );

      if (response.success && response.data) {
        set({ selectedFinding: response.data });
      } else {
        set({ error: response.error || 'Failed to load finding details' });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load finding details',
      });
    }
  },

  runBestPracticesScan: async (profileName, region) => {
    if (!window.electronAPI?.security) {
      set({ error: 'Electron API not available', isScanning: false });
      return;
    }

    set({ isScanning: true, error: null, analysis: null });

    try {
      const { selectedRegion } = get();
      const targetRegion = region || selectedRegion;

      const response = await window.electronAPI.security.runBestPracticesScan(
        profileName,
        targetRegion
      );

      if (!response.success) {
        set({ error: response.error || 'Failed to run best practices scan', isScanning: false });
      }
      // Result will arrive via security:completed event
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to run best practices scan',
        isScanning: false,
      });
    }
  },

  loadGCPSecurityPosture: async (projectId, options) => {
    if (!window.electronAPI?.gcp?.security?.getPosture) {
      set({ error: 'GCP security API not available', isLoading: false });
      return;
    }

    set({ isLoading: true, error: null });

    try {
      const response = await window.electronAPI.gcp.security.getPosture(projectId, options);
      if (!response.success) {
        set({ error: response.error || 'Failed to start GCP security posture load', isLoading: false });
      }
      // Result will arrive via onCompleted event
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load GCP security posture',
        isLoading: false,
      });
    }
  },

  runGCPBestPractices: async (projectId) => {
    if (!window.electronAPI?.gcp?.security?.runBestPractices) {
      set({ error: 'GCP security API not available', isScanning: false });
      return;
    }

    set({ isScanning: true, error: null, analysis: null });

    try {
      const response = await window.electronAPI.gcp.security.runBestPractices(projectId);
      if (!response.success) {
        set({ error: response.error || 'Failed to start GCP best practices scan', isScanning: false });
      }
      // Result will arrive via onCompleted event
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to run GCP best practices scan',
        isScanning: false,
      });
    }
  },

  loadGCPHistory: async (projectId) => {
    if (!window.electronAPI?.gcp?.security?.getAll) return;
    set({ isLoadingGCPHistory: true });
    try {
      const response = await window.electronAPI.gcp.security.getAll(projectId, 20);
      if (response.success && response.data) {
        set({ gcpHistory: response.data, isLoadingGCPHistory: false });
      } else {
        set({ isLoadingGCPHistory: false });
      }
    } catch {
      set({ isLoadingGCPHistory: false });
    }
  },

  loadGCPScanById: async (id) => {
    if (!window.electronAPI?.gcp?.security?.getById) return;
    try {
      const response = await window.electronAPI.gcp.security.getById(id);
      if (response.success && response.data) {
        set({ analysis: response.data, error: response.data.error || null });
      } else {
        set({ error: response.error || 'Failed to load security scan' });
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to load security scan' });
    }
  },

  deleteGCPScan: async (id) => {
    if (!window.electronAPI?.gcp?.security?.delete) return;
    try {
      await window.electronAPI.gcp.security.delete(id);
      set((state) => ({
        gcpHistory: state.gcpHistory.filter((h) => h.id !== id),
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to delete security scan' });
    }
  },

  loadAWSHistory: async (profileName?) => {
    if (!window.electronAPI?.security?.getAll) return;
    set({ isLoadingAWSHistory: true });
    try {
      const response = await window.electronAPI.security.getAll(profileName, 20);
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
    if (!window.electronAPI?.security?.getById) return;
    try {
      const response = await window.electronAPI.security.getById(id);
      if (response.success && response.data) {
        set({ analysis: response.data, error: response.data.error || null });
      } else {
        set({ error: response.error || 'Failed to load security scan' });
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to load security scan' });
    }
  },

  deleteAWSScan: async (id) => {
    if (!window.electronAPI?.security?.delete) return;
    try {
      await window.electronAPI.security.delete(id);
      set((state) => ({
        awsHistory: state.awsHistory.filter((h: any) => h.id !== id),
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to delete security scan' });
    }
  },

  loadPosture: async (provider, identity, region) => {
    if (provider === 'gcp') {
      await get().loadGCPSecurityPosture(identity);
    } else {
      await get().loadSecurityPosture(identity, region);
    }
  },

  runProviderBestPractices: async (provider, identity, region) => {
    if (provider === 'gcp') {
      await get().runGCPBestPractices(identity);
    } else {
      await get().runBestPracticesScan(identity, region);
    }
  },

  clearAnalysis: () => set({ analysis: null }),

  refresh: async () => {
    const profileName = useProfileStore.getState().selectedProfileName;
    const { selectedRegion, scanMode, loadSecurityPosture, runBestPracticesScan } = get();
    if (profileName) {
      if (scanMode === 'best_practices') {
        await runBestPracticesScan(profileName, selectedRegion);
      } else {
        await loadSecurityPosture(profileName, selectedRegion);
      }
    }
  },

  clearError: () => set({ error: null }),
}));

// Selector for filtered findings
export function getFilteredFindings(state: SecurityState): SecurityFinding[] {
  if (!state.analysis?.findings) {
    return [];
  }

  const { severities, sources, searchQuery } = state.filters;

  return state.analysis.findings.filter((finding) => {
    // Filter by severity
    if (severities.length > 0 && !severities.includes(finding.severity)) {
      return false;
    }

    // Filter by source
    if (sources.length > 0 && !sources.includes(finding.source)) {
      return false;
    }

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesTitle = finding.title.toLowerCase().includes(query);
      const matchesDescription = finding.description.toLowerCase().includes(query);
      const matchesResource = finding.resourceId?.toLowerCase().includes(query);
      const matchesResourceType = finding.resourceType?.toLowerCase().includes(query);

      if (!matchesTitle && !matchesDescription && !matchesResource && !matchesResourceType) {
        return false;
      }
    }

    return true;
  });
}

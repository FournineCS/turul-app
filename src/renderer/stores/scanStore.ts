// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { create } from 'zustand';
import type { Scan, ScanConfig, ScanProgress, Resource, TopologyGraph, DiagramGraph, DiagramViewMode, CloudProvider, GCPScanConfig } from '../../shared/types';

interface ScanState {
  scans: Scan[];
  currentScan: Scan | null;
  scanProgress: ScanProgress | null;
  resources: Resource[];
  topologyGraph: TopologyGraph | null;
  diagramGraph: DiagramGraph | null;
  diagramViewMode: DiagramViewMode;
  isScanning: boolean;
  isLoading: boolean;
  error: string | null;

  loadScans: (cloudProvider?: CloudProvider) => Promise<void>;
  loadScan: (scanId: string) => Promise<void>;
  startScan: (config: ScanConfig) => Promise<string | null>;
  startGCPScan: (config: GCPScanConfig) => Promise<string | null>;
  /** Unified dispatch: starts a scan for the given provider. */
  startProviderScan: (provider: CloudProvider, config: ScanConfig | GCPScanConfig) => Promise<string | null>;
  stopScan: (scanId: string) => Promise<void>;
  deleteScan: (scanId: string) => Promise<void>;
  loadResources: (scanId: string) => Promise<void>;
  searchResources: (scanId: string, query: string) => Promise<void>;
  loadTopology: (scanId: string) => Promise<void>;
  loadDiagram: (scanId: string, viewMode: DiagramViewMode) => Promise<void>;
  setDiagramViewMode: (mode: DiagramViewMode) => void;
  updateProgress: (progress: ScanProgress) => void;
  clearError: () => void;
}

// Track concurrent loading operations so isLoading stays true
// until ALL in-flight requests complete
let loadingCount = 0;

function startLoading(set: (partial: Partial<ScanState>) => void) {
  loadingCount++;
  set({ isLoading: true, error: null });
}

function endLoading(set: (partial: Partial<ScanState>) => void, extra?: Partial<ScanState>) {
  loadingCount = Math.max(0, loadingCount - 1);
  set({ ...extra, isLoading: loadingCount > 0 });
}

export const useScanStore = create<ScanState>((set, get) => ({
  scans: [],
  currentScan: null,
  scanProgress: null,
  resources: [],
  topologyGraph: null,
  diagramGraph: null,
  diagramViewMode: 'network',
  isScanning: false,
  isLoading: false,
  error: null,

  loadScans: async (cloudProvider?) => {
    if (!window.electronAPI) {
      set({ error: 'Electron API not available', isLoading: false });
      return;
    }
    startLoading(set);

    try {
      const response = await window.electronAPI.scan.getAll(cloudProvider);

      if (response.success && response.data) {
        endLoading(set, { scans: response.data as Scan[] });
      } else {
        endLoading(set, { error: response.error || 'Failed to load scans' });
      }
    } catch (error) {
      endLoading(set, {
        error: error instanceof Error ? error.message : 'Failed to load scans',
      });
    }
  },

  loadScan: async (scanId) => {
    startLoading(set);

    try {
      const response = await window.electronAPI.scan.getById(scanId);

      if (response.success && response.data) {
        endLoading(set, { currentScan: response.data as Scan });
      } else {
        endLoading(set, { error: response.error || 'Failed to load scan' });
      }
    } catch (error) {
      endLoading(set, {
        error: error instanceof Error ? error.message : 'Failed to load scan',
      });
    }
  },

  startScan: async (config) => {
    set({ isScanning: true, error: null, scanProgress: null });

    try {
      const response = await window.electronAPI.scan.start(config);

      if (response.success && response.data) {
        // Reload scans list
        await get().loadScans();
        return response.data.scanId;
      } else {
        set({ error: response.error || 'Failed to start scan', isScanning: false });
        return null;
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to start scan',
        isScanning: false,
      });
      return null;
    }
  },

  startProviderScan: async (provider, config) => {
    if (provider === 'gcp') {
      return get().startGCPScan(config as GCPScanConfig);
    }
    return get().startScan(config as ScanConfig);
  },

  startGCPScan: async (config) => {
    if (!window.electronAPI?.gcp?.scan) {
      set({ error: 'GCP scan API not available', isScanning: false });
      return null;
    }

    set({ isScanning: true, error: null, scanProgress: null });

    try {
      const response = await window.electronAPI.gcp.scan.start(config);

      if (response.success && response.data) {
        return response.data.scanId;
      } else {
        set({ error: response.error || 'Failed to start GCP scan', isScanning: false });
        return null;
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to start GCP scan',
        isScanning: false,
      });
      return null;
    }
  },

  stopScan: async (scanId) => {
    try {
      await window.electronAPI.scan.stop(scanId);
      set({ isScanning: false, scanProgress: null });
      await get().loadScans();
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to stop scan',
      });
    }
  },

  deleteScan: async (scanId) => {
    try {
      const response = await window.electronAPI.db.deleteScan(scanId);

      if (response.success) {
        const { scans, currentScan } = get();
        set({
          scans: scans.filter((s) => s.id !== scanId),
          currentScan: currentScan?.id === scanId ? null : currentScan,
        });
      } else {
        set({ error: response.error || 'Failed to delete scan' });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to delete scan',
      });
    }
  },

  loadResources: async (scanId) => {
    startLoading(set);

    try {
      const response = await window.electronAPI.resources.getByScan(scanId);

      if (response.success && response.data) {
        endLoading(set, { resources: response.data as Resource[] });
      } else {
        endLoading(set, { error: response.error || 'Failed to load resources' });
      }
    } catch (error) {
      endLoading(set, {
        error: error instanceof Error ? error.message : 'Failed to load resources',
      });
    }
  },

  searchResources: async (scanId, query) => {
    startLoading(set);

    try {
      const response = await window.electronAPI.resources.search(scanId, query);

      if (response.success && response.data) {
        endLoading(set, { resources: response.data as Resource[] });
      } else {
        endLoading(set, { error: response.error || 'Failed to search resources' });
      }
    } catch (error) {
      endLoading(set, {
        error: error instanceof Error ? error.message : 'Failed to search resources',
      });
    }
  },

  loadTopology: async (scanId) => {
    startLoading(set);

    try {
      const response = await window.electronAPI.topology.getGraph(scanId);

      if (response.success && response.data) {
        endLoading(set, { topologyGraph: response.data as TopologyGraph });
      } else {
        endLoading(set, { error: response.error || 'Failed to load topology' });
      }
    } catch (error) {
      endLoading(set, {
        error: error instanceof Error ? error.message : 'Failed to load topology',
      });
    }
  },

  loadDiagram: async (scanId, viewMode) => {
    startLoading(set);

    try {
      const response = await window.electronAPI.topology.getDiagram(scanId, viewMode);

      if (response.success && response.data) {
        endLoading(set, { diagramGraph: response.data as DiagramGraph });
      } else {
        endLoading(set, { error: response.error || 'Failed to load diagram' });
      }
    } catch (error) {
      endLoading(set, {
        error: error instanceof Error ? error.message : 'Failed to load diagram',
      });
    }
  },

  setDiagramViewMode: (mode) => {
    set({ diagramViewMode: mode });
  },

  updateProgress: (progress) => {
    set({ scanProgress: progress });

    // Check if scan completed
    if (progress.currentRegion === 'done') {
      set({ isScanning: false });
      get().loadScans();
    }
  },

  clearError: () => set({ error: null }),
}));

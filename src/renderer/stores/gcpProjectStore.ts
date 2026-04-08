// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { create } from 'zustand';
import type { GCPProject, GCPOrganization } from '../../shared/types';

interface BillingConfig {
  bqProject: string;
  bqDataset: string;
  bqRegion: string;
}

interface GCPProjectState {
  projects: GCPProject[];
  selectedProjectId: string | null;
  organizations: GCPOrganization[];
  selectedOrgId: string | null;
  billingConfig: BillingConfig | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  error: string | null;

  loadProjects: () => Promise<void>;
  setSelectedProjectId: (projectId: string) => void;
  validateProject: (projectId: string) => Promise<GCPProject | null>;
  checkAuth: () => Promise<boolean>;
  login: () => Promise<boolean>;
  logout: () => Promise<void>;
  loadOrganizations: () => Promise<void>;
  setSelectedOrgId: (orgId: string | null) => void;
  loadBillingConfig: () => Promise<void>;
  saveBillingConfig: (bqProject: string, bqDataset: string, bqRegion?: string) => Promise<void>;
}

export const useGCPProjectStore = create<GCPProjectState>((set, get) => ({
  projects: [],
  selectedProjectId: null,
  organizations: [],
  selectedOrgId: null,
  billingConfig: null,
  isLoading: false,
  isAuthenticated: false,
  error: null,

  checkAuth: async () => {
    try {
      const result = await window.electronAPI.gcp.checkAuth();
      if (result.success && result.data?.authenticated) {
        set({ isAuthenticated: true, error: null });
        return true;
      }
      set({ isAuthenticated: false, error: result.data?.error || result.error || null });
      return false;
    } catch (error) {
      set({ isAuthenticated: false, error: String(error) });
      return false;
    }
  },

  login: async () => {
    try {
      set({ isLoading: true, error: null });
      const result = await window.electronAPI.gcp.login();
      if (result.success) {
        set({ isAuthenticated: true, isLoading: false });
        return true;
      }
      set({ isLoading: false, error: result.error || 'Login failed' });
      return false;
    } catch (error) {
      set({ isLoading: false, error: String(error) });
      return false;
    }
  },

  logout: async () => {
    try {
      set({ isLoading: true });
      await window.electronAPI.gcp.logout();
      set({
        isAuthenticated: false,
        projects: [],
        selectedProjectId: null,
        organizations: [],
        selectedOrgId: null,
        billingConfig: null,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      set({ isLoading: false, error: String(error) });
    }
  },

  loadProjects: async () => {
    set({ isLoading: true, error: null });
    try {
      const result = await window.electronAPI.gcp.listProjects();
      if (result.success && result.data) {
        set({ projects: result.data, isLoading: false, isAuthenticated: true });

        // Restore previously selected project
        const savedProject = await window.electronAPI.settings.get('gcpSelectedProjectId');
        if (savedProject.success && savedProject.data) {
          const found = result.data.find(p => p.projectId === savedProject.data);
          if (found) {
            set({ selectedProjectId: found.projectId });
          }
        }
      } else {
        set({ isLoading: false, error: result.error || 'Failed to load projects' });
      }
    } catch (error) {
      set({ isLoading: false, error: String(error) });
    }
  },

  setSelectedProjectId: (projectId: string) => {
    set({ selectedProjectId: projectId });
    window.electronAPI?.settings?.set('gcpSelectedProjectId', projectId).catch(() => {});
  },

  validateProject: async (projectId: string) => {
    try {
      const result = await window.electronAPI.gcp.validateProject(projectId);
      if (result.success && result.data) {
        return result.data;
      }
      return null;
    } catch {
      return null;
    }
  },

  loadOrganizations: async () => {
    try {
      const result = await window.electronAPI.gcp.listOrganizations();
      if (result.success && result.data) {
        set({ organizations: result.data });

        // Restore previously selected org — use setSelectedOrgId to trigger
        // billing config load and project retry if needed
        const savedOrg = await window.electronAPI.settings.get('gcpSelectedOrgId');
        if (savedOrg.success && savedOrg.data) {
          const found = result.data.find(o => o.organizationId === savedOrg.data);
          if (found) {
            get().setSelectedOrgId(found.organizationId);
          }
        }
      }
    } catch {
      // Org access is optional — silently ignore
    }
  },

  setSelectedOrgId: (orgId: string | null) => {
    set({ selectedOrgId: orgId });
    if (orgId) {
      window.electronAPI?.settings?.set('gcpSelectedOrgId', orgId).catch(() => {});
    }
    // Reload billing config with new org scope
    get().loadBillingConfig();
    // Retry loading projects if list is empty (initial load may have failed)
    if (get().projects.length === 0) {
      get().loadProjects();
    }
  },

  loadBillingConfig: async () => {
    try {
      const { selectedOrgId } = get();
      let bqProject = '';
      let bqDataset = 'billing_export';
      let bqRegion = '';

      // Try org-scoped keys first
      if (selectedOrgId) {
        const [projResult, dsResult, regionResult] = await Promise.all([
          window.electronAPI.settings.get(`gcpBillingBQProject_${selectedOrgId}`),
          window.electronAPI.settings.get(`gcpBillingBQDataset_${selectedOrgId}`),
          window.electronAPI.settings.get(`gcpBillingBQRegion_${selectedOrgId}`),
        ]);
        if (projResult.success && projResult.data) {
          bqProject = projResult.data;
          bqDataset = (dsResult.success && dsResult.data) ? dsResult.data : 'billing_export';
          bqRegion = (regionResult.success && regionResult.data) ? regionResult.data : '';
          set({ billingConfig: { bqProject, bqDataset, bqRegion } });
          return;
        }
      }

      // Fall back to global keys (backward compat)
      const [projResult, dsResult, regionResult] = await Promise.all([
        window.electronAPI.settings.get('gcpBillingBQProject'),
        window.electronAPI.settings.get('gcpBillingBQDataset'),
        window.electronAPI.settings.get('gcpBillingBQRegion'),
      ]);
      bqProject = (projResult.success && projResult.data) ? projResult.data : '';
      bqDataset = (dsResult.success && dsResult.data) ? dsResult.data : 'billing_export';
      bqRegion = (regionResult.success && regionResult.data) ? regionResult.data : '';
      set({ billingConfig: { bqProject, bqDataset, bqRegion } });
    } catch {
      set({ billingConfig: { bqProject: '', bqDataset: 'billing_export', bqRegion: '' } });
    }
  },

  saveBillingConfig: async (bqProject: string, bqDataset: string, bqRegion?: string) => {
    const { selectedOrgId } = get();
    const dataset = bqDataset || 'billing_export';
    const region = bqRegion || '';

    const keys = selectedOrgId
      ? [
          [`gcpBillingBQProject_${selectedOrgId}`, bqProject],
          [`gcpBillingBQDataset_${selectedOrgId}`, dataset],
          [`gcpBillingBQRegion_${selectedOrgId}`, region],
        ]
      : [
          ['gcpBillingBQProject', bqProject],
          ['gcpBillingBQDataset', dataset],
          ['gcpBillingBQRegion', region],
        ];

    // Save sequentially and check responses (parallel settings:set can race on SQLite)
    for (const [key, value] of keys) {
      const res = await window.electronAPI.settings.set(key, value);
      if (!res.success) {
        console.error(`Failed to save ${key}:`, res.error);
        throw new Error(res.error || `Failed to save ${key}`);
      }
    }
    set({ billingConfig: { bqProject, bqDataset: dataset, bqRegion: region } });
  },
}));

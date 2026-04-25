// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { create } from 'zustand';
import type { GCPProject, GCPOrganization } from '../../shared/types';

interface BillingConfig {
  bqProject: string;
  bqDataset: string;
  bqRegion: string;
}

// Detect Google auth errors that require interactive re-login.
// Examples: invalid_grant, invalid_rapt, "Reauthentication is needed",
// "Could not refresh access token", UNAUTHENTICATED, expired/revoked tokens.
function isReauthError(message: string): boolean {
  if (!message) return false;
  const m = message.toLowerCase();
  return (
    m.includes('invalid_grant') ||
    m.includes('invalid_rapt') ||
    m.includes('reauth') ||
    m.includes('could not refresh') ||
    m.includes('unauthenticated') ||
    m.includes('token has been expired') ||
    m.includes('token has been revoked') ||
    m.includes('credentials have been revoked') ||
    m.includes('login required')
  );
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
  needsReauth: boolean;

  loadProjects: () => Promise<void>;
  setSelectedProjectId: (projectId: string) => void;
  validateProject: (projectId: string) => Promise<GCPProject | null>;
  setAuthenticated: (value: boolean) => void;
  resetProjectState: () => void;
  clearForAccountSwitch: () => void;
  loadOrganizations: () => Promise<void>;
  setSelectedOrgId: (orgId: string | null) => void;
  loadBillingConfig: () => Promise<void>;
  saveBillingConfig: (bqProject: string, bqDataset: string, bqRegion?: string) => Promise<void>;
}

// Per-account settings keys so selections don't leak across accounts.
async function getActiveAccountId(): Promise<string | null> {
  try {
    const r = await window.electronAPI.settings.get('gcpSelectedAccountId');
    return r.success && r.data ? r.data : null;
  } catch {
    return null;
  }
}
const projectKey = (accountId: string | null) =>
  accountId ? `gcpSelectedProjectId_${accountId}` : 'gcpSelectedProjectId';
const orgKey = (accountId: string | null) =>
  accountId ? `gcpSelectedOrgId_${accountId}` : 'gcpSelectedOrgId';

export const useGCPProjectStore = create<GCPProjectState>((set, get) => ({
  projects: [],
  selectedProjectId: null,
  organizations: [],
  selectedOrgId: null,
  billingConfig: null,
  isLoading: false,
  isAuthenticated: false,
  error: null,
  needsReauth: false,

  setAuthenticated: (value: boolean) => {
    set({ isAuthenticated: value });
  },

  resetProjectState: () => {
    set({
      isAuthenticated: false,
      projects: [],
      selectedProjectId: null,
      organizations: [],
      selectedOrgId: null,
      billingConfig: null,
      isLoading: false,
      error: null,
      needsReauth: false,
    });
  },

  clearForAccountSwitch: () => {
    // Clear UI state immediately so the previous account's projects/org/selection
    // do not flash while the new account's data loads.
    set({
      projects: [],
      selectedProjectId: null,
      organizations: [],
      selectedOrgId: null,
      billingConfig: null,
      error: null,
      needsReauth: false,
    });
  },

  loadProjects: async () => {
    set({ isLoading: true, error: null, needsReauth: false });
    try {
      const result = await window.electronAPI.gcp.listProjects();
      if (result.success && result.data) {
        set({ projects: result.data, isLoading: false, isAuthenticated: true, needsReauth: false });

        // Restore previously selected project (per-account)
        const accountId = await getActiveAccountId();
        const savedProject = await window.electronAPI.settings.get(projectKey(accountId));
        if (savedProject.success && savedProject.data) {
          const found = result.data.find(p => p.projectId === savedProject.data);
          if (found) {
            set({ selectedProjectId: found.projectId });
          }
        }
      } else {
        const errMsg = result.error || 'Failed to load projects';
        set({ isLoading: false, error: errMsg, needsReauth: isReauthError(errMsg) });
      }
    } catch (error) {
      const errMsg = String(error);
      set({ isLoading: false, error: errMsg, needsReauth: isReauthError(errMsg) });
    }
  },

  setSelectedProjectId: (projectId: string) => {
    set({ selectedProjectId: projectId });
    getActiveAccountId().then((accountId) => {
      window.electronAPI?.settings?.set(projectKey(accountId), projectId).catch(() => {});
    });
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

        // Restore previously selected org (per-account) — use setSelectedOrgId
        // to trigger billing config load and project retry if needed
        const accountId = await getActiveAccountId();
        const savedOrg = await window.electronAPI.settings.get(orgKey(accountId));
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
      getActiveAccountId().then((accountId) => {
        window.electronAPI?.settings?.set(orgKey(accountId), orgId).catch(() => {});
      });
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

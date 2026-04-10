// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { create } from 'zustand';
import type { GCPAccountSummary } from '../../shared/types';

interface GCPAccountState {
  accounts: GCPAccountSummary[];
  selectedAccountId: string | null;
  isLoading: boolean;
  error: string | null;

  loadAccounts: () => Promise<void>;
  addAccount: (label: string) => Promise<boolean>;
  activateAccount: (accountId: string) => Promise<void>;
  renameAccount: (accountId: string, label: string) => Promise<void>;
  deleteAccount: (accountId: string) => Promise<void>;
  reloginAccount: (accountId: string) => Promise<void>;
  setSelectedAccountId: (accountId: string | null) => void;
}

export const useGCPAccountStore = create<GCPAccountState>((set, get) => ({
  accounts: [],
  selectedAccountId: null,
  isLoading: false,
  error: null,

  loadAccounts: async () => {
    try {
      const result = await window.electronAPI.gcpAccounts.list();
      if (result.success && result.data) {
        set({ accounts: result.data });

        // Restore previously selected account
        const saved = await window.electronAPI.settings.get('gcpSelectedAccountId');
        if (saved.success && saved.data) {
          const found = result.data.find(a => a.accountId === saved.data);
          if (found) {
            set({ selectedAccountId: found.accountId });
            // Activate credentials in main process
            window.electronAPI.gcpAccounts.activate(found.accountId).catch(() => {});
          }
        } else if (result.data.length > 0 && !get().selectedAccountId) {
          // Auto-select first account if none saved
          const first = result.data[0];
          set({ selectedAccountId: first.accountId });
          window.electronAPI.gcpAccounts.activate(first.accountId).catch(() => {});
          window.electronAPI.settings.set('gcpSelectedAccountId', first.accountId).catch(() => {});
        }
      }
    } catch {
      // Non-critical — accounts will load when user navigates to GCP
    }
  },

  addAccount: async (label: string) => {
    try {
      set({ isLoading: true, error: null });
      const result = await window.electronAPI.gcpAccounts.add(label);
      if (result.success && result.data?.accountId) {
        // Reload accounts list and select the new one
        await get().loadAccounts();
        const newId = result.data.accountId;
        set({ selectedAccountId: newId, isLoading: false });
        window.electronAPI.settings.set('gcpSelectedAccountId', newId).catch(() => {});
        return true;
      }
      set({ isLoading: false, error: result.error || 'Login failed' });
      return false;
    } catch (error) {
      set({ isLoading: false, error: String(error) });
      return false;
    }
  },

  activateAccount: async (accountId: string) => {
    try {
      await window.electronAPI.gcpAccounts.activate(accountId);
      set({ selectedAccountId: accountId });
      window.electronAPI.settings.set('gcpSelectedAccountId', accountId).catch(() => {});
    } catch (error) {
      set({ error: String(error) });
    }
  },

  renameAccount: async (accountId: string, label: string) => {
    try {
      const result = await window.electronAPI.gcpAccounts.rename(accountId, label);
      if (result.success) {
        await get().loadAccounts();
      }
    } catch (error) {
      set({ error: String(error) });
    }
  },

  deleteAccount: async (accountId: string) => {
    try {
      const result = await window.electronAPI.gcpAccounts.delete(accountId);
      if (result.success) {
        // If deleted the active account, clear selection
        if (get().selectedAccountId === accountId) {
          set({ selectedAccountId: null });
          window.electronAPI.settings.set('gcpSelectedAccountId', '').catch(() => {});
        }
        await get().loadAccounts();
      }
    } catch (error) {
      set({ error: String(error) });
    }
  },

  reloginAccount: async (accountId: string) => {
    try {
      set({ isLoading: true, error: null });
      const result = await window.electronAPI.gcpAccounts.relogin(accountId);
      if (result.success) {
        await get().loadAccounts();
        set({ isLoading: false });
      } else {
        set({ isLoading: false, error: result.error || 'Re-authentication failed' });
      }
    } catch (error) {
      set({ isLoading: false, error: String(error) });
    }
  },

  setSelectedAccountId: (accountId: string | null) => {
    set({ selectedAccountId: accountId });
    if (accountId) {
      window.electronAPI.settings.set('gcpSelectedAccountId', accountId).catch(() => {});
    }
  },
}));

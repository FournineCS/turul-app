// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { create } from 'zustand';
import type { AWSProfile } from '../../shared/types';
import { useSettingsStore } from './settingsStore';

interface ProfileState {
  profiles: AWSProfile[];
  selectedProfile: AWSProfile | null;
  selectedProfileName: string | null;
  validatedAccountId: string | null;
  isLoading: boolean;
  error: string | null;

  loadProfiles: () => Promise<void>;
  selectProfile: (profile: AWSProfile | null) => void;
  setSelectedProfileName: (name: string | null) => void;
  validateProfile: (profileName: string) => Promise<boolean>;
  clearError: () => void;
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  profiles: [],
  selectedProfile: null,
  selectedProfileName: null,
  validatedAccountId: null,
  isLoading: false,
  error: null,

  loadProfiles: async () => {
    if (!window.electronAPI) {
      set({ error: 'Electron API not available', isLoading: false });
      return;
    }
    set({ isLoading: true, error: null });

    try {
      const response = await window.electronAPI.aws.getProfiles();

      if (response.success && response.data) {
        set({ profiles: response.data as AWSProfile[], isLoading: false });
      } else {
        set({ error: response.error || 'Failed to load profiles', isLoading: false });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load profiles',
        isLoading: false,
      });
    }
  },

  selectProfile: (profile) => {
    set({ selectedProfile: profile, validatedAccountId: null });
  },

  setSelectedProfileName: (name) => {
    set({ selectedProfileName: name });
    // Also update the selectedProfile object for ScanPage compatibility
    if (name) {
      const profile = get().profiles.find((p) => p.name === name) || null;
      if (profile) {
        set({ selectedProfile: profile, validatedAccountId: null });
      }
    } else {
      set({ selectedProfile: null, validatedAccountId: null });
    }
    // Persist to settings
    useSettingsStore.getState().updateSetting('defaultProfile', name || '');
  },

  validateProfile: async (profileName) => {
    if (!window.electronAPI) {
      set({ error: 'Electron API not available', isLoading: false });
      return false;
    }
    set({ isLoading: true, error: null });

    try {
      const response = await window.electronAPI.aws.validateProfile(profileName);

      if (response.success && response.data) {
        set({ validatedAccountId: response.data.accountId, isLoading: false });
        return true;
      } else {
        set({ error: response.error || 'Failed to validate profile', isLoading: false });
        return false;
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to validate profile',
        isLoading: false,
      });
      return false;
    }
  },

  clearError: () => set({ error: null }),
}));

// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { create } from 'zustand';
import type { EnvironmentHealth } from '../../shared/types';

interface HealthState {
  health: EnvironmentHealth | null;
  isLoading: boolean;
  loadHealth: () => Promise<void>;
  recheckHealth: () => Promise<void>;
}

export const useHealthStore = create<HealthState>((set) => ({
  health: null,
  isLoading: false,

  loadHealth: async () => {
    if (!window.electronAPI?.health?.check) return;
    set({ isLoading: true });
    try {
      const res = await window.electronAPI.health.check();
      if (res.success && res.data) {
        set({ health: res.data });
      }
    } finally {
      set({ isLoading: false });
    }
  },

  recheckHealth: async () => {
    if (!window.electronAPI?.health?.recheck) return;
    set({ isLoading: true });
    try {
      const res = await window.electronAPI.health.recheck();
      if (res.success && res.data) {
        set({ health: res.data });
      }
    } finally {
      set({ isLoading: false });
    }
  },
}));

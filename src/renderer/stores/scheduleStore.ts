// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { create } from 'zustand';
import type { ScanSchedule, ScanScheduleConfig } from '../../shared/types';

interface ScheduleState {
  schedules: ScanSchedule[];
  isLoading: boolean;
  error: string | null;

  loadSchedules: () => Promise<void>;
  createSchedule: (config: ScanScheduleConfig) => Promise<boolean>;
  toggleSchedule: (id: string, enabled: boolean) => Promise<void>;
  deleteSchedule: (id: string) => Promise<void>;
  clearError: () => void;
}

export const useScheduleStore = create<ScheduleState>((set, get) => ({
  schedules: [],
  isLoading: false,
  error: null,

  loadSchedules: async () => {
    if (!window.electronAPI?.schedule) return;
    set({ isLoading: true, error: null });
    try {
      const response = await window.electronAPI.schedule.getAll();
      if (response.success && response.data) {
        set({ schedules: response.data, isLoading: false });
      } else {
        set({ error: response.error || 'Failed to load schedules', isLoading: false });
      }
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to load', isLoading: false });
    }
  },

  createSchedule: async (config) => {
    if (!window.electronAPI?.schedule) {
      set({ error: 'API not available' });
      return false;
    }
    try {
      const response = await window.electronAPI.schedule.create(config);
      if (response.success) {
        get().loadSchedules();
        return true;
      }
      set({ error: response.error || 'Failed to create schedule' });
      return false;
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to create' });
      return false;
    }
  },

  toggleSchedule: async (id, enabled) => {
    if (!window.electronAPI?.schedule) return;
    try {
      await window.electronAPI.schedule.toggle(id, enabled);
      set((state) => ({
        schedules: state.schedules.map((s) =>
          s.id === id ? { ...s, enabled } : s
        ),
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to toggle' });
    }
  },

  deleteSchedule: async (id) => {
    if (!window.electronAPI?.schedule) return;
    try {
      await window.electronAPI.schedule.delete(id);
      set((state) => ({
        schedules: state.schedules.filter((s) => s.id !== id),
      }));
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to delete' });
    }
  },

  clearError: () => set({ error: null }),
}));

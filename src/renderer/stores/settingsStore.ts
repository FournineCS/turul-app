// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { create } from 'zustand';

export type AppTheme = 'dark' | 'light' | 'system';

export interface AppSettings {
  theme: AppTheme;
  defaultProfile: string;
  defaultRegions: string[];
  defaultServices: string[];
  dataRetentionDays: number;
  gcloudPath: string;
  gcpSccProjectId: string;
  gcpSccOrgId: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  theme: 'dark',
  defaultProfile: '',
  defaultRegions: ['us-east-1'],
  defaultServices: ['ec2'],
  dataRetentionDays: 90,
  gcloudPath: '',
  gcpSccProjectId: '',
  gcpSccOrgId: '',
};

interface SettingsState {
  settings: AppSettings;
  isLoading: boolean;
  isSaving: boolean;
  resolvedTheme: 'dark' | 'light';

  loadSettings: () => Promise<void>;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<void>;
  saveAll: (settings: AppSettings) => Promise<void>;
  cycleTheme: () => void;
}

let systemThemeCleanup: (() => void) | null = null;

function getSystemTheme(): 'dark' | 'light' {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme: AppTheme) {
  // Clean up previous system listener
  if (systemThemeCleanup) {
    systemThemeCleanup();
    systemThemeCleanup = null;
  }

  if (theme === 'system') {
    const resolved = getSystemTheme();
    document.documentElement.setAttribute('data-theme', resolved);
    useSettingsStore.setState({ resolvedTheme: resolved });

    // Listen for OS theme changes
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => {
      const newTheme = e.matches ? 'dark' : 'light';
      document.documentElement.setAttribute('data-theme', newTheme);
      useSettingsStore.setState({ resolvedTheme: newTheme });
    };
    mq.addEventListener('change', handler);
    systemThemeCleanup = () => mq.removeEventListener('change', handler);
  } else {
    document.documentElement.setAttribute('data-theme', theme);
    useSettingsStore.setState({ resolvedTheme: theme });
  }
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: { ...DEFAULT_SETTINGS },
  isLoading: false,
  isSaving: false,
  resolvedTheme: 'dark',

  cycleTheme: () => {
    const order: AppTheme[] = ['dark', 'light', 'system'];
    const current = get().settings.theme;
    const next = order[(order.indexOf(current) + 1) % order.length];
    get().updateSetting('theme', next);
  },

  loadSettings: async () => {
    if (!window.electronAPI?.settings?.getAllApp) return;
    set({ isLoading: true });
    try {
      const response = await window.electronAPI.settings.getAllApp();
      if (response.success && response.data) {
        const d = response.data;
        const s: AppSettings = {
          theme: (['dark', 'light', 'system'].includes(d['app.theme']) ? d['app.theme'] as AppTheme : 'dark'),
          defaultProfile: d['app.defaultProfile'] || '',
          defaultRegions: d['app.defaultRegions'] ? JSON.parse(d['app.defaultRegions']) : ['us-east-1'],
          defaultServices: d['app.defaultServices'] ? JSON.parse(d['app.defaultServices']) : ['ec2'],
          dataRetentionDays: d['app.dataRetentionDays'] ? parseInt(d['app.dataRetentionDays'], 10) : 90,
          gcloudPath: d['app.gcloudPath'] || '',
          gcpSccProjectId: d['app.gcpSccProjectId'] || '',
          gcpSccOrgId: d['app.gcpSccOrgId'] || '',
        };
        applyTheme(s.theme);
        set({ settings: s, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },

  updateSetting: async (key, value) => {
    const current = get().settings;
    const next = { ...current, [key]: value };
    set({ settings: next });

    if (key === 'theme') {
      applyTheme(value as AppTheme);
    }

    if (!window.electronAPI?.settings?.set) return;
    const dbKey = `app.${key}`;
    const dbVal = typeof value === 'string' ? value : JSON.stringify(value);
    const res = await window.electronAPI.settings.set(dbKey, dbVal);
    if (!res.success) {
      console.error(`Failed to save setting ${dbKey}:`, res.error);
    }
  },

  saveAll: async (settings) => {
    if (!window.electronAPI?.settings?.set) return;
    set({ isSaving: true, settings });
    applyTheme(settings.theme);
    try {
      const pairs: [string, string][] = [
        ['app.theme', settings.theme],
        ['app.defaultProfile', settings.defaultProfile],
        ['app.defaultRegions', JSON.stringify(settings.defaultRegions)],
        ['app.defaultServices', JSON.stringify(settings.defaultServices)],
        ['app.dataRetentionDays', String(settings.dataRetentionDays)],
        ['app.gcloudPath', settings.gcloudPath],
        ['app.gcpSccProjectId', settings.gcpSccProjectId],
        ['app.gcpSccOrgId', settings.gcpSccOrgId],
      ];
      for (const [k, v] of pairs) {
        const res = await window.electronAPI.settings.set(k, v);
        if (!res.success) {
          console.error(`Failed to save setting ${k}:`, res.error);
        }
      }
    } finally {
      set({ isSaving: false });
    }
  },
}));

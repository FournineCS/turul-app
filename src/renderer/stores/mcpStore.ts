// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { create } from 'zustand';
import type { McpServerConfig, McpServerStatus, McpToolInfo } from '../../shared/types';

interface McpState {
  servers: McpServerStatus[];
  tools: McpToolInfo[];
  isLoading: boolean;
  error: string | null;

  loadServers: () => Promise<void>;
  loadTools: () => Promise<void>;
  addServer: (config: Omit<McpServerConfig, 'id'>) => Promise<McpServerStatus | null>;
  updateServer: (id: string, updates: Partial<McpServerConfig>) => Promise<void>;
  removeServer: (id: string) => Promise<void>;
  connectServer: (id: string) => Promise<void>;
  disconnectServer: (id: string) => Promise<void>;
  reconnectServer: (id: string) => Promise<void>;
}

export const useMcpStore = create<McpState>((set, get) => ({
  servers: [],
  tools: [],
  isLoading: false,
  error: null,

  loadServers: async () => {
    set({ isLoading: true, error: null });
    try {
      const res = await window.electronAPI.mcp.getServers();
      if (res.success && res.data) {
        set({ servers: res.data });
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load servers' });
    } finally {
      set({ isLoading: false });
    }
  },

  loadTools: async () => {
    try {
      const res = await window.electronAPI.mcp.getTools();
      if (res.success && res.data) {
        set({ tools: res.data });
      }
    } catch {
      // Silently fail — tools list is informational
    }
  },

  addServer: async (config) => {
    set({ error: null });
    try {
      const res = await window.electronAPI.mcp.addServer(config);
      if (res.success && res.data) {
        await get().loadServers();
        await get().loadTools();
        return res.data;
      }
      set({ error: res.error || 'Failed to add server' });
      return null;
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to add server' });
      return null;
    }
  },

  updateServer: async (id, updates) => {
    set({ error: null });
    try {
      const res = await window.electronAPI.mcp.updateServer(id, updates);
      if (!res.success) {
        set({ error: res.error || 'Failed to update server' });
      }
      await get().loadServers();
      await get().loadTools();
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to update server' });
    }
  },

  removeServer: async (id) => {
    set({ error: null });
    try {
      await window.electronAPI.mcp.removeServer(id);
      await get().loadServers();
      await get().loadTools();
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to remove server' });
    }
  },

  connectServer: async (id) => {
    set({ error: null });
    try {
      const res = await window.electronAPI.mcp.connectServer(id);
      if (!res.success) {
        set({ error: res.error || 'Failed to connect' });
      }
      await get().loadServers();
      await get().loadTools();
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to connect' });
    }
  },

  disconnectServer: async (id) => {
    set({ error: null });
    try {
      await window.electronAPI.mcp.disconnectServer(id);
      await get().loadServers();
      await get().loadTools();
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to disconnect' });
    }
  },

  reconnectServer: async (id) => {
    set({ error: null });
    try {
      const res = await window.electronAPI.mcp.reconnectServer(id);
      if (!res.success) {
        set({ error: res.error || 'Failed to reconnect' });
      }
      await get().loadServers();
      await get().loadTools();
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to reconnect' });
    }
  },
}));

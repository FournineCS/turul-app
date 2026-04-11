// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { ipcMain } from 'electron';
import type { IpcResponse, McpServerConfig, McpServerStatus, McpToolInfo } from '../../shared/types';
import type { McpClientManager } from '../ai/mcp/mcp-client-manager';
import { requireAuth } from './ipc-utils';
import { assertString, assertObject, assertBoolean, assertStringArray } from './validation';

export function registerMcpHandlers(mcpClientManager: McpClientManager): void {

  ipcMain.handle('mcp:get-servers', async (): Promise<IpcResponse<McpServerStatus[]>> => {
    try {
      requireAuth();
      return { success: true, data: mcpClientManager.getStatuses() };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get MCP servers' };
    }
  });

  ipcMain.handle('mcp:add-server', async (_, config: unknown): Promise<IpcResponse<McpServerStatus>> => {
    try {
      requireAuth();
      const cfg = assertObject(config, 'config');
      const name = assertString(cfg.name, 'name', 1, 64);
      const command = assertString(cfg.command, 'command', 1, 512);
      const args = cfg.args != null ? assertStringArray(cfg.args, 'args', 50) : [];
      const enabled = cfg.enabled != null ? assertBoolean(cfg.enabled, 'enabled') : true;

      // Validate server name: alphanumeric, hyphens, underscores only (used in tool prefix)
      if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(name)) {
        return { success: false, error: 'Server name must be alphanumeric (hyphens and underscores allowed)' };
      }

      let env: Record<string, string> | undefined;
      if (cfg.env != null) {
        const rawEnv = assertObject(cfg.env, 'env');
        env = {};
        for (const [k, v] of Object.entries(rawEnv)) {
          if (typeof v === 'string') {
            env[k] = v;
          }
        }
      }

      const status = await mcpClientManager.addServer({
        name,
        command,
        args,
        env,
        enabled,
      });

      return { success: true, data: status };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to add MCP server' };
    }
  });

  ipcMain.handle('mcp:update-server', async (_, id: unknown, updates: unknown): Promise<IpcResponse<McpServerStatus>> => {
    try {
      requireAuth();
      const serverId = assertString(id, 'id', 1, 256);
      const upd = assertObject(updates, 'updates');

      const parsedUpdates: Partial<Omit<McpServerConfig, 'id'>> = {};

      if (upd.name != null) {
        parsedUpdates.name = assertString(upd.name, 'name', 1, 64);
        if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(parsedUpdates.name)) {
          return { success: false, error: 'Server name must be alphanumeric (hyphens and underscores allowed)' };
        }
      }
      if (upd.command != null) parsedUpdates.command = assertString(upd.command, 'command', 1, 512);
      if (upd.args != null) parsedUpdates.args = assertStringArray(upd.args, 'args', 50);
      if (upd.enabled != null) parsedUpdates.enabled = assertBoolean(upd.enabled, 'enabled');
      if (upd.env != null) {
        const rawEnv = assertObject(upd.env, 'env');
        parsedUpdates.env = {};
        for (const [k, v] of Object.entries(rawEnv)) {
          if (typeof v === 'string') {
            parsedUpdates.env[k] = v;
          }
        }
      }

      const status = await mcpClientManager.updateServer(serverId, parsedUpdates);
      return { success: true, data: status };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to update MCP server' };
    }
  });

  ipcMain.handle('mcp:remove-server', async (_, id: unknown): Promise<IpcResponse<void>> => {
    try {
      requireAuth();
      const serverId = assertString(id, 'id', 1, 256);
      await mcpClientManager.removeServer(serverId);
      return { success: true, data: undefined };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to remove MCP server' };
    }
  });

  ipcMain.handle('mcp:connect-server', async (_, id: unknown): Promise<IpcResponse<McpServerStatus>> => {
    try {
      requireAuth();
      const serverId = assertString(id, 'id', 1, 256);
      const status = await mcpClientManager.reconnectServer(serverId);
      return { success: true, data: status };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to connect MCP server' };
    }
  });

  ipcMain.handle('mcp:disconnect-server', async (_, id: unknown): Promise<IpcResponse<void>> => {
    try {
      requireAuth();
      const serverId = assertString(id, 'id', 1, 256);
      await mcpClientManager.disconnectServer(serverId);
      return { success: true, data: undefined };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to disconnect MCP server' };
    }
  });

  ipcMain.handle('mcp:reconnect-server', async (_, id: unknown): Promise<IpcResponse<McpServerStatus>> => {
    try {
      requireAuth();
      const serverId = assertString(id, 'id', 1, 256);
      const status = await mcpClientManager.reconnectServer(serverId);
      return { success: true, data: status };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to reconnect MCP server' };
    }
  });

  ipcMain.handle('mcp:get-tools', async (): Promise<IpcResponse<McpToolInfo[]>> => {
    try {
      requireAuth();
      return { success: true, data: mcpClientManager.getAllTools() };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get MCP tools' };
    }
  });
}

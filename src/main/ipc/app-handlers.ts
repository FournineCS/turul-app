// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

/**
 * App-level IPC handlers: app:*, settings:*.
 */

import { ipcMain, dialog, app, shell } from 'electron';
import type { IpcResponse, EnvironmentHealth } from '../../shared/types';
import { DatabaseManager } from '../database/db-manager';
import type { AuthService } from '../auth/auth-service';
import { requireAuth } from './ipc-utils';
import { encryptToString, decryptFromString } from '../auth/crypto-service';
import { assertString, assertSafeFileExtension } from './validation';
import { getEnvironmentChecker } from '../health/environment-checker';
import { clearGcloudCache } from '../gcp/gcloud-resolver';
import { clearClaudeCache } from '../ai/claude-resolver';

const ENCRYPTED_SETTINGS = new Set([
  // Legacy bedrock keys (backward compat)
  'chat:bedrockAccessKeyId', 'chat:bedrockSecretKey', 'chat:bedrockSessionToken',
  // New per-provider keys
  'chat:bedrock:accessKeyId', 'chat:bedrock:secretKey',
  'chat:anthropic:apiKey',
  'chat:openai:apiKey', 'chat:openai:orgId',
  'chat:gemini:apiKey',
]);

/** Prefix-based allowlist — supports dynamic keys like gcpBillingBQProject_{orgId}. */
const ALLOWED_SETTINGS_PREFIXES = ['app.', 'chat:', 'gcp', 'onboarding'];

/** Exact-match keys that don't follow a prefix convention. */
const ALLOWED_SETTINGS_EXACT = new Set(['selectedProvider']);

/** Keys that must never be writable through the settings IPC. */
const FORBIDDEN_SETTINGS_KEYS = new Set([
  'password_hash', 'password_salt', 'encryption_salt',
]);

function isSettingsKeyAllowed(key: string): boolean {
  if (FORBIDDEN_SETTINGS_KEYS.has(key)) return false;
  if (ALLOWED_SETTINGS_EXACT.has(key)) return true;
  return ALLOWED_SETTINGS_PREFIXES.some(p => key.startsWith(p));
}

export function registerAppHandlers(dbManager: DatabaseManager, authService: AuthService): void {
  // ── App utilities ──

  ipcMain.handle('app:select-directory', async (): Promise<string | null> => {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('app:select-file', async (): Promise<string | null> => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });

  ipcMain.handle('app:get-version', async (): Promise<string> => {
    return app.getVersion();
  });

  ipcMain.handle(
    'app:save-file',
    async (_, defaultName: unknown, dataUrl: unknown): Promise<string | null> => {
      requireAuth();
      const name = assertString(defaultName, 'defaultName', 1, 256);
      const data = assertString(dataUrl, 'dataUrl', 1, 10_000_000); // 10MB limit for binary data

      const ext = assertSafeFileExtension(name, 'defaultName');
      const filterName = ext.toUpperCase() + ' files';
      const result = await dialog.showSaveDialog({
        defaultPath: name,
        filters: [{ name: filterName, extensions: [ext] }],
      });
      if (result.canceled || !result.filePath) return null;

      const base64Data = data.replace(/^data:[^;]+;base64,/, '');
      const fs = await import('fs/promises');
      await fs.writeFile(result.filePath, Buffer.from(base64Data, 'base64'));
      return result.filePath;
    }
  );

  // ── App Settings ──

  ipcMain.handle('settings:get', async (_, key: unknown): Promise<IpcResponse<string | null>> => {
    try {
      requireAuth();
      const k = assertString(key, 'key', 1, 100);
      if (!isSettingsKeyAllowed(k)) {
        throw new Error(`Setting key '${k}' is not allowed`);
      }
      if (ENCRYPTED_SETTINGS.has(k)) {
        const raw = dbManager.getSetting(k);
        if (!raw) return { success: true, data: null };
        try {
          const encKey = authService.getEncryptionKey();
          return { success: true, data: decryptFromString(raw, encKey) };
        } catch {
          // Migration: value stored as plaintext before encryption was added
          return { success: true, data: raw };
        }
      }
      return { success: true, data: dbManager.getSetting(k) };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get setting' };
    }
  });

  ipcMain.handle('settings:set', async (_, key: unknown, value: unknown): Promise<IpcResponse<void>> => {
    try {
      requireAuth();
      const k = assertString(key, 'key', 1, 100);
      const v = assertString(value, 'value', 0, 10000);
      if (!isSettingsKeyAllowed(k)) {
        throw new Error(`Setting key '${k}' is not allowed`);
      }
      if (ENCRYPTED_SETTINGS.has(k)) {
        const encKey = authService.getEncryptionKey();
        dbManager.setSetting(k, encryptToString(v, encKey));
      } else {
        dbManager.setSetting(k, v);
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to save setting' };
    }
  });

  ipcMain.handle('settings:get-all-app', async (): Promise<IpcResponse<Record<string, string>>> => {
    try {
      requireAuth();
      const keys = [
        'app.theme',
        'app.defaultProfile',
        'app.defaultRegions',
        'app.defaultServices',
        'app.dataRetentionDays',
        'app.gcloudPath',
        'app.claudePath',
      ];
      const result: Record<string, string> = {};
      for (const key of keys) {
        const val = dbManager.getSetting(key);
        if (val !== null) result[key] = val;
      }
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get settings' };
    }
  });

  ipcMain.handle('settings:clear-gcloud-cache', async (): Promise<IpcResponse<void>> => {
    try {
      requireAuth();
      clearGcloudCache();
      return { success: true, data: undefined };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to clear cache' };
    }
  });

  ipcMain.handle('settings:clear-claude-cache', async (): Promise<IpcResponse<void>> => {
    try {
      requireAuth();
      clearClaudeCache();
      return { success: true, data: undefined };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to clear cache' };
    }
  });

  // ── Environment Health ──

  ipcMain.handle('health:check', async (): Promise<IpcResponse<EnvironmentHealth>> => {
    try {
      const checker = getEnvironmentChecker();
      const cached = checker.getCached();
      const data = cached || await checker.runAllChecks();
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Health check failed' };
    }
  });

  // ── Shell utilities ──

  ipcMain.handle('shell:open-external', async (_, url: unknown): Promise<void> => {
    const href = assertString(url, 'url', 1, 2048);
    if (!/^https?:\/\//i.test(href)) {
      throw new Error('Only http/https URLs are allowed');
    }
    await shell.openExternal(href);
  });

  ipcMain.handle('health:recheck', async (): Promise<IpcResponse<EnvironmentHealth>> => {
    try {
      const data = await getEnvironmentChecker().runAllChecks(true);
      return { success: true, data };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Health check failed' };
    }
  });
}

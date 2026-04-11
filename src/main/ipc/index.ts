// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

/**
 * IPC handler registration orchestrator.
 * Delegates to domain-specific handler modules.
 */

import { BrowserWindow } from 'electron';
import { DatabaseManager } from '../database/db-manager';
import { AuthService } from '../auth/auth-service';
import { AppProfileManager } from '../auth/app-profile-manager';
import { BiometricService } from '../auth/biometric-service';
import { setAuthServiceRef } from './ipc-utils';
import { registerAuthHandlers } from './auth-handlers';
import { registerProfileHandlers } from './profile-handlers';
import { registerAWSHandlers } from './aws-handlers';
import { registerResourceHandlers } from './resource-handlers';
import { registerAppHandlers } from './app-handlers';
import { registerChatHandlers } from './chat-handlers';
import { registerMcpHandlers } from './mcp-handlers';
import { McpClientManager } from '../ai/mcp/mcp-client-manager';
import { setMcpClientManager } from '../ai/tools/tool-registry';
import { GCPCredentialManager } from '../gcp/credential-manager';
import { getGCPAuthManager } from '../gcp/auth-manager';
import { setGCPCredentialManagerRef } from '../gcp/auth-factory';

// Module-level references for auth, profile, and MCP managers
let authServiceInstance: AuthService | null = null;
let appProfileManagerInstance: AppProfileManager | null = null;
let mcpClientManagerInstance: McpClientManager | null = null;

export function getAuthService(): AuthService | null {
  return authServiceInstance;
}

export function getAppProfileManager(): AppProfileManager | null {
  return appProfileManagerInstance;
}

export function getMcpClientManager(): McpClientManager | null {
  return mcpClientManagerInstance;
}

export function registerIpcHandlers(dbManager: DatabaseManager): void {
  // Initialize auth service, biometric service, and app profile manager
  authServiceInstance = new AuthService(dbManager);
  const biometricService = new BiometricService(dbManager);
  authServiceInstance.setBiometricService(biometricService);
  appProfileManagerInstance = new AppProfileManager(dbManager, authServiceInstance);

  // Share auth reference with utility module
  setAuthServiceRef(authServiceInstance);

  // Wire session timeout to send event to renderer
  authServiceInstance.onSessionTimeout(() => {
    const windows = BrowserWindow.getAllWindows();
    for (const win of windows) {
      win.webContents.send('auth:session-timeout');
    }
  });

  // Register handler groups
  registerAuthHandlers(authServiceInstance, appProfileManagerInstance, biometricService);
  registerProfileHandlers(appProfileManagerInstance, authServiceInstance);
  registerAWSHandlers(dbManager, authServiceInstance, appProfileManagerInstance);

  // GCP handlers + credential manager
  const gcpCredentialManager = new GCPCredentialManager(dbManager, authServiceInstance);
  setGCPCredentialManagerRef(gcpCredentialManager);
  getGCPAuthManager().setCredentialManager(gcpCredentialManager);

  const { registerGCPHandlers } = require('./gcp-handlers');
  registerGCPHandlers(dbManager, gcpCredentialManager);

  // Provider-agnostic handlers
  registerResourceHandlers(dbManager);
  registerAppHandlers(dbManager, authServiceInstance);

  // AI Chat handlers
  registerChatHandlers(dbManager, authServiceInstance);

  // MCP client manager + handlers
  mcpClientManagerInstance = new McpClientManager(dbManager);
  setMcpClientManager(mcpClientManagerInstance);
  registerMcpHandlers(mcpClientManagerInstance);
  mcpClientManagerInstance.loadConfigs().catch((err) => {
    console.error('[MCP] Failed to load configs on startup:', err);
  });
}

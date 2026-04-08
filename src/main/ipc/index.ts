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

// Module-level references for auth and profile managers
let authServiceInstance: AuthService | null = null;
let appProfileManagerInstance: AppProfileManager | null = null;

export function getAuthService(): AuthService | null {
  return authServiceInstance;
}

export function getAppProfileManager(): AppProfileManager | null {
  return appProfileManagerInstance;
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

  // GCP handlers
  const { registerGCPHandlers } = require('./gcp-handlers');
  registerGCPHandlers(dbManager);

  // Provider-agnostic handlers
  registerResourceHandlers(dbManager);
  registerAppHandlers(dbManager, authServiceInstance);

  // AI Chat handlers
  registerChatHandlers(dbManager, authServiceInstance);
}

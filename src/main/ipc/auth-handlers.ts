// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { ipcMain } from 'electron';
import type { IpcResponse, AuthStatus, AuthSetupRequest, AuthLoginRequest, AuthChangePasswordRequest } from '../../shared/types';
import type { AuthService } from '../auth/auth-service';
import type { AppProfileManager } from '../auth/app-profile-manager';
import type { BiometricService } from '../auth/biometric-service';
import { getClientFactory, clearAllAppCredentials } from '../aws/client-factory';
import { requireAuth } from './ipc-utils';
import { assertString } from './validation';

export function registerAuthHandlers(
  authService: AuthService,
  appProfileManager: AppProfileManager,
  biometricService: BiometricService
): void {
  ipcMain.handle('auth:check-status', async (): Promise<IpcResponse<AuthStatus>> => {
    try {
      return {
        success: true,
        data: {
          isSetup: authService.isSetup(),
          isAuthenticated: authService.isAuthenticated(),
          biometricAvailable: biometricService.isBiometricAvailable(),
          biometricEnabled: biometricService.isBiometricEnabled(),
          biometricType: biometricService.getBiometricType(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check auth status',
      };
    }
  });

  ipcMain.handle(
    'auth:setup',
    async (_, req: AuthSetupRequest): Promise<IpcResponse<void>> => {
      try {
        const password = assertString(req?.password, 'password', 6, 128);
        const confirmPassword = assertString(req?.confirmPassword, 'confirmPassword', 6, 128);
        await authService.setup(password, confirmPassword);
        appProfileManager.registerAllCredentials();
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to set up password',
        };
      }
    }
  );

  ipcMain.handle(
    'auth:login',
    async (_, req: AuthLoginRequest): Promise<IpcResponse<void>> => {
      try {
        const password = assertString(req?.password, 'password', 1, 128);
        await authService.login(password);
        appProfileManager.registerAllCredentials();
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Authentication failed',
        };
      }
    }
  );

  ipcMain.handle('auth:logout', async (): Promise<IpcResponse<void>> => {
    try {
      authService.logout();
      clearAllAppCredentials();
      getClientFactory().clearCache();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to logout',
      };
    }
  });

  ipcMain.handle(
    'auth:change-password',
    async (_, req: AuthChangePasswordRequest): Promise<IpcResponse<void>> => {
      try {
        const currentPassword = assertString(req?.currentPassword, 'currentPassword', 1, 128);
        const newPassword = assertString(req?.newPassword, 'newPassword', 6, 128);
        const confirmNewPassword = assertString(req?.confirmNewPassword, 'confirmNewPassword', 6, 128);
        await authService.changePassword(currentPassword, newPassword, confirmNewPassword);
        appProfileManager.registerAllCredentials();
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to change password',
        };
      }
    }
  );

  ipcMain.handle('auth:touch-activity', async (): Promise<IpcResponse<void>> => {
    try {
      authService.touchActivity();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to update activity',
      };
    }
  });

  // Biometric handlers

  ipcMain.handle('auth:biometric-available', async (): Promise<IpcResponse<{ available: boolean; type: string }>> => {
    try {
      return {
        success: true,
        data: {
          available: biometricService.isBiometricAvailable(),
          type: biometricService.getBiometricType(),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check biometric availability',
      };
    }
  });

  ipcMain.handle('auth:biometric-status', async (): Promise<IpcResponse<{ enabled: boolean }>> => {
    try {
      return {
        success: true,
        data: { enabled: biometricService.isBiometricEnabled() },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to check biometric status',
      };
    }
  });

  ipcMain.handle('auth:biometric-enable', async (): Promise<IpcResponse<void>> => {
    try {
      if (!authService.isAuthenticated()) {
        throw new Error('Must be authenticated to enable biometric login');
      }
      const key = authService.getEncryptionKey();
      await biometricService.enableBiometric(key);
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to enable biometric login',
      };
    }
  });

  ipcMain.handle('auth:biometric-disable', async (): Promise<IpcResponse<void>> => {
    try {
      requireAuth();
      biometricService.disableBiometric();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to disable biometric login',
      };
    }
  });

  ipcMain.handle('auth:biometric-login', async (): Promise<IpcResponse<void>> => {
    try {
      const key = await biometricService.authenticateWithBiometric();
      await authService.loginWithBiometric(key);
      appProfileManager.registerAllCredentials();
      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Biometric authentication failed',
      };
    }
  });
}

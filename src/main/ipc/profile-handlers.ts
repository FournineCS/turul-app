// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { ipcMain } from 'electron';
import { execFile } from 'child_process';
import { promisify } from 'util';
import type { IpcResponse, AppProfileInput, AppProfileSummary } from '../../shared/types';
import type { AppProfileManager } from '../auth/app-profile-manager';
import type { AuthService } from '../auth/auth-service';
import { assertString, assertOptionalString, assertOneOf, assertProfileName } from './validation';

const execFileAsync = promisify(execFile);

const CREDENTIAL_TYPES = ['iam_keys', 'sso_config', 'assume_role'] as const;

function requireAuth(authService: AuthService): void {
  if (!authService.isAuthenticated()) {
    throw new Error('Not authenticated');
  }
}

function validateProfileInput(input: AppProfileInput): void {
  assertProfileName(input?.name);
  assertOneOf(input?.credentialType, CREDENTIAL_TYPES, 'credentialType');
  assertOptionalString(input?.region, 'region', 64);
  assertOptionalString(input?.description, 'description', 500);
  assertOptionalString(input?.accessKeyId, 'accessKeyId', 128);
  assertOptionalString(input?.secretAccessKey, 'secretAccessKey', 256);
  assertOptionalString(input?.sessionToken, 'sessionToken', 2048);
  assertOptionalString(input?.ssoStartUrl, 'ssoStartUrl', 512);
  assertOptionalString(input?.ssoRegion, 'ssoRegion', 64);
  assertOptionalString(input?.ssoAccountId, 'ssoAccountId', 20);
  assertOptionalString(input?.ssoRoleName, 'ssoRoleName', 128);
  assertOptionalString(input?.assumeRoleArn, 'assumeRoleArn', 256);
  assertOptionalString(input?.externalId, 'externalId', 256);
  assertOptionalString(input?.sourceProfile, 'sourceProfile', 128);
}

export function registerProfileHandlers(
  appProfileManager: AppProfileManager,
  authService: AuthService
): void {
  ipcMain.handle('profile:list', async (): Promise<IpcResponse<AppProfileSummary[]>> => {
    try {
      requireAuth(authService);
      const profiles = appProfileManager.listProfiles();
      return { success: true, data: profiles };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to list profiles',
      };
    }
  });

  ipcMain.handle(
    'profile:add',
    async (_, input: AppProfileInput): Promise<IpcResponse<AppProfileSummary>> => {
      try {
        requireAuth(authService);
        validateProfileInput(input);
        const profile = appProfileManager.addProfile(input);
        return { success: true, data: profile };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to add profile',
        };
      }
    }
  );

  ipcMain.handle(
    'profile:update',
    async (_, id: string, input: Partial<AppProfileInput>): Promise<IpcResponse<AppProfileSummary>> => {
      try {
        requireAuth(authService);
        assertString(id, 'id', 1, 100);
        if (input?.name !== undefined) assertProfileName(input.name);
        if (input?.credentialType !== undefined) assertOneOf(input.credentialType, CREDENTIAL_TYPES, 'credentialType');
        if (input?.region !== undefined) assertOptionalString(input.region, 'region', 64);
        if (input?.description !== undefined) assertOptionalString(input.description, 'description', 500);
        const profile = appProfileManager.updateProfile(id, input);
        return { success: true, data: profile };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to update profile',
        };
      }
    }
  );

  ipcMain.handle(
    'profile:delete',
    async (_, id: string): Promise<IpcResponse<void>> => {
      try {
        requireAuth(authService);
        assertString(id, 'id', 1, 100);
        appProfileManager.deleteProfile(id);
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to delete profile',
        };
      }
    }
  );

  ipcMain.handle(
    'profile:sso-login',
    async (_, profileName: string): Promise<IpcResponse<void>> => {
      try {
        requireAuth(authService);
        assertString(profileName, 'profileName', 1, 128);
        await execFileAsync('aws', ['sso', 'login', '--profile', profileName], {
          timeout: 120_000,
        });
        return { success: true };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Failed to run aws sso login',
        };
      }
    }
  );
}

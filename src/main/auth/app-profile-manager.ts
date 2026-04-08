// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import type { DatabaseManager, RawAppProfile } from '../database/db-manager';
import type { AuthService } from './auth-service';
import type { AppProfileInput, AppProfileSummary, AWSProfile } from '../../shared/types';
import { encryptToString, decryptFromString } from './crypto-service';
import {
  registerAppProfileCredentials,
  registerAppSSOConfig,
  registerAppAssumeRoleConfig,
  clearAllAppCredentials,
} from '../aws/client-factory';

export class AppProfileManager {
  constructor(
    private dbManager: DatabaseManager,
    private authService: AuthService
  ) {}

  addProfile(input: AppProfileInput): AppProfileSummary {
    const key = this.authService.getEncryptionKey();

    const id = this.dbManager.createAppProfile({
      name: input.name,
      credential_type: input.credentialType,
      region: input.region,
      description: input.description,
      // IAM Keys (encrypted)
      encrypted_access_key_id: input.accessKeyId ? encryptToString(input.accessKeyId, key) : undefined,
      encrypted_secret_access_key: input.secretAccessKey ? encryptToString(input.secretAccessKey, key) : undefined,
      encrypted_session_token: input.sessionToken ? encryptToString(input.sessionToken, key) : undefined,
      // SSO Config (plaintext)
      sso_start_url: input.ssoStartUrl,
      sso_region: input.ssoRegion,
      sso_account_id: input.ssoAccountId,
      sso_role_name: input.ssoRoleName,
      // Assume Role
      assume_role_arn: input.assumeRoleArn,
      encrypted_external_id: input.externalId ? encryptToString(input.externalId, key) : undefined,
      source_profile: input.sourceProfile,
    });

    // Register credentials in client factory
    const raw = this.dbManager.getAppProfileById(id)!;
    this.registerProfileCredentials(raw);

    return this.rawToSummary(raw);
  }

  updateProfile(id: string, input: Partial<AppProfileInput>): AppProfileSummary {
    const key = this.authService.getEncryptionKey();

    const updateData: Record<string, string | undefined> = {};

    if (input.name !== undefined) updateData.name = input.name;
    if (input.credentialType !== undefined) updateData.credential_type = input.credentialType;
    if (input.region !== undefined) updateData.region = input.region;
    if (input.description !== undefined) updateData.description = input.description;

    // IAM Keys
    if (input.accessKeyId !== undefined) {
      updateData.encrypted_access_key_id = input.accessKeyId ? encryptToString(input.accessKeyId, key) : undefined;
    }
    if (input.secretAccessKey !== undefined) {
      updateData.encrypted_secret_access_key = input.secretAccessKey ? encryptToString(input.secretAccessKey, key) : undefined;
    }
    if (input.sessionToken !== undefined) {
      updateData.encrypted_session_token = input.sessionToken ? encryptToString(input.sessionToken, key) : undefined;
    }

    // SSO
    if (input.ssoStartUrl !== undefined) updateData.sso_start_url = input.ssoStartUrl;
    if (input.ssoRegion !== undefined) updateData.sso_region = input.ssoRegion;
    if (input.ssoAccountId !== undefined) updateData.sso_account_id = input.ssoAccountId;
    if (input.ssoRoleName !== undefined) updateData.sso_role_name = input.ssoRoleName;

    // Assume Role
    if (input.assumeRoleArn !== undefined) updateData.assume_role_arn = input.assumeRoleArn;
    if (input.externalId !== undefined) {
      updateData.encrypted_external_id = input.externalId ? encryptToString(input.externalId, key) : undefined;
    }
    if (input.sourceProfile !== undefined) updateData.source_profile = input.sourceProfile;

    this.dbManager.updateAppProfile(id, updateData);

    const raw = this.dbManager.getAppProfileById(id)!;
    this.registerProfileCredentials(raw);

    return this.rawToSummary(raw);
  }

  deleteProfile(id: string): void {
    this.dbManager.deleteAppProfile(id);
  }

  listProfiles(): AppProfileSummary[] {
    const profiles = this.dbManager.getAllAppProfiles();
    return profiles.map((p) => this.rawToSummary(p));
  }

  /** Register all app profiles' credentials in client factory. Call after login. */
  registerAllCredentials(): void {
    clearAllAppCredentials();
    const profiles = this.dbManager.getAllAppProfiles();
    for (const profile of profiles) {
      this.registerProfileCredentials(profile);
    }
  }

  /** Get app profiles merged as AWSProfile[] for the profile dropdown. */
  getAppProfilesAsAWSProfiles(): AWSProfile[] {
    const key = this.authService.getEncryptionKey();
    const rawProfiles = this.dbManager.getAllAppProfiles();

    return rawProfiles.map((raw) => {
      const profile: AWSProfile = {
        name: raw.name,
        region: raw.region || undefined,
        source: 'app',
        appProfileId: raw.id,
      };

      if (raw.credential_type === 'sso_config') {
        profile.ssoStartUrl = raw.sso_start_url || undefined;
        profile.ssoRegion = raw.sso_region || undefined;
        profile.ssoAccountId = raw.sso_account_id || undefined;
        profile.ssoRoleName = raw.sso_role_name || undefined;
      }

      if (raw.credential_type === 'assume_role') {
        profile.assumeRoleArn = raw.assume_role_arn || undefined;
        profile.sourceProfile = raw.source_profile || undefined;
      }

      return profile;
    });
  }

  private registerProfileCredentials(raw: RawAppProfile): void {
    const key = this.authService.getEncryptionKey();

    switch (raw.credential_type) {
      case 'iam_keys':
        if (raw.encrypted_access_key_id && raw.encrypted_secret_access_key) {
          registerAppProfileCredentials(raw.name, {
            accessKeyId: decryptFromString(raw.encrypted_access_key_id, key),
            secretAccessKey: decryptFromString(raw.encrypted_secret_access_key, key),
            sessionToken: raw.encrypted_session_token
              ? decryptFromString(raw.encrypted_session_token, key)
              : undefined,
          });
        }
        break;

      case 'sso_config':
        if (raw.sso_start_url && raw.sso_account_id && raw.sso_role_name && raw.sso_region) {
          registerAppSSOConfig(raw.name, {
            ssoStartUrl: raw.sso_start_url,
            ssoAccountId: raw.sso_account_id,
            ssoRoleName: raw.sso_role_name,
            ssoRegion: raw.sso_region,
          });
        }
        break;

      case 'assume_role':
        if (raw.assume_role_arn && raw.source_profile) {
          registerAppAssumeRoleConfig(raw.name, {
            roleArn: raw.assume_role_arn,
            externalId: raw.encrypted_external_id
              ? decryptFromString(raw.encrypted_external_id, key)
              : undefined,
            sourceProfile: raw.source_profile,
          });
        }
        break;
    }
  }

  private rawToSummary(raw: RawAppProfile): AppProfileSummary {
    return {
      id: raw.id,
      name: raw.name,
      credentialType: raw.credential_type as AppProfileSummary['credentialType'],
      region: raw.region || undefined,
      description: raw.description || undefined,
      ssoStartUrl: raw.sso_start_url || undefined,
      ssoRegion: raw.sso_region || undefined,
      ssoAccountId: raw.sso_account_id || undefined,
      ssoRoleName: raw.sso_role_name || undefined,
      assumeRoleArn: raw.assume_role_arn || undefined,
      sourceProfile: raw.source_profile || undefined,
      createdAt: raw.created_at,
      updatedAt: raw.updated_at,
    };
  }
}

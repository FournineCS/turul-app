// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';
import os from 'os';
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';
import { fromIni } from '@aws-sdk/credential-providers';
import type { AWSProfile } from '../../shared/types';
import { getClientFactory } from './client-factory';

export class ProfileManager {
  private credentialsPath: string;
  private configPath: string;

  constructor() {
    const awsDir = path.join(os.homedir(), '.aws');
    this.credentialsPath = path.join(awsDir, 'credentials');
    this.configPath = path.join(awsDir, 'config');
  }

  async getProfiles(): Promise<AWSProfile[]> {
    const profiles: Map<string, AWSProfile> = new Map();

    // Parse credentials file
    if (existsSync(this.credentialsPath)) {
      const credentialsContent = await readFile(this.credentialsPath, 'utf-8');
      const credentialsProfiles = this.parseIniFile(credentialsContent);

      for (const [name, values] of Object.entries(credentialsProfiles)) {
        profiles.set(name, {
          name,
          accessKeyId: values['aws_access_key_id'],
          secretAccessKey: values['aws_secret_access_key'],
          sessionToken: values['aws_session_token'],
          source: 'credentials',
        });
      }
    }

    // Parse config file
    if (existsSync(this.configPath)) {
      const configContent = await readFile(this.configPath, 'utf-8');
      const configProfiles = this.parseIniFile(configContent);

      for (const [name, values] of Object.entries(configProfiles)) {
        // Config file profile names are prefixed with "profile " except for default
        const profileName = name.startsWith('profile ')
          ? name.slice(8)
          : name;

        const existing = profiles.get(profileName);

        if (existing) {
          // Merge config values into existing profile
          existing.region = values['region'];
          if (values['sso_start_url']) {
            existing.source = 'sso';
            existing.ssoStartUrl = values['sso_start_url'];
            existing.ssoRegion = values['sso_region'];
            existing.ssoAccountId = values['sso_account_id'];
            existing.ssoRoleName = values['sso_role_name'];
          }
        } else {
          // Create new profile from config
          const profile: AWSProfile = {
            name: profileName,
            region: values['region'],
            source: 'config',
          };

          if (values['sso_start_url']) {
            profile.source = 'sso';
            profile.ssoStartUrl = values['sso_start_url'];
            profile.ssoRegion = values['sso_region'];
            profile.ssoAccountId = values['sso_account_id'];
            profile.ssoRoleName = values['sso_role_name'];
          }

          profiles.set(profileName, profile);
        }
      }
    }

    return Array.from(profiles.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }

  async validateProfile(profileName: string): Promise<{ accountId: string; arn: string }> {
    try {
      // Use client factory's STS client which checks app credential registries first
      const factory = getClientFactory();
      const stsClient = factory.getSTSClient({ profile: profileName, region: 'us-east-1' });

      const command = new GetCallerIdentityCommand({});
      const response = await stsClient.send(command);

      if (!response.Account || !response.Arn) {
        throw new Error('Unable to get account information');
      }

      return {
        accountId: response.Account,
        arn: response.Arn,
      };
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to validate profile: ${error.message}`);
      }
      throw error;
    }
  }

  getProfileRegion(profile: AWSProfile): string {
    return profile.region || 'us-east-1';
  }

  private parseIniFile(content: string): Record<string, Record<string, string>> {
    const result: Record<string, Record<string, string>> = {};
    let currentSection = '';

    const lines = content.split('\n');

    for (const line of lines) {
      const trimmedLine = line.trim();

      // Skip empty lines and comments
      if (!trimmedLine || trimmedLine.startsWith('#') || trimmedLine.startsWith(';')) {
        continue;
      }

      // Check for section header
      const sectionMatch = trimmedLine.match(/^\[([^\]]+)\]$/);
      if (sectionMatch) {
        currentSection = sectionMatch[1];
        result[currentSection] = {};
        continue;
      }

      // Parse key-value pair
      const keyValueMatch = trimmedLine.match(/^([^=]+)=(.*)$/);
      if (keyValueMatch && currentSection) {
        const key = keyValueMatch[1].trim();
        const value = keyValueMatch[2].trim();
        result[currentSection][key] = value;
      }
    }

    return result;
  }
}

// Singleton instance
let profileManager: ProfileManager | null = null;

export function getProfileManager(): ProfileManager {
  if (!profileManager) {
    profileManager = new ProfileManager();
  }
  return profileManager;
}

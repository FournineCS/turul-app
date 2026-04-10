// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { execFile } from 'child_process';
import { existsSync, writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import crypto from 'crypto';
import type { ToolCheck, EnvironmentHealth } from '../../shared/types';
import { resolveGcloudPath } from '../gcp/gcloud-resolver';

let instance: EnvironmentChecker | null = null;

export function getEnvironmentChecker(): EnvironmentChecker {
  if (!instance) instance = new EnvironmentChecker();
  return instance;
}

export class EnvironmentChecker {
  private cached: EnvironmentHealth | null = null;

  async runAllChecks(force = false): Promise<EnvironmentHealth> {
    if (this.cached && !force) return this.cached;

    const checks = await Promise.allSettled([
      this.checkGcloud(),
      this.checkAwsCredentials(),
      this.checkDataDirectory(),
      this.checkCrypto(),
    ]);

    const results: ToolCheck[] = checks.map((r) =>
      r.status === 'fulfilled'
        ? r.value
        : { id: 'unknown', name: 'Unknown', status: 'error' as const, details: String(r.reason), required: false }
    );

    let electronVersion = '';
    try {
      electronVersion = process.versions.electron || '';
    } catch {
      // not in electron context
    }

    this.cached = {
      checkedAt: new Date().toISOString(),
      platform: process.platform,
      nodeVersion: process.version,
      electronVersion,
      checks: results,
    };

    return this.cached;
  }

  getCached(): EnvironmentHealth | null {
    return this.cached;
  }

  private async checkGcloud(): Promise<ToolCheck> {
    const gcloudBin = await resolveGcloudPath();
    return new Promise((resolve) => {
      const timeout = 5_000;
      try {
        const child = execFile(gcloudBin, ['version'], { timeout }, (err, stdout) => {
          if (err) {
            if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
              return resolve({
                id: 'gcloud',
                name: 'Google Cloud SDK',
                status: 'not-found',
                details: 'gcloud CLI not installed',
                installUrl: 'https://cloud.google.com/sdk/docs/install',
                required: false,
              });
            }
            return resolve({
              id: 'gcloud',
              name: 'Google Cloud SDK',
              status: 'error',
              details: err.message,
              installUrl: 'https://cloud.google.com/sdk/docs/install',
              required: false,
            });
          }

          // Parse version from first line: "Google Cloud SDK 456.0.0"
          const versionMatch = stdout.match(/Google Cloud SDK ([\d.]+)/);
          const version = versionMatch ? versionMatch[1] : undefined;

          // Check if ADC credentials exist
          const adcPath = process.platform === 'win32'
            ? join(process.env.APPDATA || '', 'gcloud', 'application_default_credentials.json')
            : join(homedir(), '.config', 'gcloud', 'application_default_credentials.json');

          const hasADC = existsSync(adcPath);
          // Also check for app-stored encrypted credentials
          const hasStoredCreds = !!process.env.GOOGLE_APPLICATION_CREDENTIALS;

          const isAuthenticated = hasADC || hasStoredCreds;
          resolve({
            id: 'gcloud',
            name: 'Google Cloud SDK',
            status: isAuthenticated ? 'ok' : 'warning',
            version,
            details: isAuthenticated ? 'Installed and authenticated' : 'Installed but not authenticated (login via Turul or run gcloud auth application-default login)',
            installUrl: 'https://cloud.google.com/sdk/docs/install',
            required: false,
          });
        });

        child.on('error', () => {
          // handled in callback
        });
      } catch {
        resolve({
          id: 'gcloud',
          name: 'Google Cloud SDK',
          status: 'error',
          details: 'Failed to check gcloud',
          installUrl: 'https://cloud.google.com/sdk/docs/install',
          required: false,
        });
      }
    });
  }

  private async checkAwsCredentials(): Promise<ToolCheck> {
    const awsDir = join(homedir(), '.aws');
    const credentialsPath = join(awsDir, 'credentials');
    const configPath = join(awsDir, 'config');

    const hasCredentials = existsSync(credentialsPath);
    const hasConfig = existsSync(configPath);

    if (!hasCredentials && !hasConfig) {
      return {
        id: 'aws-credentials',
        name: 'AWS Credentials',
        status: 'warning',
        details: 'No ~/.aws/credentials or ~/.aws/config found. You can add profiles in-app.',
        installUrl: 'https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-files.html',
        required: false,
      };
    }

    // Count profiles from config file
    let profileCount = 0;
    try {
      const fs = await import('fs');
      const content = fs.readFileSync(hasConfig ? configPath : credentialsPath, 'utf-8');
      const profileMatches = content.match(/\[(?:profile\s+)?[^\]]+\]/g);
      profileCount = profileMatches ? profileMatches.length : 0;
    } catch {
      // ignore read errors
    }

    return {
      id: 'aws-credentials',
      name: 'AWS Credentials',
      status: 'ok',
      details: `${profileCount} profile${profileCount !== 1 ? 's' : ''} configured in ~/.aws/`,
      required: false,
    };
  }

  private async checkDataDirectory(): Promise<ToolCheck> {
    let dataDir: string;
    try {
      const { app } = require('electron');
      dataDir = app.getPath('userData');
    } catch {
      dataDir = process.cwd();
    }

    const probePath = join(dataDir, '_health_check_probe');
    try {
      writeFileSync(probePath, 'ok');
      unlinkSync(probePath);
      return {
        id: 'data-directory',
        name: 'Data Directory',
        status: 'ok',
        details: dataDir,
        required: true,
      };
    } catch (err) {
      return {
        id: 'data-directory',
        name: 'Data Directory',
        status: 'error',
        details: `Not writable: ${dataDir} (${err instanceof Error ? err.message : String(err)})`,
        required: true,
      };
    }
  }

  private async checkCrypto(): Promise<ToolCheck> {
    const hasAES = crypto.getCiphers().includes('aes-256-gcm');
    return {
      id: 'crypto',
      name: 'Encryption (AES-256-GCM)',
      status: hasAES ? 'ok' : 'error',
      details: hasAES ? 'Available' : 'AES-256-GCM cipher not available in this runtime',
      required: true,
    };
  }
}

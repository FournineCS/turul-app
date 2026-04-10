// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import crypto from 'crypto';
import { GoogleAuth } from 'google-auth-library';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { app } from 'electron';
import { resolveGcloudPath } from './gcloud-resolver';
import type { GCPCredentialManager } from './credential-manager';
import { setActiveGCPProject, resetActiveGCPAuth, activateFirstAvailableProject } from './auth-factory';

/** Validate resolved gcloud path is safe before shell execution. */
function assertSafeGcloudPath(binPath: string): void {
  const basename = path.basename(binPath).toLowerCase();
  if (basename !== 'gcloud' && basename !== 'gcloud.cmd') {
    throw new Error(`Unexpected gcloud binary name: ${basename}`);
  }
  if (/[;&|`$(){}]/.test(binPath)) {
    throw new Error('gcloud path contains disallowed characters');
  }
}

let authInstance: GCPAuthManager | null = null;

export class GCPAuthManager {
  private auth: GoogleAuth;
  private credentialManager: GCPCredentialManager | null = null;

  constructor() {
    this.auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
  }

  /** Set the credential manager for encrypted credential storage */
  setCredentialManager(cm: GCPCredentialManager): void {
    this.credentialManager = cm;
  }

  async checkAuth(): Promise<{ authenticated: boolean; email?: string; error?: string }> {
    // Check if any stored account credentials exist
    if (this.credentialManager) {
      const accounts = this.credentialManager.listCredentials();
      if (accounts.length > 0) {
        // Activate the first available if none is active yet
        activateFirstAvailableProject();
        return { authenticated: true, email: accounts[0].googleEmail ?? accounts[0].label };
      }
    }

    try {
      const client = await this.auth.getClient();
      const credentials = await client.getAccessToken();
      if (credentials.token) {
        const pid = await this.auth.getProjectId().catch(() => undefined);
        return { authenticated: true, email: pid ? `project: ${pid}` : undefined };
      }
      return { authenticated: false, error: 'No access token available' };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { authenticated: false, error: message };
    }
  }

  /**
   * Login with ADC using an isolated gcloud config directory.
   * Credentials are encrypted and stored in the database per account.
   * The user's system gcloud config (~/.config/gcloud/) is never touched.
   *
   * @param accountId - Existing account ID to re-authenticate, or undefined to create a new account
   * @param label - Display label for the account
   */
  async loginWithADC(accountId?: string, label?: string): Promise<{ success: boolean; accountId?: string; email?: string; error?: string }> {
    const TIMEOUT_MS = 120_000;
    const gcloudBin = await resolveGcloudPath();
    assertSafeGcloudPath(gcloudBin);

    // Generate a new account key if not re-authenticating an existing one
    const acctId = accountId || `gcp-acct-${crypto.randomUUID()}`;

    // Create isolated temp config directory
    const tempConfigDir = path.join(app.getPath('userData'), 'gcp-temp', acctId);
    fs.mkdirSync(tempConfigDir, { recursive: true });

    return new Promise((resolve) => {
      try {
        // Build a clean env: remove GOOGLE_APPLICATION_CREDENTIALS so gcloud
        // doesn't prompt "Do you want to continue?" in non-interactive mode
        const spawnEnv: Record<string, string | undefined> = { ...process.env, CLOUDSDK_CONFIG: tempConfigDir };
        delete spawnEnv.GOOGLE_APPLICATION_CREDENTIALS;

        const child = spawn(gcloudBin, ['auth', 'application-default', 'login', '--quiet'], {
          stdio: 'inherit',
          env: spawnEnv,
          ...(process.platform === 'win32' ? { shell: true } : {}),
        });

        const timer = setTimeout(() => {
          child.kill();
          this.cleanupTempDir(tempConfigDir);
          resolve({ success: false, error: 'gcloud login timed out after 2 minutes' });
        }, TIMEOUT_MS);

        child.on('close', (code) => {
          clearTimeout(timer);
          if (code === 0) {
            // Read ADC from isolated temp dir
            const adcPath = path.join(tempConfigDir, 'application_default_credentials.json');
            try {
              const adcJson = fs.readFileSync(adcPath, 'utf-8');

              // Extract email from ADC if available
              let email: string | undefined;
              try {
                const adc = JSON.parse(adcJson);
                email = adc.client_email || adc.account || undefined;
              } catch { /* ignore parse errors */ }

              // Encrypt and store
              if (this.credentialManager) {
                this.credentialManager.storeCredentials(acctId, adcJson, email, label);
                setActiveGCPProject(acctId);
              }

              // Recreate auth instance
              this.auth = new GoogleAuth({
                scopes: ['https://www.googleapis.com/auth/cloud-platform'],
              });

              resolve({ success: true, accountId: acctId, email });
            } catch (readErr: any) {
              resolve({ success: false, error: `Failed to read credentials: ${readErr.message}` });
            } finally {
              // Always clean up temp dir (remove plaintext)
              this.cleanupTempDir(tempConfigDir);
            }
          } else {
            this.cleanupTempDir(tempConfigDir);
            resolve({ success: false, error: `gcloud exited with code ${code}` });
          }
        });

        child.on('error', (err) => {
          clearTimeout(timer);
          this.cleanupTempDir(tempConfigDir);
          if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
            resolve({
              success: false,
              error: 'gcloud CLI not found. Install it from https://cloud.google.com/sdk/docs/install',
            });
          } else {
            resolve({ success: false, error: err.message });
          }
        });
      } catch (error) {
        this.cleanupTempDir(tempConfigDir);
        resolve({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });
  }

  async logout(accountId?: string): Promise<{ success: boolean; error?: string }> {
    // Delete stored credentials for the specified account
    if (this.credentialManager && accountId) {
      this.credentialManager.deleteCredentials(accountId);
    }

    // Reset auth
    resetActiveGCPAuth();
    this.auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });

    return { success: true };
  }

  getAuth(): GoogleAuth {
    return this.auth;
  }

  private cleanupTempDir(dir: string): void {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // Best effort cleanup
    }
  }
}

export function getGCPAuthManager(): GCPAuthManager {
  if (!authInstance) {
    authInstance = new GCPAuthManager();
  }
  return authInstance;
}

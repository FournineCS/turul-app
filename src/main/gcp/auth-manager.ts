// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GoogleAuth } from 'google-auth-library';
import path from 'path';
import { spawn } from 'child_process';
import { resolveGcloudPath } from './gcloud-resolver';

/** Validate resolved gcloud path is safe before shell execution. */
function assertSafeGcloudPath(binPath: string): void {
  const basename = path.basename(binPath).toLowerCase();
  if (basename !== 'gcloud' && basename !== 'gcloud.cmd') {
    throw new Error(`Unexpected gcloud binary name: ${basename}`);
  }
  // Reject shell metacharacters in the path
  if (/[;&|`$(){}]/.test(binPath)) {
    throw new Error('gcloud path contains disallowed characters');
  }
}

let authInstance: GCPAuthManager | null = null;

export class GCPAuthManager {
  private auth: GoogleAuth;

  constructor() {
    this.auth = new GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });
  }

  async checkAuth(): Promise<{ authenticated: boolean; email?: string; error?: string }> {
    try {
      const client = await this.auth.getClient();
      const credentials = await client.getAccessToken();
      if (credentials.token) {
        // Try to get the email from the credentials
        const projectId = await this.auth.getProjectId().catch(() => undefined);
        return { authenticated: true, email: projectId ? `project: ${projectId}` : undefined };
      }
      return { authenticated: false, error: 'No access token available' };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { authenticated: false, error: message };
    }
  }

  async loginWithADC(): Promise<{ success: boolean; error?: string }> {
    const TIMEOUT_MS = 120_000; // 2 minutes for interactive login
    const gcloudBin = await resolveGcloudPath();
    assertSafeGcloudPath(gcloudBin);
    return new Promise((resolve) => {
      try {
        const child = spawn(gcloudBin, ['auth', 'application-default', 'login'], {
          stdio: 'inherit',
          ...(process.platform === 'win32' ? { shell: true } : {}),
        });

        const timer = setTimeout(() => {
          child.kill();
          resolve({ success: false, error: 'gcloud login timed out after 2 minutes' });
        }, TIMEOUT_MS);

        child.on('close', (code) => {
          clearTimeout(timer);
          if (code === 0) {
            // Recreate auth instance to pick up new credentials
            this.auth = new GoogleAuth({
              scopes: ['https://www.googleapis.com/auth/cloud-platform'],
            });
            resolve({ success: true });
          } else {
            resolve({ success: false, error: `gcloud exited with code ${code}` });
          }
        });

        child.on('error', (err) => {
          clearTimeout(timer);
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
        resolve({
          success: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });
  }

  async logout(): Promise<{ success: boolean; error?: string }> {
    const gcloudBin = await resolveGcloudPath();
    assertSafeGcloudPath(gcloudBin);
    return new Promise((resolve) => {
      try {
        const child = spawn(gcloudBin, ['auth', 'application-default', 'revoke', '--quiet'], {
          stdio: 'inherit',
          ...(process.platform === 'win32' ? { shell: true } : {}),
        });

        const timer = setTimeout(() => {
          child.kill();
          // Even if revoke times out, reset the local auth instance
          this.auth = new GoogleAuth({
            scopes: ['https://www.googleapis.com/auth/cloud-platform'],
          });
          resolve({ success: true });
        }, 30_000);

        child.on('close', () => {
          clearTimeout(timer);
          // Reset auth instance so next checkAuth picks up new (or no) credentials
          this.auth = new GoogleAuth({
            scopes: ['https://www.googleapis.com/auth/cloud-platform'],
          });
          resolve({ success: true });
        });

        child.on('error', (err) => {
          clearTimeout(timer);
          // Still reset auth even if revoke command fails
          this.auth = new GoogleAuth({
            scopes: ['https://www.googleapis.com/auth/cloud-platform'],
          });
          resolve({ success: true });
        });
      } catch {
        this.auth = new GoogleAuth({
          scopes: ['https://www.googleapis.com/auth/cloud-platform'],
        });
        resolve({ success: true });
      }
    });
  }

  getAuth(): GoogleAuth {
    return this.auth;
  }
}

export function getGCPAuthManager(): GCPAuthManager {
  if (!authInstance) {
    authInstance = new GCPAuthManager();
  }
  return authInstance;
}

// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import fs from 'fs';
import path from 'path';
import os from 'os';
import { GoogleAuth } from 'google-auth-library';
import type { GCPCredentialManager } from './credential-manager';

const SCOPES = ['https://www.googleapis.com/auth/cloud-platform'];

let activeAccountId: string | null = null;
let activeAuth: GoogleAuth | null = null;
let credentialManagerRef: GCPCredentialManager | null = null;
let activeTempCredFile: string | null = null;

/** Set the credential manager reference (called once at app startup) */
export function setGCPCredentialManagerRef(cm: GCPCredentialManager): void {
  credentialManagerRef = cm;
}

/** Set the active GCP account (forces re-creation of GoogleAuth on next call) */
export function setActiveGCPProject(accountId: string): void {
  activeAccountId = accountId;
  activeAuth = null;
  activateCredentialsForAccount(accountId);
}

/**
 * Write decrypted credentials to a temp file and set GOOGLE_APPLICATION_CREDENTIALS.
 * This makes ALL @google-cloud/* SDK clients use the correct credentials
 * without modifying their constructors.
 * The temp file is written with restrictive permissions (0600).
 */
function activateCredentialsForAccount(accountId: string): void {
  cleanupTempCredFile();

  if (!credentialManagerRef) return;

  const creds = credentialManagerRef.getDecryptedCredentials(accountId);
  if (!creds) {
    // No stored credentials — clear env var, fall back to ADC
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    return;
  }

  // Write to temp file with restricted permissions
  const tempDir = path.join(os.tmpdir(), 'turul-gcp-creds');
  fs.mkdirSync(tempDir, { recursive: true, mode: 0o700 });
  const tempFile = path.join(tempDir, `${accountId}.json`);
  fs.writeFileSync(tempFile, JSON.stringify(creds), { encoding: 'utf-8', mode: 0o600 });

  activeTempCredFile = tempFile;
  process.env.GOOGLE_APPLICATION_CREDENTIALS = tempFile;
}

/**
 * Get a GoogleAuth instance for the active account.
 * Falls back to standard ADC auto-discovery if no stored credentials exist.
 */
export function getGoogleAuth(): GoogleAuth {
  if (activeAuth) return activeAuth;
  activeAuth = new GoogleAuth({ scopes: SCOPES });
  return activeAuth;
}

/** Clear the active auth instance and temp credentials (call on logout or account switch) */
export function resetActiveGCPAuth(): void {
  activeAuth = null;
  activeAccountId = null;
  cleanupTempCredFile();
  delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
}

/** Delete the temporary credentials file */
function cleanupTempCredFile(): void {
  if (activeTempCredFile) {
    try {
      fs.unlinkSync(activeTempCredFile);
    } catch {
      // File may already be deleted
    }
    activeTempCredFile = null;
  }
}

/** Clean up the entire temp credentials directory */
export function cleanupAllTempCredFiles(): void {
  cleanupTempCredFile();
  const tempDir = path.join(os.tmpdir(), 'turul-gcp-creds');
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch {
    // Best effort
  }
  delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
}

/** Get the currently active account ID */
export function getActiveGCPAccountId(): string | null {
  return activeAccountId;
}

/**
 * Activate the first available stored account credentials.
 * Used on startup/restart when no account has been explicitly activated yet.
 * Returns true if credentials were successfully activated.
 */
export function activateFirstAvailableProject(): boolean {
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) return true; // already active
  if (!credentialManagerRef) return false;
  const accounts = credentialManagerRef.listCredentials();
  if (accounts.length === 0) return false;
  const first = accounts[0];
  activateCredentialsForAccount(first.accountId);
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    activeAccountId = first.accountId;
    return true;
  }
  return false;
}

// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import type { DatabaseManager } from '../database/db-manager';
import type { AuthService } from '../auth/auth-service';
import { encryptToString, decryptFromString } from '../auth/crypto-service';
import type { GCPAccountSummary } from '../../shared/types';

/**
 * Manages encrypted GCP credentials per account.
 * Credentials are encrypted with the user's password-derived key
 * and stored in the SQLite gcp_credentials table.
 */
export class GCPCredentialManager {
  constructor(
    private dbManager: DatabaseManager,
    private authService: AuthService
  ) {}

  /** Encrypt and store ADC credentials for an account */
  storeCredentials(accountId: string, adcJson: string, googleEmail?: string, label?: string): void {
    const encKey = this.authService.getEncryptionKey();
    const encrypted = encryptToString(adcJson, encKey);
    this.dbManager.createGCPCredential(accountId, encrypted, label, googleEmail);
  }

  /** Decrypt and return credentials for an account (in memory only) */
  getDecryptedCredentials(accountId: string): Record<string, unknown> | null {
    const row = this.dbManager.getGCPCredentialByProjectId(accountId);
    if (!row) return null;

    try {
      const encKey = this.authService.getEncryptionKey();
      const json = decryptFromString(row.encrypted_credentials, encKey);
      return JSON.parse(json);
    } catch {
      return null;
    }
  }

  /** List all stored GCP accounts (summaries only, no secrets) */
  listCredentials(): GCPAccountSummary[] {
    const rows = this.dbManager.getAllGCPCredentials();
    return rows.map(r => ({
      accountId: r.project_id,
      label: r.label,
      googleEmail: r.google_email,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  /** Check if credentials exist for an account */
  hasCredentials(accountId: string): boolean {
    return this.dbManager.getGCPCredentialByProjectId(accountId) !== null;
  }

  /** Delete credentials for an account */
  deleteCredentials(accountId: string): void {
    this.dbManager.deleteGCPCredential(accountId);
  }

  /** Update the label for an account */
  updateLabel(accountId: string, label: string): void {
    this.dbManager.updateGCPCredentialLabel(accountId, label);
  }
}

// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { safeStorage, systemPreferences } from 'electron';
import type { DatabaseManager } from '../database/db-manager';

export class BiometricService {
  constructor(private dbManager: DatabaseManager) {}

  isBiometricAvailable(): boolean {
    if (process.platform === 'darwin') {
      try {
        return (
          systemPreferences.canPromptTouchID() &&
          safeStorage.isEncryptionAvailable()
        );
      } catch {
        return false;
      }
    }
    // Windows Hello / Linux: not supported in v1
    return false;
  }

  getBiometricType(): 'touchid' | 'none' {
    if (process.platform === 'darwin') {
      try {
        if (systemPreferences.canPromptTouchID()) {
          return 'touchid';
        }
      } catch {
        // fall through
      }
    }
    return 'none';
  }

  isBiometricEnabled(): boolean {
    try {
      const val = this.dbManager.getSetting('biometric_enabled');
      return val === 'true';
    } catch {
      return false;
    }
  }

  async enableBiometric(encryptionKey: Buffer): Promise<void> {
    if (!this.isBiometricAvailable()) {
      throw new Error('Biometric authentication is not available on this device');
    }

    // Convert key to hex and encrypt via OS keychain
    const hexKey = encryptionKey.toString('hex');
    const encryptedBlob = safeStorage.encryptString(hexKey);

    // Store encrypted blob as base64 in settings
    this.dbManager.setSetting('biometric_key_blob', encryptedBlob.toString('base64'));
    this.dbManager.setSetting('biometric_enabled', 'true');
  }

  disableBiometric(): void {
    try {
      this.dbManager.setSetting('biometric_enabled', 'false');
      this.dbManager.setSetting('biometric_key_blob', '');
    } catch {
      // Best effort cleanup
    }
  }

  async authenticateWithBiometric(): Promise<Buffer> {
    if (!this.isBiometricEnabled()) {
      throw new Error('Biometric authentication is not enabled');
    }

    // Gate: require Touch ID verification
    try {
      await systemPreferences.promptTouchID('Unlock Turul');
    } catch {
      throw new Error('Touch ID authentication was cancelled or failed');
    }

    // Retrieve and decrypt the encryption key
    const blob = this.dbManager.getSetting('biometric_key_blob');
    if (!blob) {
      this.disableBiometric();
      throw new Error('Biometric key data not found. Please log in with your password.');
    }

    try {
      const hexKey = safeStorage.decryptString(Buffer.from(blob, 'base64'));
      return Buffer.from(hexKey, 'hex');
    } catch {
      // Corrupt blob or keychain reset — auto-disable and fall back
      this.disableBiometric();
      throw new Error('Biometric key data is invalid. Biometric login has been disabled. Please log in with your password.');
    }
  }

  async updateKeyBlob(newEncryptionKey: Buffer): Promise<void> {
    if (!this.isBiometricEnabled()) return;

    try {
      const hexKey = newEncryptionKey.toString('hex');
      const encryptedBlob = safeStorage.encryptString(hexKey);
      this.dbManager.setSetting('biometric_key_blob', encryptedBlob.toString('base64'));
    } catch {
      // If re-encryption fails, disable biometric silently
      this.disableBiometric();
    }
  }
}

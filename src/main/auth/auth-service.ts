// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import crypto from 'crypto';
import type { DatabaseManager } from '../database/db-manager';
import { encrypt, decrypt, type EncryptedData } from './crypto-service';
import type { BiometricService } from './biometric-service';

const SCRYPT_KEYLEN = 64;
const SCRYPT_N = 16384; // 2^14 — compatible with Node 22+ OpenSSL memory limits
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const ENCRYPTION_KEY_LENGTH = 32; // 256 bits for AES-256

// Legacy params for migrating existing hashes (N=65536 fails on Node 22+)
const LEGACY_SCRYPT_N = 65536;

// Rate limiting
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATIONS_MS = [0, 0, 0, 0, 0, 30_000, 60_000, 300_000, 600_000];

// Session timeout
const SESSION_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes
const SESSION_CHECK_INTERVAL_MS = 60_000; // check every 60 seconds

export class AuthService {
  private dbManager: DatabaseManager;
  private encryptionKey: Buffer | null = null;

  // Rate limiting state
  private failedAttempts = 0;
  private lockoutUntil = 0;

  // Session timeout state
  private lastActivity = 0;
  private sessionTimer: ReturnType<typeof setInterval> | null = null;
  private onSessionTimeoutCallback: (() => void) | null = null;
  private changingPassword = false;
  private biometricService: BiometricService | null = null;

  constructor(dbManager: DatabaseManager) {
    this.dbManager = dbManager;
  }

  setBiometricService(svc: BiometricService): void {
    this.biometricService = svc;
  }

  /** Register a callback to fire when session expires (auto-lock). */
  onSessionTimeout(callback: () => void): void {
    this.onSessionTimeoutCallback = callback;
  }

  isSetup(): boolean {
    const hash = this.dbManager.getSetting('password_hash');
    return hash !== null;
  }

  isAuthenticated(): boolean {
    if (!this.encryptionKey) return false;
    // Check session timeout
    if (this.lastActivity > 0 && Date.now() - this.lastActivity > SESSION_TIMEOUT_MS) {
      this.logout();
      return false;
    }
    return true;
  }

  getEncryptionKey(): Buffer {
    if (!this.encryptionKey) {
      throw new Error('Not authenticated');
    }
    return this.encryptionKey;
  }

  touchActivity(): void {
    if (this.encryptionKey) {
      this.lastActivity = Date.now();
    }
  }

  async setup(password: string, confirmPassword: string): Promise<void> {
    if (this.isSetup()) {
      throw new Error('Password is already set up');
    }

    if (password !== confirmPassword) {
      throw new Error('Passwords do not match');
    }

    if (password.length < 12) {
      throw new Error('Password must be at least 12 characters');
    }

    const passwordSalt = crypto.randomBytes(32).toString('hex');
    const encryptionSalt = crypto.randomBytes(32).toString('hex');

    const hash = this.hashPassword(password, passwordSalt);

    this.dbManager.setSetting('password_hash', hash);
    this.dbManager.setSetting('password_salt', passwordSalt);
    this.dbManager.setSetting('encryption_salt', encryptionSalt);

    this.encryptionKey = this.deriveEncryptionKey(password, encryptionSalt);
    this.lastActivity = Date.now();
    this.startSessionTimer();
  }

  async login(password: string): Promise<void> {
    if (!this.isSetup()) {
      throw new Error('Authentication failed');
    }

    // Rate limiting check
    if (this.failedAttempts >= MAX_FAILED_ATTEMPTS && Date.now() < this.lockoutUntil) {
      const remainingSec = Math.ceil((this.lockoutUntil - Date.now()) / 1000);
      throw new Error(`Too many failed attempts. Try again in ${remainingSec} seconds.`);
    }

    const storedHash = this.dbManager.getSetting('password_hash')!;
    const passwordSalt = this.dbManager.getSetting('password_salt')!;
    const encryptionSalt = this.dbManager.getSetting('encryption_salt')!;

    // Try current params first, then legacy (N=65536) for passwords set on older Node versions
    let matchedN: number | null = null;
    for (const n of [SCRYPT_N, LEGACY_SCRYPT_N]) {
      try {
        const hash = this.hashPassword(password, passwordSalt, n);
        const hashBuffer = Buffer.from(hash, 'hex');
        const storedBuffer = Buffer.from(storedHash, 'hex');
        if (hashBuffer.length === storedBuffer.length && crypto.timingSafeEqual(hashBuffer, storedBuffer)) {
          matchedN = n;
          break;
        }
      } catch {
        // scrypt params failed (e.g. memory limit) — try next
      }
    }

    if (matchedN === null) {
      // Track failed attempt
      this.failedAttempts++;
      const lockoutIndex = Math.min(this.failedAttempts, LOCKOUT_DURATIONS_MS.length - 1);
      const lockoutMs = LOCKOUT_DURATIONS_MS[lockoutIndex];
      if (lockoutMs > 0) {
        this.lockoutUntil = Date.now() + lockoutMs;
      }
      throw new Error('Authentication failed');
    }

    // Success: reset rate limiter
    this.failedAttempts = 0;
    this.lockoutUntil = 0;

    // If matched with legacy params, transparently rehash with current params
    if (matchedN !== SCRYPT_N) {
      const oldKey = this.deriveEncryptionKey(password, encryptionSalt, matchedN);
      const newHash = this.hashPassword(password, passwordSalt, SCRYPT_N);
      const newKey = this.deriveEncryptionKey(password, encryptionSalt, SCRYPT_N);
      // Re-encrypt all profiles and update password hash atomically
      try {
        this.dbManager.changePasswordAtomic(oldKey, newKey, newHash, passwordSalt, encryptionSalt);
      } catch (err) {
        console.warn('[auth] Legacy migration failed — will retry on next login:', err instanceof Error ? err.message : String(err));
        // Fall back: use the old key so credentials remain accessible this session
        this.encryptionKey = this.deriveEncryptionKey(password, encryptionSalt, matchedN);
        this.lastActivity = Date.now();
        this.startSessionTimer();
        return;
      }
      this.encryptionKey = this.deriveEncryptionKey(password, encryptionSalt, SCRYPT_N);
    } else {
      this.encryptionKey = this.deriveEncryptionKey(password, encryptionSalt);
    }

    this.lastActivity = Date.now();
    this.startSessionTimer();
  }

  async loginWithBiometric(encryptionKey: Buffer): Promise<void> {
    if (!this.isSetup()) {
      throw new Error('Authentication failed');
    }
    // Biometric already verified identity — just restore the encryption key
    this.encryptionKey = encryptionKey;
    this.failedAttempts = 0;
    this.lockoutUntil = 0;
    this.lastActivity = Date.now();
    this.startSessionTimer();
  }

  logout(): void {
    this.stopSessionTimer();
    if (this.encryptionKey) {
      this.encryptionKey.fill(0);
      this.encryptionKey = null;
    }
    this.lastActivity = 0;
  }

  async changePassword(
    currentPassword: string,
    newPassword: string,
    confirmNewPassword: string
  ): Promise<void> {
    if (this.changingPassword) {
      throw new Error('Password change already in progress');
    }
    this.changingPassword = true;
    try {
      await this._changePasswordInternal(currentPassword, newPassword, confirmNewPassword);
    } finally {
      this.changingPassword = false;
    }
  }

  private async _changePasswordInternal(
    currentPassword: string,
    newPassword: string,
    confirmNewPassword: string
  ): Promise<void> {
    if (!this.isSetup()) {
      throw new Error('Authentication failed');
    }

    if (newPassword !== confirmNewPassword) {
      throw new Error('New passwords do not match');
    }

    if (newPassword.length < 12) {
      throw new Error('Password must be at least 12 characters');
    }

    // Verify current password
    const storedHash = this.dbManager.getSetting('password_hash')!;
    const passwordSalt = this.dbManager.getSetting('password_salt')!;
    const oldEncryptionSalt = this.dbManager.getSetting('encryption_salt')!;

    const currentHash = this.hashPassword(currentPassword, passwordSalt);
    const currentBuffer = Buffer.from(currentHash, 'hex');
    const storedBuffer = Buffer.from(storedHash, 'hex');

    if (currentBuffer.length !== storedBuffer.length || !crypto.timingSafeEqual(currentBuffer, storedBuffer)) {
      throw new Error('Current password is incorrect');
    }

    const oldKey = this.deriveEncryptionKey(currentPassword, oldEncryptionSalt);

    // Generate new salts and keys
    const newPasswordSalt = crypto.randomBytes(32).toString('hex');
    const newEncryptionSalt = crypto.randomBytes(32).toString('hex');
    const newHash = this.hashPassword(newPassword, newPasswordSalt);
    const newKey = this.deriveEncryptionKey(newPassword, newEncryptionSalt);

    // Atomic: re-encrypt all profiles + update settings in one transaction
    this.dbManager.changePasswordAtomic(
      oldKey,
      newKey,
      newHash,
      newPasswordSalt,
      newEncryptionSalt
    );

    // Update in-memory key
    if (this.encryptionKey) {
      this.encryptionKey.fill(0);
    }
    this.encryptionKey = newKey;
    this.lastActivity = Date.now();

    // Re-encrypt biometric key blob with new key
    if (this.biometricService) {
      await this.biometricService.updateKeyBlob(newKey);
    }

    // Zero old key
    oldKey.fill(0);
  }

  private startSessionTimer(): void {
    this.stopSessionTimer();
    this.sessionTimer = setInterval(() => {
      if (this.encryptionKey && this.lastActivity > 0) {
        if (Date.now() - this.lastActivity > SESSION_TIMEOUT_MS) {
          this.logout();
          if (this.onSessionTimeoutCallback) {
            this.onSessionTimeoutCallback();
          }
        }
      }
    }, SESSION_CHECK_INTERVAL_MS);
  }

  private stopSessionTimer(): void {
    if (this.sessionTimer) {
      clearInterval(this.sessionTimer);
      this.sessionTimer = null;
    }
  }

  private hashPassword(password: string, salt: string, n: number = SCRYPT_N): string {
    const saltBuffer = Buffer.from(salt, 'hex');
    const hash = crypto.scryptSync(password, saltBuffer, SCRYPT_KEYLEN, {
      N: n,
      r: SCRYPT_R,
      p: SCRYPT_P,
      maxmem: 128 * n * SCRYPT_R * 2,
    });
    return hash.toString('hex');
  }

  private deriveEncryptionKey(password: string, salt: string, n: number = SCRYPT_N): Buffer {
    const saltBuffer = Buffer.from(salt, 'hex');
    return crypto.scryptSync(password, saltBuffer, ENCRYPTION_KEY_LENGTH, {
      N: n,
      r: SCRYPT_R,
      p: SCRYPT_P,
      maxmem: 128 * n * SCRYPT_R * 2,
    });
  }
}

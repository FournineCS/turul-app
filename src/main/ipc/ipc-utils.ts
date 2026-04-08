// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

/**
 * Shared IPC utilities used across handler modules.
 */

import type { AWSProfile } from '../../shared/types';
import type { AuthService } from '../auth/auth-service';

let authServiceRef: AuthService | null = null;

export function setAuthServiceRef(service: AuthService): void {
  authServiceRef = service;
}

/** Guard: reject if user is not authenticated. */
export function requireAuth(): void {
  if (!authServiceRef || !authServiceRef.isAuthenticated()) {
    throw new Error('Not authenticated');
  }
}

/** Strip sensitive credential fields before sending AWSProfile to renderer. */
export function stripSecrets(profiles: AWSProfile[]): AWSProfile[] {
  return profiles.map(({ secretAccessKey, sessionToken, ...safe }) => safe);
}

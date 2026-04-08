// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

/**
 * Centralized gcloud CLI path resolver.
 * Single source of truth for finding the gcloud binary across platforms.
 */

import { existsSync, accessSync, constants } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import type { DatabaseManager } from '../database/db-manager';

let cachedPath: string | null = null;
let dbRef: DatabaseManager | null = null;

/** Inject the DB dependency at startup (before health checks run). */
export function setGcloudResolverDB(db: DatabaseManager): void {
  dbRef = db;
}

/** Clear cached result — call after the user changes the gcloud path setting. */
export function clearGcloudCache(): void {
  cachedPath = null;
}

/**
 * Resolve the gcloud binary path. Resolution order:
 * 1. User-configured `app.gcloudPath` from SQLite (if set and executable)
 * 2. Platform-specific known paths
 * 3. Bare `'gcloud'` as last resort
 */
export async function resolveGcloudPath(): Promise<string> {
  if (cachedPath) return cachedPath;

  // 1. User-configured path from DB
  if (dbRef) {
    try {
      const userPath = dbRef.getSetting('app.gcloudPath');
      if (userPath && isExecutable(userPath)) {
        cachedPath = userPath;
        return cachedPath;
      }
    } catch {
      // DB not ready or read error — fall through
    }
  }

  // 2. Platform-specific known paths
  const candidates = getPlatformCandidates();
  for (const candidate of candidates) {
    if (isExecutable(candidate)) {
      cachedPath = candidate;
      return cachedPath;
    }
  }

  // 3. Bare 'gcloud' as last resort (relies on PATH)
  cachedPath = 'gcloud';
  return cachedPath;
}

function getPlatformCandidates(): string[] {
  const home = homedir();

  switch (process.platform) {
    case 'darwin':
      return [
        '/usr/local/bin/gcloud',
        '/opt/homebrew/bin/gcloud',
        join(home, 'google-cloud-sdk', 'bin', 'gcloud'),
        '/usr/local/Caskroom/google-cloud-sdk/latest/google-cloud-sdk/bin/gcloud',
        '/opt/homebrew/share/google-cloud-sdk/bin/gcloud',
      ];

    case 'win32': {
      const programFiles = process.env.ProgramFiles || 'C:\\Program Files';
      const programFilesX86 = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
      const localAppData = process.env.LOCALAPPDATA || join(home, 'AppData', 'Local');
      return [
        join(programFiles, 'Google', 'Cloud SDK', 'google-cloud-sdk', 'bin', 'gcloud.cmd'),
        join(programFilesX86, 'Google', 'Cloud SDK', 'google-cloud-sdk', 'bin', 'gcloud.cmd'),
        join(localAppData, 'Google', 'Cloud SDK', 'google-cloud-sdk', 'bin', 'gcloud.cmd'),
        join(home, 'google-cloud-sdk', 'bin', 'gcloud.cmd'),
      ];
    }

    case 'linux':
      return [
        '/usr/bin/gcloud',
        '/usr/local/bin/gcloud',
        '/snap/bin/gcloud',
        join(home, 'google-cloud-sdk', 'bin', 'gcloud'),
      ];

    default:
      return [];
  }
}

function isExecutable(filePath: string): boolean {
  try {
    if (!existsSync(filePath)) return false;
    // On Windows, existence is sufficient (no X_OK bit)
    if (process.platform === 'win32') return true;
    accessSync(filePath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

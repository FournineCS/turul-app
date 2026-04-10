// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

/**
 * Centralized Claude Code CLI path resolver.
 * Mirrors gcloud-resolver.ts — single source of truth for finding the claude binary.
 */

import { existsSync, accessSync, constants } from 'fs';
import { homedir } from 'os';
import { join, dirname } from 'path';
import type { DatabaseManager } from '../database/db-manager';

let cachedPath: string | null = null;
let dbRef: DatabaseManager | null = null;

/** Inject the DB dependency at startup. */
export function setClaudeResolverDB(db: DatabaseManager): void {
  dbRef = db;
}

/** Clear cached result — call after the user changes the claude path setting. */
export function clearClaudeCache(): void {
  cachedPath = null;
}

/**
 * Resolve the claude binary path. Resolution order:
 * 1. User-configured `app.claudePath` from SQLite (if set and executable)
 * 2. Platform-specific known paths
 * 3. Bare `'claude'` as last resort
 */
export function resolveClaudePath(): string {
  if (cachedPath) return cachedPath;

  // 1. User-configured path from DB
  if (dbRef) {
    try {
      const userPath = dbRef.getSetting('app.claudePath');
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

  // 3. Bare 'claude' as last resort (relies on PATH)
  cachedPath = 'claude';
  return cachedPath;
}

/**
 * Ensure the resolved claude binary's directory is in process.env.PATH.
 * This is necessary because the Claude Agent SDK spawns `claude` via PATH
 * and has no cliPath option.
 */
export function ensureClaudeOnPath(): void {
  const resolved = resolveClaudePath();
  if (resolved === 'claude') return; // bare name, nothing to prepend

  const dir = dirname(resolved);
  const currentPath = process.env.PATH || '';
  const sep = process.platform === 'win32' ? ';' : ':';

  if (!currentPath.split(sep).includes(dir)) {
    process.env.PATH = `${dir}${sep}${currentPath}`;
  }
}

function getPlatformCandidates(): string[] {
  const home = homedir();

  switch (process.platform) {
    case 'darwin':
      return [
        join(home, '.local', 'bin', 'claude'),
        join(home, '.claude', 'local', 'claude'),
        '/usr/local/bin/claude',
        '/opt/homebrew/bin/claude',
        join(home, '.npm-global', 'bin', 'claude'),
      ];

    case 'win32': {
      const localAppData = process.env.LOCALAPPDATA || join(home, 'AppData', 'Local');
      return [
        join(localAppData, 'Programs', 'claude', 'claude.exe'),
        join(home, '.local', 'bin', 'claude.exe'),
        join(home, '.npm-global', 'claude.cmd'),
      ];
    }

    case 'linux':
      return [
        join(home, '.local', 'bin', 'claude'),
        join(home, '.claude', 'local', 'claude'),
        '/usr/local/bin/claude',
        join(home, '.npm-global', 'bin', 'claude'),
      ];

    default:
      return [];
  }
}

function isExecutable(filePath: string): boolean {
  try {
    if (!existsSync(filePath)) return false;
    if (process.platform === 'win32') return true;
    accessSync(filePath, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

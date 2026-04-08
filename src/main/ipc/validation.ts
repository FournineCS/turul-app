// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

/**
 * Runtime input validation for IPC handlers.
 * TypeScript types are compile-time only — these checks protect against
 * malformed data from a compromised renderer or unexpected input shapes.
 */

import path from 'path';

export function assertString(
  val: unknown,
  field: string,
  minLen = 1,
  maxLen = 256
): string {
  if (typeof val !== 'string') {
    throw new Error(`${field} must be a string`);
  }
  if (val.length < minLen) {
    throw new Error(`${field} must be at least ${minLen} character(s)`);
  }
  if (val.length > maxLen) {
    throw new Error(`${field} must be at most ${maxLen} characters`);
  }
  return val;
}

export function assertOptionalString(
  val: unknown,
  field: string,
  maxLen = 1024
): string | undefined {
  if (val === undefined || val === null || val === '') {
    return undefined;
  }
  if (typeof val !== 'string') {
    throw new Error(`${field} must be a string`);
  }
  if (val.length > maxLen) {
    throw new Error(`${field} must be at most ${maxLen} characters`);
  }
  return val;
}

export function assertOneOf<T extends string>(
  val: unknown,
  allowed: readonly T[],
  field: string
): T {
  if (typeof val !== 'string' || !(allowed as readonly string[]).includes(val)) {
    throw new Error(`${field} must be one of: ${allowed.join(', ')}`);
  }
  return val as T;
}

const PROFILE_NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_. -]*$/;

export function assertProfileName(val: unknown, field = 'name'): string {
  const name = assertString(val, field, 1, 100);
  if (!PROFILE_NAME_PATTERN.test(name)) {
    throw new Error(`${field} may only contain letters, numbers, hyphens, underscores, dots, and spaces`);
  }
  return name;
}

export function assertNumber(
  val: unknown,
  field: string,
  min = 0,
  max = Number.MAX_SAFE_INTEGER
): number {
  if (typeof val !== 'number' || !Number.isFinite(val)) {
    throw new Error(`${field} must be a number`);
  }
  if (val < min || val > max) {
    throw new Error(`${field} must be between ${min} and ${max}`);
  }
  return val;
}

export function assertOptionalNumber(
  val: unknown,
  field: string,
  min = 0,
  max = Number.MAX_SAFE_INTEGER
): number | undefined {
  if (val === undefined || val === null) return undefined;
  return assertNumber(val, field, min, max);
}

export function assertBoolean(val: unknown, field: string): boolean {
  if (typeof val !== 'boolean') {
    throw new Error(`${field} must be a boolean`);
  }
  return val;
}

export function assertArray(val: unknown, field: string): unknown[] {
  if (!Array.isArray(val)) {
    throw new Error(`${field} must be an array`);
  }
  return val;
}

export function assertStringArray(val: unknown, field: string, maxItems = 100): string[] {
  const arr = assertArray(val, field);
  if (arr.length > maxItems) {
    throw new Error(`${field} has too many items (max ${maxItems})`);
  }
  for (let i = 0; i < arr.length; i++) {
    if (typeof arr[i] !== 'string') {
      throw new Error(`${field}[${i}] must be a string`);
    }
  }
  return arr as string[];
}

/** Reject path traversal — the resolved path must stay within the given base. */
export function assertSafePath(outputPath: string, field = 'outputPath'): string {
  const resolved = path.resolve(outputPath);
  // Canonical path check: resolve symlinks and encoded sequences
  if (outputPath.includes('..') || outputPath.includes('%2e') || outputPath.includes('%2E')) {
    throw new Error(`${field} must not contain path traversal sequences`);
  }
  return resolved;
}

const ALLOWED_SAVE_EXTENSIONS = new Set(['pdf', 'png', 'jpg', 'jpeg', 'xlsx', 'csv', 'svg', 'txt']);

export function assertSafeFileExtension(filename: string, field = 'filename'): string {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  if (!ALLOWED_SAVE_EXTENSIONS.has(ext)) {
    throw new Error(`${field} has unsupported file extension: .${ext}`);
  }
  return ext;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function assertUUID(val: unknown, field: string): string {
  const s = assertString(val, field, 36, 36);
  if (!UUID_PATTERN.test(s)) {
    throw new Error(`${field} must be a valid UUID`);
  }
  return s;
}

/** ISO-8601 date string yyyy-mm-dd */
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function assertDateString(val: unknown, field: string): string {
  const s = assertString(val, field, 10, 10);
  if (!DATE_PATTERN.test(s)) {
    throw new Error(`${field} must be a date in YYYY-MM-DD format`);
  }
  return s;
}

export function assertObject(val: unknown, field: string): Record<string, unknown> {
  if (val === null || typeof val !== 'object' || Array.isArray(val)) {
    throw new Error(`${field} must be an object`);
  }
  return val as Record<string, unknown>;
}

// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import type { DatabaseManager } from '../../database/db-manager';
import type { GCPOptimizationSnapshot } from '../../../shared/types/common';

export function saveOptimizationSnapshot(
  dbManager: DatabaseManager,
  snapshot: GCPOptimizationSnapshot
): void {
  dbManager.saveGCPOptimizationSnapshot(snapshot);
}

export function listOptimizationSnapshots(
  dbManager: DatabaseManager,
  identity: string,
  limit = 20
): GCPOptimizationSnapshot[] {
  return dbManager.listGCPOptimizationSnapshots(identity, limit);
}

export function getOptimizationSnapshot(
  dbManager: DatabaseManager,
  id: string
): GCPOptimizationSnapshot | null {
  return dbManager.getGCPOptimizationSnapshot(id);
}

export function deleteOptimizationSnapshot(
  dbManager: DatabaseManager,
  id: string
): void {
  dbManager.deleteGCPOptimizationSnapshot(id);
}

// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import type { DatabaseManager } from '../../database/db-manager';
import type { GCPCostCacheEntry } from '../../../shared/types/common';

export function saveCostCacheEntry(dbManager: DatabaseManager, entry: GCPCostCacheEntry): void {
  dbManager.saveGCPCostCacheEntry(entry);
}

export function listCostCacheEntries(dbManager: DatabaseManager, identity: string, dataType: string, limit?: number): GCPCostCacheEntry[] {
  return dbManager.listGCPCostCacheEntries(identity, dataType, limit);
}

export function getCostCacheEntry(dbManager: DatabaseManager, id: string): GCPCostCacheEntry | null {
  return dbManager.getGCPCostCacheEntry(id);
}

export function getLatestCostCacheEntry(dbManager: DatabaseManager, identity: string, dataType: string): GCPCostCacheEntry | null {
  return dbManager.getLatestGCPCostCacheEntry(identity, dataType);
}

export function deleteCostCacheEntry(dbManager: DatabaseManager, id: string): void {
  dbManager.deleteGCPCostCacheEntry(id);
}

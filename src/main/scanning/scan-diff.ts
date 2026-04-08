// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import type { Resource } from '../../shared/types';

export type DiffStatus = 'added' | 'removed' | 'changed' | 'unchanged';

export interface DiffField {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

export interface DiffResource {
  resourceId: string; // ARN
  name: string;
  service: string;
  region: string;
  status: DiffStatus;
  changedFields: DiffField[];
}

export interface ScanDiffResult {
  scanIdA: string;
  scanIdB: string;
  added: DiffResource[];
  removed: DiffResource[];
  changed: DiffResource[];
  unchanged: number;
  summary: {
    totalA: number;
    totalB: number;
    addedCount: number;
    removedCount: number;
    changedCount: number;
    unchangedCount: number;
  };
}

function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a == null || b == null) return a === b;
  if (typeof a !== typeof b) return false;
  if (typeof a !== 'object') return false;

  const aObj = a as Record<string, unknown>;
  const bObj = b as Record<string, unknown>;

  const keysA = Object.keys(aObj);
  const keysB = Object.keys(bObj);

  if (keysA.length !== keysB.length) return false;

  for (const key of keysA) {
    if (!keysB.includes(key)) return false;
    if (!deepEqual(aObj[key], bObj[key])) return false;
  }

  return true;
}

function findChangedFields(
  dataA: Record<string, unknown>,
  dataB: Record<string, unknown>
): DiffField[] {
  const fields: DiffField[] = [];
  const allKeys = new Set([...Object.keys(dataA), ...Object.keys(dataB)]);

  for (const key of allKeys) {
    const valA = dataA[key];
    const valB = dataB[key];

    if (!deepEqual(valA, valB)) {
      fields.push({ field: key, oldValue: valA, newValue: valB });
    }
  }

  return fields;
}

/** Build a composite key for resource matching across services */
function resourceKey(r: Resource): string {
  return `${r.service}:${r.resourceType}:${r.id}`;
}

export function diffScans(
  resourcesA: Resource[],
  resourcesB: Resource[]
): ScanDiffResult {
  // Build maps keyed by composite key (service:resourceType:id)
  // to avoid collisions between different resource types with the same id
  const mapA = new Map<string, Resource>();
  const mapB = new Map<string, Resource>();

  for (const r of resourcesA) mapA.set(resourceKey(r), r);
  for (const r of resourcesB) mapB.set(resourceKey(r), r);

  const added: DiffResource[] = [];
  const removed: DiffResource[] = [];
  const changed: DiffResource[] = [];
  let unchangedCount = 0;

  // Find added and changed
  for (const [key, resB] of mapB) {
    const resA = mapA.get(key);

    if (!resA) {
      added.push({
        resourceId: resB.id,
        name: resB.name,
        service: resB.service,
        region: resB.region,
        status: 'added',
        changedFields: [],
      });
    } else {
      // Check for changes in data and tags
      const dataChanges = findChangedFields(resA.data, resB.data);
      const tagChanges = findChangedFields(
        resA.tags as Record<string, unknown>,
        resB.tags as Record<string, unknown>
      );

      const allChanges = [
        ...dataChanges.map((c) => ({ ...c, field: `data.${c.field}` })),
        ...tagChanges.map((c) => ({ ...c, field: `tags.${c.field}` })),
      ];

      if (allChanges.length > 0) {
        changed.push({
          resourceId: resB.id,
          name: resB.name,
          service: resB.service,
          region: resB.region,
          status: 'changed',
          changedFields: allChanges.slice(0, 20), // Limit to 20 fields for readability
        });
      } else {
        unchangedCount++;
      }
    }
  }

  // Find removed
  for (const [key, resA] of mapA) {
    if (!mapB.has(key)) {
      removed.push({
        resourceId: resA.id,
        name: resA.name,
        service: resA.service,
        region: resA.region,
        status: 'removed',
        changedFields: [],
      });
    }
  }

  return {
    scanIdA: resourcesA[0]?.scanId || '',
    scanIdB: resourcesB[0]?.scanId || '',
    added,
    removed,
    changed,
    unchanged: unchangedCount,
    summary: {
      totalA: resourcesA.length,
      totalB: resourcesB.length,
      addedCount: added.length,
      removedCount: removed.length,
      changedCount: changed.length,
      unchangedCount,
    },
  };
}

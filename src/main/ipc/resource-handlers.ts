// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

/**
 * Provider-agnostic IPC handlers: scan:get-all, scan:get-by-id, resources:*,
 * topology:*, comparison:*, report:*, db:*.
 */

import { ipcMain, BrowserWindow } from 'electron';
import type {
  IpcResponse,
  ReportConfig,
  DiagramGraph,
  DiagramViewMode,
  ScanDiffResult,
  Resource,
} from '../../shared/types';
import { DatabaseManager } from '../database/db-manager';
import { getRelationshipBuilder } from '../scanning/relationship-builder';
import { getGCPRelationshipBuilder } from '../scanning/gcp-relationship-builder';
import { generatePdfReport } from '../reports/pdf-generator';
import { generateExcelReport } from '../reports/excel-generator';
import { generateCsvReport } from '../reports/csv-generator';
import { diffScans } from '../scanning/scan-diff';
import { requireAuth } from './ipc-utils';
import {
  assertString,
  assertOptionalNumber,
  assertOneOf,
  assertStringArray,
  assertSafePath,
  assertObject,
} from './validation';

// Helper function for JSON export
async function generateJsonReport(
  outputPath: string,
  scan: unknown,
  resources: unknown[],
  relationships: unknown[],
  _config: ReportConfig,
  progressCallback: (progress: { percent: number; stage: string }) => void
): Promise<string> {
  const fs = await import('fs/promises');
  const path = await import('path');

  progressCallback({ percent: 10, stage: 'Preparing data' });

  const data = {
    scan,
    resources,
    relationships,
    generatedAt: new Date().toISOString(),
  };

  progressCallback({ percent: 50, stage: 'Writing file' });

  const filePath = path.join(outputPath, `aws-scan-${(scan as { id: string }).id}.json`);
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');

  progressCallback({ percent: 100, stage: 'Complete' });

  return filePath;
}

export function registerResourceHandlers(dbManager: DatabaseManager): void {
  // ── Scan queries (provider-agnostic, reads from DB) ──

  ipcMain.handle('scan:get-all', async (_, cloudProvider?: unknown): Promise<IpcResponse<unknown>> => {
    try {
      requireAuth();
      if (cloudProvider && typeof cloudProvider === 'string' && (cloudProvider === 'aws' || cloudProvider === 'gcp')) {
        const scans = dbManager.getAllScansByProvider(cloudProvider);
        return { success: true, data: scans };
      }
      const scans = dbManager.getAllScans();
      return { success: true, data: scans };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get scans' };
    }
  });

  ipcMain.handle('scan:get-by-id', async (_, scanId: unknown): Promise<IpcResponse<unknown>> => {
    try {
      requireAuth();
      const id = assertString(scanId, 'scanId');
      const scan = dbManager.getScan(id);
      if (!scan) return { success: false, error: 'Scan not found' };
      return { success: true, data: scan };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get scan' };
    }
  });

  // ── Resource handlers ──

  ipcMain.handle('resources:get-by-scan', async (_, scanId: unknown): Promise<IpcResponse<unknown>> => {
    try {
      requireAuth();
      const id = assertString(scanId, 'scanId');
      const resources = dbManager.getResourcesByScan(id);
      return { success: true, data: resources };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get resources' };
    }
  });

  ipcMain.handle('resources:search', async (_, scanId: unknown, query: unknown): Promise<IpcResponse<unknown>> => {
    try {
      requireAuth();
      const id = assertString(scanId, 'scanId');
      const q = assertString(query, 'query', 0, 500);
      const resources = dbManager.searchResources(id, q);
      return { success: true, data: resources };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to search resources' };
    }
  });

  // ── Topology handlers ──

  ipcMain.handle('topology:get-graph', async (_, scanId: unknown): Promise<IpcResponse<unknown>> => {
    try {
      requireAuth();
      const id = assertString(scanId, 'scanId');
      const scan = dbManager.getScan(id);
      const resources = dbManager.getResourcesByScan(id);
      let relationships = dbManager.getRelationshipsByScan(id);
      const builder = scan?.cloudProvider === 'gcp' ? getGCPRelationshipBuilder() : getRelationshipBuilder();
      // Recompute relationships on-the-fly if none stored (legacy scans)
      if (relationships.length === 0 && resources.length > 0) {
        const computed = builder.buildRelationships(id, resources);
        if (computed.length > 0) {
          const withIds = computed.map((r, i) => ({ ...r, id: -(i + 1) }));
          relationships = withIds as typeof relationships;
        }
      }
      const graph = builder.buildTopologyGraph(resources, relationships);
      return { success: true, data: graph };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get topology' };
    }
  });

  ipcMain.handle(
    'topology:get-diagram',
    async (_, scanId: unknown, viewMode: unknown): Promise<IpcResponse<DiagramGraph>> => {
      try {
        requireAuth();
        const id = assertString(scanId, 'scanId');
        const mode = assertOneOf(viewMode, ['network', 'application', 'data', 'full'] as const, 'viewMode');
        const scan = dbManager.getScan(id);
        const resources = dbManager.getResourcesByScan(id);
        let relationships = dbManager.getRelationshipsByScan(id);
        const builder = scan?.cloudProvider === 'gcp' ? getGCPRelationshipBuilder() : getRelationshipBuilder();
        // Recompute relationships on-the-fly if none stored (legacy scans)
        if (relationships.length === 0 && resources.length > 0) {
          const computed = builder.buildRelationships(id, resources);
          if (computed.length > 0) {
            const withIds = computed.map((r, i) => ({ ...r, id: -(i + 1) }));
            relationships = withIds as typeof relationships;
          }
        }
        const graph = builder.buildDiagramGraph(resources, relationships, mode);
        return { success: true, data: graph };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to get diagram' };
      }
    }
  );

  // ── Report handlers ──

  ipcMain.handle(
    'report:generate',
    async (event, config: unknown): Promise<IpcResponse<{ filePath: string }>> => {
      try {
        requireAuth();
        const c = assertObject(config, 'config');
        const scanId = assertString(c.scanId, 'scanId');
        const format = assertOneOf(c.format, ['pdf', 'excel', 'csv', 'json'] as const, 'format');
        const outputPath = assertSafePath(assertString(c.outputPath, 'outputPath', 1, 1024), 'outputPath');
        const sections = assertStringArray(c.sections ?? [], 'sections', 20) as ReportConfig['sections'];
        const includeTopology = typeof c.includeTopology === 'boolean' ? c.includeTopology : false;

        const validatedConfig: ReportConfig = { scanId, format, sections, includeTopology, outputPath };

        const resources = dbManager.getResourcesByScan(scanId);
        const relationships = dbManager.getRelationshipsByScan(scanId);
        const scan = dbManager.getScan(scanId);

        if (!scan) return { success: false, error: 'Scan not found' };

        const window = BrowserWindow.fromWebContents(event.sender);
        const progressCallback = (progress: { percent: number; stage: string }) => {
          if (window && !window.isDestroyed()) {
            window.webContents.send('report:progress', progress);
          }
        };

        let filePath: string;

        switch (format) {
          case 'pdf':
            filePath = await generatePdfReport(outputPath, scan, resources, relationships, validatedConfig, progressCallback);
            break;
          case 'excel':
            filePath = await generateExcelReport(outputPath, scan, resources, relationships, validatedConfig, progressCallback);
            break;
          case 'csv':
            filePath = await generateCsvReport(outputPath, scan, resources, validatedConfig, progressCallback);
            break;
          case 'json':
            filePath = await generateJsonReport(outputPath, scan, resources, relationships, validatedConfig, progressCallback);
            break;
          default:
            return { success: false, error: `Unsupported format: ${format}` };
        }

        return { success: true, data: { filePath } };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to generate report' };
      }
    }
  );

  // ── Database/History ──

  ipcMain.handle(
    'db:get-scan-history',
    async (_, limit?: unknown, cloudProvider?: unknown): Promise<IpcResponse<unknown>> => {
      try {
        requireAuth();
        const l = assertOptionalNumber(limit, 'limit', 1, 1000) ?? 50;
        if (cloudProvider && typeof cloudProvider === 'string' && (cloudProvider === 'aws' || cloudProvider === 'gcp')) {
          const scans = dbManager.getAllScansByProvider(cloudProvider, l);
          return { success: true, data: scans };
        }
        const scans = dbManager.getAllScans(l);
        return { success: true, data: scans };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to get scan history' };
      }
    }
  );

  ipcMain.handle('db:delete-scan', async (_, scanId: unknown): Promise<IpcResponse<void>> => {
    try {
      requireAuth();
      const id = assertString(scanId, 'scanId');
      dbManager.deleteScan(id);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to delete scan' };
    }
  });

  // ── Scan Comparison & Drift ──

  ipcMain.handle(
    'comparison:diff-scans',
    async (_, scanIdA: unknown, scanIdB: unknown): Promise<IpcResponse<ScanDiffResult>> => {
      try {
        requireAuth();
        const idA = assertString(scanIdA, 'scanIdA');
        const idB = assertString(scanIdB, 'scanIdB');

        const resourcesA = dbManager.getResourcesByScan(idA);
        const resourcesB = dbManager.getResourcesByScan(idB);

        const result = diffScans(resourcesA, resourcesB);
        result.scanIdA = idA;
        result.scanIdB = idB;

        return { success: true, data: result };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to diff scans' };
      }
    }
  );

}

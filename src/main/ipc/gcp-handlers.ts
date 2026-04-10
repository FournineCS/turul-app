// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { ipcMain, BrowserWindow } from 'electron';
import type {
  IpcResponse,
  GCPProject,
  GCPOrganization,
  GCPScanConfig,
  GCPServiceDiscoveryResult,
  SecurityAnalysisResult,
  CostAnalysisResult,
  CostOptimizationResult,
  GCPExpandedRecommendationsResult,
  GCPCostBestPracticesResult,
  GCPCUDCoverageResult,
  GCPCostFilters,
  StoppedVMResult,
  ResourceIdleAnalysisResult,
  GCPOptimizationSnapshot,
  GCPCostCacheEntry,
  GKECostAnalysis,
  CreditsAnalysisResult,
} from '../../shared/types';
import { DatabaseManager } from '../database/db-manager';
import { getGCPAuthManager } from '../gcp/auth-manager';
import { resetGCPClientFactory } from '../gcp/client-factory';
import { setActiveGCPProject, activateFirstAvailableProject, getActiveGCPAccountId } from '../gcp/auth-factory';
import type { GCPCredentialManager } from '../gcp/credential-manager';
import type { GCPAccountSummary } from '../../shared/types';
import { getGCPProjectManager, resetGCPProjectManager } from '../gcp/project-manager';
import { getGCPScanOrchestrator } from '../scanning/gcp-scan-orchestrator';
import { getGCPCostAnalysis, getGCPOrgCostAnalysis, getGCPCostRecommendations, clearBillingTableCache } from '../gcp/cost/billing-analysis';
import { getExpandedCostRecommendations, getExpandedCostRecommendationsOrgWide } from '../gcp/cost/recommender-expanded';
import { runGCPCostBestPractices } from '../gcp/cost/cost-best-practices';
import { getGCPCUDCoverage } from '../gcp/cost/cud-coverage';
import { getStoppedVMs, getStoppedVMsOrgWide } from '../gcp/cost/stopped-vm-analysis';
import { getGCPCreditsAnalysis, getGCPOrgCreditsAnalysis } from '../gcp/cost/credits-analysis';
import { analyzeIdleResources } from '../gcp/cost/resource-idle-analysis';
import {
  saveOptimizationSnapshot,
  listOptimizationSnapshots,
  getOptimizationSnapshot,
  deleteOptimizationSnapshot,
} from '../gcp/cost/optimization-history';
import {
  saveCostCacheEntry,
  listCostCacheEntries,
  getCostCacheEntry,
  getLatestCostCacheEntry,
  deleteCostCacheEntry,
} from '../gcp/cost/cost-cache';
import { getGCPSecurityPosture } from '../gcp/security/scc-integration';
import { runGCPBestPracticesScan } from '../gcp/security/best-practices';
import { generateCostExcel } from '../reports/cost-export';
import { generateCostPdf } from '../reports/cost-pdf-generator';
import { generateOptimizationExcel } from '../reports/optimization-export';
import { generateOptimizationPdf } from '../reports/optimization-pdf-generator';
import { generateGKECostExcel } from '../reports/gke-cost-export';
import { generateGKECostPdf } from '../reports/gke-cost-pdf-generator';
import { runGCPIAMAnalysis } from '../gcp/iam-analysis';
import { runGCPNetworkAnalysis } from '../gcp/network-analysis';
import { runGCPComplianceAssessment, getGCPComplianceFrameworks } from '../gcp/security/compliance';
import { runGCPAssessment } from '../gcp/assessment';
import { runGCPArchitectureFrameworkScan } from '../gcp/well-architected';
import { runGCPLabelCompliance } from '../gcp/label-governance';
import { requireAuth } from './ipc-utils';
import type {
  GCPIAMAnalysisResult,
  GCPIAMAnalysisSummary,
  GCPNetworkAnalysisResult,
  GCPNetworkAnalysisSummary,
  GCPAssessmentConfig,
  GCPAssessmentResult,
  GCPAssessmentSummary,
  GCPSecurityScanSummary,
  GCPWAScanResult,
  GCPWellArchitectedSummary,
  GCPLabelComplianceResult,
  GCPLabelComplianceSummary,
  ComplianceAssessmentResult,
  ComplianceFrameworkMeta,
  GCPComplianceSummary,
} from '../../shared/types';

export function registerGCPHandlers(dbManager: DatabaseManager, gcpCredentialManager: GCPCredentialManager): void {
  // Auth handlers
  ipcMain.handle('gcp:check-auth', async (): Promise<IpcResponse<{ authenticated: boolean; email?: string }>> => {
    try {
      requireAuth();
      const authManager = getGCPAuthManager();
      const result = await authManager.checkAuth();
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('gcp:logout', async (_, accountId?: string): Promise<IpcResponse<void>> => {
    try {
      requireAuth();
      const authManager = getGCPAuthManager();
      await authManager.logout(accountId);
      resetGCPClientFactory();
      resetGCPProjectManager();
      return { success: true, data: undefined };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('gcp:login', async (_, label?: string): Promise<IpcResponse<{ success: boolean; accountId?: string; email?: string }>> => {
    try {
      requireAuth();
      const authManager = getGCPAuthManager();
      const result = await authManager.loginWithADC(undefined, label);
      if (result.success) {
        resetGCPClientFactory();
        resetGCPProjectManager();
        return { success: true, data: { success: true, accountId: result.accountId, email: result.email } };
      }
      return { success: false, error: result.error };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // ── GCP Account management ──

  ipcMain.handle('gcp:accounts:list', async (): Promise<IpcResponse<GCPAccountSummary[]>> => {
    try {
      requireAuth();
      return { success: true, data: gcpCredentialManager.listCredentials() };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('gcp:accounts:add', async (_, label: string): Promise<IpcResponse<{ accountId?: string; email?: string }>> => {
    try {
      requireAuth();
      const authManager = getGCPAuthManager();
      const result = await authManager.loginWithADC(undefined, label || 'New Account');
      if (result.success) {
        resetGCPClientFactory();
        resetGCPProjectManager();
        return { success: true, data: { accountId: result.accountId, email: result.email } };
      }
      return { success: false, error: result.error };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('gcp:accounts:activate', async (_, accountId: string): Promise<IpcResponse<void>> => {
    try {
      requireAuth();
      setActiveGCPProject(accountId);
      resetGCPClientFactory();
      resetGCPProjectManager();
      return { success: true, data: undefined };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('gcp:accounts:rename', async (_, accountId: string, label: string): Promise<IpcResponse<void>> => {
    try {
      requireAuth();
      gcpCredentialManager.updateLabel(accountId, label);
      return { success: true, data: undefined };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('gcp:accounts:delete', async (_, accountId: string): Promise<IpcResponse<void>> => {
    try {
      requireAuth();
      gcpCredentialManager.deleteCredentials(accountId);
      // If the deleted account was the active one, reset auth
      if (getActiveGCPAccountId() === accountId) {
        const { resetActiveGCPAuth } = require('../gcp/auth-factory');
        resetActiveGCPAuth();
        resetGCPClientFactory();
        resetGCPProjectManager();
      }
      return { success: true, data: undefined };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('gcp:accounts:relogin', async (_, accountId: string): Promise<IpcResponse<{ email?: string }>> => {
    try {
      requireAuth();
      const authManager = getGCPAuthManager();
      // Fetch existing label to preserve it
      const accounts = gcpCredentialManager.listCredentials();
      const existing = accounts.find(a => a.accountId === accountId);
      const result = await authManager.loginWithADC(accountId, existing?.label);
      if (result.success) {
        resetGCPClientFactory();
        resetGCPProjectManager();
        return { success: true, data: { email: result.email } };
      }
      return { success: false, error: result.error };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Keep legacy activate-project handler for backward compat
  ipcMain.handle('gcp:activate-project', async (_, accountId: string): Promise<IpcResponse<void>> => {
    try {
      requireAuth();
      setActiveGCPProject(accountId);
      resetGCPClientFactory();
      resetGCPProjectManager();
      return { success: true, data: undefined };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Project handlers
  ipcMain.handle('gcp:list-projects', async (): Promise<IpcResponse<GCPProject[]>> => {
    try {
      requireAuth();
      // Ensure some credentials are active so @google-cloud/* SDK clients can authenticate
      activateFirstAvailableProject();
      const projectManager = getGCPProjectManager();
      const projects = await projectManager.getProjects();
      return { success: true, data: projects };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('gcp:list-organizations', async (): Promise<IpcResponse<GCPOrganization[]>> => {
    try {
      requireAuth();
      activateFirstAvailableProject();
      const projectManager = getGCPProjectManager();
      const orgs = await projectManager.getOrganizations();
      return { success: true, data: orgs };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('gcp:validate-project', async (_event, projectId: string): Promise<IpcResponse<GCPProject | null>> => {
    try {
      requireAuth();
      const projectManager = getGCPProjectManager();
      const project = await projectManager.validateProject(projectId);
      return { success: true, data: project };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Scan handlers
  ipcMain.handle('gcp:scan:start', async (_event, config: GCPScanConfig): Promise<IpcResponse<{ scanId: string }>> => {
    try {
      requireAuth();
      const orchestrator = getGCPScanOrchestrator(dbManager);

      // Set main window for progress updates
      const windows = BrowserWindow.getAllWindows();
      if (windows.length > 0) {
        orchestrator.setMainWindow(windows[0]);
      }

      const scanId = await orchestrator.startScan(config);
      return { success: true, data: { scanId } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('gcp:scan:stop', async (_event, scanId: string): Promise<IpcResponse<void>> => {
    try {
      requireAuth();
      const orchestrator = getGCPScanOrchestrator(dbManager);
      orchestrator.stopScan(scanId);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Smart service discovery via BigQuery billing export
  ipcMain.handle('gcp:scan:discover-services', async (
    _event,
    projectId: string,
    days: number,
    bqProject: string,
    bqDataset?: string,
    bqRegion?: string
  ): Promise<IpcResponse<GCPServiceDiscoveryResult>> => {
    try {
      requireAuth();
      const { discoverGCPServicesByBilling } = await import('../gcp/cost/service-discovery');
      const result = await discoverGCPServicesByBilling(projectId, days, bqProject, bqDataset, bqRegion);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Cost handler
  ipcMain.handle('gcp:cost:get-analysis', async (
    _event,
    projectId: string,
    startDate: string,
    endDate: string,
    bqProject?: string,
    bqDataset?: string,
    filters?: GCPCostFilters,
    forceRefresh?: boolean,
    bqRegion?: string
  ): Promise<IpcResponse<CostAnalysisResult>> => {
    try {
      requireAuth();
      if (forceRefresh) clearBillingTableCache();
      const result = await getGCPCostAnalysis(projectId, startDate, endDate, bqProject, bqDataset, filters, forceRefresh, bqRegion);
      return { success: true, data: JSON.parse(JSON.stringify(result)) };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Org-level cost analysis handler
  ipcMain.handle('gcp:cost:get-org-analysis', async (
    _event,
    startDate: string,
    endDate: string,
    bqProject: string,
    bqDataset?: string,
    filters?: GCPCostFilters,
    forceRefresh?: boolean,
    bqRegion?: string
  ): Promise<IpcResponse<CostAnalysisResult>> => {
    try {
      requireAuth();
      if (forceRefresh) clearBillingTableCache();
      const result = await getGCPOrgCostAnalysis(startDate, endDate, bqProject, bqDataset, filters, forceRefresh, bqRegion);
      return { success: true, data: JSON.parse(JSON.stringify(result)) };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Credits analysis handlers
  ipcMain.handle('gcp:cost:get-credits', async (
    _event,
    projectId: string,
    startDate: string,
    endDate: string,
    bqProject?: string,
    bqDataset?: string,
    bqRegion?: string
  ): Promise<IpcResponse<CreditsAnalysisResult>> => {
    try {
      requireAuth();
      const result = await getGCPCreditsAnalysis(projectId, startDate, endDate, bqProject, bqDataset, bqRegion);
      return { success: true, data: JSON.parse(JSON.stringify(result)) };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('gcp:cost:get-org-credits', async (
    _event,
    startDate: string,
    endDate: string,
    bqProject: string,
    bqDataset?: string,
    bqRegion?: string
  ): Promise<IpcResponse<CreditsAnalysisResult>> => {
    try {
      requireAuth();
      const result = await getGCPOrgCreditsAnalysis(startDate, endDate, bqProject, bqDataset, bqRegion);
      return { success: true, data: JSON.parse(JSON.stringify(result)) };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Cost recommendations handler (works without BigQuery)
  ipcMain.handle('gcp:cost:get-recommendations', async (
    _event,
    projectId: string
  ): Promise<IpcResponse<CostOptimizationResult>> => {
    try {
      requireAuth();
      const result = await getGCPCostRecommendations(projectId);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Expanded cost recommendations (all 13 recommender types, all regions)
  ipcMain.handle('gcp:cost:get-expanded-recommendations', async (
    _event,
    projectId: string
  ): Promise<IpcResponse<GCPExpandedRecommendationsResult>> => {
    try {
      requireAuth();
      const result = await getExpandedCostRecommendations(projectId);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // BigQuery-based cost best practices checks
  ipcMain.handle('gcp:cost:get-best-practices', async (
    _event,
    projectId: string,
    bqProject: string,
    bqDataset?: string
  ): Promise<IpcResponse<GCPCostBestPracticesResult>> => {
    try {
      requireAuth();
      const result = await runGCPCostBestPractices(projectId, bqProject, bqDataset);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // CUD coverage analysis
  ipcMain.handle('gcp:cost:get-cud-coverage', async (
    _event,
    projectId: string,
    bqProject?: string,
    bqDataset?: string
  ): Promise<IpcResponse<GCPCUDCoverageResult>> => {
    try {
      requireAuth();
      const result = await getGCPCUDCoverage(projectId, bqProject, bqDataset);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Stopped / suspended VM analysis
  ipcMain.handle('gcp:cost:get-stopped-vms', async (
    _event,
    projectId: string
  ): Promise<IpcResponse<StoppedVMResult>> => {
    try {
      requireAuth();
      const result = await getStoppedVMs(projectId);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Org-wide stopped VM analysis
  ipcMain.handle('gcp:cost:get-stopped-vms-org', async (
    _event,
    orgId: string
  ): Promise<IpcResponse<StoppedVMResult>> => {
    try {
      requireAuth();
      const result = await getStoppedVMsOrgWide(orgId);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Org-wide expanded recommendations
  ipcMain.handle('gcp:cost:get-expanded-recommendations-org', async (
    _event,
    orgId: string
  ): Promise<IpcResponse<GCPExpandedRecommendationsResult>> => {
    try {
      requireAuth();
      const windows = BrowserWindow.getAllWindows();
      const mainWindow = windows[0];

      const result = await getExpandedCostRecommendationsOrgWide(orgId, (progress) => {
        mainWindow?.webContents.send('gcp:cost:org-scan-progress', progress);
      });
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Cost export: Excel
  ipcMain.handle('cost:export-excel', async (
    _event,
    analysis: CostAnalysisResult,
    label: string
  ): Promise<IpcResponse<string | null>> => {
    try {
      requireAuth();
      const { dialog, app } = await import('electron');
      const result = await dialog.showSaveDialog({
        title: 'Save Cost Export',
        defaultPath: `cost-export-${label}-${new Date().toISOString().split('T')[0]}.xlsx`,
        filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }],
      });
      if (result.canceled || !result.filePath) return { success: true, data: null };

      const dir = require('path').dirname(result.filePath);
      const savedPath = await generateCostExcel(analysis, dir, label);
      // generateCostExcel writes to a constructed filename; rename to user's chosen path
      const fs = await import('fs/promises');
      await fs.rename(savedPath, result.filePath).catch(() => {});
      return { success: true, data: result.filePath };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Cost export: PDF (professional multi-page report)
  ipcMain.handle('cost:export-pdf', async (
    _event,
    analysis: CostAnalysisResult,
    label: string
  ): Promise<IpcResponse<string | null>> => {
    try {
      requireAuth();
      const { dialog } = await import('electron');
      const result = await dialog.showSaveDialog({
        title: 'Save Cost Analysis PDF',
        defaultPath: `cost-analysis-${label}-${new Date().toISOString().split('T')[0]}.pdf`,
        filters: [{ name: 'PDF Document', extensions: ['pdf'] }],
      });
      if (result.canceled || !result.filePath) return { success: true, data: null };

      const dir = require('path').dirname(result.filePath);
      const savedPath = await generateCostPdf(analysis, dir, label);
      const fs = await import('fs/promises');
      await fs.rename(savedPath, result.filePath).catch(() => {});
      return { success: true, data: result.filePath };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // GKE cost drill-down handler (project-level)
  ipcMain.handle('gcp:cost:get-gke-costs', async (
    _event,
    projectId: string,
    startDate: string,
    endDate: string,
    bqProject?: string,
    bqDataset?: string,
    clusterFilter?: string,
    namespaceFilter?: string,
    bqRegion?: string
  ): Promise<IpcResponse<GKECostAnalysis>> => {
    try {
      requireAuth();
      const { getGKECosts } = await import('../gcp/cost/gke-cost-analysis');
      const result = await getGKECosts(projectId, startDate, endDate, bqProject || projectId, bqDataset, clusterFilter, namespaceFilter, bqRegion);
      return { success: true, data: JSON.parse(JSON.stringify(result)) };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // GKE cost drill-down handler (org-level — no project filter)
  ipcMain.handle('gcp:cost:get-gke-costs-org', async (
    _event,
    startDate: string,
    endDate: string,
    bqProject: string,
    bqDataset?: string,
    clusterFilter?: string,
    namespaceFilter?: string,
    bqRegion?: string
  ): Promise<IpcResponse<GKECostAnalysis>> => {
    try {
      requireAuth();
      const { getGKECosts } = await import('../gcp/cost/gke-cost-analysis');
      const result = await getGKECosts(null, startDate, endDate, bqProject, bqDataset, clusterFilter, namespaceFilter, bqRegion);
      return { success: true, data: JSON.parse(JSON.stringify(result)) };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Security handlers — fire and forget
  ipcMain.handle('gcp:security:get-posture', async (
    _event,
    projectId: string
  ): Promise<IpcResponse<{ started: boolean }>> => {
    try {
      requireAuth();
      if (!projectId || typeof projectId !== 'string') {
        return { success: false, error: 'Invalid projectId' };
      }
      const mainWindow = BrowserWindow.getAllWindows()[0];
      getGCPSecurityPosture(projectId).then((result) => {
        try { dbManager.createGCPSecurityScan(result); } catch (e) { console.error('Failed to save GCP security scan:', e); }
        mainWindow?.webContents.send('gcp:security:completed', result);
      }).catch((error) => {
        mainWindow?.webContents.send('gcp:security:failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      });
      return { success: true, data: { started: true } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('gcp:security:run-best-practices', async (
    _event,
    projectId: string
  ): Promise<IpcResponse<{ started: boolean }>> => {
    try {
      requireAuth();
      if (!projectId || typeof projectId !== 'string') {
        return { success: false, error: 'Invalid projectId' };
      }
      const mainWindow = BrowserWindow.getAllWindows()[0];
      runGCPBestPracticesScan(projectId).then((result) => {
        try { dbManager.createGCPSecurityScan(result); } catch (e) { console.error('Failed to save GCP security scan:', e); }
        mainWindow?.webContents.send('gcp:security:completed', result);
      }).catch((error) => {
        mainWindow?.webContents.send('gcp:security:failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      });
      return { success: true, data: { started: true } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('gcp:security:get-all', async (
    _event,
    projectId?: string,
    limit?: number
  ): Promise<IpcResponse<GCPSecurityScanSummary[]>> => {
    try {
      requireAuth();
      const results = dbManager.getAllGCPSecurityScans(projectId, limit ?? 50);
      return { success: true, data: results };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('gcp:security:get-by-id', async (
    _event,
    id: string
  ): Promise<IpcResponse<SecurityAnalysisResult>> => {
    try {
      requireAuth();
      const result = dbManager.getGCPSecurityScan(id);
      return result ? { success: true, data: result } : { success: false, error: 'Not found' };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('gcp:security:delete', async (
    _event,
    id: string
  ): Promise<IpcResponse<void>> => {
    try {
      requireAuth();
      dbManager.deleteGCPSecurityScan(id);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // GCP Optimization — resource idle analysis (no API calls, uses scan DB)
  ipcMain.handle('gcp:opt:analyze-resources', async (
    _event,
    identity: string
  ): Promise<IpcResponse<ResourceIdleAnalysisResult>> => {
    try {
      requireAuth();
      const scanId = dbManager.getLatestGCPScanId(identity);
      if (!scanId) {
        return { success: false, error: 'No completed GCP scan found for this project. Run a GCP resource scan first.' };
      }
      const result = await analyzeIdleResources(scanId, dbManager);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('gcp:opt:save-snapshot', async (
    _event,
    snapshot: GCPOptimizationSnapshot
  ): Promise<IpcResponse<void>> => {
    try {
      requireAuth();
      saveOptimizationSnapshot(dbManager, snapshot);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('gcp:opt:list-snapshots', async (
    _event,
    identity: string,
    limit?: number
  ): Promise<IpcResponse<GCPOptimizationSnapshot[]>> => {
    try {
      requireAuth();
      const result = listOptimizationSnapshots(dbManager, identity, limit);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('gcp:opt:get-snapshot', async (
    _event,
    id: string
  ): Promise<IpcResponse<GCPOptimizationSnapshot>> => {
    try {
      requireAuth();
      const result = getOptimizationSnapshot(dbManager, id);
      if (!result) return { success: false, error: 'Snapshot not found' };
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('gcp:opt:delete-snapshot', async (
    _event,
    id: string
  ): Promise<IpcResponse<void>> => {
    try {
      requireAuth();
      deleteOptimizationSnapshot(dbManager, id);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Optimization export: Excel
  ipcMain.handle('gcp:opt:export-excel', async (
    _event,
    data: { recs: GCPExpandedRecommendationsResult | null; vms: StoppedVMResult | null; idle: ResourceIdleAnalysisResult | null },
    label: string
  ): Promise<IpcResponse<string | null>> => {
    try {
      requireAuth();
      const { dialog } = await import('electron');
      const result = await dialog.showSaveDialog({
        title: 'Save Optimization Export',
        defaultPath: `gcp-optimization-${label}-${new Date().toISOString().split('T')[0]}.xlsx`,
        filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }],
      });
      if (result.canceled || !result.filePath) return { success: true, data: null };

      const dir = require('path').dirname(result.filePath);
      const savedPath = await generateOptimizationExcel(data.recs, data.vms, data.idle, dir, label);
      const fs = await import('fs/promises');
      await fs.rename(savedPath, result.filePath).catch(() => {});
      return { success: true, data: result.filePath };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // Optimization export: PDF
  ipcMain.handle('gcp:opt:export-pdf', async (
    _event,
    data: { recs: GCPExpandedRecommendationsResult | null; vms: StoppedVMResult | null; idle: ResourceIdleAnalysisResult | null },
    label: string
  ): Promise<IpcResponse<string | null>> => {
    try {
      requireAuth();
      const { dialog } = await import('electron');
      const result = await dialog.showSaveDialog({
        title: 'Save Optimization PDF Report',
        defaultPath: `gcp-optimization-${label}-${new Date().toISOString().split('T')[0]}.pdf`,
        filters: [{ name: 'PDF Document', extensions: ['pdf'] }],
      });
      if (result.canceled || !result.filePath) return { success: true, data: null };

      const dir = require('path').dirname(result.filePath);
      const savedPath = await generateOptimizationPdf(data.recs, data.vms, data.idle, dir, label);
      const fs = await import('fs/promises');
      await fs.rename(savedPath, result.filePath).catch(() => {});
      return { success: true, data: result.filePath };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // GKE Cost export: Excel
  ipcMain.handle('gke:cost:export-excel', async (
    _event,
    data: GKECostAnalysis,
    label: string
  ): Promise<IpcResponse<string | null>> => {
    try {
      requireAuth();
      const { dialog } = await import('electron');
      const result = await dialog.showSaveDialog({
        title: 'Save GKE Cost Export',
        defaultPath: `gke-costs-${label}-${new Date().toISOString().split('T')[0]}.xlsx`,
        filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }],
      });
      if (result.canceled || !result.filePath) return { success: true, data: null };

      const dir = require('path').dirname(result.filePath);
      const savedPath = await generateGKECostExcel(data, dir, label);
      const fs = await import('fs/promises');
      await fs.rename(savedPath, result.filePath).catch(() => {});
      return { success: true, data: result.filePath };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // GKE Cost export: PDF
  ipcMain.handle('gke:cost:export-pdf', async (
    _event,
    data: GKECostAnalysis,
    label: string
  ): Promise<IpcResponse<string | null>> => {
    try {
      requireAuth();
      const { dialog } = await import('electron');
      const result = await dialog.showSaveDialog({
        title: 'Save GKE Cost PDF Report',
        defaultPath: `gke-costs-${label}-${new Date().toISOString().split('T')[0]}.pdf`,
        filters: [{ name: 'PDF Document', extensions: ['pdf'] }],
      });
      if (result.canceled || !result.filePath) return { success: true, data: null };

      const dir = require('path').dirname(result.filePath);
      const savedPath = await generateGKECostPdf(data, dir, label);
      const fs = await import('fs/promises');
      await fs.rename(savedPath, result.filePath).catch(() => {});
      return { success: true, data: result.filePath };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // GCP Cost Cache
  ipcMain.handle('gcp:cost-cache:save', async (
    _event,
    entry: GCPCostCacheEntry
  ): Promise<IpcResponse<void>> => {
    try {
      requireAuth();
      saveCostCacheEntry(dbManager, entry);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('gcp:cost-cache:list', async (
    _event,
    identity: string,
    dataType: string,
    limit?: number
  ): Promise<IpcResponse<GCPCostCacheEntry[]>> => {
    try {
      requireAuth();
      const result = listCostCacheEntries(dbManager, identity, dataType, limit);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('gcp:cost-cache:get', async (
    _event,
    id: string
  ): Promise<IpcResponse<GCPCostCacheEntry>> => {
    try {
      requireAuth();
      const result = getCostCacheEntry(dbManager, id);
      if (!result) return { success: false, error: 'Cache entry not found' };
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('gcp:cost-cache:get-latest', async (
    _event,
    identity: string,
    dataType: string
  ): Promise<IpcResponse<GCPCostCacheEntry>> => {
    try {
      requireAuth();
      const result = getLatestCostCacheEntry(dbManager, identity, dataType);
      if (!result) return { success: false, error: 'No cached entry found' };
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('gcp:cost-cache:delete', async (
    _event,
    id: string
  ): Promise<IpcResponse<void>> => {
    try {
      requireAuth();
      deleteCostCacheEntry(dbManager, id);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // ── GCP IAM Analysis ──

  ipcMain.handle('gcp:iam:run-analysis', async (
    _event,
    projectId: string
  ): Promise<IpcResponse<{ started: boolean }>> => {
    try {
      requireAuth();
      if (!projectId || typeof projectId !== 'string') {
        return { success: false, error: 'Invalid projectId' };
      }
      const mainWindow = BrowserWindow.getAllWindows()[0];
      // Fire and forget
      runGCPIAMAnalysis(projectId).then((result) => {
        try { dbManager.createGCPIAMAnalysis(result); } catch (e) { console.error('Failed to save GCP IAM analysis:', e); }
        mainWindow?.webContents.send('gcp:iam:completed', result);
      }).catch((error) => {
        mainWindow?.webContents.send('gcp:iam:failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      });
      return { success: true, data: { started: true } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('gcp:iam:get-all', async (
    _event,
    projectId?: string,
    limit?: number
  ): Promise<IpcResponse<GCPIAMAnalysisSummary[]>> => {
    try {
      requireAuth();
      const results = dbManager.getAllGCPIAMAnalyses(projectId, limit ?? 50);
      return { success: true, data: results };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('gcp:iam:get-by-id', async (
    _event,
    id: string
  ): Promise<IpcResponse<GCPIAMAnalysisResult>> => {
    try {
      requireAuth();
      const result = dbManager.getGCPIAMAnalysis(id);
      return result
        ? { success: true, data: result }
        : { success: false, error: 'Not found' };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('gcp:iam:delete', async (
    _event,
    id: string
  ): Promise<IpcResponse<void>> => {
    try {
      requireAuth();
      dbManager.deleteGCPIAMAnalysis(id);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // ── GCP Network Analysis ──

  ipcMain.handle('gcp:network:analyze', async (
    _event,
    projectId: string
  ): Promise<IpcResponse<{ started: boolean }>> => {
    try {
      requireAuth();
      if (!projectId || typeof projectId !== 'string') {
        return { success: false, error: 'Invalid projectId' };
      }
      const mainWindow = BrowserWindow.getAllWindows()[0];
      // Fire and forget — do NOT await
      runGCPNetworkAnalysis(projectId).then((result) => {
        try { dbManager.createGCPNetworkAnalysis(result); } catch (e) { console.error('Failed to save GCP network analysis:', e); }
        mainWindow?.webContents.send('gcp:network:completed', result);
      }).catch((error) => {
        mainWindow?.webContents.send('gcp:network:failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      });
      return { success: true, data: { started: true } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('gcp:network:get-all', async (
    _event,
    projectId?: string,
    limit?: number
  ): Promise<IpcResponse<GCPNetworkAnalysisSummary[]>> => {
    try {
      requireAuth();
      const results = dbManager.getAllGCPNetworkAnalysis(projectId, limit);
      return { success: true, data: results };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('gcp:network:get-by-id', async (
    _event,
    id: string
  ): Promise<IpcResponse<GCPNetworkAnalysisResult>> => {
    try {
      requireAuth();
      const result = dbManager.getGCPNetworkAnalysis(id);
      return result
        ? { success: true, data: result }
        : { success: false, error: 'Not found' };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('gcp:network:delete', async (
    _event,
    id: string
  ): Promise<IpcResponse<void>> => {
    try {
      requireAuth();
      dbManager.deleteGCPNetworkAnalysis(id);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // ── GCP Compliance ──

  ipcMain.handle('gcp:compliance:get-frameworks', async (): Promise<IpcResponse<ComplianceFrameworkMeta[]>> => {
    try {
      requireAuth();
      const frameworks = getGCPComplianceFrameworks();
      return { success: true, data: frameworks };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('gcp:compliance:run-assessment', async (
    _event,
    projectId: string,
    _frameworkId?: string
  ): Promise<IpcResponse<{ started: boolean }>> => {
    try {
      requireAuth();
      if (!projectId || typeof projectId !== 'string') {
        return { success: false, error: 'Invalid projectId' };
      }
      const mainWindow = BrowserWindow.getAllWindows()[0];
      // Fire and forget — do NOT await
      runGCPComplianceAssessment(projectId).then((result) => {
        try { dbManager.createGCPCompliance(result); } catch (e) { console.error('Failed to save GCP compliance:', e); }
        mainWindow?.webContents.send('gcp:compliance:completed', result);
      }).catch((error) => {
        mainWindow?.webContents.send('gcp:compliance:failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      });
      return { success: true, data: { started: true } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('gcp:compliance:get-all', async (
    _event,
    projectId?: string,
    limit?: number
  ): Promise<IpcResponse<GCPComplianceSummary[]>> => {
    try {
      requireAuth();
      const results = dbManager.getAllGCPCompliance(projectId, limit ?? 50);
      return { success: true, data: results };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('gcp:compliance:get-by-id', async (
    _event,
    id: string
  ): Promise<IpcResponse<ComplianceAssessmentResult>> => {
    try {
      requireAuth();
      const result = dbManager.getGCPCompliance(id);
      return result
        ? { success: true, data: result }
        : { success: false, error: 'Not found' };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('gcp:compliance:delete', async (
    _event,
    id: string
  ): Promise<IpcResponse<void>> => {
    try {
      requireAuth();
      dbManager.deleteGCPCompliance(id);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // ── GCP Assessment ──

  ipcMain.handle('gcp:assessment:run', async (
    _event,
    config: GCPAssessmentConfig
  ): Promise<IpcResponse<{ started: boolean }>> => {
    try {
      requireAuth();
      if (!config?.projectId || typeof config.projectId !== 'string') {
        return { success: false, error: 'Invalid config: projectId required' };
      }
      const mainWindow = BrowserWindow.getAllWindows()[0];
      // Fire and forget — do NOT await
      runGCPAssessment(config, (progress) => {
        mainWindow?.webContents.send('gcp:assessment:progress', progress);
      }).then((result) => {
        try { dbManager.createGCPAssessment(result); } catch (e) { console.error('Failed to save GCP assessment:', e); }
        mainWindow?.webContents.send('gcp:assessment:completed', result);
      }).catch((error) => {
        mainWindow?.webContents.send('gcp:assessment:failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      });
      return { success: true, data: { started: true } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('gcp:assessment:get-all', async (
    _event,
    projectId?: string,
    limit?: number
  ): Promise<IpcResponse<GCPAssessmentSummary[]>> => {
    try {
      requireAuth();
      const results = dbManager.getAllGCPAssessments(projectId, limit ?? 50);
      return { success: true, data: results };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('gcp:assessment:get-by-id', async (
    _event,
    id: string
  ): Promise<IpcResponse<GCPAssessmentResult>> => {
    try {
      requireAuth();
      const result = dbManager.getGCPAssessment(id);
      return result
        ? { success: true, data: result }
        : { success: false, error: 'Not found' };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('gcp:assessment:delete', async (
    _event,
    id: string
  ): Promise<IpcResponse<void>> => {
    try {
      requireAuth();
      dbManager.deleteGCPAssessment(id);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('gcp:assessment:generate-report', async (
    _event,
    result: unknown,
    outputDir: unknown
  ): Promise<IpcResponse<{ filePath: string }>> => {
    try {
      requireAuth();
      if (!result || typeof result !== 'object') {
        return { success: false, error: 'Invalid result object' };
      }
      if (!outputDir || typeof outputDir !== 'string') {
        return { success: false, error: 'Invalid output directory' };
      }

      const { generateGCPAssessmentPdf } = await import('../reports/gcp-assessment-pdf-generator');
      const filePath = await generateGCPAssessmentPdf(
        outputDir as string,
        result as GCPAssessmentResult,
      );
      return { success: true, data: { filePath } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // ── GCP Well-Architected ──

  ipcMain.handle('gcp:well-architected:run', async (
    _event,
    projectId: string
  ): Promise<IpcResponse<{ started: boolean }>> => {
    try {
      requireAuth();
      if (!projectId || typeof projectId !== 'string') {
        return { success: false, error: 'Invalid projectId' };
      }
      const mainWindow = BrowserWindow.getAllWindows()[0];
      // Fire and forget — do NOT await
      runGCPArchitectureFrameworkScan(projectId, (progress) => {
        mainWindow?.webContents.send('gcp:well-architected:progress', progress);
      }).then((result) => {
        try { dbManager.createGCPWellArchitected(result); } catch (e) { console.error('Failed to save GCP well-architected result:', e); }
        mainWindow?.webContents.send('gcp:well-architected:completed', result);
      }).catch((error) => {
        mainWindow?.webContents.send('gcp:well-architected:failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      });
      return { success: true, data: { started: true } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('gcp:well-architected:get-all', async (
    _event,
    projectId?: string,
    limit?: number
  ): Promise<IpcResponse<GCPWellArchitectedSummary[]>> => {
    try {
      requireAuth();
      const results = dbManager.getAllGCPWellArchitected(projectId, limit);
      return { success: true, data: results };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('gcp:well-architected:get-by-id', async (
    _event,
    id: string
  ): Promise<IpcResponse<GCPWAScanResult>> => {
    try {
      requireAuth();
      const result = dbManager.getGCPWellArchitected(id);
      return result
        ? { success: true, data: result }
        : { success: false, error: 'Not found' };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('gcp:well-architected:delete', async (
    _event,
    id: string
  ): Promise<IpcResponse<void>> => {
    try {
      requireAuth();
      dbManager.deleteGCPWellArchitected(id);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  // ── GCP Label Governance ──

  ipcMain.handle('gcp:labels:get-config', async (): Promise<IpcResponse<{ requiredLabels: string[] }>> => {
    try {
      requireAuth();
      const requiredLabels = dbManager.getGCPLabelConfig();
      return { success: true, data: { requiredLabels } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('gcp:labels:save-config', async (
    _event,
    requiredLabels: string[]
  ): Promise<IpcResponse<void>> => {
    try {
      requireAuth();
      dbManager.saveGCPLabelConfig(requiredLabels);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('gcp:labels:check-compliance', async (
    _event,
    projectId: string,
    requiredLabels: string[]
  ): Promise<IpcResponse<{ started: boolean }>> => {
    try {
      requireAuth();
      if (!projectId || typeof projectId !== 'string') {
        return { success: false, error: 'Invalid projectId' };
      }
      const mainWindow = BrowserWindow.getAllWindows()[0];
      // Fire and forget — do NOT await
      runGCPLabelCompliance(projectId, { requiredLabels }).then((result) => {
        try { dbManager.createGCPLabelCompliance(result); } catch (e) { console.error('Failed to save GCP label compliance:', e); }
        mainWindow?.webContents.send('gcp:labels:completed', result);
      }).catch((error) => {
        mainWindow?.webContents.send('gcp:labels:failed', {
          error: error instanceof Error ? error.message : String(error),
        });
      });
      return { success: true, data: { started: true } };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('gcp:labels:get-all', async (
    _event,
    projectId?: string,
    limit?: number
  ): Promise<IpcResponse<GCPLabelComplianceSummary[]>> => {
    try {
      requireAuth();
      const results = dbManager.getAllGCPLabelCompliance(projectId, limit);
      return { success: true, data: results };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('gcp:labels:get-by-id', async (
    _event,
    id: string
  ): Promise<IpcResponse<GCPLabelComplianceResult>> => {
    try {
      requireAuth();
      const result = dbManager.getGCPLabelCompliance(id);
      return result
        ? { success: true, data: result }
        : { success: false, error: 'Not found' };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });

  ipcMain.handle('gcp:labels:delete', async (
    _event,
    id: string
  ): Promise<IpcResponse<void>> => {
    try {
      requireAuth();
      dbManager.deleteGCPLabelCompliance(id);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
}

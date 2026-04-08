// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

/**
 * AWS-specific IPC handlers: aws:*, cost:*, security:*, wellarchitected:*,
 * assessment:*, tags:*, iam:*, network:*, compliance:*, schedule:*.
 */

import { ipcMain, BrowserWindow } from 'electron';
import type {
  ScanConfig,
  IpcResponse,
  CostDiscoveryResponse,
  CostAnalysisResult,
  CostTrendDataPoint,
  CostOptimizationResult,
  CostGranularity,
  SecurityAnalysisResult,
  SecurityFinding,
  WAAnalysisResult,
  WAWorkloadSummary,
  WALensReview,
  WAImprovementItem,
  WABPScanResult,
  AssessmentConfig,
  AssessmentResult,
  AssessmentSummary,
  AWSProfile,
  TagGovernanceConfig,
  TagComplianceResult,
  TagServiceCompliance,
  TagKeyCompliance,
  UntaggedResource,
  NetworkReachabilityResult,
  ScanSchedule,
  ScanScheduleConfig,
  IAMAnalysisResult,
  ComplianceFrameworkMeta,
  ComplianceAssessmentResult,
  GCPCostCacheEntry,
  EKSCostAnalysis,
  CreditsAnalysisResult,
} from '../../shared/types';
import { AWS_REGIONS } from '../../shared/types';
import { getEKSCostAnalysis } from '../aws/cost/eks-cost-analysis';
import { getAWSCreditsAnalysis } from '../aws/cost/credits-analysis';
import { DatabaseManager } from '../database/db-manager';
import { getProfileManager } from '../aws/profile-manager';
import { getScanOrchestrator } from '../scanning/scan-orchestrator';
import {
  discoverActiveServicesByCost,
  getDetailedCostAnalysis,
  getCostTrend,
  getCostOptimizations,
} from '../aws/discovery/cost-explorer';
import {
  getSecurityFindings,
  getSecurityFindingById,
} from '../aws/security/security-hub';
import { runBestPracticesScan } from '../aws/security/best-practices';
import {
  listWorkloads,
  getWorkloadDetails,
  getLensReview,
  getImprovements,
  runWABestPracticesScan,
} from '../aws/well-architected';
import { analyzeNetworkReachability } from '../aws/network-analysis';
import { runIAMAnalysis } from '../aws/iam-analysis';
import { getAvailableFrameworks, runComplianceAssessment } from '../aws/security/compliance';
import { getScheduler } from '../scanning/scan-scheduler';
import { runAssessment } from '../assessment';
import { generateAssessmentPdf } from '../reports/assessment-pdf-generator';
import { requireAuth, stripSecrets } from './ipc-utils';
import type { AuthService } from '../auth/auth-service';
import type { AppProfileManager } from '../auth/app-profile-manager';
import {
  assertString,
  assertNumber,
  assertOptionalNumber,
  assertOneOf,
  assertStringArray,
  assertSafePath,
  assertDateString,
  assertObject,
  assertProfileName,
} from './validation';

export function registerAWSHandlers(
  dbManager: DatabaseManager,
  authService: AuthService,
  appProfileManager: AppProfileManager
): void {
  const scanOrchestrator = getScanOrchestrator(dbManager);

  // ── AWS Profile handlers ──

  ipcMain.handle('aws:get-profiles', async (): Promise<IpcResponse<AWSProfile[]>> => {
    try {
      const profileManager = getProfileManager();
      const awsProfiles = await profileManager.getProfiles();

      if (authService.isAuthenticated() && appProfileManager) {
        const appProfiles = appProfileManager.getAppProfilesAsAWSProfiles();
        const merged = new Map<string, AWSProfile>();
        for (const p of awsProfiles) merged.set(p.name, p);
        for (const p of appProfiles) merged.set(p.name, p);
        const result = Array.from(merged.values()).sort((a, b) => a.name.localeCompare(b.name));
        return { success: true, data: stripSecrets(result) };
      }

      return { success: true, data: stripSecrets(awsProfiles) };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get profiles' };
    }
  });

  ipcMain.handle(
    'aws:validate-profile',
    async (_, profileName: unknown): Promise<IpcResponse<{ accountId: string }>> => {
      try {
        const name = assertProfileName(profileName, 'profileName');
        const profileManager = getProfileManager();
        const result = await profileManager.validateProfile(name);
        return { success: true, data: { accountId: result.accountId } };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to validate profile' };
      }
    }
  );

  ipcMain.handle('aws:get-regions', async (): Promise<IpcResponse<string[]>> => {
    return { success: true, data: [...AWS_REGIONS] };
  });

  ipcMain.handle(
    'aws:discover-services-by-cost',
    async (_, profileName: unknown, days: unknown): Promise<IpcResponse<CostDiscoveryResponse>> => {
      try {
        requireAuth();
        const name = assertProfileName(profileName, 'profileName');
        const d = assertOptionalNumber(days, 'days', 1, 365) ?? 30;
        const result = await discoverActiveServicesByCost(name, d);
        return { success: true, data: result };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to discover services by cost' };
      }
    }
  );

  // ── Scan handlers (AWS) ──

  ipcMain.handle(
    'scan:start',
    async (event, config: unknown): Promise<IpcResponse<{ scanId: string }>> => {
      try {
        requireAuth();
        const c = assertObject(config, 'config');
        const validatedConfig: ScanConfig = {
          profileName: assertProfileName(c.profileName, 'profileName'),
          regions: assertStringArray(c.regions, 'regions', 30),
          services: assertStringArray(c.services, 'services', 200) as ScanConfig['services'],
          includeGlobal: typeof c.includeGlobal === 'boolean' ? c.includeGlobal : false,
        };

        const window = BrowserWindow.fromWebContents(event.sender);
        if (window) scanOrchestrator.setMainWindow(window);

        const scanId = await scanOrchestrator.startScan(validatedConfig);
        return { success: true, data: { scanId } };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to start scan' };
      }
    }
  );

  ipcMain.handle(
    'scan:stop',
    async (_, scanId: unknown): Promise<IpcResponse<void>> => {
      try {
        requireAuth();
        const id = assertString(scanId, 'scanId');
        await scanOrchestrator.stopScan(id);
        return { success: true };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to stop scan' };
      }
    }
  );

  // ── Cost Analysis ──

  ipcMain.handle(
    'cost:get-analysis',
    async (_, profileName: unknown, startDate: unknown, endDate: unknown, granularity: unknown): Promise<IpcResponse<CostAnalysisResult>> => {
      try {
        requireAuth();
        const name = assertProfileName(profileName, 'profileName');
        const start = assertDateString(startDate, 'startDate');
        const end = assertDateString(endDate, 'endDate');
        const gran = granularity
          ? assertOneOf(granularity, ['DAILY', 'MONTHLY'] as const, 'granularity')
          : 'DAILY' as CostGranularity;
        const result = await getDetailedCostAnalysis(name, start, end, gran);
        return { success: true, data: result };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to get cost analysis' };
      }
    }
  );

  ipcMain.handle(
    'cost:get-trend',
    async (_, profileName: unknown, days: unknown, granularity: unknown): Promise<IpcResponse<CostTrendDataPoint[]>> => {
      try {
        requireAuth();
        const name = assertProfileName(profileName, 'profileName');
        const d = assertOptionalNumber(days, 'days', 1, 365) ?? 30;
        const gran = granularity
          ? assertOneOf(granularity, ['DAILY', 'MONTHLY'] as const, 'granularity')
          : 'DAILY' as CostGranularity;
        const result = await getCostTrend(name, d, gran);
        return { success: true, data: result };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to get cost trend' };
      }
    }
  );

  ipcMain.handle(
    'cost:get-optimizations',
    async (_, profileName: unknown, days: unknown, region?: unknown): Promise<IpcResponse<CostOptimizationResult>> => {
      try {
        requireAuth();
        const name = assertProfileName(profileName, 'profileName');
        const d = assertOptionalNumber(days, 'days', 1, 365) ?? 30;
        const r = region ? assertString(region, 'region', 1, 30) : undefined;
        const result = await getCostOptimizations(name, d, r);
        return { success: true, data: result };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to get cost optimizations' };
      }
    }
  );

  // ── Credits Analysis ──
  ipcMain.handle(
    'cost:get-credits',
    async (_, profileName: unknown, startDate: unknown, endDate: unknown): Promise<IpcResponse<CreditsAnalysisResult>> => {
      try {
        requireAuth();
        const name = assertProfileName(profileName, 'profileName');
        const start = assertDateString(startDate, 'startDate');
        const end = assertDateString(endDate, 'endDate');
        const result = await getAWSCreditsAnalysis(name, start, end);
        return { success: true, data: result };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to get credits analysis' };
      }
    }
  );

  // ── Security Analysis ──

  ipcMain.handle(
    'security:get-posture',
    async (_, profileName: unknown, region: unknown, includeArchived: unknown): Promise<IpcResponse<SecurityAnalysisResult>> => {
      try {
        requireAuth();
        const name = assertProfileName(profileName, 'profileName');
        const r = region ? assertString(region, 'region', 1, 30) : 'us-east-1';
        const archived = typeof includeArchived === 'boolean' ? includeArchived : false;
        const result = await getSecurityFindings(name, r, archived);
        return { success: true, data: result };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to get security posture' };
      }
    }
  );

  ipcMain.handle(
    'security:get-finding-details',
    async (_, profileName: unknown, findingId: unknown, region: unknown): Promise<IpcResponse<SecurityFinding | null>> => {
      try {
        requireAuth();
        const name = assertProfileName(profileName, 'profileName');
        const fId = assertString(findingId, 'findingId', 1, 512);
        const r = region ? assertString(region, 'region', 1, 30) : 'us-east-1';
        const result = await getSecurityFindingById(name, fId, r);
        return { success: true, data: result };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to get finding details' };
      }
    }
  );

  ipcMain.handle(
    'security:run-best-practices-scan',
    async (_, profileName: unknown, region: unknown): Promise<IpcResponse<{ started: boolean }>> => {
      try {
        requireAuth();
        const name = assertProfileName(profileName, 'profileName');
        const r = region ? assertString(region, 'region', 1, 30) : 'us-east-1';
        const mainWindow = BrowserWindow.getAllWindows()[0];

        runBestPracticesScan(name, r).then((result) => {
          const enriched = { ...result, id: require('crypto').randomUUID(), profileName: name, region: r, timestamp: new Date().toISOString(), scanMode: 'best-practices' };
          try { dbManager.createAWSSecurityScan(enriched); } catch (e) { console.error('[aws] Failed to save security scan:', e); }
          mainWindow?.webContents.send('security:completed', enriched);
        }).catch((error) => {
          mainWindow?.webContents.send('security:failed', { error: error instanceof Error ? error.message : String(error) });
        });

        return { success: true, data: { started: true } };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to run best practices scan' };
      }
    }
  );

  ipcMain.handle('security:get-all', async (_, profileName: unknown, limit: unknown) => {
    try { requireAuth(); return { success: true, data: dbManager.getAllAWSSecurityScans(profileName && typeof profileName === 'string' ? profileName : undefined, typeof limit === 'number' ? limit : 20) }; }
    catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Failed to get security history' }; }
  });
  ipcMain.handle('security:get-by-id', async (_, id: unknown) => {
    try { requireAuth(); const data = dbManager.getAWSSecurityScan(assertString(id, 'id')); if (!data) return { success: false, error: 'Scan not found' }; return { success: true, data }; }
    catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Failed to get scan' }; }
  });
  ipcMain.handle('security:delete', async (_, id: unknown) => {
    try { requireAuth(); dbManager.deleteAWSSecurityScan(assertString(id, 'id')); return { success: true, data: undefined }; }
    catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Failed to delete scan' }; }
  });

  // ── Well-Architected ──

  ipcMain.handle(
    'wellarchitected:list-workloads',
    async (_, profileName: unknown, region: unknown): Promise<IpcResponse<WAAnalysisResult>> => {
      try {
        requireAuth();
        const name = assertProfileName(profileName, 'profileName');
        const r = region ? assertString(region, 'region', 1, 30) : 'us-west-2';
        const result = await listWorkloads(name, r);
        return { success: true, data: result };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to list workloads' };
      }
    }
  );

  ipcMain.handle(
    'wellarchitected:get-workload',
    async (_, profileName: unknown, region: unknown, workloadId: unknown): Promise<IpcResponse<WAWorkloadSummary | null>> => {
      try {
        requireAuth();
        const name = assertProfileName(profileName, 'profileName');
        const r = assertString(region, 'region', 1, 30);
        const wId = assertString(workloadId, 'workloadId');
        const result = await getWorkloadDetails(name, r, wId);
        return { success: true, data: result };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to get workload details' };
      }
    }
  );

  ipcMain.handle(
    'wellarchitected:get-lens-review',
    async (_, profileName: unknown, region: unknown, workloadId: unknown, lensAlias: unknown): Promise<IpcResponse<WALensReview | null>> => {
      try {
        requireAuth();
        const name = assertProfileName(profileName, 'profileName');
        const r = assertString(region, 'region', 1, 30);
        const wId = assertString(workloadId, 'workloadId');
        const lens = lensAlias ? assertString(lensAlias, 'lensAlias', 1, 128) : 'wellarchitected';
        const result = await getLensReview(name, r, wId, lens);
        return { success: true, data: result };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to get lens review' };
      }
    }
  );

  ipcMain.handle(
    'wellarchitected:get-improvements',
    async (_, profileName: unknown, region: unknown, workloadId: unknown, lensAlias: unknown): Promise<IpcResponse<WAImprovementItem[]>> => {
      try {
        requireAuth();
        const name = assertProfileName(profileName, 'profileName');
        const r = assertString(region, 'region', 1, 30);
        const wId = assertString(workloadId, 'workloadId');
        const lens = lensAlias ? assertString(lensAlias, 'lensAlias', 1, 128) : 'wellarchitected';
        const result = await getImprovements(name, r, wId, lens);
        return { success: true, data: result };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to get improvements' };
      }
    }
  );

  ipcMain.handle(
    'wellarchitected:run-best-practices-scan',
    async (event, profileName: unknown, region: unknown): Promise<IpcResponse<{ started: boolean }>> => {
      try {
        requireAuth();
        const name = assertProfileName(profileName, 'profileName');
        const r = region ? assertString(region, 'region', 1, 30) : 'us-west-2';
        const mainWindow = BrowserWindow.fromWebContents(event.sender) || BrowserWindow.getAllWindows()[0];

        const progressCallback = (progress: { phase: string; pillar: string; service: string; percent: number }) => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send('wellarchitected:best-practices-progress', progress);
          }
        };

        runWABestPracticesScan(name, r, progressCallback).then((result) => {
          const enriched = { ...result, id: require('crypto').randomUUID(), profileName: name, region: r, timestamp: new Date().toISOString() };
          try { dbManager.createAWSWellArchitected(enriched); } catch (e) { console.error('[aws] Failed to save WA scan:', e); }
          mainWindow?.webContents.send('wellarchitected:completed', enriched);
        }).catch((error) => {
          mainWindow?.webContents.send('wellarchitected:failed', { error: error instanceof Error ? error.message : String(error) });
        });

        return { success: true, data: { started: true } };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to run best practices scan' };
      }
    }
  );

  ipcMain.handle('wellarchitected:get-all', async (_, profileName: unknown, limit: unknown) => {
    try { requireAuth(); return { success: true, data: dbManager.getAllAWSWellArchitected(profileName && typeof profileName === 'string' ? profileName : undefined, typeof limit === 'number' ? limit : 20) }; }
    catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Failed to get WA history' }; }
  });
  ipcMain.handle('wellarchitected:get-by-id', async (_, id: unknown) => {
    try { requireAuth(); const data = dbManager.getAWSWellArchitected(assertString(id, 'id')); if (!data) return { success: false, error: 'Scan not found' }; return { success: true, data }; }
    catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Failed to get scan' }; }
  });
  ipcMain.handle('wellarchitected:delete', async (_, id: unknown) => {
    try { requireAuth(); dbManager.deleteAWSWellArchitected(assertString(id, 'id')); return { success: true, data: undefined }; }
    catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Failed to delete scan' }; }
  });

  // ── Assessment ──

  ipcMain.handle(
    'assessment:run',
    async (event, config: unknown): Promise<IpcResponse<AssessmentResult>> => {
      try {
        requireAuth();
        const c = assertObject(config, 'config');
        const validatedConfig: AssessmentConfig = {
          profile: assertProfileName(c.profile, 'profile'),
          region: assertString(c.region, 'region', 1, 30),
          domains: assertStringArray(c.domains, 'domains', 10) as AssessmentConfig['domains'],
          costDays: assertOptionalNumber(c.costDays, 'costDays', 1, 365),
          includeResourceScan: typeof c.includeResourceScan === 'boolean' ? c.includeResourceScan : undefined,
          servicesToScan: c.servicesToScan ? assertStringArray(c.servicesToScan, 'servicesToScan', 200) as AssessmentConfig['servicesToScan'] : undefined,
        };

        const window = BrowserWindow.fromWebContents(event.sender);
        const progressCallback = (progress: { stage: string; percent: number; message: string }) => {
          if (window && !window.isDestroyed()) {
            window.webContents.send('assessment:progress', progress);
          }
        };

        const result = await runAssessment(validatedConfig, progressCallback);

        try {
          dbManager.createAssessment(result);
        } catch (saveError) {
          console.error('Failed to save assessment to history:', saveError);
        }

        return { success: true, data: result };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to run assessment' };
      }
    }
  );

  ipcMain.handle(
    'assessment:generate-report',
    async (event, result: unknown, outputDir: unknown): Promise<IpcResponse<{ filePath: string }>> => {
      try {
        requireAuth();
        assertObject(result, 'result');
        const dir = assertSafePath(assertString(outputDir, 'outputDir', 1, 1024), 'outputDir');

        const window = BrowserWindow.fromWebContents(event.sender);
        const progressCallback = (progress: { percent: number; stage: string }) => {
          if (window && !window.isDestroyed()) {
            window.webContents.send('assessment:report-progress', progress);
          }
        };

        const filePath = await generateAssessmentPdf(dir, result as AssessmentResult, progressCallback);
        return { success: true, data: { filePath } };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to generate assessment report' };
      }
    }
  );

  ipcMain.handle(
    'assessment:get-all',
    async (_, limit?: unknown): Promise<IpcResponse<AssessmentSummary[]>> => {
      try {
        requireAuth();
        const l = assertOptionalNumber(limit, 'limit', 1, 1000) ?? 50;
        const assessments = dbManager.getAllAssessments(l);
        return { success: true, data: assessments };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to get assessment history' };
      }
    }
  );

  ipcMain.handle(
    'assessment:get-by-id',
    async (_, id: unknown): Promise<IpcResponse<AssessmentResult>> => {
      try {
        requireAuth();
        const assessmentId = assertString(id, 'id');
        const assessment = dbManager.getAssessment(assessmentId);
        if (!assessment) return { success: false, error: 'Assessment not found' };
        return { success: true, data: assessment };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to get assessment' };
      }
    }
  );

  ipcMain.handle(
    'assessment:delete',
    async (_, id: unknown): Promise<IpcResponse<void>> => {
      try {
        requireAuth();
        const assessmentId = assertString(id, 'id');
        dbManager.deleteAssessment(assessmentId);
        return { success: true };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to delete assessment' };
      }
    }
  );

  // ── Tag Governance ──

  ipcMain.handle(
    'tags:get-config',
    async (): Promise<IpcResponse<TagGovernanceConfig>> => {
      try {
        requireAuth();
        const requiredTags = dbManager.getTagGovernanceConfig();
        return { success: true, data: { requiredTags } };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to get tag config' };
      }
    }
  );

  ipcMain.handle(
    'tags:save-config',
    async (_, tags: unknown): Promise<IpcResponse<void>> => {
      try {
        requireAuth();
        const requiredTags = assertStringArray(tags, 'requiredTags', 50);
        dbManager.saveTagGovernanceConfig(requiredTags);
        return { success: true };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to save tag config' };
      }
    }
  );

  ipcMain.handle(
    'tags:get-compliance',
    async (_, scanId: unknown): Promise<IpcResponse<TagComplianceResult>> => {
      try {
        requireAuth();
        const id = assertString(scanId, 'scanId');
        const requiredTags = dbManager.getTagGovernanceConfig();

        if (requiredTags.length === 0) {
          return { success: false, error: 'No required tags configured. Go to Tag Governance settings first.' };
        }

        const resources = dbManager.getResourcesByScan(id);
        if (resources.length === 0) {
          return { success: false, error: 'No resources found for this scan.' };
        }

        const serviceMap = new Map<string, { total: number; compliant: number }>();
        const tagKeyMap = new Map<string, { total: number; tagged: number }>();
        const untaggedResources: UntaggedResource[] = [];
        let fullyCompliant = 0;

        for (const tag of requiredTags) {
          tagKeyMap.set(tag, { total: 0, tagged: 0 });
        }

        for (const resource of resources) {
          const tags = resource.tags || {};
          const missing: string[] = [];

          for (const reqTag of requiredTags) {
            const entry = tagKeyMap.get(reqTag)!;
            entry.total++;
            if (tags[reqTag] !== undefined && tags[reqTag] !== '') {
              entry.tagged++;
            } else {
              missing.push(reqTag);
            }
          }

          const svcEntry = serviceMap.get(resource.service) || { total: 0, compliant: 0 };
          svcEntry.total++;
          if (missing.length === 0) {
            svcEntry.compliant++;
            fullyCompliant++;
          }
          serviceMap.set(resource.service, svcEntry);

          if (missing.length > 0) {
            untaggedResources.push({
              id: resource.id,
              name: resource.name || resource.id,
              service: resource.service,
              region: resource.region,
              missingTags: missing,
            });
          }
        }

        const byService: TagServiceCompliance[] = Array.from(serviceMap.entries())
          .map(([service, { total, compliant }]) => ({
            service,
            totalResources: total,
            compliantResources: compliant,
            compliancePercent: total > 0 ? Math.round((compliant / total) * 100) : 0,
          }))
          .sort((a, b) => a.compliancePercent - b.compliancePercent);

        const byTagKey: TagKeyCompliance[] = Array.from(tagKeyMap.entries())
          .map(([tagKey, { total, tagged }]) => ({
            tagKey,
            totalResources: total,
            taggedResources: tagged,
            coveragePercent: total > 0 ? Math.round((tagged / total) * 100) : 0,
          }))
          .sort((a, b) => a.coveragePercent - b.coveragePercent);

        const result: TagComplianceResult = {
          scanId: id,
          totalResources: resources.length,
          fullyCompliantResources: fullyCompliant,
          overallCompliancePercent: resources.length > 0 ? Math.round((fullyCompliant / resources.length) * 100) : 0,
          byService,
          byTagKey,
          untaggedResources: untaggedResources.slice(0, 500),
        };

        return { success: true, data: result };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to compute tag compliance' };
      }
    }
  );

  // ── Scan Scheduling ──

  ipcMain.handle('schedule:get-all', async (): Promise<IpcResponse<ScanSchedule[]>> => {
    try {
      requireAuth();
      const scheduler = getScheduler();
      if (!scheduler) return { success: false, error: 'Scheduler not initialized' };
      return { success: true, data: scheduler.getAll() };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get schedules' };
    }
  });

  ipcMain.handle('schedule:create', async (_, config: unknown): Promise<IpcResponse<ScanSchedule>> => {
    try {
      requireAuth();
      const obj = assertObject(config, 'config');
      const name = assertString(obj.name, 'name', 1, 100);
      const profileName = assertProfileName(obj.profileName, 'profileName');
      const regions = assertStringArray(obj.regions, 'regions', 30);
      const services = assertStringArray(obj.services, 'services', 200);
      const frequency = assertOneOf(obj.frequency, ['hourly', 'daily', 'weekly'] as const, 'frequency');
      const autoAssess = obj.autoAssess === true;

      const scheduler = getScheduler();
      if (!scheduler) return { success: false, error: 'Scheduler not initialized' };

      const schedule = scheduler.create({ name, profileName, regions, services, frequency, autoAssess });
      return { success: true, data: schedule };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to create schedule' };
    }
  });

  ipcMain.handle('schedule:toggle', async (_, id: unknown, enabled: unknown): Promise<IpcResponse<void>> => {
    try {
      requireAuth();
      const scheduleId = assertString(id, 'id');
      const isEnabled = enabled === true;
      const scheduler = getScheduler();
      if (!scheduler) return { success: false, error: 'Scheduler not initialized' };
      scheduler.toggle(scheduleId, isEnabled);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to toggle schedule' };
    }
  });

  ipcMain.handle('schedule:delete', async (_, id: unknown): Promise<IpcResponse<void>> => {
    try {
      requireAuth();
      const scheduleId = assertString(id, 'id');
      const scheduler = getScheduler();
      if (!scheduler) return { success: false, error: 'Scheduler not initialized' };
      scheduler.delete(scheduleId);
      return { success: true };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to delete schedule' };
    }
  });

  // ── Network Reachability ──

  ipcMain.handle(
    'network:analyze-reachability',
    async (_, profileName: unknown, region: unknown): Promise<IpcResponse<{ started: boolean }>> => {
      try {
        requireAuth();
        const name = assertProfileName(profileName, 'profileName');
        const r = assertString(region, 'region', 1, 30);
        const mainWindow = BrowserWindow.getAllWindows()[0];

        analyzeNetworkReachability(name, r).then((result) => {
          const enriched = { ...result, id: require('crypto').randomUUID(), profileName: name, region: r, timestamp: new Date().toISOString() };
          try { dbManager.createAWSNetworkAnalysis(enriched); } catch (e) { console.error('[aws] Failed to save network analysis:', e); }
          mainWindow?.webContents.send('network:completed', enriched);
        }).catch((error) => {
          mainWindow?.webContents.send('network:failed', { error: error instanceof Error ? error.message : String(error) });
        });

        return { success: true, data: { started: true } };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to analyze network reachability' };
      }
    }
  );

  ipcMain.handle('network:get-all', async (_, profileName: unknown, limit: unknown) => {
    try { requireAuth(); return { success: true, data: dbManager.getAllAWSNetworkAnalyses(profileName && typeof profileName === 'string' ? profileName : undefined, typeof limit === 'number' ? limit : 20) }; }
    catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Failed to get network history' }; }
  });
  ipcMain.handle('network:get-by-id', async (_, id: unknown) => {
    try { requireAuth(); const data = dbManager.getAWSNetworkAnalysis(assertString(id, 'id')); if (!data) return { success: false, error: 'Analysis not found' }; return { success: true, data }; }
    catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Failed to get analysis' }; }
  });
  ipcMain.handle('network:delete', async (_, id: unknown) => {
    try { requireAuth(); dbManager.deleteAWSNetworkAnalysis(assertString(id, 'id')); return { success: true, data: undefined }; }
    catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Failed to delete analysis' }; }
  });

  // ── IAM Deep Analysis ──

  ipcMain.handle(
    'iam:run-analysis',
    async (_, profileName: unknown): Promise<IpcResponse<{ started: boolean }>> => {
      try {
        requireAuth();
        const name = assertProfileName(profileName, 'profileName');
        const mainWindow = BrowserWindow.getAllWindows()[0];

        runIAMAnalysis(name).then((result) => {
          const enriched = { ...result, id: require('crypto').randomUUID(), profileName: name, timestamp: new Date().toISOString() };
          try { dbManager.createAWSIAMAnalysis(enriched); } catch (e) { console.error('[aws] Failed to save IAM analysis:', e); }
          mainWindow?.webContents.send('iam:completed', enriched);
        }).catch((error) => {
          mainWindow?.webContents.send('iam:failed', { error: error instanceof Error ? error.message : String(error) });
        });

        return { success: true, data: { started: true } };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to run IAM analysis' };
      }
    }
  );

  ipcMain.handle('iam:get-all', async (_, profileName: unknown, limit: unknown) => {
    try { requireAuth(); return { success: true, data: dbManager.getAllAWSIAMAnalyses(profileName && typeof profileName === 'string' ? profileName : undefined, typeof limit === 'number' ? limit : 20) }; }
    catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Failed to get IAM history' }; }
  });
  ipcMain.handle('iam:get-by-id', async (_, id: unknown) => {
    try { requireAuth(); const data = dbManager.getAWSIAMAnalysis(assertString(id, 'id')); if (!data) return { success: false, error: 'Analysis not found' }; return { success: true, data }; }
    catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Failed to get analysis' }; }
  });
  ipcMain.handle('iam:delete', async (_, id: unknown) => {
    try { requireAuth(); dbManager.deleteAWSIAMAnalysis(assertString(id, 'id')); return { success: true, data: undefined }; }
    catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Failed to delete analysis' }; }
  });

  // ── Compliance Frameworks ──

  ipcMain.handle('compliance:get-frameworks', async (): Promise<IpcResponse<ComplianceFrameworkMeta[]>> => {
    try {
      requireAuth();
      return { success: true, data: getAvailableFrameworks() };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get frameworks' };
    }
  });

  ipcMain.handle(
    'compliance:run-assessment',
    async (_, profileName: unknown, region: unknown, frameworkId: unknown): Promise<IpcResponse<{ started: boolean }>> => {
      try {
        requireAuth();
        const name = assertProfileName(profileName, 'profileName');
        const r = assertString(region, 'region', 1, 30);
        const fid = assertString(frameworkId, 'frameworkId', 1, 50);
        const mainWindow = BrowserWindow.getAllWindows()[0];

        runComplianceAssessment(name, r, fid).then((result) => {
          const enriched = { ...result, id: require('crypto').randomUUID(), profileName: name, region: r, timestamp: new Date().toISOString() };
          try { dbManager.createAWSCompliance(enriched); } catch (e) { console.error('[aws] Failed to save compliance:', e); }
          mainWindow?.webContents.send('compliance:completed', enriched);
        }).catch((error) => {
          mainWindow?.webContents.send('compliance:failed', { error: error instanceof Error ? error.message : String(error) });
        });

        return { success: true, data: { started: true } };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to run compliance assessment' };
      }
    }
  );

  ipcMain.handle('compliance:get-all', async (_, profileName: unknown, limit: unknown) => {
    try { requireAuth(); return { success: true, data: dbManager.getAllAWSCompliance(profileName && typeof profileName === 'string' ? profileName : undefined, typeof limit === 'number' ? limit : 20) }; }
    catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Failed to get compliance history' }; }
  });
  ipcMain.handle('compliance:get-by-id', async (_, id: unknown) => {
    try { requireAuth(); const data = dbManager.getAWSCompliance(assertString(id, 'id')); if (!data) return { success: false, error: 'Assessment not found' }; return { success: true, data }; }
    catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Failed to get assessment' }; }
  });
  ipcMain.handle('compliance:delete', async (_, id: unknown) => {
    try { requireAuth(); dbManager.deleteAWSCompliance(assertString(id, 'id')); return { success: true, data: undefined }; }
    catch (error) { return { success: false, error: error instanceof Error ? error.message : 'Failed to delete assessment' }; }
  });

  // ── EKS Cost Analysis ──

  ipcMain.handle(
    'eks:get-costs',
    async (_, profileName: unknown, region: unknown, startDate: unknown, endDate: unknown, clusterFilter?: unknown): Promise<IpcResponse<EKSCostAnalysis>> => {
      try {
        requireAuth();
        const name = assertString(profileName, 'profileName');
        const r = assertString(region, 'region', 1, 30);
        const start = assertString(startDate, 'startDate');
        const end = assertString(endDate, 'endDate');
        const cluster = clusterFilter && typeof clusterFilter === 'string' ? clusterFilter : undefined;
        const result = await getEKSCostAnalysis(name, r, start, end, cluster);
        return { success: true, data: result };
      } catch (error) {
        return { success: false, error: error instanceof Error ? error.message : 'Failed to get EKS costs' };
      }
    }
  );

  // ── AWS Cost Cache (reuses gcp_cost_cache table — schema is provider-agnostic) ──

  ipcMain.handle('aws:cost-cache:save', async (
    _event,
    entry: GCPCostCacheEntry
  ): Promise<IpcResponse<void>> => {
    try {
      dbManager.saveGCPCostCacheEntry(entry);
      return { success: true, data: undefined };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to save cost cache entry' };
    }
  });

  ipcMain.handle('aws:cost-cache:list', async (
    _event,
    identity: string,
    dataType: string,
    limit?: number
  ): Promise<IpcResponse<GCPCostCacheEntry[]>> => {
    try {
      const entries = dbManager.listGCPCostCacheEntries(identity, dataType, limit);
      return { success: true, data: entries };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to list cost cache entries' };
    }
  });

  ipcMain.handle('aws:cost-cache:get', async (
    _event,
    id: string
  ): Promise<IpcResponse<GCPCostCacheEntry>> => {
    try {
      const entry = dbManager.getGCPCostCacheEntry(id);
      if (!entry) return { success: false, error: 'Cost cache entry not found' };
      return { success: true, data: entry };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get cost cache entry' };
    }
  });

  ipcMain.handle('aws:cost-cache:get-latest', async (
    _event,
    identity: string,
    dataType: string
  ): Promise<IpcResponse<GCPCostCacheEntry>> => {
    try {
      const entry = dbManager.getLatestGCPCostCacheEntry(identity, dataType);
      if (!entry) return { success: false, error: 'No cached cost data found' };
      return { success: true, data: entry };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get latest cost cache entry' };
    }
  });

  ipcMain.handle('aws:cost-cache:delete', async (
    _event,
    id: string
  ): Promise<IpcResponse<void>> => {
    try {
      dbManager.deleteGCPCostCacheEntry(id);
      return { success: true, data: undefined };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to delete cost cache entry' };
    }
  });

}

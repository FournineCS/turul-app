// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { create } from 'zustand';
import type {
  AssessmentConfig,
  AssessmentResult,
  AssessmentProgress,
  AssessmentSummary,
  CloudProvider,
  GCPAssessmentResult,
  GCPAssessmentProgress,
  GCPAssessmentSummary,
  GCPServiceType,
  ServiceType,
} from '../../shared/types';
import { useScanStore } from './scanStore';
import { useProfileStore } from './profileStore';
import { useGCPProjectStore } from './gcpProjectStore';
import { useCostStore } from './costStore';
import { useToastStore } from './toastStore';

export type FullRunStage =
  | 'idle'
  | 'discovering'
  | 'scanning'
  | 'analyzing'
  | 'finalizing'
  | 'done'
  | 'error';

const FALLBACK_AWS_SERVICES: ServiceType[] = [
  'ec2', 's3', 'rds', 'lambda', 'iam', 'vpc', 'cloudtrail', 'kms', 'dynamodb', 'cloudfront',
];

const FALLBACK_GCP_SERVICES: GCPServiceType[] = [
  'gce', 'gke', 'cloud-run', 'cloud-functions',
  'vpc-network', 'vpc-firewall',
  'gclb',
  'cloud-sql', 'gcs',
];

const FULL_RUN_REGIONS = ['us-east-1', 'us-east-2', 'us-west-2', 'eu-west-1'];
const SCAN_TIMEOUT_MS = 15 * 60 * 1000;
const ANALYSIS_TIMEOUT_MS = 15 * 60 * 1000;

interface AssessmentState {
  config: AssessmentConfig | null;
  result: AssessmentResult | null;
  progress: AssessmentProgress | null;
  gcpResult: GCPAssessmentResult | null;
  gcpProgress: GCPAssessmentProgress | null;
  isRunning: boolean;
  error: string | null;
  assessmentHistory: AssessmentSummary[];
  isLoadingHistory: boolean;
  gcpHistory: GCPAssessmentSummary[];
  isLoadingGCPHistory: boolean;

  // Full-run orchestration state — drives the QuickAssessCard + FullAssessmentProgress overlay
  fullRunStage: FullRunStage;
  fullRunPercent: number;
  fullRunMessage: string;
  fullRunError: string | null;
  fullRunProvider: CloudProvider | null;

  runAssessment: (config: AssessmentConfig) => Promise<void>;
  runGCPAssessment: (projectId: string) => Promise<void>;
  runFullAssessment: (provider: CloudProvider) => Promise<void>;
  resetFullRun: () => void;
  generateReport: (outputDir: string) => Promise<string | null>;
  generateGCPReport: (outputDir: string) => Promise<string | null>;
  loadHistory: () => Promise<void>;
  loadAssessment: (id: string) => Promise<void>;
  deleteAssessment: (id: string) => Promise<void>;
  loadGCPHistory: (projectId: string) => Promise<void>;
  loadGCPAssessmentById: (id: string) => Promise<void>;
  deleteGCPAssessment: (id: string) => Promise<void>;
  reset: () => void;
  setProgress: (progress: AssessmentProgress) => void;
  setGCPProgress: (progress: GCPAssessmentProgress) => void;
  clearError: () => void;
}

export const useAssessmentStore = create<AssessmentState>((set, get) => ({
  config: null,
  result: null,
  progress: null,
  gcpResult: null,
  gcpProgress: null,
  isRunning: false,
  error: null,
  assessmentHistory: [],
  isLoadingHistory: false,
  gcpHistory: [],
  isLoadingGCPHistory: false,

  fullRunStage: 'idle',
  fullRunPercent: 0,
  fullRunMessage: '',
  fullRunError: null,
  fullRunProvider: null,

  resetFullRun: () =>
    set({
      fullRunStage: 'idle',
      fullRunPercent: 0,
      fullRunMessage: '',
      fullRunError: null,
      fullRunProvider: null,
    }),

  runFullAssessment: async (provider) => {
    const stage = get().fullRunStage;
    if (stage !== 'idle' && stage !== 'done' && stage !== 'error') {
      return; // Already running
    }

    set({
      fullRunStage: 'discovering',
      fullRunPercent: 5,
      fullRunMessage: 'Preparing assessment...',
      fullRunError: null,
      fullRunProvider: provider,
    });

    try {
      if (provider === 'aws') {
        await runFullAwsAssessment(set, get);
      } else {
        await runFullGcpAssessment(set, get);
      }

      set({
        fullRunStage: 'done',
        fullRunPercent: 100,
        fullRunMessage: 'Assessment complete',
      });
      useToastStore.getState().addToast(
        'success',
        'Assessment complete — your dashboard is ready.'
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Assessment failed';
      set({
        fullRunStage: 'error',
        fullRunError: message,
        fullRunMessage: message,
      });
      useToastStore.getState().addToast('error', `Assessment failed: ${message}`);
    }
  },

  runGCPAssessment: async (projectId) => {
    if (!window.electronAPI?.gcp?.assessment) {
      set({ error: 'GCP Assessment API not available', isRunning: false });
      return;
    }
    set({ isRunning: true, error: null, gcpResult: null, gcpProgress: null });
    try {
      const response = await window.electronAPI.gcp.assessment.run({ projectId, domains: [] });
      if (!response.success) {
        set({ error: response.error || 'Failed to start GCP assessment', isRunning: false });
      }
      // Result will arrive via onCompleted event — don't set isRunning: false here
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to run GCP assessment',
        isRunning: false,
      });
    }
  },

  runAssessment: async (config) => {
    if (!window.electronAPI?.assessment) {
      set({ error: 'Electron API not available', isRunning: false });
      return;
    }

    set({ isRunning: true, error: null, result: null, progress: null, config });

    try {
      const response = await window.electronAPI.assessment.run(config);

      if (response.success && response.data) {
        set({ result: response.data, isRunning: false, progress: null });
        // Refresh history after successful run
        get().loadHistory();
      } else {
        set({ error: response.error || 'Failed to run assessment', isRunning: false });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to run assessment',
        isRunning: false,
      });
    }
  },

  generateReport: async (outputDir) => {
    const { result } = get();
    if (!result || !window.electronAPI?.assessment) {
      set({ error: 'No assessment result or Electron API not available' });
      return null;
    }

    try {
      const response = await window.electronAPI.assessment.generateReport(result, outputDir);
      if (response.success && response.data) {
        return response.data.filePath;
      } else {
        set({ error: response.error || 'Failed to generate report' });
        return null;
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to generate report',
      });
      return null;
    }
  },

  generateGCPReport: async (outputDir) => {
    const { gcpResult } = get();
    if (!gcpResult || !window.electronAPI?.gcp?.assessment?.generateReport) {
      set({ error: 'No GCP assessment result or API not available' });
      return null;
    }

    try {
      const response = await window.electronAPI.gcp.assessment.generateReport(gcpResult, outputDir);
      if (response.success && response.data) {
        return response.data.filePath;
      } else {
        set({ error: response.error || 'Failed to generate GCP report' });
        return null;
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to generate GCP report',
      });
      return null;
    }
  },

  loadHistory: async () => {
    if (!window.electronAPI?.assessment) return;

    set({ isLoadingHistory: true });
    try {
      const response = await window.electronAPI.assessment.getAll();
      if (response.success && response.data) {
        set({ assessmentHistory: response.data, isLoadingHistory: false });
      } else {
        set({ isLoadingHistory: false });
      }
    } catch {
      set({ isLoadingHistory: false });
    }
  },

  loadAssessment: async (id) => {
    if (!window.electronAPI?.assessment) {
      set({ error: 'Electron API not available' });
      return;
    }

    try {
      const response = await window.electronAPI.assessment.getById(id);
      if (response.success && response.data) {
        set({ result: response.data, error: null });
      } else {
        set({ error: response.error || 'Failed to load assessment' });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load assessment',
      });
    }
  },

  deleteAssessment: async (id) => {
    if (!window.electronAPI?.assessment) return;

    try {
      const response = await window.electronAPI.assessment.delete(id);
      if (response.success) {
        set((state) => ({
          assessmentHistory: state.assessmentHistory.filter((a) => a.id !== id),
        }));
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to delete assessment',
      });
    }
  },

  loadGCPHistory: async (projectId) => {
    if (!window.electronAPI?.gcp?.assessment?.getAll) return;

    set({ isLoadingGCPHistory: true });
    try {
      const response = await window.electronAPI.gcp.assessment.getAll(projectId, 20);
      if (response.success && response.data) {
        set({ gcpHistory: response.data, isLoadingGCPHistory: false });
      } else {
        set({ isLoadingGCPHistory: false });
      }
    } catch {
      set({ isLoadingGCPHistory: false });
    }
  },

  loadGCPAssessmentById: async (id) => {
    if (!window.electronAPI?.gcp?.assessment?.getById) return;

    try {
      const response = await window.electronAPI.gcp.assessment.getById(id);
      if (response.success && response.data) {
        set({ gcpResult: response.data, error: null });
      } else {
        set({ error: response.error || 'Failed to load GCP assessment' });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load GCP assessment',
      });
    }
  },

  deleteGCPAssessment: async (id) => {
    if (!window.electronAPI?.gcp?.assessment?.delete) return;

    try {
      await window.electronAPI.gcp.assessment.delete(id);
      set((state) => ({
        gcpHistory: state.gcpHistory.filter((h) => h.id !== id),
      }));
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to delete GCP assessment',
      });
    }
  },

  reset: () => set({
    config: null,
    result: null,
    progress: null,
    gcpResult: null,
    gcpProgress: null,
    isRunning: false,
    error: null,
  }),

  setProgress: (progress) => set({ progress }),
  setGCPProgress: (progress) => set({ gcpProgress: progress }),

  clearError: () => set({ error: null }),
}));

// ─────────────────────────────────────────────────────────────────────────────
// Full assessment orchestration helpers — keep the store action body short.
// These chain existing IPC channels (scan + assessment + compliance) so a
// first-time user can populate every dashboard widget with one click.
// ─────────────────────────────────────────────────────────────────────────────

type SetState = (
  partial:
    | Partial<AssessmentState>
    | ((state: AssessmentState) => Partial<AssessmentState>),
) => void;
type GetState = () => AssessmentState;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

async function discoverAwsServices(profile: string): Promise<ServiceType[]> {
  if (!window.electronAPI?.aws?.discoverServicesByCost) return FALLBACK_AWS_SERVICES;
  try {
    const response = await window.electronAPI.aws.discoverServicesByCost(profile, 30);
    if (response.success && response.data?.activeServices?.length) {
      return response.data.activeServices;
    }
  } catch {
    // Discovery is best-effort — fall through to the fallback list
  }
  return FALLBACK_AWS_SERVICES;
}

async function discoverGcpServices(
  projectId: string,
  bqProject: string | undefined,
  bqDataset: string | undefined,
  bqRegion: string | undefined,
): Promise<{ services: GCPServiceType[]; usedFallback: boolean }> {
  if (!bqProject || !window.electronAPI?.gcp?.scan?.discoverServices) {
    return { services: FALLBACK_GCP_SERVICES, usedFallback: true };
  }
  try {
    const response = await window.electronAPI.gcp.scan.discoverServices(
      projectId,
      30,
      bqProject,
      bqDataset || undefined,
      bqRegion || undefined,
    );
    if (response.success && response.data?.activeServices?.length) {
      return { services: response.data.activeServices, usedFallback: false };
    }
  } catch {
    // Fall through to defaults
  }
  return { services: FALLBACK_GCP_SERVICES, usedFallback: true };
}

/**
 * Resolves once the active scan emits `currentRegion === 'done'`.
 * Maps scan progress into the 10-50% slice of the overall full-run bar.
 */
function awaitScanCompletion(set: SetState): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (!window.electronAPI?.scan?.onProgress) {
      reject(new Error('Scan progress API unavailable'));
      return;
    }
    let settled = false;
    const unsubscribe = window.electronAPI.scan.onProgress((progress) => {
      if (settled) return;
      const totalRegions = progress.totalRegions || 0;
      const totalServices = progress.totalServices || 0;
      let regionPct = 0;
      if (totalRegions > 0) {
        regionPct =
          (progress.completedRegions + (progress.completedServices / Math.max(1, totalServices))) /
          totalRegions;
      } else if (totalServices > 0) {
        regionPct = progress.completedServices / totalServices;
      }
      const overall = clamp(10 + regionPct * 40, 10, 50);
      set({
        fullRunPercent: overall,
        fullRunMessage:
          progress.currentRegion === 'done'
            ? 'Scan complete'
            : `Scanning ${progress.currentService || '...'} in ${progress.currentRegion || '...'}`,
      });
      if (progress.currentRegion === 'done') {
        settled = true;
        unsubscribe();
        resolve();
      }
    });
    setTimeout(() => {
      if (settled) return;
      settled = true;
      unsubscribe();
      reject(new Error('Scan timed out after 15 minutes'));
    }, SCAN_TIMEOUT_MS);
  });
}

async function runFullAwsAssessment(set: SetState, get: GetState): Promise<void> {
  if (!window.electronAPI?.scan?.start || !window.electronAPI?.assessment?.run) {
    throw new Error('AWS scan/assessment API unavailable');
  }

  const profile = useProfileStore.getState().selectedProfileName;
  if (!profile) {
    throw new Error('Select an AWS profile from the top bar first');
  }

  set({ fullRunMessage: 'Discovering active services from cost data...', fullRunPercent: 7 });
  const services = await discoverAwsServices(profile);

  // Step 1 — resource scan
  set({
    fullRunStage: 'scanning',
    fullRunPercent: 10,
    fullRunMessage: `Scanning ${services.length} services across ${FULL_RUN_REGIONS.length} regions...`,
  });

  const scanCompleted = awaitScanCompletion(set);
  const scanResponse = await window.electronAPI.scan.start({
    profileName: profile,
    regions: FULL_RUN_REGIONS,
    services,
    includeGlobal: true,
  });
  if (!scanResponse.success) {
    throw new Error(scanResponse.error || 'Failed to start scan');
  }
  await scanCompleted;
  await useScanStore.getState().loadScans('aws');

  // Step 2 — assessment + compliance in parallel
  set({
    fullRunStage: 'analyzing',
    fullRunPercent: 55,
    fullRunMessage: 'Analyzing cost, security, and well-architected posture...',
  });

  const region = FULL_RUN_REGIONS[0];

  const assessmentProgressUnsub = window.electronAPI.assessment.onProgress((progress) => {
    const overall = clamp(55 + (progress.percent || 0) * 0.3, 55, 85);
    set({
      fullRunPercent: overall,
      fullRunMessage: progress.message || 'Analyzing...',
    });
  });

  const assessmentPromise = window.electronAPI.assessment.run({
    profile,
    region,
    domains: ['cost', 'security', 'wellArchitected', 'inventory'],
    costDays: 30,
    includeResourceScan: false,
  });

  const compliancePromise = runAwsComplianceBestEffort(profile, region);

  let assessmentResult: AssessmentResult | null = null;
  try {
    const [assessResp] = await Promise.all([assessmentPromise, compliancePromise]);
    if (!assessResp.success || !assessResp.data) {
      throw new Error(assessResp.error || 'Assessment failed');
    }
    assessmentResult = assessResp.data;
  } finally {
    assessmentProgressUnsub();
  }

  set({
    result: assessmentResult,
    fullRunStage: 'finalizing',
    fullRunPercent: 90,
    fullRunMessage: 'Loading dashboard widgets...',
  });

  // Step 3 — refresh every store the dashboard reads from
  await Promise.all([
    get().loadHistory(),
    useCostStore.getState().loadCostAnalysis(profile),
    useScanStore.getState().loadScans('aws'),
  ]);
}

/**
 * Compliance is best-effort: failure here must not fail the whole full-run.
 * Resolves either when `compliance:completed` fires, when `compliance:failed`
 * fires, or after a hard 10-minute cap so the user is never stuck.
 */
function runAwsComplianceBestEffort(
  profile: string,
  region: string,
): Promise<void> {
  return new Promise<void>((resolve) => {
    if (!window.electronAPI?.compliance?.runAssessment) {
      resolve();
      return;
    }

    let settled = false;
    let unsubCompleted: (() => void) | undefined;
    let unsubFailed: (() => void) | undefined;
    const settle = () => {
      if (settled) return;
      settled = true;
      unsubCompleted?.();
      unsubFailed?.();
      resolve();
    };

    unsubCompleted = window.electronAPI.compliance.onCompleted?.(() => settle());
    unsubFailed = window.electronAPI.compliance.onFailed?.(() => settle());

    window.electronAPI.compliance
      .runAssessment(profile, region, 'cis-aws-v3')
      .then((resp) => {
        if (!resp.success) settle();
      })
      .catch(() => settle());

    setTimeout(settle, 10 * 60 * 1000);
  });
}

async function runFullGcpAssessment(set: SetState, get: GetState): Promise<void> {
  if (!window.electronAPI?.gcp?.scan?.start || !window.electronAPI?.gcp?.assessment?.run) {
    throw new Error('GCP scan/assessment API unavailable');
  }

  const projectId = useGCPProjectStore.getState().selectedProjectId;
  if (!projectId) {
    throw new Error('Select a GCP project from the top bar first');
  }
  const billingConfig = useGCPProjectStore.getState().billingConfig;

  set({ fullRunMessage: 'Discovering active GCP services...', fullRunPercent: 7 });
  const { services, usedFallback } = await discoverGcpServices(
    projectId,
    billingConfig?.bqProject,
    billingConfig?.bqDataset,
    billingConfig?.bqRegion,
  );
  if (usedFallback) {
    useToastStore
      .getState()
      .addToast(
        'info',
        'Using default GCP service set — configure BigQuery billing export for smarter discovery.',
      );
  }

  // Step 1 — GCP resource scan
  set({
    fullRunStage: 'scanning',
    fullRunPercent: 10,
    fullRunMessage: `Scanning ${services.length} GCP services...`,
  });

  const scanCompleted = awaitScanCompletion(set);
  const scanResponse = await window.electronAPI.gcp.scan.start({
    projectId,
    services,
  });
  if (!scanResponse.success) {
    throw new Error(scanResponse.error || 'Failed to start GCP scan');
  }
  await scanCompleted;
  await useScanStore.getState().loadScans('gcp');

  // Step 2 — GCP assessment (cost + security + reliability + compliance + iam)
  set({
    fullRunStage: 'analyzing',
    fullRunPercent: 55,
    fullRunMessage: 'Analyzing GCP cost, security, reliability, compliance, and IAM...',
  });

  const result = await awaitGcpAssessment(set, projectId, billingConfig);

  set({
    gcpResult: result,
    fullRunStage: 'finalizing',
    fullRunPercent: 90,
    fullRunMessage: 'Loading dashboard widgets...',
  });

  await Promise.all([
    get().loadGCPHistory(projectId),
    useCostStore.getState().loadGCPCostAnalysis(projectId),
  ]);
}

function awaitGcpAssessment(
  set: SetState,
  projectId: string,
  billingConfig: { bqProject: string; bqDataset: string; bqRegion: string } | null,
): Promise<GCPAssessmentResult> {
  return new Promise<GCPAssessmentResult>((resolve, reject) => {
    if (!window.electronAPI?.gcp?.assessment) {
      reject(new Error('GCP assessment API unavailable'));
      return;
    }
    let settled = false;
    let unsubProgress: (() => void) | undefined;
    let unsubCompleted: (() => void) | undefined;
    let unsubFailed: (() => void) | undefined;
    const cleanup = () => {
      unsubProgress?.();
      unsubCompleted?.();
      unsubFailed?.();
    };
    const settleResolve = (result: GCPAssessmentResult) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };
    const settleReject = (err: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err);
    };

    unsubProgress = window.electronAPI.gcp.assessment.onProgress((progress) => {
      const overall = clamp(55 + (progress.percent || 0) * 0.3, 55, 85);
      set({
        fullRunPercent: overall,
        fullRunMessage: progress.message || 'Analyzing...',
      });
    });
    unsubCompleted = window.electronAPI.gcp.assessment.onCompleted((result) => {
      settleResolve(result);
    });
    unsubFailed = window.electronAPI.gcp.assessment.onFailed((info) => {
      settleReject(new Error(info.error || 'GCP assessment failed'));
    });

    window.electronAPI.gcp.assessment
      .run({
        projectId,
        domains: ['cost', 'security', 'reliability', 'compliance', 'iam'],
        bqProject: billingConfig?.bqProject || undefined,
        bqDataset: billingConfig?.bqDataset || undefined,
      })
      .then((resp) => {
        if (!resp.success) {
          settleReject(new Error(resp.error || 'Failed to start GCP assessment'));
        }
      })
      .catch((err) => {
        settleReject(err instanceof Error ? err : new Error(String(err)));
      });

    setTimeout(
      () => settleReject(new Error('GCP assessment timed out after 15 minutes')),
      ANALYSIS_TIMEOUT_MS,
    );
  });
}

// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';
import type {
  AWSProfile,
  Scan,
  ScanConfig,
  ScanProgress,
  Resource,
  TopologyGraph,
  DiagramGraph,
  DiagramViewMode,
  ReportConfig,
  IpcResponse,
  CostDiscoveryResponse,
  CostAnalysisResult,
  CostTrendDataPoint,
  CostOptimizationResult,
  CostGranularity,
  GCPExpandedRecommendationsResult,
  GCPCostBestPracticesResult,
  GCPCUDCoverageResult,
  StoppedVMResult,
  SecurityAnalysisResult,
  SecurityFinding,
  WAAnalysisResult,
  WAWorkloadSummary,
  WALensReview,
  WAImprovementItem,
  WABPScanResult,
  WABPScanProgress,
  AssessmentConfig,
  AssessmentResult,
  AssessmentProgress,
  AssessmentSummary,
  AuthStatus,
  AuthSetupRequest,
  AuthLoginRequest,
  AuthChangePasswordRequest,
  AppProfileInput,
  AppProfileSummary,
  TagGovernanceConfig,
  TagComplianceResult,
  NetworkReachabilityResult,
  ScanSchedule,
  ScanScheduleConfig,
  IAMAnalysisResult,
  ComplianceFrameworkMeta,
  ComplianceAssessmentResult,
  ScanDiffResult,
  GCPProject,
  GCPOrganization,
  GCPAccountSummary,
  GCPScanConfig,
  GCPServiceDiscoveryResult,
  GCPCostFilters,
  CloudProvider,
  ResourceIdleAnalysisResult,
  GCPOptimizationSnapshot,
  GCPCostCacheEntry,
  EKSCostAnalysis,
  GCPOrgScanProgress,
  GKECostAnalysis,
  AIStreamChunk,
  ChatConversation,
  ChatMessage,
  AIProviderType,
  ChatContext,
  EnvironmentHealth,
  GCPIAMAnalysisResult,
  GCPNetworkAnalysisResult,
  GCPNetworkAnalysisSummary,
  GCPAssessmentConfig,
  GCPAssessmentResult,
  GCPAssessmentSummary,
  GCPAssessmentProgress,
  GCPIAMAnalysisSummary,
  GCPSecurityScanSummary,
  GCPComplianceSummary,
  GCPWAScanResult,
  GCPWAScanProgress,
  GCPWellArchitectedSummary,
  GCPLabelComplianceResult,
  GCPLabelComplianceSummary,
  CreditsAnalysisResult,
} from '../shared/types';

// Type-safe API for renderer process
const electronAPI = {
  // AWS Profile Management
  aws: {
    getProfiles: (): Promise<IpcResponse<AWSProfile[]>> =>
      ipcRenderer.invoke('aws:get-profiles'),
    validateProfile: (profileName: string): Promise<IpcResponse<{ accountId: string }>> =>
      ipcRenderer.invoke('aws:validate-profile', profileName),
    getRegions: (): Promise<IpcResponse<string[]>> =>
      ipcRenderer.invoke('aws:get-regions'),
    discoverServicesByCost: (profileName: string, days?: number): Promise<IpcResponse<CostDiscoveryResponse>> =>
      ipcRenderer.invoke('aws:discover-services-by-cost', profileName, days ?? 30),
  },

  // Scan Management
  scan: {
    start: (config: ScanConfig): Promise<IpcResponse<{ scanId: string }>> =>
      ipcRenderer.invoke('scan:start', config),
    stop: (scanId: string): Promise<IpcResponse<void>> =>
      ipcRenderer.invoke('scan:stop', scanId),
    getAll: (cloudProvider?: CloudProvider): Promise<IpcResponse<Scan[]>> =>
      ipcRenderer.invoke('scan:get-all', cloudProvider),
    getById: (scanId: string): Promise<IpcResponse<Scan>> =>
      ipcRenderer.invoke('scan:get-by-id', scanId),
    onProgress: (callback: (progress: ScanProgress) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, progress: ScanProgress) => callback(progress);
      ipcRenderer.on('scan:progress', handler);
      return () => ipcRenderer.removeListener('scan:progress', handler);
    },
  },

  // Resource Management
  resources: {
    getByScan: (scanId: string): Promise<IpcResponse<Resource[]>> =>
      ipcRenderer.invoke('resources:get-by-scan', scanId),
    search: (scanId: string, query: string): Promise<IpcResponse<Resource[]>> =>
      ipcRenderer.invoke('resources:search', scanId, query),
  },

  // Topology
  topology: {
    getGraph: (scanId: string): Promise<IpcResponse<TopologyGraph>> =>
      ipcRenderer.invoke('topology:get-graph', scanId),
    getDiagram: (scanId: string, viewMode: DiagramViewMode): Promise<IpcResponse<DiagramGraph>> =>
      ipcRenderer.invoke('topology:get-diagram', scanId, viewMode),
  },

  // Reports
  report: {
    generate: (config: ReportConfig): Promise<IpcResponse<{ filePath: string }>> =>
      ipcRenderer.invoke('report:generate', config),
    onProgress: (callback: (progress: { percent: number; stage: string }) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, progress: { percent: number; stage: string }) =>
        callback(progress);
      ipcRenderer.on('report:progress', handler);
      return () => ipcRenderer.removeListener('report:progress', handler);
    },
  },

  // Database / History
  db: {
    getScanHistory: (limit?: number, cloudProvider?: CloudProvider): Promise<IpcResponse<Scan[]>> =>
      ipcRenderer.invoke('db:get-scan-history', limit, cloudProvider),
    deleteScan: (scanId: string): Promise<IpcResponse<void>> =>
      ipcRenderer.invoke('db:delete-scan', scanId),
  },

  // App utilities
  app: {
    selectDirectory: (): Promise<string | null> =>
      ipcRenderer.invoke('app:select-directory'),
    selectFile: (): Promise<string | null> =>
      ipcRenderer.invoke('app:select-file'),
    getAppVersion: (): Promise<string> =>
      ipcRenderer.invoke('app:get-version'),
    saveFile: (defaultName: string, dataUrl: string): Promise<string | null> =>
      ipcRenderer.invoke('app:save-file', defaultName, dataUrl),
  },

  // Cost Analysis
  cost: {
    getAnalysis: (
      profileName: string,
      startDate: string,
      endDate: string,
      granularity: CostGranularity = 'DAILY'
    ): Promise<IpcResponse<CostAnalysisResult>> =>
      ipcRenderer.invoke('cost:get-analysis', profileName, startDate, endDate, granularity),
    getTrend: (
      profileName: string,
      days: number = 30,
      granularity: CostGranularity = 'DAILY'
    ): Promise<IpcResponse<CostTrendDataPoint[]>> =>
      ipcRenderer.invoke('cost:get-trend', profileName, days, granularity),
    getOptimizations: (profileName: string, days: number = 30, region?: string): Promise<IpcResponse<CostOptimizationResult>> =>
      ipcRenderer.invoke('cost:get-optimizations', profileName, days, region),
    costCache: {
      save: (entry: GCPCostCacheEntry): Promise<IpcResponse<void>> =>
        ipcRenderer.invoke('aws:cost-cache:save', entry),
      list: (identity: string, dataType: string, limit?: number): Promise<IpcResponse<GCPCostCacheEntry[]>> =>
        ipcRenderer.invoke('aws:cost-cache:list', identity, dataType, limit),
      get: (id: string): Promise<IpcResponse<GCPCostCacheEntry>> =>
        ipcRenderer.invoke('aws:cost-cache:get', id),
      getLatest: (identity: string, dataType: string): Promise<IpcResponse<GCPCostCacheEntry>> =>
        ipcRenderer.invoke('aws:cost-cache:get-latest', identity, dataType),
      delete: (id: string): Promise<IpcResponse<void>> =>
        ipcRenderer.invoke('aws:cost-cache:delete', id),
    },
  },

  credits: {
    getAnalysis: (
      profileName: string,
      startDate: string,
      endDate: string
    ): Promise<IpcResponse<CreditsAnalysisResult>> =>
      ipcRenderer.invoke('cost:get-credits', profileName, startDate, endDate),
  },

  // EKS Cost Analysis
  eks: {
    getCosts: (
      profileName: string,
      region: string,
      startDate: string,
      endDate: string,
      clusterFilter?: string
    ): Promise<IpcResponse<EKSCostAnalysis>> =>
      ipcRenderer.invoke('eks:get-costs', profileName, region, startDate, endDate, clusterFilter),
  },

  // Security Analysis
  security: {
    getPosture: (
      profileName: string,
      region: string = 'us-east-1',
      includeArchived: boolean = false
    ): Promise<IpcResponse<SecurityAnalysisResult>> =>
      ipcRenderer.invoke('security:get-posture', profileName, region, includeArchived),
    getFindingDetails: (
      profileName: string,
      findingId: string,
      region: string = 'us-east-1'
    ): Promise<IpcResponse<SecurityFinding | null>> =>
      ipcRenderer.invoke('security:get-finding-details', profileName, findingId, region),
    runBestPracticesScan: (
      profileName: string,
      region: string = 'us-east-1'
    ): Promise<IpcResponse<{ started: boolean }>> =>
      ipcRenderer.invoke('security:run-best-practices-scan', profileName, region),
    getAll: (profileName?: string, limit?: number): Promise<IpcResponse<any[]>> =>
      ipcRenderer.invoke('security:get-all', profileName, limit),
    getById: (id: string): Promise<IpcResponse<SecurityAnalysisResult>> =>
      ipcRenderer.invoke('security:get-by-id', id),
    delete: (id: string): Promise<IpcResponse<void>> =>
      ipcRenderer.invoke('security:delete', id),
    onCompleted: (callback: (result: SecurityAnalysisResult) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, result: SecurityAnalysisResult) => callback(result);
      ipcRenderer.on('security:completed', handler);
      return () => ipcRenderer.removeListener('security:completed', handler);
    },
    onFailed: (callback: (info: { error: string }) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, info: { error: string }) => callback(info);
      ipcRenderer.on('security:failed', handler);
      return () => ipcRenderer.removeListener('security:failed', handler);
    },
  },

  // Well-Architected
  wellArchitected: {
    listWorkloads: (
      profileName: string,
      region: string = 'us-west-2'
    ): Promise<IpcResponse<WAAnalysisResult>> =>
      ipcRenderer.invoke('wellarchitected:list-workloads', profileName, region),
    getWorkload: (
      profileName: string,
      region: string,
      workloadId: string
    ): Promise<IpcResponse<WAWorkloadSummary | null>> =>
      ipcRenderer.invoke('wellarchitected:get-workload', profileName, region, workloadId),
    getLensReview: (
      profileName: string,
      region: string,
      workloadId: string,
      lensAlias: string = 'wellarchitected'
    ): Promise<IpcResponse<WALensReview | null>> =>
      ipcRenderer.invoke('wellarchitected:get-lens-review', profileName, region, workloadId, lensAlias),
    getImprovements: (
      profileName: string,
      region: string,
      workloadId: string,
      lensAlias: string = 'wellarchitected'
    ): Promise<IpcResponse<WAImprovementItem[]>> =>
      ipcRenderer.invoke('wellarchitected:get-improvements', profileName, region, workloadId, lensAlias),
    runBestPracticesScan: (
      profileName: string,
      region: string = 'us-west-2'
    ): Promise<IpcResponse<{ started: boolean }>> =>
      ipcRenderer.invoke('wellarchitected:run-best-practices-scan', profileName, region),
    onBestPracticesProgress: (callback: (progress: WABPScanProgress) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, progress: WABPScanProgress) => callback(progress);
      ipcRenderer.on('wellarchitected:best-practices-progress', handler);
      return () => ipcRenderer.removeListener('wellarchitected:best-practices-progress', handler);
    },
    getAll: (profileName?: string, limit?: number): Promise<IpcResponse<any[]>> =>
      ipcRenderer.invoke('wellarchitected:get-all', profileName, limit),
    getById: (id: string): Promise<IpcResponse<any>> =>
      ipcRenderer.invoke('wellarchitected:get-by-id', id),
    delete: (id: string): Promise<IpcResponse<void>> =>
      ipcRenderer.invoke('wellarchitected:delete', id),
    onCompleted: (callback: (result: any) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, result: any) => callback(result);
      ipcRenderer.on('wellarchitected:completed', handler);
      return () => ipcRenderer.removeListener('wellarchitected:completed', handler);
    },
    onFailed: (callback: (info: { error: string }) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, info: { error: string }) => callback(info);
      ipcRenderer.on('wellarchitected:failed', handler);
      return () => ipcRenderer.removeListener('wellarchitected:failed', handler);
    },
  },

  // Auth
  auth: {
    checkStatus: (): Promise<IpcResponse<AuthStatus>> =>
      ipcRenderer.invoke('auth:check-status'),
    setup: (req: AuthSetupRequest): Promise<IpcResponse<void>> =>
      ipcRenderer.invoke('auth:setup', req),
    login: (req: AuthLoginRequest): Promise<IpcResponse<void>> =>
      ipcRenderer.invoke('auth:login', req),
    logout: (): Promise<IpcResponse<void>> =>
      ipcRenderer.invoke('auth:logout'),
    changePassword: (req: AuthChangePasswordRequest): Promise<IpcResponse<void>> =>
      ipcRenderer.invoke('auth:change-password', req),
    touchActivity: (): Promise<IpcResponse<void>> =>
      ipcRenderer.invoke('auth:touch-activity'),
    onSessionTimeout: (callback: () => void): (() => void) => {
      const handler = () => callback();
      ipcRenderer.on('auth:session-timeout', handler);
      return () => ipcRenderer.removeListener('auth:session-timeout', handler);
    },
    // Biometric
    checkBiometricAvailable: (): Promise<IpcResponse<{ available: boolean; type: string }>> =>
      ipcRenderer.invoke('auth:biometric-available'),
    getBiometricStatus: (): Promise<IpcResponse<{ enabled: boolean }>> =>
      ipcRenderer.invoke('auth:biometric-status'),
    enableBiometric: (): Promise<IpcResponse<void>> =>
      ipcRenderer.invoke('auth:biometric-enable'),
    disableBiometric: (): Promise<IpcResponse<void>> =>
      ipcRenderer.invoke('auth:biometric-disable'),
    loginWithBiometric: (): Promise<IpcResponse<void>> =>
      ipcRenderer.invoke('auth:biometric-login'),
  },

  // App Profiles
  profiles: {
    list: (): Promise<IpcResponse<AppProfileSummary[]>> =>
      ipcRenderer.invoke('profile:list'),
    add: (input: AppProfileInput): Promise<IpcResponse<AppProfileSummary>> =>
      ipcRenderer.invoke('profile:add', input),
    update: (id: string, input: Partial<AppProfileInput>): Promise<IpcResponse<AppProfileSummary>> =>
      ipcRenderer.invoke('profile:update', id, input),
    delete: (id: string): Promise<IpcResponse<void>> =>
      ipcRenderer.invoke('profile:delete', id),
    ssoLogin: (profileName: string): Promise<IpcResponse<void>> =>
      ipcRenderer.invoke('profile:sso-login', profileName),
  },

  // Scan Scheduling
  schedule: {
    getAll: (): Promise<IpcResponse<ScanSchedule[]>> =>
      ipcRenderer.invoke('schedule:get-all'),
    create: (config: ScanScheduleConfig): Promise<IpcResponse<ScanSchedule>> =>
      ipcRenderer.invoke('schedule:create', config),
    toggle: (id: string, enabled: boolean): Promise<IpcResponse<void>> =>
      ipcRenderer.invoke('schedule:toggle', id, enabled),
    delete: (id: string): Promise<IpcResponse<void>> =>
      ipcRenderer.invoke('schedule:delete', id),
  },

  // Network Reachability
  network: {
    analyzeReachability: (
      profileName: string,
      region: string
    ): Promise<IpcResponse<{ started: boolean }>> =>
      ipcRenderer.invoke('network:analyze-reachability', profileName, region),
    getAll: (profileName?: string, limit?: number): Promise<IpcResponse<any[]>> =>
      ipcRenderer.invoke('network:get-all', profileName, limit),
    getById: (id: string): Promise<IpcResponse<NetworkReachabilityResult>> =>
      ipcRenderer.invoke('network:get-by-id', id),
    delete: (id: string): Promise<IpcResponse<void>> =>
      ipcRenderer.invoke('network:delete', id),
    onCompleted: (callback: (result: NetworkReachabilityResult) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, result: NetworkReachabilityResult) => callback(result);
      ipcRenderer.on('network:completed', handler);
      return () => ipcRenderer.removeListener('network:completed', handler);
    },
    onFailed: (callback: (info: { error: string }) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, info: { error: string }) => callback(info);
      ipcRenderer.on('network:failed', handler);
      return () => ipcRenderer.removeListener('network:failed', handler);
    },
  },

  // Scan Comparison
  comparison: {
    diffScans: (scanIdA: string, scanIdB: string): Promise<IpcResponse<ScanDiffResult>> =>
      ipcRenderer.invoke('comparison:diff-scans', scanIdA, scanIdB),
  },

  // Compliance Frameworks
  compliance: {
    getFrameworks: (): Promise<IpcResponse<ComplianceFrameworkMeta[]>> =>
      ipcRenderer.invoke('compliance:get-frameworks'),
    runAssessment: (
      profileName: string,
      region: string,
      frameworkId: string
    ): Promise<IpcResponse<{ started: boolean }>> =>
      ipcRenderer.invoke('compliance:run-assessment', profileName, region, frameworkId),
    getAll: (profileName?: string, limit?: number): Promise<IpcResponse<any[]>> =>
      ipcRenderer.invoke('compliance:get-all', profileName, limit),
    getById: (id: string): Promise<IpcResponse<ComplianceAssessmentResult>> =>
      ipcRenderer.invoke('compliance:get-by-id', id),
    delete: (id: string): Promise<IpcResponse<void>> =>
      ipcRenderer.invoke('compliance:delete', id),
    onCompleted: (callback: (result: ComplianceAssessmentResult) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, result: ComplianceAssessmentResult) => callback(result);
      ipcRenderer.on('compliance:completed', handler);
      return () => ipcRenderer.removeListener('compliance:completed', handler);
    },
    onFailed: (callback: (info: { error: string }) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, info: { error: string }) => callback(info);
      ipcRenderer.on('compliance:failed', handler);
      return () => ipcRenderer.removeListener('compliance:failed', handler);
    },
  },

  // IAM Deep Analysis
  iam: {
    runAnalysis: (profileName: string): Promise<IpcResponse<{ started: boolean }>> =>
      ipcRenderer.invoke('iam:run-analysis', profileName),
    getAll: (profileName?: string, limit?: number): Promise<IpcResponse<any[]>> =>
      ipcRenderer.invoke('iam:get-all', profileName, limit),
    getById: (id: string): Promise<IpcResponse<IAMAnalysisResult>> =>
      ipcRenderer.invoke('iam:get-by-id', id),
    delete: (id: string): Promise<IpcResponse<void>> =>
      ipcRenderer.invoke('iam:delete', id),
    onCompleted: (callback: (result: IAMAnalysisResult) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, result: IAMAnalysisResult) => callback(result);
      ipcRenderer.on('iam:completed', handler);
      return () => ipcRenderer.removeListener('iam:completed', handler);
    },
    onFailed: (callback: (info: { error: string }) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, info: { error: string }) => callback(info);
      ipcRenderer.on('iam:failed', handler);
      return () => ipcRenderer.removeListener('iam:failed', handler);
    },
  },

  // App Settings
  settings: {
    get: (key: string): Promise<IpcResponse<string | null>> =>
      ipcRenderer.invoke('settings:get', key),
    set: (key: string, value: string): Promise<IpcResponse<void>> =>
      ipcRenderer.invoke('settings:set', key, value),
    getAllApp: (): Promise<IpcResponse<Record<string, string>>> =>
      ipcRenderer.invoke('settings:get-all-app'),
    clearGcloudCache: (): Promise<void> =>
      ipcRenderer.invoke('settings:clear-gcloud-cache'),
  },

  // Tag Governance
  tags: {
    getConfig: (): Promise<IpcResponse<TagGovernanceConfig>> =>
      ipcRenderer.invoke('tags:get-config'),
    saveConfig: (requiredTags: string[]): Promise<IpcResponse<void>> =>
      ipcRenderer.invoke('tags:save-config', requiredTags),
    getCompliance: (scanId: string): Promise<IpcResponse<TagComplianceResult>> =>
      ipcRenderer.invoke('tags:get-compliance', scanId),
  },

  // Assessment
  assessment: {
    run: (config: AssessmentConfig): Promise<IpcResponse<AssessmentResult>> =>
      ipcRenderer.invoke('assessment:run', config),
    generateReport: (result: AssessmentResult, outputDir: string): Promise<IpcResponse<{ filePath: string }>> =>
      ipcRenderer.invoke('assessment:generate-report', result, outputDir),
    getAll: (limit?: number): Promise<IpcResponse<AssessmentSummary[]>> =>
      ipcRenderer.invoke('assessment:get-all', limit),
    getById: (id: string): Promise<IpcResponse<AssessmentResult>> =>
      ipcRenderer.invoke('assessment:get-by-id', id),
    delete: (id: string): Promise<IpcResponse<void>> =>
      ipcRenderer.invoke('assessment:delete', id),
    onProgress: (callback: (progress: AssessmentProgress) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, progress: AssessmentProgress) => callback(progress);
      ipcRenderer.on('assessment:progress', handler);
      return () => ipcRenderer.removeListener('assessment:progress', handler);
    },
  },

  // GCP
  gcp: {
    checkAuth: (): Promise<IpcResponse<{ authenticated: boolean; email?: string }>> =>
      ipcRenderer.invoke('gcp:check-auth'),
    login: (label?: string): Promise<IpcResponse<{ success: boolean; accountId?: string; email?: string }>> =>
      ipcRenderer.invoke('gcp:login', label),
    logout: (accountId?: string): Promise<IpcResponse<void>> =>
      ipcRenderer.invoke('gcp:logout', accountId),
    activateProject: (accountId: string): Promise<IpcResponse<void>> =>
      ipcRenderer.invoke('gcp:activate-project', accountId),
    listProjects: (): Promise<IpcResponse<GCPProject[]>> =>
      ipcRenderer.invoke('gcp:list-projects'),
    listOrganizations: (): Promise<IpcResponse<GCPOrganization[]>> =>
      ipcRenderer.invoke('gcp:list-organizations'),
    validateProject: (projectId: string): Promise<IpcResponse<GCPProject | null>> =>
      ipcRenderer.invoke('gcp:validate-project', projectId),
    scan: {
      start: (config: GCPScanConfig): Promise<IpcResponse<{ scanId: string }>> =>
        ipcRenderer.invoke('gcp:scan:start', config),
      stop: (scanId: string): Promise<IpcResponse<void>> =>
        ipcRenderer.invoke('gcp:scan:stop', scanId),
      discoverServices: (
        projectId: string,
        days: number,
        bqProject: string,
        bqDataset?: string,
        bqRegion?: string
      ): Promise<IpcResponse<GCPServiceDiscoveryResult>> =>
        ipcRenderer.invoke('gcp:scan:discover-services', projectId, days, bqProject, bqDataset, bqRegion),
    },
    cost: {
      getAnalysis: (
        projectId: string,
        startDate: string,
        endDate: string,
        bqProject?: string,
        bqDataset?: string,
        filters?: GCPCostFilters,
        forceRefresh?: boolean,
        bqRegion?: string
      ): Promise<IpcResponse<CostAnalysisResult>> =>
        ipcRenderer.invoke('gcp:cost:get-analysis', projectId, startDate, endDate, bqProject, bqDataset, filters, forceRefresh, bqRegion),
      getOrgAnalysis: (
        startDate: string,
        endDate: string,
        bqProject: string,
        bqDataset?: string,
        filters?: GCPCostFilters,
        forceRefresh?: boolean,
        bqRegion?: string
      ): Promise<IpcResponse<CostAnalysisResult>> =>
        ipcRenderer.invoke('gcp:cost:get-org-analysis', startDate, endDate, bqProject, bqDataset, filters, forceRefresh, bqRegion),
      getRecommendations: (projectId: string): Promise<IpcResponse<CostOptimizationResult>> =>
        ipcRenderer.invoke('gcp:cost:get-recommendations', projectId),
      getExpandedRecommendations: (projectId: string): Promise<IpcResponse<GCPExpandedRecommendationsResult>> =>
        ipcRenderer.invoke('gcp:cost:get-expanded-recommendations', projectId),
      getBestPractices: (projectId: string, bqProject: string, bqDataset?: string): Promise<IpcResponse<GCPCostBestPracticesResult>> =>
        ipcRenderer.invoke('gcp:cost:get-best-practices', projectId, bqProject, bqDataset),
      getCUDCoverage: (projectId: string, bqProject?: string, bqDataset?: string): Promise<IpcResponse<GCPCUDCoverageResult>> =>
        ipcRenderer.invoke('gcp:cost:get-cud-coverage', projectId, bqProject, bqDataset),
      getStoppedVMs: (projectId: string): Promise<IpcResponse<StoppedVMResult>> =>
        ipcRenderer.invoke('gcp:cost:get-stopped-vms', projectId),
      getStoppedVMsOrg: (orgId: string): Promise<IpcResponse<StoppedVMResult>> =>
        ipcRenderer.invoke('gcp:cost:get-stopped-vms-org', orgId),
      getExpandedRecommendationsOrg: (orgId: string): Promise<IpcResponse<GCPExpandedRecommendationsResult>> =>
        ipcRenderer.invoke('gcp:cost:get-expanded-recommendations-org', orgId),
      onOrgScanProgress: (callback: (progress: GCPOrgScanProgress) => void): (() => void) => {
        const handler = (_event: IpcRendererEvent, progress: GCPOrgScanProgress) => callback(progress);
        ipcRenderer.on('gcp:cost:org-scan-progress', handler);
        return () => ipcRenderer.removeListener('gcp:cost:org-scan-progress', handler);
      },
      getGKECosts: (
        projectId: string,
        startDate: string,
        endDate: string,
        bqProject?: string,
        bqDataset?: string,
        clusterFilter?: string,
        namespaceFilter?: string,
        bqRegion?: string
      ): Promise<IpcResponse<GKECostAnalysis>> =>
        ipcRenderer.invoke('gcp:cost:get-gke-costs', projectId, startDate, endDate, bqProject, bqDataset, clusterFilter, namespaceFilter, bqRegion),
      getGKECostsOrg: (
        startDate: string,
        endDate: string,
        bqProject: string,
        bqDataset?: string,
        clusterFilter?: string,
        namespaceFilter?: string,
        bqRegion?: string
      ): Promise<IpcResponse<GKECostAnalysis>> =>
        ipcRenderer.invoke('gcp:cost:get-gke-costs-org', startDate, endDate, bqProject, bqDataset, clusterFilter, namespaceFilter, bqRegion),
      exportExcel: (analysis: CostAnalysisResult, label: string): Promise<IpcResponse<string | null>> =>
        ipcRenderer.invoke('cost:export-excel', analysis, label),
      exportPdf: (analysis: CostAnalysisResult, label: string): Promise<IpcResponse<string | null>> =>
        ipcRenderer.invoke('cost:export-pdf', analysis, label),
      exportGKEExcel: (data: GKECostAnalysis, label: string): Promise<IpcResponse<string | null>> =>
        ipcRenderer.invoke('gke:cost:export-excel', data, label),
      exportGKEPdf: (data: GKECostAnalysis, label: string): Promise<IpcResponse<string | null>> =>
        ipcRenderer.invoke('gke:cost:export-pdf', data, label),
    },
    costCache: {
      save: (entry: GCPCostCacheEntry): Promise<IpcResponse<void>> =>
        ipcRenderer.invoke('gcp:cost-cache:save', entry),
      list: (identity: string, dataType: string, limit?: number): Promise<IpcResponse<GCPCostCacheEntry[]>> =>
        ipcRenderer.invoke('gcp:cost-cache:list', identity, dataType, limit),
      get: (id: string): Promise<IpcResponse<GCPCostCacheEntry>> =>
        ipcRenderer.invoke('gcp:cost-cache:get', id),
      getLatest: (identity: string, dataType: string): Promise<IpcResponse<GCPCostCacheEntry>> =>
        ipcRenderer.invoke('gcp:cost-cache:get-latest', identity, dataType),
      delete: (id: string): Promise<IpcResponse<void>> =>
        ipcRenderer.invoke('gcp:cost-cache:delete', id),
    },
    credits: {
      getAnalysis: (
        projectId: string,
        startDate: string,
        endDate: string,
        bqProject?: string,
        bqDataset?: string,
        bqRegion?: string
      ): Promise<IpcResponse<CreditsAnalysisResult>> =>
        ipcRenderer.invoke('gcp:cost:get-credits', projectId, startDate, endDate, bqProject, bqDataset, bqRegion),
      getOrgAnalysis: (
        startDate: string,
        endDate: string,
        bqProject: string,
        bqDataset?: string,
        bqRegion?: string
      ): Promise<IpcResponse<CreditsAnalysisResult>> =>
        ipcRenderer.invoke('gcp:cost:get-org-credits', startDate, endDate, bqProject, bqDataset, bqRegion),
    },
    security: {
      getPosture: (projectId: string): Promise<IpcResponse<{ started: boolean }>> =>
        ipcRenderer.invoke('gcp:security:get-posture', projectId),
      runBestPractices: (projectId: string): Promise<IpcResponse<{ started: boolean }>> =>
        ipcRenderer.invoke('gcp:security:run-best-practices', projectId),
      getAll: (projectId?: string, limit?: number): Promise<IpcResponse<GCPSecurityScanSummary[]>> =>
        ipcRenderer.invoke('gcp:security:get-all', projectId, limit),
      getById: (id: string): Promise<IpcResponse<SecurityAnalysisResult>> =>
        ipcRenderer.invoke('gcp:security:get-by-id', id),
      delete: (id: string): Promise<IpcResponse<void>> =>
        ipcRenderer.invoke('gcp:security:delete', id),
      onCompleted: (callback: (result: SecurityAnalysisResult) => void): (() => void) => {
        const handler = (_event: IpcRendererEvent, result: SecurityAnalysisResult) => callback(result);
        ipcRenderer.on('gcp:security:completed', handler);
        return () => ipcRenderer.removeListener('gcp:security:completed', handler);
      },
      onFailed: (callback: (info: { error: string }) => void): (() => void) => {
        const handler = (_event: IpcRendererEvent, info: { error: string }) => callback(info);
        ipcRenderer.on('gcp:security:failed', handler);
        return () => ipcRenderer.removeListener('gcp:security:failed', handler);
      },
    },
    iam: {
      runAnalysis: (projectId: string): Promise<IpcResponse<{ started: boolean }>> =>
        ipcRenderer.invoke('gcp:iam:run-analysis', projectId),
      getAll: (projectId?: string, limit?: number): Promise<IpcResponse<GCPIAMAnalysisSummary[]>> =>
        ipcRenderer.invoke('gcp:iam:get-all', projectId, limit),
      getById: (id: string): Promise<IpcResponse<GCPIAMAnalysisResult>> =>
        ipcRenderer.invoke('gcp:iam:get-by-id', id),
      delete: (id: string): Promise<IpcResponse<void>> =>
        ipcRenderer.invoke('gcp:iam:delete', id),
      onCompleted: (callback: (result: GCPIAMAnalysisResult) => void): (() => void) => {
        const handler = (_event: IpcRendererEvent, result: GCPIAMAnalysisResult) => callback(result);
        ipcRenderer.on('gcp:iam:completed', handler);
        return () => ipcRenderer.removeListener('gcp:iam:completed', handler);
      },
      onFailed: (callback: (info: { error: string }) => void): (() => void) => {
        const handler = (_event: IpcRendererEvent, info: { error: string }) => callback(info);
        ipcRenderer.on('gcp:iam:failed', handler);
        return () => ipcRenderer.removeListener('gcp:iam:failed', handler);
      },
    },
    network: {
      analyze: (projectId: string): Promise<IpcResponse<{ started: boolean }>> =>
        ipcRenderer.invoke('gcp:network:analyze', projectId),
      getAll: (projectId?: string, limit?: number): Promise<IpcResponse<GCPNetworkAnalysisSummary[]>> =>
        ipcRenderer.invoke('gcp:network:get-all', projectId, limit),
      getById: (id: string): Promise<IpcResponse<GCPNetworkAnalysisResult>> =>
        ipcRenderer.invoke('gcp:network:get-by-id', id),
      delete: (id: string): Promise<IpcResponse<void>> =>
        ipcRenderer.invoke('gcp:network:delete', id),
      onCompleted: (callback: (result: GCPNetworkAnalysisResult) => void): (() => void) => {
        const handler = (_event: IpcRendererEvent, result: GCPNetworkAnalysisResult) => callback(result);
        ipcRenderer.on('gcp:network:completed', handler);
        return () => ipcRenderer.removeListener('gcp:network:completed', handler);
      },
      onFailed: (callback: (info: { error: string }) => void): (() => void) => {
        const handler = (_event: IpcRendererEvent, info: { error: string }) => callback(info);
        ipcRenderer.on('gcp:network:failed', handler);
        return () => ipcRenderer.removeListener('gcp:network:failed', handler);
      },
    },
    compliance: {
      getFrameworks: (): Promise<IpcResponse<ComplianceFrameworkMeta[]>> =>
        ipcRenderer.invoke('gcp:compliance:get-frameworks'),
      runAssessment: (projectId: string, frameworkId?: string): Promise<IpcResponse<{ started: boolean }>> =>
        ipcRenderer.invoke('gcp:compliance:run-assessment', projectId, frameworkId),
      getAll: (projectId?: string, limit?: number): Promise<IpcResponse<GCPComplianceSummary[]>> =>
        ipcRenderer.invoke('gcp:compliance:get-all', projectId, limit),
      getById: (id: string): Promise<IpcResponse<ComplianceAssessmentResult>> =>
        ipcRenderer.invoke('gcp:compliance:get-by-id', id),
      delete: (id: string): Promise<IpcResponse<void>> =>
        ipcRenderer.invoke('gcp:compliance:delete', id),
      onCompleted: (callback: (result: ComplianceAssessmentResult) => void): (() => void) => {
        const handler = (_event: IpcRendererEvent, result: ComplianceAssessmentResult) => callback(result);
        ipcRenderer.on('gcp:compliance:completed', handler);
        return () => ipcRenderer.removeListener('gcp:compliance:completed', handler);
      },
      onFailed: (callback: (info: { error: string }) => void): (() => void) => {
        const handler = (_event: IpcRendererEvent, info: { error: string }) => callback(info);
        ipcRenderer.on('gcp:compliance:failed', handler);
        return () => ipcRenderer.removeListener('gcp:compliance:failed', handler);
      },
    },
    assessment: {
      run: (config: GCPAssessmentConfig): Promise<IpcResponse<{ started: boolean }>> =>
        ipcRenderer.invoke('gcp:assessment:run', config),
      getAll: (projectId?: string, limit?: number): Promise<IpcResponse<GCPAssessmentSummary[]>> =>
        ipcRenderer.invoke('gcp:assessment:get-all', projectId, limit),
      getById: (id: string): Promise<IpcResponse<GCPAssessmentResult>> =>
        ipcRenderer.invoke('gcp:assessment:get-by-id', id),
      delete: (id: string): Promise<IpcResponse<void>> =>
        ipcRenderer.invoke('gcp:assessment:delete', id),
      generateReport: (result: GCPAssessmentResult, outputDir: string): Promise<IpcResponse<{ filePath: string }>> =>
        ipcRenderer.invoke('gcp:assessment:generate-report', result, outputDir),
      onProgress: (callback: (progress: GCPAssessmentProgress) => void): (() => void) => {
        const handler = (_event: IpcRendererEvent, progress: GCPAssessmentProgress) => callback(progress);
        ipcRenderer.on('gcp:assessment:progress', handler);
        return () => ipcRenderer.removeListener('gcp:assessment:progress', handler);
      },
      onCompleted: (callback: (result: GCPAssessmentResult) => void): (() => void) => {
        const handler = (_event: IpcRendererEvent, result: GCPAssessmentResult) => callback(result);
        ipcRenderer.on('gcp:assessment:completed', handler);
        return () => ipcRenderer.removeListener('gcp:assessment:completed', handler);
      },
      onFailed: (callback: (info: { error: string }) => void): (() => void) => {
        const handler = (_event: IpcRendererEvent, info: { error: string }) => callback(info);
        ipcRenderer.on('gcp:assessment:failed', handler);
        return () => ipcRenderer.removeListener('gcp:assessment:failed', handler);
      },
    },
    wellArchitected: {
      run: (projectId: string): Promise<IpcResponse<{ started: boolean }>> =>
        ipcRenderer.invoke('gcp:well-architected:run', projectId),
      getAll: (projectId?: string, limit?: number): Promise<IpcResponse<GCPWellArchitectedSummary[]>> =>
        ipcRenderer.invoke('gcp:well-architected:get-all', projectId, limit),
      getById: (id: string): Promise<IpcResponse<GCPWAScanResult>> =>
        ipcRenderer.invoke('gcp:well-architected:get-by-id', id),
      delete: (id: string): Promise<IpcResponse<void>> =>
        ipcRenderer.invoke('gcp:well-architected:delete', id),
      onProgress: (callback: (progress: GCPWAScanProgress) => void): (() => void) => {
        const handler = (_event: IpcRendererEvent, progress: GCPWAScanProgress) => callback(progress);
        ipcRenderer.on('gcp:well-architected:progress', handler);
        return () => ipcRenderer.removeListener('gcp:well-architected:progress', handler);
      },
      onCompleted: (callback: (result: GCPWAScanResult) => void): (() => void) => {
        const handler = (_event: IpcRendererEvent, result: GCPWAScanResult) => callback(result);
        ipcRenderer.on('gcp:well-architected:completed', handler);
        return () => ipcRenderer.removeListener('gcp:well-architected:completed', handler);
      },
      onFailed: (callback: (info: { error: string }) => void): (() => void) => {
        const handler = (_event: IpcRendererEvent, info: { error: string }) => callback(info);
        ipcRenderer.on('gcp:well-architected:failed', handler);
        return () => ipcRenderer.removeListener('gcp:well-architected:failed', handler);
      },
    },
    labels: {
      getConfig: (): Promise<IpcResponse<{ requiredLabels: string[] }>> =>
        ipcRenderer.invoke('gcp:labels:get-config'),
      saveConfig: (requiredLabels: string[]): Promise<IpcResponse<void>> =>
        ipcRenderer.invoke('gcp:labels:save-config', requiredLabels),
      checkCompliance: (projectId: string, requiredLabels: string[]): Promise<IpcResponse<{ started: boolean }>> =>
        ipcRenderer.invoke('gcp:labels:check-compliance', projectId, requiredLabels),
      getAll: (projectId?: string, limit?: number): Promise<IpcResponse<GCPLabelComplianceSummary[]>> =>
        ipcRenderer.invoke('gcp:labels:get-all', projectId, limit),
      getById: (id: string): Promise<IpcResponse<GCPLabelComplianceResult>> =>
        ipcRenderer.invoke('gcp:labels:get-by-id', id),
      delete: (id: string): Promise<IpcResponse<void>> =>
        ipcRenderer.invoke('gcp:labels:delete', id),
      onCompleted: (callback: (result: GCPLabelComplianceResult) => void): (() => void) => {
        const handler = (_event: IpcRendererEvent, result: GCPLabelComplianceResult) => callback(result);
        ipcRenderer.on('gcp:labels:completed', handler);
        return () => ipcRenderer.removeListener('gcp:labels:completed', handler);
      },
      onFailed: (callback: (info: { error: string }) => void): (() => void) => {
        const handler = (_event: IpcRendererEvent, info: { error: string }) => callback(info);
        ipcRenderer.on('gcp:labels:failed', handler);
        return () => ipcRenderer.removeListener('gcp:labels:failed', handler);
      },
    },
    optimization: {
      analyzeResources: (identity: string): Promise<IpcResponse<ResourceIdleAnalysisResult>> =>
        ipcRenderer.invoke('gcp:opt:analyze-resources', identity),
      saveSnapshot: (snapshot: GCPOptimizationSnapshot): Promise<IpcResponse<void>> =>
        ipcRenderer.invoke('gcp:opt:save-snapshot', snapshot),
      listSnapshots: (identity: string, limit?: number): Promise<IpcResponse<GCPOptimizationSnapshot[]>> =>
        ipcRenderer.invoke('gcp:opt:list-snapshots', identity, limit),
      getSnapshot: (id: string): Promise<IpcResponse<GCPOptimizationSnapshot>> =>
        ipcRenderer.invoke('gcp:opt:get-snapshot', id),
      deleteSnapshot: (id: string): Promise<IpcResponse<void>> =>
        ipcRenderer.invoke('gcp:opt:delete-snapshot', id),
      exportExcel: (data: { recs: GCPExpandedRecommendationsResult | null; vms: StoppedVMResult | null; idle: ResourceIdleAnalysisResult | null }, label: string): Promise<IpcResponse<string | null>> =>
        ipcRenderer.invoke('gcp:opt:export-excel', data, label),
      exportPdf: (data: { recs: GCPExpandedRecommendationsResult | null; vms: StoppedVMResult | null; idle: ResourceIdleAnalysisResult | null }, label: string): Promise<IpcResponse<string | null>> =>
        ipcRenderer.invoke('gcp:opt:export-pdf', data, label),
    },
  },
  // GCP Account management
  gcpAccounts: {
    list: (): Promise<IpcResponse<GCPAccountSummary[]>> =>
      ipcRenderer.invoke('gcp:accounts:list'),
    add: (label: string): Promise<IpcResponse<{ accountId?: string; email?: string }>> =>
      ipcRenderer.invoke('gcp:accounts:add', label),
    activate: (accountId: string): Promise<IpcResponse<void>> =>
      ipcRenderer.invoke('gcp:accounts:activate', accountId),
    rename: (accountId: string, label: string): Promise<IpcResponse<void>> =>
      ipcRenderer.invoke('gcp:accounts:rename', accountId, label),
    delete: (accountId: string): Promise<IpcResponse<void>> =>
      ipcRenderer.invoke('gcp:accounts:delete', accountId),
    relogin: (accountId: string): Promise<IpcResponse<{ email?: string }>> =>
      ipcRenderer.invoke('gcp:accounts:relogin', accountId),
  },
  // Environment Health
  health: {
    check: (): Promise<IpcResponse<EnvironmentHealth>> =>
      ipcRenderer.invoke('health:check'),
    recheck: (): Promise<IpcResponse<EnvironmentHealth>> =>
      ipcRenderer.invoke('health:recheck'),
  },

  // AI Chat
  chat: {
    sendMessage: (
      conversationId: string,
      message: string,
      providerType: string,
      context?: ChatContext,
      providerConfig?: { profileName?: string; region?: string; model?: string; apiKey?: string }
    ): Promise<IpcResponse<string>> =>
      ipcRenderer.invoke('chat:send-message', conversationId, message, providerType, context, providerConfig),
    onStreamChunk: (callback: (chunk: AIStreamChunk) => void): (() => void) => {
      const handler = (_event: IpcRendererEvent, chunk: AIStreamChunk) => callback(chunk);
      ipcRenderer.on('chat:stream-chunk', handler);
      return () => ipcRenderer.removeListener('chat:stream-chunk', handler);
    },
    stopGeneration: (conversationId: string): Promise<IpcResponse<void>> =>
      ipcRenderer.invoke('chat:stop-generation', conversationId),
    listConversations: (): Promise<IpcResponse<ChatConversation[]>> =>
      ipcRenderer.invoke('chat:list-conversations'),
    getConversation: (id: string): Promise<IpcResponse<{ conversation: ChatConversation; messages: ChatMessage[] }>> =>
      ipcRenderer.invoke('chat:get-conversation', id),
    createConversation: (title: string, provider: string): Promise<IpcResponse<ChatConversation>> =>
      ipcRenderer.invoke('chat:create-conversation', title, provider),
    deleteConversation: (id: string): Promise<IpcResponse<void>> =>
      ipcRenderer.invoke('chat:delete-conversation', id),
    updateTitle: (id: string, title: string): Promise<IpcResponse<void>> =>
      ipcRenderer.invoke('chat:update-title', id, title),
    getProviders: (profileName?: string): Promise<IpcResponse<any[]>> =>
      ipcRenderer.invoke('chat:get-providers', profileName),
  },

  shell: {
    openExternal: (url: string): Promise<void> =>
      ipcRenderer.invoke('shell:open-external', url),
  },
};

// Expose the API to the renderer process
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// Type declaration for the renderer process
export type ElectronAPI = typeof electronAPI;

// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

// ── AWS-Specific Types ──

import type { ServiceType } from './common';

// AWS Profile Types
export interface AWSProfile {
  name: string;
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
  region?: string;
  source?: 'credentials' | 'config' | 'sso' | 'app';
  ssoStartUrl?: string;
  ssoRegion?: string;
  ssoAccountId?: string;
  ssoRoleName?: string;
  assumeRoleArn?: string;
  externalId?: string;
  sourceProfile?: string;
  appProfileId?: string;
}

// Auth Types
export interface AuthStatus {
  isSetup: boolean;
  isAuthenticated: boolean;
  biometricAvailable: boolean;
  biometricEnabled: boolean;
  biometricType: string;
}

export interface AuthSetupRequest {
  password: string;
  confirmPassword: string;
}

export interface AuthLoginRequest {
  password: string;
}

export interface AuthChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmNewPassword: string;
}

// App Profile Types
export type AppProfileCredentialType = 'iam_keys' | 'sso_config' | 'assume_role';

export interface AppProfileInput {
  name: string;
  credentialType: AppProfileCredentialType;
  region?: string;
  description?: string;
  // IAM Keys
  accessKeyId?: string;
  secretAccessKey?: string;
  sessionToken?: string;
  // SSO Config
  ssoStartUrl?: string;
  ssoRegion?: string;
  ssoAccountId?: string;
  ssoRoleName?: string;
  // Assume Role
  assumeRoleArn?: string;
  externalId?: string;
  sourceProfile?: string;
}

export interface AppProfileSummary {
  id: string;
  name: string;
  credentialType: AppProfileCredentialType;
  region?: string;
  description?: string;
  // SSO fields (not secret)
  ssoStartUrl?: string;
  ssoRegion?: string;
  ssoAccountId?: string;
  ssoRoleName?: string;
  // Assume Role fields (non-secret)
  assumeRoleArn?: string;
  sourceProfile?: string;
  createdAt: string;
  updatedAt: string;
}

// Scan Types
export interface ScanConfig {
  profileName: string;
  regions: string[];
  services: ServiceType[];
  includeGlobal: boolean;
}

// AWS Regions
export const AWS_REGIONS = [
  'us-east-1',
  'us-east-2',
  'us-west-1',
  'us-west-2',
  'af-south-1',
  'ap-east-1',
  'ap-south-1',
  'ap-south-2',
  'ap-southeast-1',
  'ap-southeast-2',
  'ap-southeast-3',
  'ap-southeast-4',
  'ap-northeast-1',
  'ap-northeast-2',
  'ap-northeast-3',
  'ca-central-1',
  'eu-central-1',
  'eu-central-2',
  'eu-west-1',
  'eu-west-2',
  'eu-west-3',
  'eu-south-1',
  'eu-south-2',
  'eu-north-1',
  'me-south-1',
  'me-central-1',
  'sa-east-1',
] as const;

export type AWSRegion = (typeof AWS_REGIONS)[number];

// Well-Architected Framework Types
export type WAPillarId =
  | 'operationalExcellence'
  | 'security'
  | 'reliability'
  | 'performance'
  | 'costOptimization'
  | 'sustainability';

export type WARiskLevel = 'HIGH' | 'MEDIUM' | 'NONE' | 'NOT_APPLICABLE' | 'UNANSWERED';

export interface WAWorkloadSummary {
  workloadId: string;
  workloadName: string;
  workloadArn: string;
  description?: string;
  environment: string;
  updatedAt: string;
  riskCounts: Record<WARiskLevel, number>;
  lenses: string[];
}

export interface WAPillarReviewSummary {
  pillarId: WAPillarId;
  pillarName: string;
  riskCounts: Record<WARiskLevel, number>;
  notes?: string;
}

export interface WALensReview {
  lensAlias: string;
  lensName: string;
  lensVersion: string;
  riskCounts: Record<WARiskLevel, number>;
  pillarReviewSummaries: WAPillarReviewSummary[];
  updatedAt: string;
}

export interface WAImprovementItem {
  pillarId: WAPillarId;
  questionId: string;
  questionTitle: string;
  risk: WARiskLevel;
  improvementPlanUrl?: string;
  improvementPlans: {
    choiceId: string;
    displayText: string;
    improvementPlanUrl?: string;
  }[];
}

export interface WAAnalysisResult {
  workloads: WAWorkloadSummary[];
  consolidatedRiskCounts?: Record<WARiskLevel, number>;
  error?: string;
}

// Well-Architected Best Practices Scan Types
export type WABPScanMode = 'workloads' | 'best_practices';

export interface WABPCheckDefinition {
  id: string;
  title: string;
  description: string;
  pillar: WAPillarId;
  severity: import('./common').FindingSeverity;
  service: string;
  remediationRecommendation: string;
  remediationUrl?: string;
}

export interface WABPFinding {
  checkId: string;
  title: string;
  description: string;
  pillar: WAPillarId;
  severity: import('./common').FindingSeverity;
  status: 'PASS' | 'FAIL' | 'ERROR';
  service: string;
  resourceId?: string;
  resourceArn?: string;
  region: string;
  remediationRecommendation?: string;
  remediationUrl?: string;
}

export interface WABPPillarSummary {
  pillarId: WAPillarId;
  pillarName: string;
  totalChecks: number;
  passCount: number;
  failCount: number;
  errorCount: number;
  findings: WABPFinding[];
}

export interface WABPScanResult {
  pillarSummaries: WABPPillarSummary[];
  totalChecks: number;
  totalPass: number;
  totalFail: number;
  totalError: number;
  duration: number;
  timestamp: string;
  error?: string;
}

export interface WABPScanProgress {
  phase: string;
  pillar: string;
  service: string;
  percent: number;
}

// Assessment Types
export type AssessmentDomain = 'cost' | 'security' | 'wellArchitected' | 'inventory';

export interface AssessmentConfig {
  profile: string;
  region: string;
  domains: AssessmentDomain[];
  costDays?: number;
  includeResourceScan?: boolean;
  servicesToScan?: ServiceType[];
}

export interface DomainScore {
  domain: AssessmentDomain;
  score: number;
  grade: string;
  weight: number;
  findings: number;
  recommendations: AssessmentRecommendation[];
  details: Record<string, unknown>;
}

export interface AssessmentRecommendation {
  id: string;
  domain: AssessmentDomain;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  description: string;
  impact?: string;
  remediation?: string;
  estimatedSavings?: number;
  resourceId?: string;
}

export interface AssessmentResult {
  id: string;
  profile: string;
  region: string;
  accountId?: string;
  timestamp: string;
  overallScore: number;
  overallGrade: string;
  domainScores: DomainScore[];
  totalRecommendations: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  costData?: import('./common').CostAnalysisResult;
  costOptimizations?: import('./common').CostOptimizationResult;
  securityData?: import('./common').SecurityAnalysisResult;
  waData?: WABPScanResult;
  resourceSummary?: {
    totalResources: number;
    byService: Record<string, number>;
    tagCoverage: number;
  };
  duration: number;
  errors: string[];
}

export interface AssessmentProgress {
  stage: string;
  percent: number;
  message: string;
}

export interface AssessmentSummary {
  id: string;
  profile: string;
  region: string;
  accountId?: string;
  timestamp: string;
  overallScore: number;
  overallGrade: string;
  totalRecommendations: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  duration: number;
}

// Tag Governance Types
export interface TagGovernanceConfig {
  requiredTags: string[];
}

export interface TagServiceCompliance {
  service: string;
  totalResources: number;
  compliantResources: number;
  compliancePercent: number;
}

export interface TagKeyCompliance {
  tagKey: string;
  totalResources: number;
  taggedResources: number;
  coveragePercent: number;
}

export interface UntaggedResource {
  id: string;
  name: string;
  service: string;
  region: string;
  missingTags: string[];
}

export interface TagComplianceResult {
  scanId: string;
  totalResources: number;
  fullyCompliantResources: number;
  overallCompliancePercent: number;
  byService: TagServiceCompliance[];
  byTagKey: TagKeyCompliance[];
  untaggedResources: UntaggedResource[];
}

// Network Reachability Types
export interface ExposurePathStep {
  type: 'igw' | 'route_table' | 'subnet' | 'nacl' | 'security_group' | 'instance';
  id: string;
  name?: string;
  detail: string;
}

export interface ExposedPort {
  protocol: string;
  fromPort: number;
  toPort: number;
  source: string;
}

export interface ExposedResource {
  resourceId: string;
  resourceType: string;
  name?: string;
  vpcId: string;
  subnetId: string;
  publicIp?: string;
  openPorts: ExposedPort[];
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  exposurePath: ExposurePathStep[];
}

export interface NetworkReachabilityResult {
  vpcCount: number;
  subnetCount: number;
  publicSubnetCount: number;
  exposedResources: ExposedResource[];
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  analyzedAt: string;
}

// Scan Scheduling Types
export type ScheduleFrequency = 'hourly' | 'daily' | 'weekly';

export interface ScanSchedule {
  id: string;
  name: string;
  profileName: string;
  regions: string[];
  services: string[];
  frequency: ScheduleFrequency;
  enabled: boolean;
  autoAssess: boolean;
  lastRunAt?: string;
  nextRunAt?: string;
  createdAt: string;
  provider: 'aws' | 'gcp';
  projectId?: string;
}

export interface ScanScheduleConfig {
  name: string;
  profileName: string;
  regions: string[];
  services: string[];
  frequency: ScheduleFrequency;
  autoAssess: boolean;
  provider?: 'aws' | 'gcp';
  projectId?: string;
}

// ── IAM Deep Analysis ──

export interface IAMUnusedRole {
  roleName: string;
  roleArn: string;
  createdDate: string;
  lastUsedDate?: string;
  daysSinceLastUse: number;
  hasInlinePolicies: boolean;
  attachedPolicyCount: number;
}

export interface IAMOverlyPermissivePolicy {
  policyName: string;
  policyArn: string;
  isAWSManaged: boolean;
  attachmentCount: number;
  wildcardActions: boolean;
  wildcardResources: boolean;
  dangerousStatements: string[];
}

export interface IAMCrossAccountTrust {
  roleName: string;
  roleArn: string;
  trustedAccountId: string;
  trustedPrincipal: string;
  isExternalAccount: boolean;
  conditionKeys: string[];
}

export interface IAMPasswordPolicyCheck {
  check: string;
  current: string;
  recommended: string;
  compliant: boolean;
}

export interface IAMPasswordPolicyCompliance {
  hasPolicy: boolean;
  checks: IAMPasswordPolicyCheck[];
  score: number;
}

export type IAMUserIssueSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export interface IAMUserIssue {
  userName: string;
  userArn: string;
  issue: string;
  severity: IAMUserIssueSeverity;
  category: 'mfa' | 'access_key_rotation' | 'unused_credentials' | 'multiple_keys' | 'direct_policy' | 'root_account';
  detail: string;
}

export interface IAMUserAnalysisSummary {
  rootIssues: number;
  noMFA: number;
  oldAccessKeys: number;
  unusedCredentials: number;
  multipleActiveKeys: number;
  directPolicies: number;
}

export interface IAMUserAnalysisResult {
  totalUsers: number;
  issues: IAMUserIssue[];
  summary: IAMUserAnalysisSummary;
  score: number;
}

export interface IAMAnalysisResult {
  unusedRoles: IAMUnusedRole[];
  overlyPermissivePolicies: IAMOverlyPermissivePolicy[];
  crossAccountTrusts: IAMCrossAccountTrust[];
  passwordPolicy: IAMPasswordPolicyCompliance;
  userAnalysis?: IAMUserAnalysisResult;
  analyzedAt: string;
  errors: string[];
}

// ── Compliance Frameworks ──

export type ComplianceFrameworkId = 'cis-aws-v3' | 'cis-gcp-v2';

export interface ComplianceFrameworkMeta {
  id: ComplianceFrameworkId;
  name: string;
  version: string;
  description: string;
  controlCount: number;
}

export interface ComplianceControlInfo {
  id: string;
  section: string;
  title: string;
  level: 1 | 2;
  checkIds: string[];
}

export interface ComplianceControlResult {
  control: ComplianceControlInfo;
  status: 'PASS' | 'FAIL' | 'NOT_CHECKED';
  findingCount: number;
}

export interface ComplianceSectionResult {
  section: string;
  totalControls: number;
  passedControls: number;
  failedControls: number;
  notCheckedControls: number;
  controls: ComplianceControlResult[];
}

export interface ComplianceAssessmentResult {
  id?: string;
  projectId?: string;
  framework: ComplianceFrameworkMeta;
  overallScore: number;
  totalControls: number;
  passedControls: number;
  failedControls: number;
  notCheckedControls: number;
  sections: ComplianceSectionResult[];
  assessedAt: string;
  duration?: number;
  error?: string;
}

// ── EKS Cost Analysis ──

export interface EKSClusterCost {
  cluster: string;
  region: string;
  version: string;
  status: string;
  nodeGroupCount: number;
  totalNodes: number;
  cost: number;
  controlPlaneCost: number;
  nodeGroups: EKSNodeGroupCost[];
}

export interface EKSNodeGroupCost {
  name: string;
  cluster: string;
  status: string;
  instanceTypes: string[];
  capacityType: string;
  minSize: number;
  maxSize: number;
  desiredSize: number;
  diskSize: number;
  amiType: string;
  estimatedMonthlyCost: number;
}

export interface EKSTrendPoint {
  date: string;
  cost: number;
}

export interface EKSCostAnalysis {
  totalCost: number;
  currency: string;
  byCluster: EKSClusterCost[];
  byNodeGroup: EKSNodeGroupCost[];
  trend: EKSTrendPoint[];
  costExplorerTotal: number;
  relatedServices: Array<{ service: string; cost: number }>;
  startDate: string;
  endDate: string;
}


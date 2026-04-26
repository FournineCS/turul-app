// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

// ── Provider-Agnostic / Shared Types ──

import type { GCPServiceType, GCPCostRecommendationMeta, GCPCostCategory, GCPCommitment, GCPCostFilters } from './gcp';

// Cloud Provider Types
export type CloudProvider = 'aws' | 'gcp';

// AWS Service Types (kept here since it's referenced extensively in common types)
export type ServiceType =
  // Compute
  | 'ec2'
  | 'lambda'
  | 'ecs'
  | 'eks'
  | 'autoscaling'
  // Storage
  | 's3'
  | 'efs'
  | 'ecr'
  | 'backup'
  // Database
  | 'rds'
  | 'dynamodb'
  | 'elasticache'
  | 'redshift'
  | 'opensearch'
  // Networking
  | 'vpc'
  | 'subnet'
  | 'securityGroup'
  | 'alb'
  | 'cloudfront'
  | 'route53'
  | 'wafv2'
  // Management
  | 'cloudformation'
  | 'cloudwatch'
  | 'cloudtrail'
  | 'config'
  | 'ssm'
  // Analytics
  | 'glue'
  | 'athena'
  | 'kinesis'
  | 'firehose'
  | 'msk'
  | 'emr'
  // Integration
  | 'sns'
  | 'sqs'
  | 'stepfunctions'
  | 'eventbridge'
  | 'apigateway'
  | 'appsync'
  | 'ses'
  // Security
  | 'secretsmanager'
  | 'kms'
  | 'iam'
  | 'guardduty'
  | 'accessanalyzer'
  | 'inspector'
  | 'acm'
  // Identity
  | 'cognito'
  // Developer Tools
  | 'codepipeline'
  | 'codebuild'
  // ML & AI
  | 'sagemaker'
  // Data Pipeline
  | 'mwaa'
  | 'transfer'
  // Phase 4: Database & Networking
  | 'neptune'
  | 'documentdb'
  | 'memorydb'
  | 'timestream'
  | 'keyspaces'
  | 'transitgateway'
  | 'globalaccelerator'
  | 'directconnect'
  | 'networkfirewall'
  | 'mq'
  // Phase 5: Storage, Migration & Compute
  | 'fsx'
  | 'storagegateway'
  | 'dms'
  | 'datasync'
  | 'drs'
  | 'lakeformation'
  | 'elasticbeanstalk'
  | 'apprunner'
  | 'batch'
  | 'appflow'
  // Phase 6: Security & Compliance
  | 'macie'
  | 'fms'
  | 'shield'
  | 'cloudhsm'
  | 'directoryservice'
  | 'detective'
  | 'auditmanager'
  | 'ram'
  | 'organizations'
  | 'trustedadvisor'
  // Phase 7: Developer Tools & Management
  | 'codedeploy'
  | 'codeartifact'
  | 'xray'
  | 'fis'
  | 'imagebuilder'
  | 'servicecatalog'
  | 'licensemanager'
  | 'computeoptimizer'
  // Phase 8: AI/ML & Frontend
  | 'bedrock'
  | 'comprehend'
  | 'rekognition'
  | 'textract'
  | 'transcribe'
  | 'lex'
  | 'kendra'
  | 'amplify'
  | 'location'
  | 'lightsail'
  // Phase 9: Streaming, Analytics & Comms
  | 'kinesisvideo'
  | 'flink'
  | 'quicksight'
  | 'pinpoint'
  | 'connect'
  | 'ivs'
  | 'mediaconvert'
  | 'medialive'
  // Phase 10: IoT, Niche & Remaining
  | 'iot'
  | 'forecast'
  | 'personalize'
  | 'frauddetector'
  | 'workspaces'
  | 'verifiedaccess'
  | 'vpclattice'
  | 'elastictranscoder'
  | 'cloudsearch'
  | 'healthlake';

// Scan Types
export type ScanStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface Scan {
  id: string;
  profile: string;
  regions: string[];
  services: (ServiceType | GCPServiceType)[];
  startedAt: string;
  completedAt?: string;
  status: ScanStatus;
  resourceCount: number;
  error?: string;
  groupId?: string;
  cloudProvider?: CloudProvider;
}

export interface ScanProgress {
  scanId: string;
  currentRegion: string;
  currentService: string;
  totalRegions: number;
  completedRegions: number;
  totalServices: number;
  completedServices: number;
  resourcesFound: number;
  errors: ScanError[];
}

export interface ScanError {
  region: string;
  service: string;
  message: string;
  timestamp: string;
}

// Resource Types
export interface Resource {
  id: string; // ARN or GCP selfLink
  scanId: string;
  service: ServiceType | GCPServiceType;
  resourceType: string;
  region: string;
  name: string;
  tags: Record<string, string>;
  data: Record<string, unknown>;
  createdAt?: string;
  cloudProvider?: CloudProvider;
}

// Relationship Types
export type RelationshipType =
  | 'contains'
  | 'member_of'
  | 'targets'
  | 'routes_to'
  | 'serves'
  | 'attached_to'
  | 'uses'
  | 'depends_on'
  | 'produces';

export interface Relationship {
  id: number;
  scanId: string;
  sourceArn: string;
  targetArn: string;
  relationshipType: RelationshipType;
}

// Network Topology Types
export interface TopologyNode {
  id: string;
  type: string;
  service: ServiceType | GCPServiceType;
  name: string;
  region: string;
  data: Record<string, unknown>;
  cloudProvider?: CloudProvider;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

export interface TopologyLink {
  source: string | TopologyNode;
  target: string | TopologyNode;
  type: RelationshipType;
}

export interface TopologyGraph {
  nodes: TopologyNode[];
  links: TopologyLink[];
}

// Architecture Diagram Types
export type DiagramViewMode = 'network' | 'application' | 'data' | 'full';

export interface DiagramNode {
  id: string;
  type: string;
  service: ServiceType | GCPServiceType;
  name: string;
  region: string;
  tier?: string;
  group?: string;
  data: Record<string, unknown>;
  cloudProvider?: CloudProvider;
}

export interface DiagramEdge {
  id: string;
  source: string;
  target: string;
  type: RelationshipType;
  label?: string;
}

export interface DiagramGraph {
  nodes: DiagramNode[];
  edges: DiagramEdge[];
  viewMode: DiagramViewMode;
}

// Report Types
export type ReportFormat = 'pdf' | 'excel' | 'csv' | 'json';

export interface ReportConfig {
  scanId: string;
  format: ReportFormat;
  sections: ReportSection[];
  includeTopology: boolean;
  outputPath: string;
}

export type ReportSection =
  | 'summary'
  | 'resources'
  | 'relationships'
  | 'security_groups'
  | 'costs';

// IPC Channel Types
export type IpcChannel =
  // AWS
  | 'aws:get-profiles'
  | 'aws:validate-profile'
  | 'aws:get-regions'
  | 'aws:discover-services-by-cost'
  // Scan
  | 'scan:start'
  | 'scan:stop'
  | 'scan:progress'
  | 'scan:get-all'
  | 'scan:get-by-id'
  // Resources
  | 'resources:get-by-scan'
  | 'resources:search'
  // Topology
  | 'topology:get-graph'
  | 'topology:get-diagram'
  // Reports
  | 'report:generate'
  | 'report:progress'
  // Database
  | 'db:get-scan-history'
  | 'db:delete-scan'
  // App
  | 'app:select-directory'
  | 'app:get-version'
  | 'app:save-file'
  // Cost
  | 'cost:get-analysis'
  | 'cost:get-trend'
  | 'cost:get-optimizations'
  // Security
  | 'security:get-posture'
  | 'security:get-finding-details'
  | 'security:run-best-practices-scan'
  | 'security:best-practices-progress'
  // Well-Architected
  | 'wellarchitected:list-workloads'
  | 'wellarchitected:get-workload'
  | 'wellarchitected:get-lens-review'
  | 'wellarchitected:get-improvements'
  | 'wellarchitected:run-best-practices-scan'
  | 'wellarchitected:best-practices-progress'
  // Assessment
  | 'assessment:run'
  | 'assessment:generate-report'
  | 'assessment:get-all'
  | 'assessment:get-by-id'
  | 'assessment:delete'
  | 'assessment:progress'
  | 'assessment:report-progress'
  // Auth
  | 'auth:check-status'
  | 'auth:setup'
  | 'auth:login'
  | 'auth:logout'
  | 'auth:change-password'
  // App Profiles
  | 'profile:list'
  | 'profile:add'
  | 'profile:update'
  | 'profile:delete'
  // GCP
  | 'gcp:check-auth'
  | 'gcp:login'
  | 'gcp:logout'
  | 'gcp:list-projects'
  | 'gcp:list-organizations'
  | 'gcp:validate-project'
  | 'gcp:scan:start'
  | 'gcp:scan:stop'
  | 'gcp:cost:get-analysis'
  | 'gcp:cost:get-org-analysis'
  | 'gcp:cost:get-expanded-recommendations'
  | 'gcp:cost:get-best-practices'
  | 'gcp:cost:get-cud-coverage'
  | 'gcp:security:get-posture'
  | 'gcp:security:run-best-practices'
  // GCP Optimization
  | 'gcp:opt:analyze-resources'
  | 'gcp:opt:save-snapshot'
  | 'gcp:opt:list-snapshots'
  | 'gcp:opt:get-snapshot'
  | 'gcp:opt:delete-snapshot'
  | 'gcp:cost:org-scan-progress'
  | 'gcp:cost:get-gke-costs'
  | 'gcp:cost:get-gke-costs-org';

// IPC Request/Response Types
export interface IpcResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Rate Limiter Types
export interface RateLimiterConfig {
  service: string;
  requestsPerSecond: number;
  burstLimit: number;
}

export interface ServiceRateLimits {
  [service: string]: RateLimiterConfig;
}

// Discovery Types
export interface DiscoveredResource {
  arn: string;
  service: string;
  resourceType: string;
  region: string;
  tags: Record<string, string>;
}

// Cost Discovery Types
export interface ServiceCostInfo {
  service: string;
  cost: number;
  currency: string;
  hasUsage: boolean;
  serviceType?: ServiceType;
}

export interface CostDiscoveryResponse {
  services: ServiceCostInfo[];
  activeServices: ServiceType[];
  totalCost: number;
  currency: string;
  startDate: string;
  endDate: string;
}

// Service Rate Limits (conservative defaults)
export const DEFAULT_SERVICE_RATE_LIMITS: ServiceRateLimits = {
  // Compute
  ec2: { service: 'ec2', requestsPerSecond: 10, burstLimit: 50 },
  lambda: { service: 'lambda', requestsPerSecond: 10, burstLimit: 100 },
  ecs: { service: 'ecs', requestsPerSecond: 10, burstLimit: 50 },
  eks: { service: 'eks', requestsPerSecond: 10, burstLimit: 50 },
  // Storage
  s3: { service: 's3', requestsPerSecond: 50, burstLimit: 200 },
  efs: { service: 'efs', requestsPerSecond: 10, burstLimit: 50 },
  // Database
  rds: { service: 'rds', requestsPerSecond: 5, burstLimit: 20 },
  dynamodb: { service: 'dynamodb', requestsPerSecond: 25, burstLimit: 100 },
  elasticache: { service: 'elasticache', requestsPerSecond: 5, burstLimit: 20 },
  redshift: { service: 'redshift', requestsPerSecond: 5, burstLimit: 20 },
  // Networking
  elb: { service: 'elb', requestsPerSecond: 10, burstLimit: 50 },
  cloudfront: { service: 'cloudfront', requestsPerSecond: 10, burstLimit: 50 },
  route53: { service: 'route53', requestsPerSecond: 5, burstLimit: 20 },
  // Management
  cloudformation: { service: 'cloudformation', requestsPerSecond: 5, burstLimit: 20 },
  cloudwatch: { service: 'cloudwatch', requestsPerSecond: 10, burstLimit: 50 },
  'cloudwatch-logs': { service: 'cloudwatch-logs', requestsPerSecond: 5, burstLimit: 20 },
  // Analytics
  glue: { service: 'glue', requestsPerSecond: 5, burstLimit: 20 },
  athena: { service: 'athena', requestsPerSecond: 5, burstLimit: 20 },
  // Integration
  sns: { service: 'sns', requestsPerSecond: 30, burstLimit: 100 },
  sqs: { service: 'sqs', requestsPerSecond: 30, burstLimit: 100 },
  stepfunctions: { service: 'stepfunctions', requestsPerSecond: 10, burstLimit: 50 },
  eventbridge: { service: 'eventbridge', requestsPerSecond: 10, burstLimit: 50 },
  apigateway: { service: 'apigateway', requestsPerSecond: 10, burstLimit: 50 },
  // Security
  secretsmanager: { service: 'secretsmanager', requestsPerSecond: 5, burstLimit: 20 },
  kms: { service: 'kms', requestsPerSecond: 10, burstLimit: 50 },
  iam: { service: 'iam', requestsPerSecond: 10, burstLimit: 50 },
  guardduty: { service: 'guardduty', requestsPerSecond: 5, burstLimit: 20 },
  accessanalyzer: { service: 'accessanalyzer', requestsPerSecond: 5, burstLimit: 20 },
  inspector: { service: 'inspector', requestsPerSecond: 5, burstLimit: 20 },
  acm: { service: 'acm', requestsPerSecond: 5, burstLimit: 20 },
  wafv2: { service: 'wafv2', requestsPerSecond: 5, burstLimit: 20 },
  // Identity
  cognito: { service: 'cognito', requestsPerSecond: 5, burstLimit: 20 },
  // Compute
  autoscaling: { service: 'autoscaling', requestsPerSecond: 10, burstLimit: 50 },
  // Storage
  ecr: { service: 'ecr', requestsPerSecond: 5, burstLimit: 20 },
  backup: { service: 'backup', requestsPerSecond: 5, burstLimit: 20 },
  // Management
  cloudtrail: { service: 'cloudtrail', requestsPerSecond: 5, burstLimit: 20 },
  config: { service: 'config', requestsPerSecond: 5, burstLimit: 20 },
  ssm: { service: 'ssm', requestsPerSecond: 10, burstLimit: 50 },
  // Analytics
  kinesis: { service: 'kinesis', requestsPerSecond: 5, burstLimit: 20 },
  firehose: { service: 'firehose', requestsPerSecond: 5, burstLimit: 20 },
  msk: { service: 'msk', requestsPerSecond: 5, burstLimit: 20 },
  emr: { service: 'emr', requestsPerSecond: 5, burstLimit: 20 },
  // Database
  opensearch: { service: 'opensearch', requestsPerSecond: 5, burstLimit: 20 },
  // Integration
  appsync: { service: 'appsync', requestsPerSecond: 5, burstLimit: 20 },
  ses: { service: 'ses', requestsPerSecond: 5, burstLimit: 20 },
  // Developer Tools
  codepipeline: { service: 'codepipeline', requestsPerSecond: 5, burstLimit: 20 },
  codebuild: { service: 'codebuild', requestsPerSecond: 5, burstLimit: 20 },
  // ML & AI
  sagemaker: { service: 'sagemaker', requestsPerSecond: 5, burstLimit: 20 },
  // Data Pipeline
  mwaa: { service: 'mwaa', requestsPerSecond: 5, burstLimit: 20 },
  transfer: { service: 'transfer', requestsPerSecond: 5, burstLimit: 20 },
  // Phase 4: Database & Networking
  neptune: { service: 'neptune', requestsPerSecond: 5, burstLimit: 20 },
  documentdb: { service: 'documentdb', requestsPerSecond: 5, burstLimit: 20 },
  memorydb: { service: 'memorydb', requestsPerSecond: 5, burstLimit: 20 },
  timestream: { service: 'timestream', requestsPerSecond: 5, burstLimit: 20 },
  keyspaces: { service: 'keyspaces', requestsPerSecond: 5, burstLimit: 20 },
  transitgateway: { service: 'transitgateway', requestsPerSecond: 10, burstLimit: 50 },
  globalaccelerator: { service: 'globalaccelerator', requestsPerSecond: 5, burstLimit: 20 },
  directconnect: { service: 'directconnect', requestsPerSecond: 5, burstLimit: 20 },
  networkfirewall: { service: 'networkfirewall', requestsPerSecond: 5, burstLimit: 20 },
  mq: { service: 'mq', requestsPerSecond: 5, burstLimit: 20 },
  // Phase 5: Storage, Migration & Compute
  fsx: { service: 'fsx', requestsPerSecond: 5, burstLimit: 20 },
  storagegateway: { service: 'storagegateway', requestsPerSecond: 5, burstLimit: 20 },
  dms: { service: 'dms', requestsPerSecond: 5, burstLimit: 20 },
  datasync: { service: 'datasync', requestsPerSecond: 5, burstLimit: 20 },
  drs: { service: 'drs', requestsPerSecond: 5, burstLimit: 20 },
  lakeformation: { service: 'lakeformation', requestsPerSecond: 5, burstLimit: 20 },
  elasticbeanstalk: { service: 'elasticbeanstalk', requestsPerSecond: 5, burstLimit: 20 },
  apprunner: { service: 'apprunner', requestsPerSecond: 5, burstLimit: 20 },
  batch: { service: 'batch', requestsPerSecond: 5, burstLimit: 20 },
  appflow: { service: 'appflow', requestsPerSecond: 5, burstLimit: 20 },
  // Phase 6: Security & Compliance
  macie: { service: 'macie', requestsPerSecond: 5, burstLimit: 20 },
  fms: { service: 'fms', requestsPerSecond: 5, burstLimit: 20 },
  shield: { service: 'shield', requestsPerSecond: 5, burstLimit: 20 },
  cloudhsm: { service: 'cloudhsm', requestsPerSecond: 5, burstLimit: 20 },
  directoryservice: { service: 'directoryservice', requestsPerSecond: 5, burstLimit: 20 },
  detective: { service: 'detective', requestsPerSecond: 5, burstLimit: 20 },
  auditmanager: { service: 'auditmanager', requestsPerSecond: 5, burstLimit: 20 },
  ram: { service: 'ram', requestsPerSecond: 5, burstLimit: 20 },
  organizations: { service: 'organizations', requestsPerSecond: 5, burstLimit: 20 },
  trustedadvisor: { service: 'trustedadvisor', requestsPerSecond: 5, burstLimit: 20 },
  // Phase 7: Developer Tools & Management
  codedeploy: { service: 'codedeploy', requestsPerSecond: 5, burstLimit: 20 },
  codeartifact: { service: 'codeartifact', requestsPerSecond: 5, burstLimit: 20 },
  xray: { service: 'xray', requestsPerSecond: 5, burstLimit: 20 },
  fis: { service: 'fis', requestsPerSecond: 5, burstLimit: 20 },
  imagebuilder: { service: 'imagebuilder', requestsPerSecond: 5, burstLimit: 20 },
  servicecatalog: { service: 'servicecatalog', requestsPerSecond: 5, burstLimit: 20 },
  licensemanager: { service: 'licensemanager', requestsPerSecond: 5, burstLimit: 20 },
  computeoptimizer: { service: 'computeoptimizer', requestsPerSecond: 5, burstLimit: 20 },
  // Phase 8: AI/ML & Frontend
  bedrock: { service: 'bedrock', requestsPerSecond: 5, burstLimit: 20 },
  comprehend: { service: 'comprehend', requestsPerSecond: 5, burstLimit: 20 },
  rekognition: { service: 'rekognition', requestsPerSecond: 5, burstLimit: 20 },
  textract: { service: 'textract', requestsPerSecond: 5, burstLimit: 20 },
  transcribe: { service: 'transcribe', requestsPerSecond: 5, burstLimit: 20 },
  lex: { service: 'lex', requestsPerSecond: 5, burstLimit: 20 },
  kendra: { service: 'kendra', requestsPerSecond: 5, burstLimit: 20 },
  amplify: { service: 'amplify', requestsPerSecond: 5, burstLimit: 20 },
  location: { service: 'location', requestsPerSecond: 5, burstLimit: 20 },
  lightsail: { service: 'lightsail', requestsPerSecond: 5, burstLimit: 20 },
  // Phase 9: Streaming, Analytics & Comms
  kinesisvideo: { service: 'kinesisvideo', requestsPerSecond: 5, burstLimit: 20 },
  flink: { service: 'flink', requestsPerSecond: 5, burstLimit: 20 },
  quicksight: { service: 'quicksight', requestsPerSecond: 5, burstLimit: 20 },
  pinpoint: { service: 'pinpoint', requestsPerSecond: 5, burstLimit: 20 },
  connect: { service: 'connect', requestsPerSecond: 5, burstLimit: 20 },
  ivs: { service: 'ivs', requestsPerSecond: 5, burstLimit: 20 },
  mediaconvert: { service: 'mediaconvert', requestsPerSecond: 5, burstLimit: 20 },
  medialive: { service: 'medialive', requestsPerSecond: 5, burstLimit: 20 },
  // Phase 10: IoT, Niche & Remaining
  iot: { service: 'iot', requestsPerSecond: 5, burstLimit: 20 },
  forecast: { service: 'forecast', requestsPerSecond: 5, burstLimit: 20 },
  personalize: { service: 'personalize', requestsPerSecond: 5, burstLimit: 20 },
  frauddetector: { service: 'frauddetector', requestsPerSecond: 5, burstLimit: 20 },
  workspaces: { service: 'workspaces', requestsPerSecond: 5, burstLimit: 20 },
  verifiedaccess: { service: 'verifiedaccess', requestsPerSecond: 10, burstLimit: 50 },
  vpclattice: { service: 'vpclattice', requestsPerSecond: 5, burstLimit: 20 },
  elastictranscoder: { service: 'elastictranscoder', requestsPerSecond: 5, burstLimit: 20 },
  cloudsearch: { service: 'cloudsearch', requestsPerSecond: 5, burstLimit: 20 },
  healthlake: { service: 'healthlake', requestsPerSecond: 5, burstLimit: 20 },
  // Other
  tagging: { service: 'tagging', requestsPerSecond: 5, burstLimit: 20 },
  sts: { service: 'sts', requestsPerSecond: 20, burstLimit: 100 },
  'cost-explorer': { service: 'cost-explorer', requestsPerSecond: 5, burstLimit: 10 },
};

// Cost Analysis Types
export type CostDateRange = '7d' | '30d' | '90d' | '12m' | 'custom';
export type CostGranularity = 'DAILY' | 'MONTHLY';

export interface CostTrendDataPoint {
  date: string;
  cost: number;
  currency: string;
}

export interface DetailedServiceCost {
  service: string;
  cost: number;
  previousPeriodCost: number;
  percentChange: number;
  currency: string;
}

export interface RegionCost {
  region: string;
  cost: number;
  currency: string;
}

export interface ProjectCost {
  projectId: string;
  projectName: string;
  cost: number;
  currency: string;
}

export interface SkuCost {
  service: string;
  sku: string;
  cost: number;
  currency: string;
}

export interface ResourceCostSkuEntry {
  sku: string;
  cost: number;
}

export interface ResourceCost {
  resourceName: string;
  shortName: string;
  service: string;
  sku?: string;
  projectId?: string;
  region: string;
  cost: number;
  currency: string;
  labels: Record<string, string>;
  skuBreakdown?: ResourceCostSkuEntry[];
}

export interface CostAnalysisResult {
  totalCost: number;
  previousPeriodTotalCost: number;
  percentChange: number;
  currency: string;
  startDate: string;
  endDate: string;
  trend: CostTrendDataPoint[];
  serviceTrends: Record<string, CostTrendDataPoint[]>;
  byService: DetailedServiceCost[];
  byRegion: RegionCost[];
  byProject?: ProjectCost[];
  bySku?: SkuCost[];
  byResource?: ResourceCost[];
  availableLabels?: { key: string; values: string[] }[];
}

// ── Credits Analysis ──

export interface CreditsByCategory {
  category: string;
  amount: number;
  currency: string;
  count: number;
}

export interface CreditsTrendPoint {
  date: string;
  totalCredits: number;
  byType?: Record<string, number>;
  currency: string;
}

export interface CreditsAnalysisResult {
  totalCredits: number;
  totalGrossCost: number;
  totalNetCost: number;
  creditsAsPercentOfGross: number;
  currency: string;
  startDate: string;
  endDate: string;
  trend: CreditsTrendPoint[];
  byService: CreditsByCategory[];
  byType: CreditsByCategory[];
  byLinkedAccount?: CreditsByCategory[];
  byProject?: CreditsByCategory[];
}

export interface CostOptimizationRecommendation {
  id: string;
  type: 'unused_resource' | 'underutilized' | 'reserved_instance' | 'savings_plan'
      | 'idle_resource' | 'orphaned_resource' | 'cost_anomaly' | 'rightsizing'
      | 'commitment_coverage' | 'best_practice' | 'egress_optimization';
  severity: 'low' | 'medium' | 'high';
  service: string;
  description: string;
  estimatedMonthlySavings: number;
  currency: string;
  actionRequired: string;
  resourceId?: string;
  resourceType?: string;
  region?: string;
  category?: string;
}

export interface CostOptimizationResult {
  recommendations: CostOptimizationRecommendation[];
  totalPotentialSavings: number;
  currency: string;
}

// ── GCP Expanded Cost Recommendation Results ──

export interface GCPExpandedRecommendationsResult {
  recommendations: CostOptimizationRecommendation[];
  meta: Record<string, GCPCostRecommendationMeta>;
  totalPotentialSavings: number;
  currency: string;
  byCategory: Record<GCPCostCategory, { count: number; savings: number }>;
  regionsScanned: string[];
  recommenderTypesScanned: string[];
  errors: string[];
}

export interface GCPOrgScanProgress {
  projectsCompleted: number;
  totalProjects: number;
  currentProject: string;
  partial: GCPExpandedRecommendationsResult;
}

export interface GCPCostBestPracticesResult {
  recommendations: CostOptimizationRecommendation[];
  checksRun: number;
  checksWithFindings: number;
  errors: string[];
  totalPotentialSavings: number;
  currency: string;
}

export interface GCPCommitmentCostBreakdown {
  commitmentLabel: string;
  skuDescription: string;
  commitmentFee: number;
}

export interface GCPCUDCoverageResult {
  commitments: GCPCommitment[];
  coverageRatio: number;
  totalCommittedSpend: number;
  totalEligibleOnDemandSpend: number;
  uncoveredOnDemandSpend: number;
  potentialSavingsFromCUD: number;
  currency: string;
  byRegion: Array<{ region: string; committedSpend: number; onDemandSpend: number; coverageRatio: number }>;
  cudRecommendations: CostOptimizationRecommendation[];
  commitmentBreakdown: GCPCommitmentCostBreakdown[];
  costUtilization: {
    totalCommitmentFees: number;
    totalCUDCredits: number;
    utilizationRatio: number;
  };
  errors: string[];
}

// ── GCP Stopped / Suspended VM Analysis ──

export interface StoppedVMInfo {
  name: string;
  zone: string;
  machineType: string;
  status: 'TERMINATED' | 'SUSPENDED';
  stoppedSince?: string;
  attachedDiskCount: number;
  totalDiskSizeGb: number;
  estimatedDiskMonthlyCost: number;
  hasStaticExternalIp: boolean;
  staticIpMonthlyCost: number;
  totalMonthlyCost: number;
  labels: Record<string, string>;
  projectId?: string;
}

export interface StoppedVMResult {
  vms: StoppedVMInfo[];
  totalEstimatedMonthlyCost: number;
  currency: string;
}

// Security Posture Types
export type FindingSeverity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'INFORMATIONAL';
export type FindingSource = 'SECURITY_HUB' | 'GUARDDUTY' | 'INSPECTOR' | 'ACCESS_ANALYZER' | 'CONFIG' | 'BEST_PRACTICES';
export type FindingStatus = 'ACTIVE' | 'ARCHIVED' | 'RESOLVED';
export type SecurityScanMode = 'security_hub' | 'best_practices';

export interface BestPracticesScanProgress {
  phase: string;
  service: string;
  percent: number;
}

export interface SecurityFinding {
  id: string;
  title: string;
  description: string;
  severity: FindingSeverity;
  status: FindingStatus;
  source: FindingSource;
  region: string;
  resourceType?: string;
  resourceId?: string;
  resourceArn?: string;
  complianceStatus?: string;
  remediationRecommendation?: string;
  remediationUrl?: string;
  firstObservedAt?: string;
  lastObservedAt?: string;
  awsAccountId?: string;
  generatorId?: string;
  productName?: string;
}

export interface ComplianceStandard {
  standardArn: string;
  standardName: string;
  description?: string;
  enabledDate?: string;
}

export interface ComplianceScore {
  standardName: string;
  standardArn: string;
  score: number;
  passedControls: number;
  failedControls: number;
  totalControls: number;
}

export interface SecurityPostureSummary {
  totalFindings: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  informationalCount: number;
  bySource: Record<FindingSource, number>;
  complianceScores: ComplianceScore[];
  lastRefreshed: string;
}

export interface SecurityAnalysisResult {
  id?: string;
  projectId?: string;
  scanMode?: string;
  timestamp?: string;
  duration?: number;
  summary: SecurityPostureSummary;
  findings: SecurityFinding[];
  enabledStandards: ComplianceStandard[];
  error?: string;
}

/**
 * Diagnostic payload returned by Settings → "Test SCC Connection".
 * Returns the raw outcome of a single `listFindings(pageSize=1)` call so the
 * UI can show exactly which parent/scope was queried and the actual gRPC
 * status code on failure (rather than a re-mapped human message).
 */
export interface SccProbeResult {
  ok: boolean;
  parent: string;
  scope: 'organization' | 'project';
  orgId?: string;
  orgIdSource: 'settings' | 'discovered' | 'none';
  quotaProject: string;
  filter: string;
  durationMs: number;
  sampleCount?: number;
  error?: {
    grpcCode: number | null;
    grpcCodeName: string;
    message: string;
    details?: string;
  };
}

export interface SecurityFilters {
  severities: FindingSeverity[];
  sources: FindingSource[];
  searchQuery: string;
  includeArchived: boolean;
}

// ── Scan Comparison & Drift ──

export type DiffStatus = 'added' | 'removed' | 'changed' | 'unchanged';

export interface DiffField {
  field: string;
  oldValue: unknown;
  newValue: unknown;
}

export interface DiffResource {
  resourceId: string;
  name: string;
  service: string;
  region: string;
  status: DiffStatus;
  changedFields: DiffField[];
}

export interface ScanDiffSummary {
  totalA: number;
  totalB: number;
  addedCount: number;
  removedCount: number;
  changedCount: number;
  unchangedCount: number;
}

export interface ScanDiffResult {
  scanIdA: string;
  scanIdB: string;
  added: DiffResource[];
  removed: DiffResource[];
  changed: DiffResource[];
  unchanged: number;
  summary: ScanDiffSummary;
}

// ── GCP Resource Idle Analysis ──

export type IdleResourceIssueType =
  | 'unused_ip'
  | 'unattached_disk'
  | 'unused_lb'
  | 'empty_dns_zone'
  | 'stopped_vm'
  | 'idle_vertex_endpoint'
  | 'errored_composer_env'
  | 'orphaned_forwarding_rule'
  | 'orphaned_pubsub_topic'
  | 'orphaned_pubsub_subscription';

export interface ResourceIdleFinding {
  id: string;
  resourceId: string;
  resourceName: string;
  service: string;
  resourceType: string;
  region: string;
  projectId?: string;
  issueType: IdleResourceIssueType;
  description: string;
  estimatedMonthlySavings: number;
  details: Record<string, unknown>;
}

export interface ResourceIdleAnalysisResult {
  findings: ResourceIdleFinding[];
  scanId: string;
  scannedAt: string;
  totalFindings: number;
  byType: Record<IdleResourceIssueType, number>;
  estimatedMonthlySavings: number;
}

export interface GCPOptimizationSnapshot {
  id: string;
  scope: 'project' | 'org';
  identity: string;
  scannedAt: string;
  totalSavings: number;
  recCount: number;
  vmCount: number;
  resourceFindingsCount: number;
  expandedRecs?: GCPExpandedRecommendationsResult;
  stoppedVMs?: StoppedVMResult;
  resourceFindings?: ResourceIdleAnalysisResult;
}

// ── GKE Cost Analysis ──

export interface GKEClusterCost {
  cluster: string;
  cost: number;
  namespaceCount?: number;
}

export interface GKENamespaceCost {
  namespace: string;
  cluster: string;
  cost: number;
}

export interface GKEWorkloadCost {
  workload: string;
  workloadType: string;
  namespace: string;
  cluster: string;
  cost: number;
}

export interface GKETrendPoint {
  date: string;
  cost: number;
  cluster?: string;
}

export interface GKESkuCost {
  sku: string;
  cost: number;
}

export interface GKECostAnalysis {
  totalCost: number;
  currency: string;
  byCluster: GKEClusterCost[];
  byNamespace: GKENamespaceCost[];
  byWorkload: GKEWorkloadCost[];
  trend: GKETrendPoint[];
  bySku: GKESkuCost[];
}

// ── GCP Cost Cache ──

export interface GCPCostCacheEntry {
  id: string;
  dataType: 'cost_analysis' | 'gke_cost';
  scope: 'project' | 'org';
  identity: string;
  fetchedAt: string;
  startDate: string;
  endDate: string;
  dateRangeLabel: string;
  label: string;
  filters?: GCPCostFilters;
  totalCost: number;
  serviceCount: number;
  data?: CostAnalysisResult | GKECostAnalysis;
}

// ── Environment Health ──

export type HealthStatus = 'ok' | 'warning' | 'error' | 'not-found';

export interface ToolCheck {
  id: string;
  name: string;
  status: HealthStatus;
  version?: string;
  details?: string;
  installUrl?: string;
  required: boolean;
}

export interface EnvironmentHealth {
  checkedAt: string;
  platform: string;
  nodeVersion: string;
  electronVersion: string;
  checks: ToolCheck[];
}

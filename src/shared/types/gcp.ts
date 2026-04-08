// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

// ── GCP-Specific Types ──

export interface GCPProject {
  projectId: string;
  projectName: string;
  projectNumber?: string;
  state?: string;
  labels?: Record<string, string>;
}

export interface GCPOrganization {
  organizationId: string;
  displayName: string;
}

export type GCPServiceType =
  // Compute & Containers
  | 'gce'
  | 'gce-disks'
  | 'gce-images'
  | 'gce-snapshots'
  | 'gce-instance-groups'
  | 'gke'
  | 'cloud-run'
  | 'cloud-functions'
  | 'app-engine'
  // Storage
  | 'gcs'
  | 'filestore'
  // Database
  | 'cloud-sql'
  | 'cloud-spanner'
  | 'firestore'
  | 'bigtable'
  | 'memorystore'
  | 'alloydb'
  | 'datastore'
  // Networking
  | 'vpc-network'
  | 'vpc-subnet'
  | 'vpc-firewall'
  | 'cloud-router'
  | 'cloud-nat'
  | 'cloud-address'
  | 'cloud-dns'
  | 'gclb'
  | 'gclb-url-maps'
  | 'cloud-armor'
  | 'cloud-cdn'
  | 'cloud-interconnect'
  | 'service-directory'
  | 'cloud-endpoints'
  | 'vpc-peering'
  // Analytics & Data
  | 'bigquery'
  | 'dataflow'
  | 'dataproc'
  | 'cloud-composer'
  | 'dataplex'
  | 'data-catalog'
  // Messaging & Integration
  | 'pubsub'
  | 'cloud-tasks'
  | 'cloud-scheduler'
  | 'cloud-workflows'
  | 'eventarc'
  // Security & Identity
  | 'gcp-iam'
  | 'gcp-kms'
  | 'secret-manager'
  | 'security-command-center'
  | 'cloud-dlp'
  | 'certificate-authority'
  | 'access-context-manager'
  | 'cloud-asset-inventory'
  // DevOps & CI/CD
  | 'cloud-build'
  | 'cloud-deploy'
  | 'artifact-registry'
  | 'cloud-source-repos'
  // AI/ML
  | 'vertex-ai'
  | 'dialogflow'
  | 'document-ai'
  | 'vision-ai'
  | 'speech-ai'
  | 'natural-language'
  | 'translation-ai'
  // Monitoring & Logging
  | 'cloud-logging'
  | 'cloud-monitoring'
  | 'cloud-trace'
  | 'error-reporting'
  // Cost & Management
  | 'cloud-billing'
  | 'recommender'
  // Additional Services
  | 'cloud-batch'
  | 'api-gateway'
  | 'data-fusion'
  | 'datastream'
  | 'managed-kafka'
  | 'cloud-workstations'
  | 'vmware-engine'
  | 'backup-dr'
  | 'storage-transfer'
  | 'database-migration'
  | 'apigee'
  | 'deployment-manager'
  | 'application-integration'
  | 'network-intelligence'
  | 'identity-platform'
  | 'looker'
  | 'firebase';

export interface GCPScanConfig {
  projectId: string;
  services: GCPServiceType[];
}

export interface GCPServiceDiscoveryResult {
  /** GCPServiceType IDs that have billing usage and are scannable */
  activeServices: GCPServiceType[];
  /** Raw billing services with cost — for display in the UI */
  billingServices: Array<{
    service: string;
    cost: number;
    currency: string;
    /** Mapped scanner types (empty if no scanner maps to this billing service) */
    scannerTypes: GCPServiceType[];
  }>;
  /** Query period */
  startDate: string;
  endDate: string;
  /** Total cost across all services */
  totalCost: number;
  currency: string;
}

export interface GCPCostFilters {
  services?: string[];      // service.description (e.g., "Compute Engine")
  skus?: string[];          // sku.description
  regions?: string[];       // location.region (e.g., "us-central1")
  projectIds?: string[];    // project.id (org scope only)
  labels?: { key: string; values: string[] }[];  // resource label key-value filters
  resourceName?: string;    // substring match on resource.name
}

// ── GCP Cost Recommendation Types ──

export type GCPCostRecommendationSource = 'recommender_api' | 'billing_best_practice' | 'cud_analysis';
export type GCPCostCategory = 'idle_resources' | 'rightsizing' | 'commitments' | 'best_practices' | 'stopped_vms';

export interface GCPCostRecommendationMeta {
  source: GCPCostRecommendationSource;
  uiCategory: GCPCostCategory;
  recommenderType?: string;
  recommenderSubtype?: string;
  consoleUrl?: string;
}

export interface GCPCommitment {
  name: string;
  region: string;
  type: string;       // COMPUTE_OPTIMIZED, GENERAL_PURPOSE, etc.
  plan: string;       // 12_MONTH or 36_MONTH
  status: string;     // ACTIVE, EXPIRED, etc.
  startTimestamp: string;
  endTimestamp: string;
  resources: Array<{ type: string; amount: number; unit: string }>;
}

// GCP Service Categories (for UI grouping)
export const GCP_SERVICE_CATEGORIES: Record<string, { label: string; services: GCPServiceType[] }> = {
  compute: {
    label: 'Compute & Containers',
    services: ['gce', 'gce-disks', 'gce-images', 'gce-snapshots', 'gce-instance-groups', 'gke', 'cloud-run', 'cloud-functions', 'app-engine'],
  },
  storage: {
    label: 'Storage',
    services: ['gcs', 'filestore'],
  },
  database: {
    label: 'Database',
    services: ['cloud-sql', 'cloud-spanner', 'firestore', 'bigtable', 'memorystore', 'alloydb', 'datastore'],
  },
  networking: {
    label: 'Networking',
    services: ['vpc-network', 'vpc-subnet', 'vpc-firewall', 'cloud-router', 'cloud-nat', 'cloud-address', 'cloud-dns', 'gclb', 'gclb-url-maps', 'cloud-armor', 'cloud-cdn', 'cloud-interconnect', 'service-directory', 'cloud-endpoints', 'vpc-peering'],
  },
  analytics: {
    label: 'Analytics & Data',
    services: ['bigquery', 'dataflow', 'dataproc', 'cloud-composer', 'dataplex', 'data-catalog'],
  },
  messaging: {
    label: 'Messaging & Integration',
    services: ['pubsub', 'cloud-tasks', 'cloud-scheduler', 'cloud-workflows', 'eventarc'],
  },
  security: {
    label: 'Security & Identity',
    services: ['gcp-iam', 'gcp-kms', 'secret-manager', 'security-command-center', 'cloud-dlp', 'certificate-authority', 'access-context-manager', 'cloud-asset-inventory'],
  },
  devops: {
    label: 'DevOps & CI/CD',
    services: ['cloud-build', 'cloud-deploy', 'artifact-registry', 'cloud-source-repos'],
  },
  aiml: {
    label: 'AI/ML',
    services: ['vertex-ai', 'dialogflow', 'document-ai', 'vision-ai', 'speech-ai', 'natural-language', 'translation-ai'],
  },
  monitoring: {
    label: 'Monitoring & Logging',
    services: ['cloud-logging', 'cloud-monitoring', 'cloud-trace', 'error-reporting'],
  },
  cost: {
    label: 'Cost & Management',
    services: ['cloud-billing', 'recommender'],
  },
  additional: {
    label: 'Additional Services',
    services: [
      'cloud-batch', 'api-gateway', 'data-fusion', 'datastream', 'managed-kafka',
      'cloud-workstations', 'vmware-engine', 'backup-dr', 'storage-transfer',
      'database-migration', 'apigee', 'deployment-manager', 'application-integration',
      'network-intelligence', 'identity-platform', 'looker', 'firebase',
    ],
  },
};

// GCP Service Display Names
export const GCP_SERVICE_NAMES: Record<GCPServiceType, string> = {
  'gce': 'Compute Engine',
  'gce-disks': 'Persistent Disks',
  'gce-images': 'Custom Images',
  'gce-snapshots': 'Disk Snapshots',
  'gce-instance-groups': 'Instance Groups',
  'gke': 'GKE Clusters',
  'cloud-run': 'Cloud Run',
  'cloud-functions': 'Cloud Functions',
  'app-engine': 'App Engine',
  'gcs': 'Cloud Storage',
  'filestore': 'Filestore',
  'cloud-sql': 'Cloud SQL',
  'cloud-spanner': 'Cloud Spanner',
  'firestore': 'Firestore',
  'bigtable': 'Cloud Bigtable',
  'memorystore': 'Memorystore',
  'alloydb': 'AlloyDB',
  'datastore': 'Datastore',
  'vpc-network': 'VPC Networks',
  'vpc-subnet': 'VPC Subnets',
  'vpc-firewall': 'Firewall Rules',
  'cloud-router': 'Cloud Routers',
  'cloud-nat': 'Cloud NAT',
  'cloud-address': 'IP Addresses',
  'cloud-dns': 'Cloud DNS',
  'gclb': 'Load Balancers',
  'gclb-url-maps': 'URL Maps',
  'cloud-armor': 'Cloud Armor',
  'cloud-cdn': 'Cloud CDN',
  'cloud-interconnect': 'Cloud Interconnect',
  'service-directory': 'Service Directory',
  'cloud-endpoints': 'Cloud Endpoints',
  'vpc-peering': 'VPC Peering',
  'bigquery': 'BigQuery',
  'dataflow': 'Dataflow',
  'dataproc': 'Dataproc',
  'cloud-composer': 'Cloud Composer',
  'dataplex': 'Dataplex',
  'data-catalog': 'Data Catalog',
  'pubsub': 'Pub/Sub',
  'cloud-tasks': 'Cloud Tasks',
  'cloud-scheduler': 'Cloud Scheduler',
  'cloud-workflows': 'Cloud Workflows',
  'eventarc': 'Eventarc',
  'gcp-iam': 'IAM',
  'gcp-kms': 'Cloud KMS',
  'secret-manager': 'Secret Manager',
  'security-command-center': 'Security Command Center',
  'cloud-dlp': 'Cloud DLP',
  'certificate-authority': 'Certificate Authority',
  'access-context-manager': 'Access Context Manager',
  'cloud-asset-inventory': 'Cloud Asset Inventory',
  'cloud-build': 'Cloud Build',
  'cloud-deploy': 'Cloud Deploy',
  'artifact-registry': 'Artifact Registry',
  'cloud-source-repos': 'Source Repositories',
  'vertex-ai': 'Vertex AI',
  'dialogflow': 'Dialogflow',
  'document-ai': 'Document AI',
  'vision-ai': 'Vision AI',
  'speech-ai': 'Speech-to-Text',
  'natural-language': 'Natural Language',
  'translation-ai': 'Translation',
  'cloud-logging': 'Cloud Logging',
  'cloud-monitoring': 'Cloud Monitoring',
  'cloud-trace': 'Cloud Trace',
  'error-reporting': 'Error Reporting',
  'cloud-billing': 'Cloud Billing',
  'recommender': 'Recommender',
  'cloud-batch': 'Cloud Batch',
  'api-gateway': 'API Gateway',
  'data-fusion': 'Data Fusion',
  'datastream': 'Datastream',
  'managed-kafka': 'Managed Kafka',
  'cloud-workstations': 'Cloud Workstations',
  'vmware-engine': 'VMware Engine',
  'backup-dr': 'Backup and DR',
  'storage-transfer': 'Storage Transfer',
  'database-migration': 'Database Migration',
  'apigee': 'Apigee',
  'deployment-manager': 'Deployment Manager',
  'application-integration': 'Application Integration',
  'network-intelligence': 'Network Intelligence',
  'identity-platform': 'Identity Platform',
  'looker': 'Looker',
  'firebase': 'Firebase',
};

// ── GCP IAM Analysis Types ──

export interface GCPUnusedServiceAccount {
  email: string;
  displayName: string;
  projectId: string;
  uniqueId: string;
  lastActivityDate?: string;
  daysSinceLastActivity: number;
  hasKeys: boolean;
  keyCount: number;
  disabled: boolean;
}

export interface GCPOverlyPermissiveBinding {
  member: string;
  memberType: 'serviceAccount' | 'user' | 'group' | 'domain';
  role: string;
  roleType: 'primitive' | 'predefined' | 'custom';
  projectId: string;
  isOrgLevel: boolean;
  reason: string;
}

export interface GCPServiceAccountKeyIssue {
  serviceAccountEmail: string;
  keyId: string;
  keyType: 'USER_MANAGED' | 'SYSTEM_MANAGED';
  createdAt: string;
  expiresAt?: string;
  keyAgeInDays: number;
  issue: string;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
}

export interface GCPCrossProjectBinding {
  sourceProjectId: string;
  member: string;
  memberProjectId: string;
  role: string;
  isExternalProject: boolean;
}

export interface GCPIAMAnalysisResult {
  id: string;
  projectId: string;
  unusedServiceAccounts: GCPUnusedServiceAccount[];
  overlyPermissiveBindings: GCPOverlyPermissiveBinding[];
  serviceAccountKeyIssues: GCPServiceAccountKeyIssue[];
  crossProjectBindings: GCPCrossProjectBinding[];
  analyzedAt: string;
  duration: number;
  errors: string[];
}

export interface GCPIAMAnalysisSummary {
  id: string;
  projectId: string;
  analyzedAt: string;
  unusedServiceAccountCount: number;
  permissiveBindingCount: number;
  keyIssueCount: number;
  crossProjectCount: number;
  totalFindings: number;
  duration: number;
}

// ── GCP Network Analysis Types ──

export interface GCPFirewallFinding {
  ruleName: string;
  network: string;
  direction: 'INGRESS' | 'EGRESS';
  priority: number;
  sourceRanges: string[];
  targetTags: string[];
  targetServiceAccounts: string[];
  allowedPorts: { protocol: string; ports: string[] }[];
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  issue: string;
  disabled: boolean;
}

export interface GCPExposedResource {
  resourceId: string;
  resourceType: 'instance' | 'cloud-sql' | 'gke-cluster' | 'load-balancer';
  name: string;
  zone: string;
  network: string;
  externalIp?: string;
  openPorts: { protocol: string; port: string; source: string }[];
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  exposureDetails: string;
}

export interface GCPVPCAnalysis {
  networkName: string;
  networkMode: 'auto' | 'custom' | 'legacy';
  subnetCount: number;
  peeringConnections: { network: string; state: string; importRoutes: boolean; exportRoutes: boolean }[];
  isSharedVpc: boolean;
  isDefault: boolean;
  privateGoogleAccess: boolean;
}

export interface GCPNetworkAnalysisResult {
  id: string;
  projectId: string;
  firewallFindings: GCPFirewallFinding[];
  exposedResources: GCPExposedResource[];
  vpcAnalysis: GCPVPCAnalysis[];
  totalNetworks: number;
  totalFirewallRules: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  analyzedAt: string;
  duration: number;
  errors: string[];
}

export interface GCPNetworkAnalysisSummary {
  id: string;
  projectId: string;
  analyzedAt: string;
  totalNetworks: number;
  totalFirewallRules: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  totalFindings: number;
  duration: number;
}

// ── GCP Assessment Types ──

export type GCPAssessmentDomain = 'cost' | 'security' | 'reliability' | 'compliance' | 'iam';

export interface GCPAssessmentConfig {
  projectId: string;
  domains: GCPAssessmentDomain[];
  bqProject?: string;
  bqDataset?: string;
}

export interface GCPAssessmentProgress {
  stage: string;
  percent: number;
  message: string;
}

export interface GCPDomainScore {
  domain: GCPAssessmentDomain;
  score: number;
  grade: string;
  weight: number;
  findings: number;
  recommendations: GCPAssessmentRecommendation[];
  details: Record<string, unknown>;
}

export interface GCPAssessmentRecommendation {
  id: string;
  domain: GCPAssessmentDomain;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  description: string;
  impact?: string;
  remediation?: string;
  estimatedSavings?: number;
  resourceId?: string;
}

export interface GCPAssessmentResult {
  id: string;
  projectId: string;
  timestamp: string;
  overallScore: number;
  overallGrade: string;
  domainScores: GCPDomainScore[];
  totalRecommendations: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  duration: number;
  errors: string[];
}

export interface GCPAssessmentSummary {
  id: string;
  projectId: string;
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

// ── GCP Well-Architected Types ──

export type GCPWAPillarId = 'ops_excellence' | 'security' | 'reliability' | 'performance_cost' | 'system_design';

export interface GCPWACheckDefinition {
  id: string;
  title: string;
  description: string;
  pillar: GCPWAPillarId;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  service: string;
  remediationRecommendation: string;
}

export interface GCPWAFinding {
  check: GCPWACheckDefinition;
  status: 'PASS' | 'FAIL' | 'ERROR';
  resources: string[];
  detail?: string;
}

export interface GCPWAPillarSummary {
  pillar: GCPWAPillarId;
  pillarName: string;
  totalChecks: number;
  passCount: number;
  failCount: number;
  errorCount: number;
  findings: GCPWAFinding[];
}

export interface GCPWAScanResult {
  id?: string;
  projectId?: string;
  pillarSummaries: GCPWAPillarSummary[];
  totalChecks: number;
  totalPass: number;
  totalFail: number;
  totalError: number;
  duration: number;
  timestamp: string;
  error?: string;
}

export interface GCPWAScanProgress {
  phase: 'Scanning' | 'Complete';
  pillar: string;
  percent: number;
  service: string;
}

export interface GCPWellArchitectedSummary {
  id: string;
  projectId: string;
  timestamp: string;
  totalChecks: number;
  totalPass: number;
  totalFail: number;
  totalError: number;
  duration: number;
}

// ── GCP Label Governance Types ──

export interface GCPLabelGovernanceConfig {
  requiredLabels: string[];
}

export interface GCPLabelServiceCompliance {
  service: string;
  totalResources: number;
  compliantResources: number;
  compliancePercent: number;
}

export interface GCPLabelKeyCompliance {
  labelKey: string;
  totalResources: number;
  labeledResources: number;
  coveragePercent: number;
}

export interface GCPUnlabeledResource {
  id: string;
  name: string;
  service: string;
  region: string;
  missingLabels: string[];
}

export interface GCPLabelComplianceResult {
  id: string;
  projectId: string;
  totalResources: number;
  fullyCompliantResources: number;
  overallCompliancePercent: number;
  byService: GCPLabelServiceCompliance[];
  byLabelKey: GCPLabelKeyCompliance[];
  unlabeledResources: GCPUnlabeledResource[];
  analyzedAt: string;
  duration: number;
}

export interface GCPLabelComplianceSummary {
  id: string;
  projectId: string;
  analyzedAt: string;
  totalResources: number;
  fullyCompliantResources: number;
  overallCompliancePercent: number;
  nonCompliantCount: number;
  duration: number;
}

// ── GCP Compliance Summary (for DB history) ──

export interface GCPComplianceSummary {
  id: string;
  projectId: string;
  frameworkId: string;
  assessedAt: string;
  overallScore: number;
  totalControls: number;
  passedControls: number;
  failedControls: number;
  notCheckedControls: number;
  duration: number;
}

// ── GCP Security Scan Summary (for DB history) ──

export interface GCPSecurityScanSummary {
  id: string;
  projectId: string;
  scanMode: string;
  timestamp: string;
  totalFindings: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  duration: number;
}


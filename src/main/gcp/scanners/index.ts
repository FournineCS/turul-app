// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import type { GCPServiceType } from '../../../shared/types';
import { GCPBaseScanner, type GCPScannerConfig } from './base-scanner';

// Batch 1: Compute & Containers
import { ComputeScanner } from './compute-scanner';
import { DisksScanner } from './disks-scanner';
import { ImagesScanner } from './images-scanner';
import { SnapshotsScanner } from './snapshots-scanner';
import { InstanceGroupsScanner } from './instance-groups-scanner';
import { GKEScanner } from './gke-scanner';
import { CloudRunScanner } from './cloudrun-scanner';
import { FunctionsScanner } from './functions-scanner';
import { AppEngineScanner } from './appengine-scanner';

// Batch 2: Storage
import { GCSScanner } from './gcs-scanner';
import { FilestoreScanner } from './filestore-scanner';

// Batch 3: Database
import { CloudSQLScanner } from './cloudsql-scanner';
import { SpannerScanner } from './spanner-scanner';
import { FirestoreScanner } from './firestore-scanner';
import { BigtableScanner } from './bigtable-scanner';
import { MemorystoreScanner } from './memorystore-scanner';
import { AlloyDBScanner } from './alloydb-scanner';
import { DatastoreScanner } from './datastore-scanner';

// Batch 4: Networking
import { NetworksScanner } from './networks-scanner';
import { SubnetsScanner } from './subnets-scanner';
import { FirewallScanner } from './firewall-scanner';
import { RoutersScanner } from './routers-scanner';
import { AddressesScanner } from './addresses-scanner';
import { DNSScanner } from './dns-scanner';
import { ForwardingRulesScanner } from './forwarding-rules-scanner';
import { BackendServicesScanner } from './backend-services-scanner';
import { UrlMapsScanner } from './urlmaps-scanner';
import { HealthChecksScanner } from './health-checks-scanner';
import { SslCertsScanner } from './ssl-certs-scanner';
import { CloudArmorScanner } from './cloud-armor-scanner';
import { InterconnectScanner } from './interconnect-scanner';
import { ServiceDirectoryScanner } from './service-directory-scanner';

// Batch 5: Analytics & Data
import { BigQueryScanner } from './bigquery-scanner';
import { DataflowScanner } from './dataflow-scanner';
import { DataprocScanner } from './dataproc-scanner';
import { ComposerScanner } from './composer-scanner';
import { DataplexScanner } from './dataplex-scanner';
import { DataCatalogScanner } from './data-catalog-scanner';

// Batch 6: Messaging & Integration
import { PubSubScanner } from './pubsub-scanner';
import { TasksScanner } from './tasks-scanner';
import { SchedulerScanner } from './scheduler-scanner';
import { WorkflowsScanner } from './workflows-scanner';
import { EventarcScanner } from './eventarc-scanner';

// Batch 7: Security & Identity
import { IAMScanner } from './iam-scanner';
import { KMSScanner } from './kms-scanner';
import { SecretManagerScanner } from './secret-manager-scanner';
import { SecurityCommandCenterScanner } from './scc-scanner';
import { DLPScanner } from './dlp-scanner';
import { CertificateAuthorityScanner } from './cert-authority-scanner';
import { AssetInventoryScanner } from './asset-inventory-scanner';
import { AccessContextManagerScanner } from './access-context-scanner';

// Batch 8: DevOps & CI/CD
import { CloudBuildScanner } from './cloud-build-scanner';
import { CloudDeployScanner } from './cloud-deploy-scanner';
import { ArtifactRegistryScanner } from './artifact-registry-scanner';
import { SourceReposScanner } from './source-repos-scanner';

// Batch 9: AI/ML
import { VertexAIScanner } from './vertex-ai-scanner';
import { DialogflowScanner } from './dialogflow-scanner';
import { DocumentAIScanner } from './document-ai-scanner';
import { VisionScanner } from './vision-scanner';
import { SpeechScanner } from './speech-scanner';
import { LanguageScanner } from './language-scanner';
import { TranslationScanner } from './translation-scanner';

// Batch 10: Monitoring & Management
import { LoggingScanner } from './logging-scanner';
import { MonitoringScanner } from './monitoring-scanner';
import { BillingScanner } from './billing-scanner';
import { RecommenderScanner } from './recommender-scanner';

// Batch 11: Additional Services
import { BatchScanner } from './batch-scanner';
import { APIGatewayScanner } from './api-gateway-scanner';
import { DataFusionScanner } from './data-fusion-scanner';
import { DatastreamScanner } from './datastream-scanner';
import { ManagedKafkaScanner } from './managed-kafka-scanner';
import { WorkstationsScanner } from './workstations-scanner';
import { VMwareEngineScanner } from './vmware-engine-scanner';
import { BackupDRScanner } from './backup-dr-scanner';
import { StorageTransferScanner } from './storage-transfer-scanner';
import { DatabaseMigrationScanner } from './database-migration-scanner';
import { ApigeeScanner } from './apigee-scanner';
import { DeploymentManagerScanner } from './deployment-manager-scanner';
import { ApplicationIntegrationScanner } from './application-integration-scanner';
import { NetworkIntelligenceScanner } from './network-intelligence-scanner';
import { IdentityPlatformScanner } from './identity-platform-scanner';
import { LookerScanner } from './looker-scanner';
import { FirebaseScanner } from './firebase-scanner';

const SCANNER_MAP: Record<GCPServiceType, new (config: GCPScannerConfig) => GCPBaseScanner> = {
  // Compute & Containers
  'gce': ComputeScanner,
  'gce-disks': DisksScanner,
  'gce-images': ImagesScanner,
  'gce-snapshots': SnapshotsScanner,
  'gce-instance-groups': InstanceGroupsScanner,
  'gke': GKEScanner,
  'cloud-run': CloudRunScanner,
  'cloud-functions': FunctionsScanner,
  'app-engine': AppEngineScanner,
  // Storage
  'gcs': GCSScanner,
  'filestore': FilestoreScanner,
  // Database
  'cloud-sql': CloudSQLScanner,
  'cloud-spanner': SpannerScanner,
  'firestore': FirestoreScanner,
  'bigtable': BigtableScanner,
  'memorystore': MemorystoreScanner,
  'alloydb': AlloyDBScanner,
  'datastore': DatastoreScanner,
  // Networking
  'vpc-network': NetworksScanner,
  'vpc-subnet': SubnetsScanner,
  'vpc-firewall': FirewallScanner,
  'cloud-router': RoutersScanner,
  'cloud-nat': RoutersScanner, // NAT is discovered via Router scanner
  'cloud-address': AddressesScanner,
  'cloud-dns': DNSScanner,
  'gclb': ForwardingRulesScanner, // LB entry point
  'gclb-url-maps': UrlMapsScanner,
  'cloud-armor': CloudArmorScanner,
  'cloud-cdn': BackendServicesScanner, // CDN is a feature of backend services
  'cloud-interconnect': InterconnectScanner,
  'service-directory': ServiceDirectoryScanner,
  'cloud-endpoints': ServiceDirectoryScanner, // Uses same underlying API
  'vpc-peering': NetworksScanner, // Peering info is in networks
  // Analytics & Data
  'bigquery': BigQueryScanner,
  'dataflow': DataflowScanner,
  'dataproc': DataprocScanner,
  'cloud-composer': ComposerScanner,
  'dataplex': DataplexScanner,
  'data-catalog': DataCatalogScanner,
  // Messaging & Integration
  'pubsub': PubSubScanner,
  'cloud-tasks': TasksScanner,
  'cloud-scheduler': SchedulerScanner,
  'cloud-workflows': WorkflowsScanner,
  'eventarc': EventarcScanner,
  // Security & Identity
  'gcp-iam': IAMScanner,
  'gcp-kms': KMSScanner,
  'secret-manager': SecretManagerScanner,
  'security-command-center': SecurityCommandCenterScanner,
  'cloud-dlp': DLPScanner,
  'certificate-authority': CertificateAuthorityScanner,
  'cloud-asset-inventory': AssetInventoryScanner,
  'access-context-manager': AccessContextManagerScanner,
  // DevOps & CI/CD
  'cloud-build': CloudBuildScanner,
  'cloud-deploy': CloudDeployScanner,
  'artifact-registry': ArtifactRegistryScanner,
  'cloud-source-repos': SourceReposScanner,
  // AI/ML
  'vertex-ai': VertexAIScanner,
  'dialogflow': DialogflowScanner,
  'document-ai': DocumentAIScanner,
  'vision-ai': VisionScanner,
  'speech-ai': SpeechScanner,
  'natural-language': LanguageScanner,
  'translation-ai': TranslationScanner,
  // Monitoring & Management
  'cloud-logging': LoggingScanner,
  'cloud-monitoring': MonitoringScanner,
  'cloud-trace': MonitoringScanner,       // Trace data is accessed via monitoring
  'error-reporting': LoggingScanner,       // Error Reporting uses logging infrastructure
  'cloud-billing': BillingScanner,
  'recommender': RecommenderScanner,
  // Additional Services
  'cloud-batch': BatchScanner,
  'api-gateway': APIGatewayScanner,
  'data-fusion': DataFusionScanner,
  'datastream': DatastreamScanner,
  'managed-kafka': ManagedKafkaScanner,
  'cloud-workstations': WorkstationsScanner,
  'vmware-engine': VMwareEngineScanner,
  'backup-dr': BackupDRScanner,
  'storage-transfer': StorageTransferScanner,
  'database-migration': DatabaseMigrationScanner,
  'apigee': ApigeeScanner,
  'deployment-manager': DeploymentManagerScanner,
  'application-integration': ApplicationIntegrationScanner,
  'network-intelligence': NetworkIntelligenceScanner,
  'identity-platform': IdentityPlatformScanner,
  'looker': LookerScanner,
  'firebase': FirebaseScanner,
};

// Services that share scanners — skip duplicate scans
const SHARED_SCANNER_SERVICES: Set<GCPServiceType> = new Set([
  'cloud-nat',         // Scanned by cloud-router
  'cloud-cdn',         // Feature of backend services
  'cloud-endpoints',   // Uses service directory
  'vpc-peering',       // Info is in networks
  'cloud-trace',       // Uses monitoring scanner
  'error-reporting',   // Uses logging scanner
]);

export function createGCPScanner(
  serviceType: GCPServiceType,
  config: GCPScannerConfig
): GCPBaseScanner | null {
  const ScannerClass = SCANNER_MAP[serviceType];
  if (!ScannerClass) {
    console.warn(`No GCP scanner found for service type: ${serviceType}`);
    return null;
  }
  return new ScannerClass(config);
}

export function shouldSkipService(serviceType: GCPServiceType): boolean {
  return SHARED_SCANNER_SERVICES.has(serviceType);
}

export { GCPBaseScanner, type GCPScannerConfig, type GCPScanResult, type GCPScanError } from './base-scanner';

// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

// Import GCP client types
import {
  InstancesClient,
  DisksClient,
  ImagesClient,
  SnapshotsClient,
  InstanceGroupsClient,
  NetworksClient,
  SubnetworksClient,
  FirewallsClient,
  RoutersClient,
  AddressesClient,
  ForwardingRulesClient,
  BackendServicesClient,
  UrlMapsClient,
  HealthChecksClient,
  SslCertificatesClient,
  SecurityPoliciesClient,
  InterconnectsClient,
  ProjectsClient,
} from '@google-cloud/compute';
import { ClusterManagerClient } from '@google-cloud/container';
import { Storage } from '@google-cloud/storage';
import { BigQuery } from '@google-cloud/bigquery';
import { PubSub } from '@google-cloud/pubsub';
import { DNS } from '@google-cloud/dns';
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';
import { KeyManagementServiceClient } from '@google-cloud/kms';
import { SecurityCenterClient } from '@google-cloud/security-center';
import { AssetServiceClient } from '@google-cloud/asset';
import { Logging } from '@google-cloud/logging';
import { AlertPolicyServiceClient, UptimeCheckServiceClient } from '@google-cloud/monitoring';
import { CloudBillingClient } from '@google-cloud/billing';
import { BudgetServiceClient } from '@google-cloud/billing-budgets';
import { RecommenderClient } from '@google-cloud/recommender';
import { ArtifactRegistryClient } from '@google-cloud/artifact-registry';
import { CloudBuildClient } from '@google-cloud/cloudbuild';
import { CloudDeployClient } from '@google-cloud/deploy';
import { ClusterControllerClient } from '@google-cloud/dataproc';
import { CloudSchedulerClient } from '@google-cloud/scheduler';
import { CloudTasksClient } from '@google-cloud/tasks';
import { RegistrationServiceClient } from '@google-cloud/service-directory';
import { DlpServiceClient } from '@google-cloud/dlp';
import { Spanner } from '@google-cloud/spanner';
import { Bigtable } from '@google-cloud/bigtable';
import { CloudRedisClient } from '@google-cloud/redis';
import { CloudFilestoreManagerClient } from '@google-cloud/filestore';
import { ServicesClient as CloudRunServicesClient } from '@google-cloud/run';
import { CloudFunctionsServiceClient } from '@google-cloud/functions';
import { ModelServiceClient, EndpointServiceClient, DatasetServiceClient, PipelineServiceClient, JobServiceClient } from '@google-cloud/aiplatform';
import { AgentsClient } from '@google-cloud/dialogflow';
import { DocumentProcessorServiceClient } from '@google-cloud/documentai';
import { ProductSearchClient } from '@google-cloud/vision';
import { SpeechClient } from '@google-cloud/speech';
import { LanguageServiceClient } from '@google-cloud/language';
import { TranslationServiceClient } from '@google-cloud/translate';

let factoryInstance: GCPClientFactory | null = null;

export class GCPClientFactory {
  private clientCache: Map<string, unknown> = new Map();
  private projectId: string;

  constructor(projectId: string) {
    this.projectId = projectId;
  }

  setProjectId(projectId: string): void {
    if (this.projectId !== projectId) {
      this.clientCache.clear();
      this.projectId = projectId;
    }
  }

  getProjectId(): string {
    return this.projectId;
  }

  private getOrCreate<T>(key: string, factory: () => T): T {
    if (this.clientCache.has(key)) {
      return this.clientCache.get(key) as T;
    }
    const client = factory();
    this.clientCache.set(key, client);
    return client;
  }

  // Compute Engine clients
  getInstancesClient(): InstancesClient {
    return this.getOrCreate('instances', () => new InstancesClient());
  }
  getDisksClient(): DisksClient {
    return this.getOrCreate('disks', () => new DisksClient());
  }
  getImagesClient(): ImagesClient {
    return this.getOrCreate('images', () => new ImagesClient());
  }
  getSnapshotsClient(): SnapshotsClient {
    return this.getOrCreate('snapshots', () => new SnapshotsClient());
  }
  getInstanceGroupsClient(): InstanceGroupsClient {
    return this.getOrCreate('instanceGroups', () => new InstanceGroupsClient());
  }
  getProjectsClient(): ProjectsClient {
    return this.getOrCreate('projects', () => new ProjectsClient());
  }
  getNetworksClient(): NetworksClient {
    return this.getOrCreate('networks', () => new NetworksClient());
  }
  getSubnetworksClient(): SubnetworksClient {
    return this.getOrCreate('subnetworks', () => new SubnetworksClient());
  }
  getFirewallsClient(): FirewallsClient {
    return this.getOrCreate('firewalls', () => new FirewallsClient());
  }
  getRoutersClient(): RoutersClient {
    return this.getOrCreate('routers', () => new RoutersClient());
  }
  getAddressesClient(): AddressesClient {
    return this.getOrCreate('addresses', () => new AddressesClient());
  }
  getForwardingRulesClient(): ForwardingRulesClient {
    return this.getOrCreate('forwardingRules', () => new ForwardingRulesClient());
  }
  getBackendServicesClient(): BackendServicesClient {
    return this.getOrCreate('backendServices', () => new BackendServicesClient());
  }
  getUrlMapsClient(): UrlMapsClient {
    return this.getOrCreate('urlMaps', () => new UrlMapsClient());
  }
  getHealthChecksClient(): HealthChecksClient {
    return this.getOrCreate('healthChecks', () => new HealthChecksClient());
  }
  getSslCertificatesClient(): SslCertificatesClient {
    return this.getOrCreate('sslCertificates', () => new SslCertificatesClient());
  }
  getSecurityPoliciesClient(): SecurityPoliciesClient {
    return this.getOrCreate('securityPolicies', () => new SecurityPoliciesClient());
  }
  getInterconnectsClient(): InterconnectsClient {
    return this.getOrCreate('interconnects', () => new InterconnectsClient());
  }

  // Container (GKE)
  getClusterManagerClient(): ClusterManagerClient {
    return this.getOrCreate('clusterManager', () => new ClusterManagerClient());
  }

  // Storage
  getStorageClient(): Storage {
    return this.getOrCreate('storage', () => new Storage({ projectId: this.projectId }));
  }

  // BigQuery
  getBigQueryClient(): BigQuery {
    return this.getOrCreate('bigquery', () => new BigQuery({ projectId: this.projectId }));
  }

  // Pub/Sub
  getPubSubClient(): PubSub {
    return this.getOrCreate('pubsub', () => new PubSub({ projectId: this.projectId }));
  }

  // DNS
  getDNSClient(): DNS {
    return this.getOrCreate('dns', () => new DNS({ projectId: this.projectId }));
  }

  // Secret Manager
  getSecretManagerClient(): SecretManagerServiceClient {
    return this.getOrCreate('secretManager', () => new SecretManagerServiceClient());
  }

  // KMS
  getKMSClient(): KeyManagementServiceClient {
    return this.getOrCreate('kms', () => new KeyManagementServiceClient());
  }

  // Security Command Center
  // ADC user creds require quota_project to be set on the AuthClient itself
  // (clientOptions.quotaProjectId is silently ignored for UserRefreshClient).
  // See gcp/security/scc-client.ts for the full rationale.
  async getSecurityCenterClient(): Promise<SecurityCenterClient> {
    const cached = this.clientCache.get('securityCenter') as SecurityCenterClient | undefined;
    if (cached) return cached;
    const { createSecurityCenterClient } = await import('./security/scc-client');
    const client = await createSecurityCenterClient(this.projectId);
    this.clientCache.set('securityCenter', client);
    return client;
  }

  // Cloud Asset Inventory
  getAssetClient(): AssetServiceClient {
    return this.getOrCreate('asset', () => new AssetServiceClient());
  }

  // Logging
  getLoggingClient(): Logging {
    return this.getOrCreate('logging', () => new Logging({ projectId: this.projectId }));
  }

  // Monitoring
  getAlertPolicyClient(): AlertPolicyServiceClient {
    return this.getOrCreate('alertPolicy', () => new AlertPolicyServiceClient());
  }
  getUptimeCheckClient(): UptimeCheckServiceClient {
    return this.getOrCreate('uptimeCheck', () => new UptimeCheckServiceClient());
  }

  // Billing
  getBillingClient(): CloudBillingClient {
    return this.getOrCreate('billing', () => new CloudBillingClient());
  }

  // Billing Budgets
  getBudgetServiceClient(): BudgetServiceClient {
    return this.getOrCreate('budgetService', () => new BudgetServiceClient());
  }

  // Recommender
  getRecommenderClient(): RecommenderClient {
    return this.getOrCreate('recommender', () => new RecommenderClient());
  }

  // Artifact Registry
  getArtifactRegistryClient(): ArtifactRegistryClient {
    return this.getOrCreate('artifactRegistry', () => new ArtifactRegistryClient());
  }

  // Cloud Build
  getCloudBuildClient(): CloudBuildClient {
    return this.getOrCreate('cloudBuild', () => new CloudBuildClient());
  }

  // Cloud Deploy
  getCloudDeployClient(): CloudDeployClient {
    return this.getOrCreate('cloudDeploy', () => new CloudDeployClient());
  }

  // Dataproc
  getDataprocClient(): ClusterControllerClient {
    return this.getOrCreate('dataproc', () => new ClusterControllerClient());
  }

  // Cloud Scheduler
  getSchedulerClient(): CloudSchedulerClient {
    return this.getOrCreate('scheduler', () => new CloudSchedulerClient());
  }

  // Cloud Tasks
  getTasksClient(): CloudTasksClient {
    return this.getOrCreate('tasks', () => new CloudTasksClient());
  }

  // Workflows — uses googleapis since @google-cloud/workflows only has ExecutionsClient
  // Returns a googleapis workflows API instance
  getWorkflowsAPI() {
    return this.getOrCreate('workflows', () => {
      const { google } = require('googleapis');
      const auth = new google.auth.GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      });
      return google.workflows({ version: 'v1', auth });
    });
  }

  // Service Directory
  getServiceDirectoryClient(): RegistrationServiceClient {
    return this.getOrCreate('serviceDirectory', () => new RegistrationServiceClient());
  }

  // DLP
  getDlpClient(): DlpServiceClient {
    return this.getOrCreate('dlp', () => new DlpServiceClient());
  }

  // Spanner
  getSpannerClient(): Spanner {
    return this.getOrCreate('spanner', () => new Spanner({ projectId: this.projectId }));
  }

  // Bigtable
  getBigtableClient(): Bigtable {
    return this.getOrCreate('bigtable', () => new Bigtable({ projectId: this.projectId }));
  }

  // Memorystore (Redis)
  getRedisClient(): CloudRedisClient {
    return this.getOrCreate('redis', () => new CloudRedisClient());
  }

  // Filestore
  getFilestoreClient(): CloudFilestoreManagerClient {
    return this.getOrCreate('filestore', () => new CloudFilestoreManagerClient());
  }

  // Cloud Run
  getCloudRunServicesClient(): CloudRunServicesClient {
    return this.getOrCreate('cloudRunServices', () => new CloudRunServicesClient());
  }

  // Cloud Functions
  getFunctionsClient(): CloudFunctionsServiceClient {
    return this.getOrCreate('functions', () => new CloudFunctionsServiceClient());
  }

  // Vertex AI
  getModelServiceClient(): ModelServiceClient {
    return this.getOrCreate('modelService', () => new ModelServiceClient());
  }
  getEndpointServiceClient(): EndpointServiceClient {
    return this.getOrCreate('endpointService', () => new EndpointServiceClient());
  }
  getDatasetServiceClient(): DatasetServiceClient {
    return this.getOrCreate('datasetService', () => new DatasetServiceClient());
  }
  getPipelineServiceClient(): PipelineServiceClient {
    return this.getOrCreate('pipelineService', () => new PipelineServiceClient());
  }
  getJobServiceClient(): JobServiceClient {
    return this.getOrCreate('jobService', () => new JobServiceClient());
  }

  // Dialogflow
  getDialogflowClient(): AgentsClient {
    return this.getOrCreate('dialogflow', () => new AgentsClient());
  }

  // Document AI
  getDocumentAIClient(): DocumentProcessorServiceClient {
    return this.getOrCreate('documentAI', () => new DocumentProcessorServiceClient());
  }

  // Vision
  getVisionClient(): ProductSearchClient {
    return this.getOrCreate('vision', () => new ProductSearchClient());
  }

  // Speech
  getSpeechClient(): SpeechClient {
    return this.getOrCreate('speech', () => new SpeechClient());
  }

  // Language
  getLanguageClient(): LanguageServiceClient {
    return this.getOrCreate('language', () => new LanguageServiceClient());
  }

  // Translation
  getTranslateClient(): TranslationServiceClient {
    return this.getOrCreate('translate', () => new TranslationServiceClient());
  }
}

export function getGCPClientFactory(projectId: string): GCPClientFactory {
  if (!factoryInstance || factoryInstance.getProjectId() !== projectId) {
    factoryInstance = new GCPClientFactory(projectId);
  }
  return factoryInstance;
}

export function resetGCPClientFactory(): void {
  factoryInstance = null;
}

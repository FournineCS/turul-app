// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import type { AwsCredentialIdentityProvider } from '@aws-sdk/types';
import { fromIni, fromSSO, fromTemporaryCredentials } from '@aws-sdk/credential-providers';
import { EC2Client } from '@aws-sdk/client-ec2';
import { LambdaClient } from '@aws-sdk/client-lambda';
import { S3Client } from '@aws-sdk/client-s3';
import { RDSClient } from '@aws-sdk/client-rds';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { ECSClient } from '@aws-sdk/client-ecs';
import { EKSClient } from '@aws-sdk/client-eks';
import { ElastiCacheClient } from '@aws-sdk/client-elasticache';
import { EFSClient } from '@aws-sdk/client-efs';
import { ElasticLoadBalancingV2Client } from '@aws-sdk/client-elastic-load-balancing-v2';
import { CloudFrontClient } from '@aws-sdk/client-cloudfront';
import { Route53Client } from '@aws-sdk/client-route-53';
import { ResourceGroupsTaggingAPIClient } from '@aws-sdk/client-resource-groups-tagging-api';
import { STSClient } from '@aws-sdk/client-sts';
import { CloudFormationClient } from '@aws-sdk/client-cloudformation';
import { GlueClient } from '@aws-sdk/client-glue';
import { AthenaClient } from '@aws-sdk/client-athena';
import { SFNClient } from '@aws-sdk/client-sfn';
import { RedshiftClient } from '@aws-sdk/client-redshift';
import { MWAAClient } from '@aws-sdk/client-mwaa';
import { SNSClient } from '@aws-sdk/client-sns';
import { SQSClient } from '@aws-sdk/client-sqs';
import { APIGatewayClient } from '@aws-sdk/client-api-gateway';
import { ApiGatewayV2Client } from '@aws-sdk/client-apigatewayv2';
import { SecretsManagerClient } from '@aws-sdk/client-secrets-manager';
import { KMSClient } from '@aws-sdk/client-kms';
import { EventBridgeClient } from '@aws-sdk/client-eventbridge';
import { CloudWatchClient } from '@aws-sdk/client-cloudwatch';
import { CloudWatchLogsClient } from '@aws-sdk/client-cloudwatch-logs';
import { CostExplorerClient } from '@aws-sdk/client-cost-explorer';
import { SecurityHubClient } from '@aws-sdk/client-securityhub';
import { GuardDutyClient } from '@aws-sdk/client-guardduty';
import { IAMClient } from '@aws-sdk/client-iam';
import { Inspector2Client } from '@aws-sdk/client-inspector2';
import { AccessAnalyzerClient } from '@aws-sdk/client-accessanalyzer';
import { WellArchitectedClient } from '@aws-sdk/client-wellarchitected';
import { CloudTrailClient } from '@aws-sdk/client-cloudtrail';
import { AutoScalingClient } from '@aws-sdk/client-auto-scaling';
import { ECRClient } from '@aws-sdk/client-ecr';
import { ACMClient } from '@aws-sdk/client-acm';
import { SSMClient } from '@aws-sdk/client-ssm';
import { WAFV2Client } from '@aws-sdk/client-wafv2';
import { CognitoIdentityProviderClient } from '@aws-sdk/client-cognito-identity-provider';
import { ConfigServiceClient } from '@aws-sdk/client-config-service';
import { BackupClient } from '@aws-sdk/client-backup';
import { CodePipelineClient } from '@aws-sdk/client-codepipeline';
import { CodeBuildClient } from '@aws-sdk/client-codebuild';
import { OpenSearchClient } from '@aws-sdk/client-opensearch';
import { KinesisClient } from '@aws-sdk/client-kinesis';
import { FirehoseClient } from '@aws-sdk/client-firehose';
import { SESv2Client } from '@aws-sdk/client-sesv2';
import { AppSyncClient } from '@aws-sdk/client-appsync';
import { KafkaClient } from '@aws-sdk/client-kafka';
import { EMRClient } from '@aws-sdk/client-emr';
import { SageMakerClient } from '@aws-sdk/client-sagemaker';
import { TransferClient } from '@aws-sdk/client-transfer';
// Phase 4: Database & Networking
import { NeptuneClient } from '@aws-sdk/client-neptune';
import { DocDBClient } from '@aws-sdk/client-docdb';
import { MemoryDBClient } from '@aws-sdk/client-memorydb';
import { TimestreamWriteClient } from '@aws-sdk/client-timestream-write';
import { KeyspacesClient } from '@aws-sdk/client-keyspaces';
import { GlobalAcceleratorClient } from '@aws-sdk/client-global-accelerator';
import { DirectConnectClient } from '@aws-sdk/client-direct-connect';
import { NetworkFirewallClient } from '@aws-sdk/client-network-firewall';
import { MqClient } from '@aws-sdk/client-mq';
// Phase 5: Storage, Migration & Compute
import { FSxClient } from '@aws-sdk/client-fsx';
import { StorageGatewayClient } from '@aws-sdk/client-storage-gateway';
import { DatabaseMigrationServiceClient } from '@aws-sdk/client-database-migration-service';
import { DataSyncClient } from '@aws-sdk/client-datasync';
import { DrsClient } from '@aws-sdk/client-drs';
import { LakeFormationClient } from '@aws-sdk/client-lakeformation';
import { ElasticBeanstalkClient } from '@aws-sdk/client-elastic-beanstalk';
import { AppRunnerClient } from '@aws-sdk/client-apprunner';
import { BatchClient } from '@aws-sdk/client-batch';
import { AppflowClient } from '@aws-sdk/client-appflow';
// Phase 6: Security & Compliance
import { Macie2Client } from '@aws-sdk/client-macie2';
import { FMSClient } from '@aws-sdk/client-fms';
import { ShieldClient } from '@aws-sdk/client-shield';
import { CloudHSMV2Client } from '@aws-sdk/client-cloudhsm-v2';
import { DirectoryServiceClient } from '@aws-sdk/client-directory-service';
import { DetectiveClient } from '@aws-sdk/client-detective';
import { AuditManagerClient } from '@aws-sdk/client-auditmanager';
import { RAMClient } from '@aws-sdk/client-ram';
import { OrganizationsClient } from '@aws-sdk/client-organizations';
import { TrustedAdvisorClient } from '@aws-sdk/client-trustedadvisor';
// Phase 7: Developer Tools & Management
import { CodeDeployClient } from '@aws-sdk/client-codedeploy';
import { CodeartifactClient } from '@aws-sdk/client-codeartifact';
import { XRayClient } from '@aws-sdk/client-xray';
import { FisClient } from '@aws-sdk/client-fis';
import { ImagebuilderClient } from '@aws-sdk/client-imagebuilder';
import { ServiceCatalogClient } from '@aws-sdk/client-service-catalog';
import { LicenseManagerClient } from '@aws-sdk/client-license-manager';
import { ComputeOptimizerClient } from '@aws-sdk/client-compute-optimizer';
// Phase 8: AI/ML & Frontend
import { BedrockClient } from '@aws-sdk/client-bedrock';
import { BedrockRuntimeClient } from '@aws-sdk/client-bedrock-runtime';
import { ComprehendClient } from '@aws-sdk/client-comprehend';
import { RekognitionClient } from '@aws-sdk/client-rekognition';
import { TextractClient } from '@aws-sdk/client-textract';
import { TranscribeClient } from '@aws-sdk/client-transcribe';
import { LexModelsV2Client } from '@aws-sdk/client-lex-models-v2';
import { KendraClient } from '@aws-sdk/client-kendra';
import { AmplifyClient } from '@aws-sdk/client-amplify';
import { LocationClient } from '@aws-sdk/client-location';
import { LightsailClient } from '@aws-sdk/client-lightsail';
// Phase 9: Streaming, Analytics & Communication
import { KinesisVideoClient } from '@aws-sdk/client-kinesis-video';
import { KinesisAnalyticsV2Client } from '@aws-sdk/client-kinesis-analytics-v2';
import { QuickSightClient } from '@aws-sdk/client-quicksight';
import { PinpointClient } from '@aws-sdk/client-pinpoint';
import { ConnectClient } from '@aws-sdk/client-connect';
import { IvsClient } from '@aws-sdk/client-ivs';
import { MediaConvertClient } from '@aws-sdk/client-mediaconvert';
import { MediaLiveClient } from '@aws-sdk/client-medialive';
// Phase 10: IoT, Niche & Remaining
import { IoTClient } from '@aws-sdk/client-iot';
import { ForecastClient } from '@aws-sdk/client-forecast';
import { PersonalizeClient } from '@aws-sdk/client-personalize';
import { FraudDetectorClient } from '@aws-sdk/client-frauddetector';
import { WorkSpacesClient } from '@aws-sdk/client-workspaces';
import { VPCLatticeClient } from '@aws-sdk/client-vpc-lattice';
import { ElasticTranscoderClient } from '@aws-sdk/client-elastic-transcoder';
import { CloudSearchClient } from '@aws-sdk/client-cloudsearch';
import { HealthLakeClient } from '@aws-sdk/client-healthlake';
import type { ServiceType } from '../../shared/types';

export type AWSClientType =
  | EC2Client
  | LambdaClient
  | S3Client
  | RDSClient
  | DynamoDBClient
  | ECSClient
  | EKSClient
  | ElastiCacheClient
  | EFSClient
  | ElasticLoadBalancingV2Client
  | CloudFrontClient
  | Route53Client
  | ResourceGroupsTaggingAPIClient
  | STSClient
  | CloudFormationClient
  | GlueClient
  | AthenaClient
  | SFNClient
  | RedshiftClient
  | MWAAClient
  | SNSClient
  | SQSClient
  | APIGatewayClient
  | ApiGatewayV2Client
  | SecretsManagerClient
  | KMSClient
  | EventBridgeClient
  | CloudWatchClient
  | CloudWatchLogsClient
  | CostExplorerClient
  | SecurityHubClient
  | GuardDutyClient
  | IAMClient
  | Inspector2Client
  | AccessAnalyzerClient
  | WellArchitectedClient
  | CloudTrailClient
  | AutoScalingClient
  | ECRClient
  | ACMClient
  | SSMClient
  | WAFV2Client
  | CognitoIdentityProviderClient
  | ConfigServiceClient
  | BackupClient
  | CodePipelineClient
  | CodeBuildClient
  | OpenSearchClient
  | KinesisClient
  | FirehoseClient
  | SESv2Client
  | AppSyncClient
  | KafkaClient
  | EMRClient
  | SageMakerClient
  | TransferClient
  // Phase 4
  | NeptuneClient
  | DocDBClient
  | MemoryDBClient
  | TimestreamWriteClient
  | KeyspacesClient
  | GlobalAcceleratorClient
  | DirectConnectClient
  | NetworkFirewallClient
  | MqClient
  // Phase 5
  | FSxClient
  | StorageGatewayClient
  | DatabaseMigrationServiceClient
  | DataSyncClient
  | DrsClient
  | LakeFormationClient
  | ElasticBeanstalkClient
  | AppRunnerClient
  | BatchClient
  | AppflowClient
  // Phase 6
  | Macie2Client
  | FMSClient
  | ShieldClient
  | CloudHSMV2Client
  | DirectoryServiceClient
  | DetectiveClient
  | AuditManagerClient
  | RAMClient
  | OrganizationsClient
  | TrustedAdvisorClient
  // Phase 7
  | CodeDeployClient
  | CodeartifactClient
  | XRayClient
  | FisClient
  | ImagebuilderClient
  | ServiceCatalogClient
  | LicenseManagerClient
  | ComputeOptimizerClient
  // Phase 8
  | BedrockClient
  | BedrockRuntimeClient
  | ComprehendClient
  | RekognitionClient
  | TextractClient
  | TranscribeClient
  | LexModelsV2Client
  | KendraClient
  | AmplifyClient
  | LocationClient
  | LightsailClient
  // Phase 9
  | KinesisVideoClient
  | KinesisAnalyticsV2Client
  | QuickSightClient
  | PinpointClient
  | ConnectClient
  | IvsClient
  | MediaConvertClient
  | MediaLiveClient
  // Phase 10
  | IoTClient
  | ForecastClient
  | PersonalizeClient
  | FraudDetectorClient
  | WorkSpacesClient
  | VPCLatticeClient
  | ElasticTranscoderClient
  | CloudSearchClient
  | HealthLakeClient;

// App profile credential registries (populated on login, cleared on logout)
const appIAMCredentials = new Map<string, { accessKeyId: string; secretAccessKey: string; sessionToken?: string }>();
const appSSOConfigs = new Map<string, { ssoStartUrl: string; ssoAccountId: string; ssoRoleName: string; ssoRegion: string }>();
const appAssumeRoleConfigs = new Map<string, { roleArn: string; externalId?: string; sourceProfile: string }>();

export function registerAppProfileCredentials(
  name: string,
  creds: { accessKeyId: string; secretAccessKey: string; sessionToken?: string }
): void {
  appIAMCredentials.set(name, creds);
}

export function registerAppSSOConfig(
  name: string,
  config: { ssoStartUrl: string; ssoAccountId: string; ssoRoleName: string; ssoRegion: string }
): void {
  appSSOConfigs.set(name, config);
}

export function registerAppAssumeRoleConfig(
  name: string,
  config: { roleArn: string; externalId?: string; sourceProfile: string }
): void {
  appAssumeRoleConfigs.set(name, config);
}

export function clearAllAppCredentials(): void {
  appIAMCredentials.clear();
  appSSOConfigs.clear();
  appAssumeRoleConfigs.clear();
}

interface ClientConfig {
  profile: string;
  region: string;
}

/**
 * Read-only guard: only allow AWS SDK commands whose names start with these
 * prefixes. Any mutating operation (Create, Put, Delete, Update, etc.) will
 * be rejected at runtime before hitting the AWS API.
 */
const READ_ONLY_COMMAND_PREFIXES = [
  'Describe', 'List', 'Get', 'Search', 'Head', 'Lookup',
  'Generate', 'BatchGet', 'Scan', 'Query', 'Select',
  'Check', 'Detect', 'Estimate', 'Evaluate', 'Forecast',
  'Predict', 'Recognize', 'Test', 'Validate', 'Verify',
  'AssumeRole', // STS — needed for credential chains
];

export class ClientFactory {
  private clientCache: Map<string, AWSClientType> = new Map();

  private getCacheKey(service: string, profile: string, region: string): string {
    return `${service}:${profile}:${region}`;
  }

  /**
   * Wraps a client's `send` method so only read-only AWS API calls are allowed.
   * Rejects any mutating operation (Create, Put, Delete, Update, etc.).
   */
  private enforceReadOnly<T>(client: T): T {
    const c = client as Record<string, unknown>;
    if (!c.send || c.__readOnlyGuarded) return client;
    c.__readOnlyGuarded = true;
    const originalSend = (c.send as Function).bind(client);
    c.send = (command: unknown, ...args: unknown[]) => {
      const name = (command as { constructor?: { name?: string } })?.constructor?.name ?? '';
      const allowed = READ_ONLY_COMMAND_PREFIXES.some(p => name.startsWith(p));
      if (!allowed) {
        return Promise.reject(
          new Error(`Blocked mutating AWS API call: ${name}. Only read-only operations are allowed.`)
        );
      }
      return originalSend(command, ...args);
    };
    return client;
  }

  private static readonly MAX_ASSUME_ROLE_DEPTH = 3;

  private getCredentials(profile: string, depth = 0): AwsCredentialIdentityProvider {
    // 1. Check IAM keys registry
    const iamCreds = appIAMCredentials.get(profile);
    if (iamCreds) {
      return async () => ({
        accessKeyId: iamCreds.accessKeyId,
        secretAccessKey: iamCreds.secretAccessKey,
        ...(iamCreds.sessionToken ? { sessionToken: iamCreds.sessionToken } : {}),
      });
    }

    // 2. Check SSO config registry
    const ssoConfig = appSSOConfigs.get(profile);
    if (ssoConfig) {
      return fromSSO({
        ssoStartUrl: ssoConfig.ssoStartUrl,
        ssoAccountId: ssoConfig.ssoAccountId,
        ssoRoleName: ssoConfig.ssoRoleName,
        ssoRegion: ssoConfig.ssoRegion,
      });
    }

    // 3. Check assume role registry (with depth guard)
    const assumeConfig = appAssumeRoleConfigs.get(profile);
    if (assumeConfig) {
      if (depth >= ClientFactory.MAX_ASSUME_ROLE_DEPTH) {
        throw new Error(`Assume-role chain exceeds maximum depth of ${ClientFactory.MAX_ASSUME_ROLE_DEPTH}`);
      }
      return fromTemporaryCredentials({
        params: {
          RoleArn: assumeConfig.roleArn,
          ...(assumeConfig.externalId ? { ExternalId: assumeConfig.externalId } : {}),
          RoleSessionName: `aws-analyzer-${profile}`,
        },
        masterCredentials: this.getCredentials(assumeConfig.sourceProfile, depth + 1),
      });
    }

    // 4. Fallback to ~/.aws files
    return fromIni({ profile });
  }

  getEC2Client(config: ClientConfig): EC2Client {
    const key = this.getCacheKey('ec2', config.profile, config.region);
    let client = this.clientCache.get(key) as EC2Client | undefined;

    if (!client) {
      client = new EC2Client({
        credentials: this.getCredentials(config.profile),
        region: config.region,
      });
      this.clientCache.set(key, this.enforceReadOnly(client));
    }

    return client;
  }

  getLambdaClient(config: ClientConfig): LambdaClient {
    const key = this.getCacheKey('lambda', config.profile, config.region);
    let client = this.clientCache.get(key) as LambdaClient | undefined;

    if (!client) {
      client = new LambdaClient({
        credentials: this.getCredentials(config.profile),
        region: config.region,
      });
      this.clientCache.set(key, this.enforceReadOnly(client));
    }

    return client;
  }

  getS3Client(config: ClientConfig): S3Client {
    const key = this.getCacheKey('s3', config.profile, config.region);
    let client = this.clientCache.get(key) as S3Client | undefined;

    if (!client) {
      client = new S3Client({
        credentials: this.getCredentials(config.profile),
        region: config.region,
      });
      this.clientCache.set(key, this.enforceReadOnly(client));
    }

    return client;
  }

  getRDSClient(config: ClientConfig): RDSClient {
    const key = this.getCacheKey('rds', config.profile, config.region);
    let client = this.clientCache.get(key) as RDSClient | undefined;

    if (!client) {
      client = new RDSClient({
        credentials: this.getCredentials(config.profile),
        region: config.region,
      });
      this.clientCache.set(key, this.enforceReadOnly(client));
    }

    return client;
  }

  getDynamoDBClient(config: ClientConfig): DynamoDBClient {
    const key = this.getCacheKey('dynamodb', config.profile, config.region);
    let client = this.clientCache.get(key) as DynamoDBClient | undefined;

    if (!client) {
      client = new DynamoDBClient({
        credentials: this.getCredentials(config.profile),
        region: config.region,
      });
      this.clientCache.set(key, this.enforceReadOnly(client));
    }

    return client;
  }

  getECSClient(config: ClientConfig): ECSClient {
    const key = this.getCacheKey('ecs', config.profile, config.region);
    let client = this.clientCache.get(key) as ECSClient | undefined;

    if (!client) {
      client = new ECSClient({
        credentials: this.getCredentials(config.profile),
        region: config.region,
      });
      this.clientCache.set(key, this.enforceReadOnly(client));
    }

    return client;
  }

  getEKSClient(config: ClientConfig): EKSClient {
    const key = this.getCacheKey('eks', config.profile, config.region);
    let client = this.clientCache.get(key) as EKSClient | undefined;

    if (!client) {
      client = new EKSClient({
        credentials: this.getCredentials(config.profile),
        region: config.region,
      });
      this.clientCache.set(key, this.enforceReadOnly(client));
    }

    return client;
  }

  getElastiCacheClient(config: ClientConfig): ElastiCacheClient {
    const key = this.getCacheKey('elasticache', config.profile, config.region);
    let client = this.clientCache.get(key) as ElastiCacheClient | undefined;

    if (!client) {
      client = new ElastiCacheClient({
        credentials: this.getCredentials(config.profile),
        region: config.region,
      });
      this.clientCache.set(key, this.enforceReadOnly(client));
    }

    return client;
  }

  getEFSClient(config: ClientConfig): EFSClient {
    const key = this.getCacheKey('efs', config.profile, config.region);
    let client = this.clientCache.get(key) as EFSClient | undefined;

    if (!client) {
      client = new EFSClient({
        credentials: this.getCredentials(config.profile),
        region: config.region,
      });
      this.clientCache.set(key, this.enforceReadOnly(client));
    }

    return client;
  }

  getELBv2Client(config: ClientConfig): ElasticLoadBalancingV2Client {
    const key = this.getCacheKey('elbv2', config.profile, config.region);
    let client = this.clientCache.get(key) as ElasticLoadBalancingV2Client | undefined;

    if (!client) {
      client = new ElasticLoadBalancingV2Client({
        credentials: this.getCredentials(config.profile),
        region: config.region,
      });
      this.clientCache.set(key, this.enforceReadOnly(client));
    }

    return client;
  }

  getCloudFrontClient(config: ClientConfig): CloudFrontClient {
    // CloudFront is global, always use us-east-1
    const key = this.getCacheKey('cloudfront', config.profile, 'us-east-1');
    let client = this.clientCache.get(key) as CloudFrontClient | undefined;

    if (!client) {
      client = new CloudFrontClient({
        credentials: this.getCredentials(config.profile),
        region: 'us-east-1',
      });
      this.clientCache.set(key, this.enforceReadOnly(client));
    }

    return client;
  }

  getRoute53Client(config: ClientConfig): Route53Client {
    // Route53 is global, always use us-east-1
    const key = this.getCacheKey('route53', config.profile, 'us-east-1');
    let client = this.clientCache.get(key) as Route53Client | undefined;

    if (!client) {
      client = new Route53Client({
        credentials: this.getCredentials(config.profile),
        region: 'us-east-1',
      });
      this.clientCache.set(key, this.enforceReadOnly(client));
    }

    return client;
  }

  getTaggingClient(config: ClientConfig): ResourceGroupsTaggingAPIClient {
    const key = this.getCacheKey('tagging', config.profile, config.region);
    let client = this.clientCache.get(key) as ResourceGroupsTaggingAPIClient | undefined;

    if (!client) {
      client = new ResourceGroupsTaggingAPIClient({
        credentials: this.getCredentials(config.profile),
        region: config.region,
      });
      this.clientCache.set(key, this.enforceReadOnly(client));
    }

    return client;
  }

  getSTSClient(config: ClientConfig): STSClient {
    const key = this.getCacheKey('sts', config.profile, config.region);
    let client = this.clientCache.get(key) as STSClient | undefined;

    if (!client) {
      client = new STSClient({
        credentials: this.getCredentials(config.profile),
        region: config.region,
      });
      this.clientCache.set(key, this.enforceReadOnly(client));
    }

    return client;
  }

  getCloudFormationClient(config: ClientConfig): CloudFormationClient {
    const key = this.getCacheKey('cloudformation', config.profile, config.region);
    let client = this.clientCache.get(key) as CloudFormationClient | undefined;

    if (!client) {
      client = new CloudFormationClient({
        credentials: this.getCredentials(config.profile),
        region: config.region,
      });
      this.clientCache.set(key, this.enforceReadOnly(client));
    }

    return client;
  }

  getGlueClient(config: ClientConfig): GlueClient {
    const key = this.getCacheKey('glue', config.profile, config.region);
    let client = this.clientCache.get(key) as GlueClient | undefined;

    if (!client) {
      client = new GlueClient({
        credentials: this.getCredentials(config.profile),
        region: config.region,
      });
      this.clientCache.set(key, this.enforceReadOnly(client));
    }

    return client;
  }

  getAthenaClient(config: ClientConfig): AthenaClient {
    const key = this.getCacheKey('athena', config.profile, config.region);
    let client = this.clientCache.get(key) as AthenaClient | undefined;

    if (!client) {
      client = new AthenaClient({
        credentials: this.getCredentials(config.profile),
        region: config.region,
      });
      this.clientCache.set(key, this.enforceReadOnly(client));
    }

    return client;
  }

  getSFNClient(config: ClientConfig): SFNClient {
    const key = this.getCacheKey('stepfunctions', config.profile, config.region);
    let client = this.clientCache.get(key) as SFNClient | undefined;

    if (!client) {
      client = new SFNClient({
        credentials: this.getCredentials(config.profile),
        region: config.region,
      });
      this.clientCache.set(key, this.enforceReadOnly(client));
    }

    return client;
  }

  getRedshiftClient(config: ClientConfig): RedshiftClient {
    const key = this.getCacheKey('redshift', config.profile, config.region);
    let client = this.clientCache.get(key) as RedshiftClient | undefined;

    if (!client) {
      client = new RedshiftClient({
        credentials: this.getCredentials(config.profile),
        region: config.region,
      });
      this.clientCache.set(key, this.enforceReadOnly(client));
    }

    return client;
  }

  getMWAAClient(config: ClientConfig): MWAAClient {
    const key = this.getCacheKey('mwaa', config.profile, config.region);
    let client = this.clientCache.get(key) as MWAAClient | undefined;

    if (!client) {
      client = new MWAAClient({
        credentials: this.getCredentials(config.profile),
        region: config.region,
      });
      this.clientCache.set(key, this.enforceReadOnly(client));
    }

    return client;
  }

  getSNSClient(config: ClientConfig): SNSClient {
    const key = this.getCacheKey('sns', config.profile, config.region);
    let client = this.clientCache.get(key) as SNSClient | undefined;

    if (!client) {
      client = new SNSClient({
        credentials: this.getCredentials(config.profile),
        region: config.region,
      });
      this.clientCache.set(key, this.enforceReadOnly(client));
    }

    return client;
  }

  getSQSClient(config: ClientConfig): SQSClient {
    const key = this.getCacheKey('sqs', config.profile, config.region);
    let client = this.clientCache.get(key) as SQSClient | undefined;

    if (!client) {
      client = new SQSClient({
        credentials: this.getCredentials(config.profile),
        region: config.region,
      });
      this.clientCache.set(key, this.enforceReadOnly(client));
    }

    return client;
  }

  getAPIGatewayClient(config: ClientConfig): APIGatewayClient {
    const key = this.getCacheKey('apigateway', config.profile, config.region);
    let client = this.clientCache.get(key) as APIGatewayClient | undefined;

    if (!client) {
      client = new APIGatewayClient({
        credentials: this.getCredentials(config.profile),
        region: config.region,
      });
      this.clientCache.set(key, this.enforceReadOnly(client));
    }

    return client;
  }

  getAPIGatewayV2Client(config: ClientConfig): ApiGatewayV2Client {
    const key = this.getCacheKey('apigatewayv2', config.profile, config.region);
    let client = this.clientCache.get(key) as ApiGatewayV2Client | undefined;

    if (!client) {
      client = new ApiGatewayV2Client({
        credentials: this.getCredentials(config.profile),
        region: config.region,
      });
      this.clientCache.set(key, this.enforceReadOnly(client));
    }

    return client;
  }

  getSecretsManagerClient(config: ClientConfig): SecretsManagerClient {
    const key = this.getCacheKey('secretsmanager', config.profile, config.region);
    let client = this.clientCache.get(key) as SecretsManagerClient | undefined;

    if (!client) {
      client = new SecretsManagerClient({
        credentials: this.getCredentials(config.profile),
        region: config.region,
      });
      this.clientCache.set(key, this.enforceReadOnly(client));
    }

    return client;
  }

  getKMSClient(config: ClientConfig): KMSClient {
    const key = this.getCacheKey('kms', config.profile, config.region);
    let client = this.clientCache.get(key) as KMSClient | undefined;

    if (!client) {
      client = new KMSClient({
        credentials: this.getCredentials(config.profile),
        region: config.region,
      });
      this.clientCache.set(key, this.enforceReadOnly(client));
    }

    return client;
  }

  getEventBridgeClient(config: ClientConfig): EventBridgeClient {
    const key = this.getCacheKey('eventbridge', config.profile, config.region);
    let client = this.clientCache.get(key) as EventBridgeClient | undefined;

    if (!client) {
      client = new EventBridgeClient({
        credentials: this.getCredentials(config.profile),
        region: config.region,
      });
      this.clientCache.set(key, this.enforceReadOnly(client));
    }

    return client;
  }

  getCloudWatchClient(config: ClientConfig): CloudWatchClient {
    const key = this.getCacheKey('cloudwatch', config.profile, config.region);
    let client = this.clientCache.get(key) as CloudWatchClient | undefined;

    if (!client) {
      client = new CloudWatchClient({
        credentials: this.getCredentials(config.profile),
        region: config.region,
      });
      this.clientCache.set(key, this.enforceReadOnly(client));
    }

    return client;
  }

  getCloudWatchLogsClient(config: ClientConfig): CloudWatchLogsClient {
    const key = this.getCacheKey('cloudwatch-logs', config.profile, config.region);
    let client = this.clientCache.get(key) as CloudWatchLogsClient | undefined;

    if (!client) {
      client = new CloudWatchLogsClient({
        credentials: this.getCredentials(config.profile),
        region: config.region,
      });
      this.clientCache.set(key, this.enforceReadOnly(client));
    }

    return client;
  }

  getCostExplorerClient(config: ClientConfig): CostExplorerClient {
    // Cost Explorer is global, always use us-east-1
    const key = this.getCacheKey('cost-explorer', config.profile, 'us-east-1');
    let client = this.clientCache.get(key) as CostExplorerClient | undefined;

    if (!client) {
      client = new CostExplorerClient({
        credentials: this.getCredentials(config.profile),
        region: 'us-east-1',
      });
      this.clientCache.set(key, this.enforceReadOnly(client));
    }

    return client;
  }

  getSecurityHubClient(config: ClientConfig): SecurityHubClient {
    const key = this.getCacheKey('securityhub', config.profile, config.region);
    let client = this.clientCache.get(key) as SecurityHubClient | undefined;

    if (!client) {
      client = new SecurityHubClient({
        credentials: this.getCredentials(config.profile),
        region: config.region,
      });
      this.clientCache.set(key, this.enforceReadOnly(client));
    }

    return client;
  }

  getGuardDutyClient(config: ClientConfig): GuardDutyClient {
    const key = this.getCacheKey('guardduty', config.profile, config.region);
    let client = this.clientCache.get(key) as GuardDutyClient | undefined;

    if (!client) {
      client = new GuardDutyClient({
        credentials: this.getCredentials(config.profile),
        region: config.region,
      });
      this.clientCache.set(key, this.enforceReadOnly(client));
    }

    return client;
  }

  getInspector2Client(config: ClientConfig): Inspector2Client {
    const key = this.getCacheKey('inspector2', config.profile, config.region);
    let client = this.clientCache.get(key) as Inspector2Client | undefined;

    if (!client) {
      client = new Inspector2Client({
        credentials: this.getCredentials(config.profile),
        region: config.region,
      });
      this.clientCache.set(key, this.enforceReadOnly(client));
    }

    return client;
  }

  getAccessAnalyzerClient(config: ClientConfig): AccessAnalyzerClient {
    const key = this.getCacheKey('accessanalyzer', config.profile, config.region);
    let client = this.clientCache.get(key) as AccessAnalyzerClient | undefined;

    if (!client) {
      client = new AccessAnalyzerClient({
        credentials: this.getCredentials(config.profile),
        region: config.region,
      });
      this.clientCache.set(key, this.enforceReadOnly(client));
    }

    return client;
  }

  getIAMClient(config: ClientConfig): IAMClient {
    // IAM is global, always use us-east-1
    const key = this.getCacheKey('iam', config.profile, 'us-east-1');
    let client = this.clientCache.get(key) as IAMClient | undefined;

    if (!client) {
      client = new IAMClient({
        credentials: this.getCredentials(config.profile),
        region: 'us-east-1',
      });
      this.clientCache.set(key, this.enforceReadOnly(client));
    }

    return client;
  }

  getWellArchitectedClient(config: ClientConfig): WellArchitectedClient {
    const key = this.getCacheKey('wellarchitected', config.profile, config.region);
    let client = this.clientCache.get(key) as WellArchitectedClient | undefined;

    if (!client) {
      client = new WellArchitectedClient({
        credentials: this.getCredentials(config.profile),
        region: config.region,
      });
      this.clientCache.set(key, this.enforceReadOnly(client));
    }

    return client;
  }

  getCloudTrailClient(config: ClientConfig): CloudTrailClient {
    const key = this.getCacheKey('cloudtrail', config.profile, config.region);
    let client = this.clientCache.get(key) as CloudTrailClient | undefined;

    if (!client) {
      client = new CloudTrailClient({
        credentials: this.getCredentials(config.profile),
        region: config.region,
      });
      this.clientCache.set(key, this.enforceReadOnly(client));
    }

    return client;
  }

  getAutoScalingClient(config: ClientConfig): AutoScalingClient {
    const key = this.getCacheKey('autoscaling', config.profile, config.region);
    let client = this.clientCache.get(key) as AutoScalingClient | undefined;

    if (!client) {
      client = new AutoScalingClient({
        credentials: this.getCredentials(config.profile),
        region: config.region,
      });
      this.clientCache.set(key, this.enforceReadOnly(client));
    }

    return client;
  }

  getECRClient(config: ClientConfig): ECRClient {
    const key = this.getCacheKey('ecr', config.profile, config.region);
    let client = this.clientCache.get(key) as ECRClient | undefined;
    if (!client) {
      client = new ECRClient({ credentials: this.getCredentials(config.profile), region: config.region });
      this.clientCache.set(key, this.enforceReadOnly(client));
    }
    return client;
  }

  getACMClient(config: ClientConfig): ACMClient {
    const key = this.getCacheKey('acm', config.profile, config.region);
    let client = this.clientCache.get(key) as ACMClient | undefined;
    if (!client) {
      client = new ACMClient({ credentials: this.getCredentials(config.profile), region: config.region });
      this.clientCache.set(key, this.enforceReadOnly(client));
    }
    return client;
  }

  getSSMClient(config: ClientConfig): SSMClient {
    const key = this.getCacheKey('ssm', config.profile, config.region);
    let client = this.clientCache.get(key) as SSMClient | undefined;
    if (!client) {
      client = new SSMClient({ credentials: this.getCredentials(config.profile), region: config.region });
      this.clientCache.set(key, this.enforceReadOnly(client));
    }
    return client;
  }

  getWAFV2Client(config: ClientConfig): WAFV2Client {
    const key = this.getCacheKey('wafv2', config.profile, config.region);
    let client = this.clientCache.get(key) as WAFV2Client | undefined;
    if (!client) {
      client = new WAFV2Client({ credentials: this.getCredentials(config.profile), region: config.region });
      this.clientCache.set(key, this.enforceReadOnly(client));
    }
    return client;
  }

  getCognitoClient(config: ClientConfig): CognitoIdentityProviderClient {
    const key = this.getCacheKey('cognito', config.profile, config.region);
    let client = this.clientCache.get(key) as CognitoIdentityProviderClient | undefined;
    if (!client) {
      client = new CognitoIdentityProviderClient({ credentials: this.getCredentials(config.profile), region: config.region });
      this.clientCache.set(key, this.enforceReadOnly(client));
    }
    return client;
  }

  getConfigServiceClient(config: ClientConfig): ConfigServiceClient {
    const key = this.getCacheKey('config', config.profile, config.region);
    let client = this.clientCache.get(key) as ConfigServiceClient | undefined;
    if (!client) {
      client = new ConfigServiceClient({ credentials: this.getCredentials(config.profile), region: config.region });
      this.clientCache.set(key, this.enforceReadOnly(client));
    }
    return client;
  }

  getBackupClient(config: ClientConfig): BackupClient {
    const key = this.getCacheKey('backup', config.profile, config.region);
    let client = this.clientCache.get(key) as BackupClient | undefined;
    if (!client) {
      client = new BackupClient({ credentials: this.getCredentials(config.profile), region: config.region });
      this.clientCache.set(key, this.enforceReadOnly(client));
    }
    return client;
  }

  getCodePipelineClient(config: ClientConfig): CodePipelineClient {
    const key = this.getCacheKey('codepipeline', config.profile, config.region);
    let client = this.clientCache.get(key) as CodePipelineClient | undefined;
    if (!client) {
      client = new CodePipelineClient({ credentials: this.getCredentials(config.profile), region: config.region });
      this.clientCache.set(key, this.enforceReadOnly(client));
    }
    return client;
  }

  getCodeBuildClient(config: ClientConfig): CodeBuildClient {
    const key = this.getCacheKey('codebuild', config.profile, config.region);
    let client = this.clientCache.get(key) as CodeBuildClient | undefined;
    if (!client) {
      client = new CodeBuildClient({ credentials: this.getCredentials(config.profile), region: config.region });
      this.clientCache.set(key, this.enforceReadOnly(client));
    }
    return client;
  }

  getOpenSearchClient(config: ClientConfig): OpenSearchClient {
    const key = this.getCacheKey('opensearch', config.profile, config.region);
    let client = this.clientCache.get(key) as OpenSearchClient | undefined;
    if (!client) {
      client = new OpenSearchClient({ credentials: this.getCredentials(config.profile), region: config.region });
      this.clientCache.set(key, this.enforceReadOnly(client));
    }
    return client;
  }

  getKinesisClient(config: ClientConfig): KinesisClient {
    const key = this.getCacheKey('kinesis', config.profile, config.region);
    let client = this.clientCache.get(key) as KinesisClient | undefined;
    if (!client) {
      client = new KinesisClient({ credentials: this.getCredentials(config.profile), region: config.region });
      this.clientCache.set(key, this.enforceReadOnly(client));
    }
    return client;
  }

  getFirehoseClient(config: ClientConfig): FirehoseClient {
    const key = this.getCacheKey('firehose', config.profile, config.region);
    let client = this.clientCache.get(key) as FirehoseClient | undefined;
    if (!client) {
      client = new FirehoseClient({ credentials: this.getCredentials(config.profile), region: config.region });
      this.clientCache.set(key, this.enforceReadOnly(client));
    }
    return client;
  }

  getSESv2Client(config: ClientConfig): SESv2Client {
    const key = this.getCacheKey('ses', config.profile, config.region);
    let client = this.clientCache.get(key) as SESv2Client | undefined;
    if (!client) {
      client = new SESv2Client({ credentials: this.getCredentials(config.profile), region: config.region });
      this.clientCache.set(key, this.enforceReadOnly(client));
    }
    return client;
  }

  getAppSyncClient(config: ClientConfig): AppSyncClient {
    const key = this.getCacheKey('appsync', config.profile, config.region);
    let client = this.clientCache.get(key) as AppSyncClient | undefined;
    if (!client) {
      client = new AppSyncClient({ credentials: this.getCredentials(config.profile), region: config.region });
      this.clientCache.set(key, this.enforceReadOnly(client));
    }
    return client;
  }

  getKafkaClient(config: ClientConfig): KafkaClient {
    const key = this.getCacheKey('msk', config.profile, config.region);
    let client = this.clientCache.get(key) as KafkaClient | undefined;
    if (!client) {
      client = new KafkaClient({ credentials: this.getCredentials(config.profile), region: config.region });
      this.clientCache.set(key, this.enforceReadOnly(client));
    }
    return client;
  }

  getEMRClient(config: ClientConfig): EMRClient {
    const key = this.getCacheKey('emr', config.profile, config.region);
    let client = this.clientCache.get(key) as EMRClient | undefined;
    if (!client) {
      client = new EMRClient({ credentials: this.getCredentials(config.profile), region: config.region });
      this.clientCache.set(key, this.enforceReadOnly(client));
    }
    return client;
  }

  getSageMakerClient(config: ClientConfig): SageMakerClient {
    const key = this.getCacheKey('sagemaker', config.profile, config.region);
    let client = this.clientCache.get(key) as SageMakerClient | undefined;
    if (!client) {
      client = new SageMakerClient({ credentials: this.getCredentials(config.profile), region: config.region });
      this.clientCache.set(key, this.enforceReadOnly(client));
    }
    return client;
  }

  getTransferClient(config: ClientConfig): TransferClient {
    const key = this.getCacheKey('transfer', config.profile, config.region);
    let client = this.clientCache.get(key) as TransferClient | undefined;
    if (!client) {
      client = new TransferClient({ credentials: this.getCredentials(config.profile), region: config.region });
      this.clientCache.set(key, this.enforceReadOnly(client));
    }
    return client;
  }

  // Phase 4: Database & Networking
  getNeptuneClient(config: ClientConfig): NeptuneClient {
    const key = this.getCacheKey('neptune', config.profile, config.region);
    let client = this.clientCache.get(key) as NeptuneClient | undefined;
    if (!client) {
      client = new NeptuneClient({ credentials: this.getCredentials(config.profile), region: config.region });
      this.clientCache.set(key, this.enforceReadOnly(client));
    }
    return client;
  }

  getDocDBClient(config: ClientConfig): DocDBClient {
    const key = this.getCacheKey('docdb', config.profile, config.region);
    let client = this.clientCache.get(key) as DocDBClient | undefined;
    if (!client) {
      client = new DocDBClient({ credentials: this.getCredentials(config.profile), region: config.region });
      this.clientCache.set(key, this.enforceReadOnly(client));
    }
    return client;
  }

  getMemoryDBClient(config: ClientConfig): MemoryDBClient {
    const key = this.getCacheKey('memorydb', config.profile, config.region);
    let client = this.clientCache.get(key) as MemoryDBClient | undefined;
    if (!client) {
      client = new MemoryDBClient({ credentials: this.getCredentials(config.profile), region: config.region });
      this.clientCache.set(key, this.enforceReadOnly(client));
    }
    return client;
  }

  getTimestreamWriteClient(config: ClientConfig): TimestreamWriteClient {
    const key = this.getCacheKey('timestream', config.profile, config.region);
    let client = this.clientCache.get(key) as TimestreamWriteClient | undefined;
    if (!client) {
      client = new TimestreamWriteClient({ credentials: this.getCredentials(config.profile), region: config.region });
      this.clientCache.set(key, this.enforceReadOnly(client));
    }
    return client;
  }

  getKeyspacesClient(config: ClientConfig): KeyspacesClient {
    const key = this.getCacheKey('keyspaces', config.profile, config.region);
    let client = this.clientCache.get(key) as KeyspacesClient | undefined;
    if (!client) {
      client = new KeyspacesClient({ credentials: this.getCredentials(config.profile), region: config.region });
      this.clientCache.set(key, this.enforceReadOnly(client));
    }
    return client;
  }

  getGlobalAcceleratorClient(config: ClientConfig): GlobalAcceleratorClient {
    const key = this.getCacheKey('globalaccelerator', config.profile, 'us-west-2');
    let client = this.clientCache.get(key) as GlobalAcceleratorClient | undefined;
    if (!client) {
      client = new GlobalAcceleratorClient({ credentials: this.getCredentials(config.profile), region: 'us-west-2' });
      this.clientCache.set(key, this.enforceReadOnly(client));
    }
    return client;
  }

  getDirectConnectClient(config: ClientConfig): DirectConnectClient {
    const key = this.getCacheKey('directconnect', config.profile, config.region);
    let client = this.clientCache.get(key) as DirectConnectClient | undefined;
    if (!client) {
      client = new DirectConnectClient({ credentials: this.getCredentials(config.profile), region: config.region });
      this.clientCache.set(key, this.enforceReadOnly(client));
    }
    return client;
  }

  getNetworkFirewallClient(config: ClientConfig): NetworkFirewallClient {
    const key = this.getCacheKey('networkfirewall', config.profile, config.region);
    let client = this.clientCache.get(key) as NetworkFirewallClient | undefined;
    if (!client) {
      client = new NetworkFirewallClient({ credentials: this.getCredentials(config.profile), region: config.region });
      this.clientCache.set(key, this.enforceReadOnly(client));
    }
    return client;
  }

  getMQClient(config: ClientConfig): MqClient {
    const key = this.getCacheKey('mq', config.profile, config.region);
    let client = this.clientCache.get(key) as MqClient | undefined;
    if (!client) {
      client = new MqClient({ credentials: this.getCredentials(config.profile), region: config.region });
      this.clientCache.set(key, this.enforceReadOnly(client));
    }
    return client;
  }

  // Phase 5: Storage, Migration & Compute
  getFSxClient(config: ClientConfig): FSxClient {
    const key = this.getCacheKey('fsx', config.profile, config.region);
    let client = this.clientCache.get(key) as FSxClient | undefined;
    if (!client) { client = new FSxClient({ credentials: this.getCredentials(config.profile), region: config.region }); this.clientCache.set(key, client); }
    return client;
  }

  getStorageGatewayClient(config: ClientConfig): StorageGatewayClient {
    const key = this.getCacheKey('storagegateway', config.profile, config.region);
    let client = this.clientCache.get(key) as StorageGatewayClient | undefined;
    if (!client) { client = new StorageGatewayClient({ credentials: this.getCredentials(config.profile), region: config.region }); this.clientCache.set(key, client); }
    return client;
  }

  getDMSClient(config: ClientConfig): DatabaseMigrationServiceClient {
    const key = this.getCacheKey('dms', config.profile, config.region);
    let client = this.clientCache.get(key) as DatabaseMigrationServiceClient | undefined;
    if (!client) { client = new DatabaseMigrationServiceClient({ credentials: this.getCredentials(config.profile), region: config.region }); this.clientCache.set(key, client); }
    return client;
  }

  getDataSyncClient(config: ClientConfig): DataSyncClient {
    const key = this.getCacheKey('datasync', config.profile, config.region);
    let client = this.clientCache.get(key) as DataSyncClient | undefined;
    if (!client) { client = new DataSyncClient({ credentials: this.getCredentials(config.profile), region: config.region }); this.clientCache.set(key, client); }
    return client;
  }

  getDRSClient(config: ClientConfig): DrsClient {
    const key = this.getCacheKey('drs', config.profile, config.region);
    let client = this.clientCache.get(key) as DrsClient | undefined;
    if (!client) { client = new DrsClient({ credentials: this.getCredentials(config.profile), region: config.region }); this.clientCache.set(key, client); }
    return client;
  }

  getLakeFormationClient(config: ClientConfig): LakeFormationClient {
    const key = this.getCacheKey('lakeformation', config.profile, config.region);
    let client = this.clientCache.get(key) as LakeFormationClient | undefined;
    if (!client) { client = new LakeFormationClient({ credentials: this.getCredentials(config.profile), region: config.region }); this.clientCache.set(key, client); }
    return client;
  }

  getElasticBeanstalkClient(config: ClientConfig): ElasticBeanstalkClient {
    const key = this.getCacheKey('elasticbeanstalk', config.profile, config.region);
    let client = this.clientCache.get(key) as ElasticBeanstalkClient | undefined;
    if (!client) { client = new ElasticBeanstalkClient({ credentials: this.getCredentials(config.profile), region: config.region }); this.clientCache.set(key, client); }
    return client;
  }

  getAppRunnerClient(config: ClientConfig): AppRunnerClient {
    const key = this.getCacheKey('apprunner', config.profile, config.region);
    let client = this.clientCache.get(key) as AppRunnerClient | undefined;
    if (!client) { client = new AppRunnerClient({ credentials: this.getCredentials(config.profile), region: config.region }); this.clientCache.set(key, client); }
    return client;
  }

  getBatchClient(config: ClientConfig): BatchClient {
    const key = this.getCacheKey('batch', config.profile, config.region);
    let client = this.clientCache.get(key) as BatchClient | undefined;
    if (!client) { client = new BatchClient({ credentials: this.getCredentials(config.profile), region: config.region }); this.clientCache.set(key, client); }
    return client;
  }

  getAppFlowClient(config: ClientConfig): AppflowClient {
    const key = this.getCacheKey('appflow', config.profile, config.region);
    let client = this.clientCache.get(key) as AppflowClient | undefined;
    if (!client) { client = new AppflowClient({ credentials: this.getCredentials(config.profile), region: config.region }); this.clientCache.set(key, client); }
    return client;
  }

  // Phase 6: Security & Compliance
  getMacie2Client(config: ClientConfig): Macie2Client {
    const key = this.getCacheKey('macie', config.profile, config.region);
    let client = this.clientCache.get(key) as Macie2Client | undefined;
    if (!client) { client = new Macie2Client({ credentials: this.getCredentials(config.profile), region: config.region }); this.clientCache.set(key, client); }
    return client;
  }

  getFMSClient(config: ClientConfig): FMSClient {
    const key = this.getCacheKey('fms', config.profile, 'us-east-1');
    let client = this.clientCache.get(key) as FMSClient | undefined;
    if (!client) { client = new FMSClient({ credentials: this.getCredentials(config.profile), region: 'us-east-1' }); this.clientCache.set(key, client); }
    return client;
  }

  getShieldClient(config: ClientConfig): ShieldClient {
    const key = this.getCacheKey('shield', config.profile, 'us-east-1');
    let client = this.clientCache.get(key) as ShieldClient | undefined;
    if (!client) { client = new ShieldClient({ credentials: this.getCredentials(config.profile), region: 'us-east-1' }); this.clientCache.set(key, client); }
    return client;
  }

  getCloudHSMV2Client(config: ClientConfig): CloudHSMV2Client {
    const key = this.getCacheKey('cloudhsm', config.profile, config.region);
    let client = this.clientCache.get(key) as CloudHSMV2Client | undefined;
    if (!client) { client = new CloudHSMV2Client({ credentials: this.getCredentials(config.profile), region: config.region }); this.clientCache.set(key, client); }
    return client;
  }

  getDirectoryServiceClient(config: ClientConfig): DirectoryServiceClient {
    const key = this.getCacheKey('directoryservice', config.profile, config.region);
    let client = this.clientCache.get(key) as DirectoryServiceClient | undefined;
    if (!client) { client = new DirectoryServiceClient({ credentials: this.getCredentials(config.profile), region: config.region }); this.clientCache.set(key, client); }
    return client;
  }

  getDetectiveClient(config: ClientConfig): DetectiveClient {
    const key = this.getCacheKey('detective', config.profile, config.region);
    let client = this.clientCache.get(key) as DetectiveClient | undefined;
    if (!client) { client = new DetectiveClient({ credentials: this.getCredentials(config.profile), region: config.region }); this.clientCache.set(key, client); }
    return client;
  }

  getAuditManagerClient(config: ClientConfig): AuditManagerClient {
    const key = this.getCacheKey('auditmanager', config.profile, config.region);
    let client = this.clientCache.get(key) as AuditManagerClient | undefined;
    if (!client) { client = new AuditManagerClient({ credentials: this.getCredentials(config.profile), region: config.region }); this.clientCache.set(key, client); }
    return client;
  }

  getRAMClient(config: ClientConfig): RAMClient {
    const key = this.getCacheKey('ram', config.profile, config.region);
    let client = this.clientCache.get(key) as RAMClient | undefined;
    if (!client) { client = new RAMClient({ credentials: this.getCredentials(config.profile), region: config.region }); this.clientCache.set(key, client); }
    return client;
  }

  getOrganizationsClient(config: ClientConfig): OrganizationsClient {
    const key = this.getCacheKey('organizations', config.profile, 'us-east-1');
    let client = this.clientCache.get(key) as OrganizationsClient | undefined;
    if (!client) { client = new OrganizationsClient({ credentials: this.getCredentials(config.profile), region: 'us-east-1' }); this.clientCache.set(key, client); }
    return client;
  }

  getTrustedAdvisorClient(config: ClientConfig): TrustedAdvisorClient {
    const key = this.getCacheKey('trustedadvisor', config.profile, 'us-east-1');
    let client = this.clientCache.get(key) as TrustedAdvisorClient | undefined;
    if (!client) { client = new TrustedAdvisorClient({ credentials: this.getCredentials(config.profile), region: 'us-east-1' }); this.clientCache.set(key, client); }
    return client;
  }

  // Phase 7: Developer Tools & Management
  getCodeDeployClient(config: ClientConfig): CodeDeployClient {
    const key = this.getCacheKey('codedeploy', config.profile, config.region);
    let client = this.clientCache.get(key) as CodeDeployClient | undefined;
    if (!client) { client = new CodeDeployClient({ credentials: this.getCredentials(config.profile), region: config.region }); this.clientCache.set(key, client); }
    return client;
  }

  getCodeArtifactClient(config: ClientConfig): CodeartifactClient {
    const key = this.getCacheKey('codeartifact', config.profile, config.region);
    let client = this.clientCache.get(key) as CodeartifactClient | undefined;
    if (!client) { client = new CodeartifactClient({ credentials: this.getCredentials(config.profile), region: config.region }); this.clientCache.set(key, client); }
    return client;
  }

  getXRayClient(config: ClientConfig): XRayClient {
    const key = this.getCacheKey('xray', config.profile, config.region);
    let client = this.clientCache.get(key) as XRayClient | undefined;
    if (!client) { client = new XRayClient({ credentials: this.getCredentials(config.profile), region: config.region }); this.clientCache.set(key, client); }
    return client;
  }

  getFISClient(config: ClientConfig): FisClient {
    const key = this.getCacheKey('fis', config.profile, config.region);
    let client = this.clientCache.get(key) as FisClient | undefined;
    if (!client) { client = new FisClient({ credentials: this.getCredentials(config.profile), region: config.region }); this.clientCache.set(key, client); }
    return client;
  }

  getImageBuilderClient(config: ClientConfig): ImagebuilderClient {
    const key = this.getCacheKey('imagebuilder', config.profile, config.region);
    let client = this.clientCache.get(key) as ImagebuilderClient | undefined;
    if (!client) { client = new ImagebuilderClient({ credentials: this.getCredentials(config.profile), region: config.region }); this.clientCache.set(key, client); }
    return client;
  }

  getServiceCatalogClient(config: ClientConfig): ServiceCatalogClient {
    const key = this.getCacheKey('servicecatalog', config.profile, config.region);
    let client = this.clientCache.get(key) as ServiceCatalogClient | undefined;
    if (!client) { client = new ServiceCatalogClient({ credentials: this.getCredentials(config.profile), region: config.region }); this.clientCache.set(key, client); }
    return client;
  }

  getLicenseManagerClient(config: ClientConfig): LicenseManagerClient {
    const key = this.getCacheKey('licensemanager', config.profile, config.region);
    let client = this.clientCache.get(key) as LicenseManagerClient | undefined;
    if (!client) { client = new LicenseManagerClient({ credentials: this.getCredentials(config.profile), region: config.region }); this.clientCache.set(key, client); }
    return client;
  }

  getComputeOptimizerClient(config: ClientConfig): ComputeOptimizerClient {
    const key = this.getCacheKey('computeoptimizer', config.profile, config.region);
    let client = this.clientCache.get(key) as ComputeOptimizerClient | undefined;
    if (!client) { client = new ComputeOptimizerClient({ credentials: this.getCredentials(config.profile), region: config.region }); this.clientCache.set(key, client); }
    return client;
  }

  // Phase 8: AI/ML & Frontend
  getBedrockClient(config: ClientConfig): BedrockClient {
    const key = this.getCacheKey('bedrock', config.profile, config.region);
    let client = this.clientCache.get(key) as BedrockClient | undefined;
    if (!client) { client = new BedrockClient({ credentials: this.getCredentials(config.profile), region: config.region }); this.clientCache.set(key, client); }
    return client;
  }

  getBedrockRuntimeClient(config: ClientConfig): BedrockRuntimeClient {
    const key = this.getCacheKey('bedrock-runtime', config.profile, config.region);
    let client = this.clientCache.get(key) as BedrockRuntimeClient | undefined;
    if (!client) { client = new BedrockRuntimeClient({ credentials: this.getCredentials(config.profile), region: config.region }); this.clientCache.set(key, client); }
    return client;
  }

  getComprehendClient(config: ClientConfig): ComprehendClient {
    const key = this.getCacheKey('comprehend', config.profile, config.region);
    let client = this.clientCache.get(key) as ComprehendClient | undefined;
    if (!client) { client = new ComprehendClient({ credentials: this.getCredentials(config.profile), region: config.region }); this.clientCache.set(key, client); }
    return client;
  }

  getRekognitionClient(config: ClientConfig): RekognitionClient {
    const key = this.getCacheKey('rekognition', config.profile, config.region);
    let client = this.clientCache.get(key) as RekognitionClient | undefined;
    if (!client) { client = new RekognitionClient({ credentials: this.getCredentials(config.profile), region: config.region }); this.clientCache.set(key, client); }
    return client;
  }

  getTextractClient(config: ClientConfig): TextractClient {
    const key = this.getCacheKey('textract', config.profile, config.region);
    let client = this.clientCache.get(key) as TextractClient | undefined;
    if (!client) { client = new TextractClient({ credentials: this.getCredentials(config.profile), region: config.region }); this.clientCache.set(key, client); }
    return client;
  }

  getTranscribeClient(config: ClientConfig): TranscribeClient {
    const key = this.getCacheKey('transcribe', config.profile, config.region);
    let client = this.clientCache.get(key) as TranscribeClient | undefined;
    if (!client) { client = new TranscribeClient({ credentials: this.getCredentials(config.profile), region: config.region }); this.clientCache.set(key, client); }
    return client;
  }

  getLexV2Client(config: ClientConfig): LexModelsV2Client {
    const key = this.getCacheKey('lex', config.profile, config.region);
    let client = this.clientCache.get(key) as LexModelsV2Client | undefined;
    if (!client) { client = new LexModelsV2Client({ credentials: this.getCredentials(config.profile), region: config.region }); this.clientCache.set(key, client); }
    return client;
  }

  getKendraClient(config: ClientConfig): KendraClient {
    const key = this.getCacheKey('kendra', config.profile, config.region);
    let client = this.clientCache.get(key) as KendraClient | undefined;
    if (!client) { client = new KendraClient({ credentials: this.getCredentials(config.profile), region: config.region }); this.clientCache.set(key, client); }
    return client;
  }

  getAmplifyClient(config: ClientConfig): AmplifyClient {
    const key = this.getCacheKey('amplify', config.profile, config.region);
    let client = this.clientCache.get(key) as AmplifyClient | undefined;
    if (!client) { client = new AmplifyClient({ credentials: this.getCredentials(config.profile), region: config.region }); this.clientCache.set(key, client); }
    return client;
  }

  getLocationClient(config: ClientConfig): LocationClient {
    const key = this.getCacheKey('location', config.profile, config.region);
    let client = this.clientCache.get(key) as LocationClient | undefined;
    if (!client) { client = new LocationClient({ credentials: this.getCredentials(config.profile), region: config.region }); this.clientCache.set(key, client); }
    return client;
  }

  getLightsailClient(config: ClientConfig): LightsailClient {
    const key = this.getCacheKey('lightsail', config.profile, config.region);
    let client = this.clientCache.get(key) as LightsailClient | undefined;
    if (!client) { client = new LightsailClient({ credentials: this.getCredentials(config.profile), region: config.region }); this.clientCache.set(key, client); }
    return client;
  }

  // Phase 9: Streaming, Analytics & Communication
  getKinesisVideoClient(config: ClientConfig): KinesisVideoClient {
    const key = this.getCacheKey('kinesisvideo', config.profile, config.region);
    let client = this.clientCache.get(key) as KinesisVideoClient | undefined;
    if (!client) { client = new KinesisVideoClient({ credentials: this.getCredentials(config.profile), region: config.region }); this.clientCache.set(key, client); }
    return client;
  }

  getKinesisAnalyticsV2Client(config: ClientConfig): KinesisAnalyticsV2Client {
    const key = this.getCacheKey('flink', config.profile, config.region);
    let client = this.clientCache.get(key) as KinesisAnalyticsV2Client | undefined;
    if (!client) { client = new KinesisAnalyticsV2Client({ credentials: this.getCredentials(config.profile), region: config.region }); this.clientCache.set(key, client); }
    return client;
  }

  getQuickSightClient(config: ClientConfig): QuickSightClient {
    const key = this.getCacheKey('quicksight', config.profile, config.region);
    let client = this.clientCache.get(key) as QuickSightClient | undefined;
    if (!client) { client = new QuickSightClient({ credentials: this.getCredentials(config.profile), region: config.region }); this.clientCache.set(key, client); }
    return client;
  }

  getPinpointClient(config: ClientConfig): PinpointClient {
    const key = this.getCacheKey('pinpoint', config.profile, config.region);
    let client = this.clientCache.get(key) as PinpointClient | undefined;
    if (!client) { client = new PinpointClient({ credentials: this.getCredentials(config.profile), region: config.region }); this.clientCache.set(key, client); }
    return client;
  }

  getConnectClient(config: ClientConfig): ConnectClient {
    const key = this.getCacheKey('connect', config.profile, config.region);
    let client = this.clientCache.get(key) as ConnectClient | undefined;
    if (!client) { client = new ConnectClient({ credentials: this.getCredentials(config.profile), region: config.region }); this.clientCache.set(key, client); }
    return client;
  }

  getIVSClient(config: ClientConfig): IvsClient {
    const key = this.getCacheKey('ivs', config.profile, config.region);
    let client = this.clientCache.get(key) as IvsClient | undefined;
    if (!client) { client = new IvsClient({ credentials: this.getCredentials(config.profile), region: config.region }); this.clientCache.set(key, client); }
    return client;
  }

  getMediaConvertClient(config: ClientConfig): MediaConvertClient {
    const key = this.getCacheKey('mediaconvert', config.profile, config.region);
    let client = this.clientCache.get(key) as MediaConvertClient | undefined;
    if (!client) { client = new MediaConvertClient({ credentials: this.getCredentials(config.profile), region: config.region }); this.clientCache.set(key, client); }
    return client;
  }

  getMediaLiveClient(config: ClientConfig): MediaLiveClient {
    const key = this.getCacheKey('medialive', config.profile, config.region);
    let client = this.clientCache.get(key) as MediaLiveClient | undefined;
    if (!client) { client = new MediaLiveClient({ credentials: this.getCredentials(config.profile), region: config.region }); this.clientCache.set(key, client); }
    return client;
  }

  // Phase 10: IoT, Niche & Remaining
  getIoTClient(config: ClientConfig): IoTClient {
    const key = this.getCacheKey('iot', config.profile, config.region);
    let client = this.clientCache.get(key) as IoTClient | undefined;
    if (!client) { client = new IoTClient({ credentials: this.getCredentials(config.profile), region: config.region }); this.clientCache.set(key, client); }
    return client;
  }

  getForecastClient(config: ClientConfig): ForecastClient {
    const key = this.getCacheKey('forecast', config.profile, config.region);
    let client = this.clientCache.get(key) as ForecastClient | undefined;
    if (!client) { client = new ForecastClient({ credentials: this.getCredentials(config.profile), region: config.region }); this.clientCache.set(key, client); }
    return client;
  }

  getPersonalizeClient(config: ClientConfig): PersonalizeClient {
    const key = this.getCacheKey('personalize', config.profile, config.region);
    let client = this.clientCache.get(key) as PersonalizeClient | undefined;
    if (!client) { client = new PersonalizeClient({ credentials: this.getCredentials(config.profile), region: config.region }); this.clientCache.set(key, client); }
    return client;
  }

  getFraudDetectorClient(config: ClientConfig): FraudDetectorClient {
    const key = this.getCacheKey('frauddetector', config.profile, config.region);
    let client = this.clientCache.get(key) as FraudDetectorClient | undefined;
    if (!client) { client = new FraudDetectorClient({ credentials: this.getCredentials(config.profile), region: config.region }); this.clientCache.set(key, client); }
    return client;
  }

  getWorkSpacesClient(config: ClientConfig): WorkSpacesClient {
    const key = this.getCacheKey('workspaces', config.profile, config.region);
    let client = this.clientCache.get(key) as WorkSpacesClient | undefined;
    if (!client) { client = new WorkSpacesClient({ credentials: this.getCredentials(config.profile), region: config.region }); this.clientCache.set(key, client); }
    return client;
  }

  getVPCLatticeClient(config: ClientConfig): VPCLatticeClient {
    const key = this.getCacheKey('vpclattice', config.profile, config.region);
    let client = this.clientCache.get(key) as VPCLatticeClient | undefined;
    if (!client) { client = new VPCLatticeClient({ credentials: this.getCredentials(config.profile), region: config.region }); this.clientCache.set(key, client); }
    return client;
  }

  getElasticTranscoderClient(config: ClientConfig): ElasticTranscoderClient {
    const key = this.getCacheKey('elastictranscoder', config.profile, config.region);
    let client = this.clientCache.get(key) as ElasticTranscoderClient | undefined;
    if (!client) { client = new ElasticTranscoderClient({ credentials: this.getCredentials(config.profile), region: config.region }); this.clientCache.set(key, client); }
    return client;
  }

  getCloudSearchClient(config: ClientConfig): CloudSearchClient {
    const key = this.getCacheKey('cloudsearch', config.profile, config.region);
    let client = this.clientCache.get(key) as CloudSearchClient | undefined;
    if (!client) { client = new CloudSearchClient({ credentials: this.getCredentials(config.profile), region: config.region }); this.clientCache.set(key, client); }
    return client;
  }

  getHealthLakeClient(config: ClientConfig): HealthLakeClient {
    const key = this.getCacheKey('healthlake', config.profile, config.region);
    let client = this.clientCache.get(key) as HealthLakeClient | undefined;
    if (!client) { client = new HealthLakeClient({ credentials: this.getCredentials(config.profile), region: config.region }); this.clientCache.set(key, client); }
    return client;
  }

  getClientForService(service: ServiceType, config: ClientConfig): AWSClientType {
    switch (service) {
      case 'ec2':
      case 'vpc':
      case 'subnet':
      case 'securityGroup':
        return this.getEC2Client(config);
      case 'lambda':
        return this.getLambdaClient(config);
      case 's3':
        return this.getS3Client(config);
      case 'rds':
        return this.getRDSClient(config);
      case 'dynamodb':
        return this.getDynamoDBClient(config);
      case 'ecs':
        return this.getECSClient(config);
      case 'eks':
        return this.getEKSClient(config);
      case 'elasticache':
        return this.getElastiCacheClient(config);
      case 'efs':
        return this.getEFSClient(config);
      case 'alb':
        return this.getELBv2Client(config);
      case 'cloudfront':
        return this.getCloudFrontClient(config);
      case 'route53':
        return this.getRoute53Client(config);
      case 'cloudformation':
        return this.getCloudFormationClient(config);
      case 'glue':
        return this.getGlueClient(config);
      case 'athena':
        return this.getAthenaClient(config);
      case 'stepfunctions':
        return this.getSFNClient(config);
      case 'redshift':
        return this.getRedshiftClient(config);
      case 'mwaa':
        return this.getMWAAClient(config);
      case 'sns':
        return this.getSNSClient(config);
      case 'sqs':
        return this.getSQSClient(config);
      case 'apigateway':
        return this.getAPIGatewayClient(config);
      case 'secretsmanager':
        return this.getSecretsManagerClient(config);
      case 'kms':
        return this.getKMSClient(config);
      case 'eventbridge':
        return this.getEventBridgeClient(config);
      case 'cloudwatch':
        return this.getCloudWatchClient(config);
      case 'iam':
        return this.getIAMClient(config);
      case 'autoscaling':
        return this.getAutoScalingClient(config);
      case 'cloudtrail':
        return this.getCloudTrailClient(config);
      case 'guardduty':
        return this.getGuardDutyClient(config);
      case 'accessanalyzer':
        return this.getAccessAnalyzerClient(config);
      case 'inspector':
        return this.getInspector2Client(config);
      case 'ecr':
        return this.getECRClient(config);
      case 'acm':
        return this.getACMClient(config);
      case 'ssm':
        return this.getSSMClient(config);
      case 'wafv2':
        return this.getWAFV2Client(config);
      case 'cognito':
        return this.getCognitoClient(config);
      case 'config':
        return this.getConfigServiceClient(config);
      case 'backup':
        return this.getBackupClient(config);
      case 'codepipeline':
        return this.getCodePipelineClient(config);
      case 'codebuild':
        return this.getCodeBuildClient(config);
      case 'opensearch':
        return this.getOpenSearchClient(config);
      case 'kinesis':
        return this.getKinesisClient(config);
      case 'firehose':
        return this.getFirehoseClient(config);
      case 'ses':
        return this.getSESv2Client(config);
      case 'appsync':
        return this.getAppSyncClient(config);
      case 'msk':
        return this.getKafkaClient(config);
      case 'emr':
        return this.getEMRClient(config);
      case 'sagemaker':
        return this.getSageMakerClient(config);
      case 'transfer':
        return this.getTransferClient(config);
      // Phase 4
      case 'neptune':
        return this.getNeptuneClient(config);
      case 'documentdb':
        return this.getDocDBClient(config);
      case 'memorydb':
        return this.getMemoryDBClient(config);
      case 'timestream':
        return this.getTimestreamWriteClient(config);
      case 'keyspaces':
        return this.getKeyspacesClient(config);
      case 'transitgateway':
        return this.getEC2Client(config);
      case 'globalaccelerator':
        return this.getGlobalAcceleratorClient(config);
      case 'directconnect':
        return this.getDirectConnectClient(config);
      case 'networkfirewall':
        return this.getNetworkFirewallClient(config);
      case 'mq':
        return this.getMQClient(config);
      // Phase 5
      case 'fsx':
        return this.getFSxClient(config);
      case 'storagegateway':
        return this.getStorageGatewayClient(config);
      case 'dms':
        return this.getDMSClient(config);
      case 'datasync':
        return this.getDataSyncClient(config);
      case 'drs':
        return this.getDRSClient(config);
      case 'lakeformation':
        return this.getLakeFormationClient(config);
      case 'elasticbeanstalk':
        return this.getElasticBeanstalkClient(config);
      case 'apprunner':
        return this.getAppRunnerClient(config);
      case 'batch':
        return this.getBatchClient(config);
      case 'appflow':
        return this.getAppFlowClient(config);
      // Phase 6
      case 'macie':
        return this.getMacie2Client(config);
      case 'fms':
        return this.getFMSClient(config);
      case 'shield':
        return this.getShieldClient(config);
      case 'cloudhsm':
        return this.getCloudHSMV2Client(config);
      case 'directoryservice':
        return this.getDirectoryServiceClient(config);
      case 'detective':
        return this.getDetectiveClient(config);
      case 'auditmanager':
        return this.getAuditManagerClient(config);
      case 'ram':
        return this.getRAMClient(config);
      case 'organizations':
        return this.getOrganizationsClient(config);
      case 'trustedadvisor':
        return this.getTrustedAdvisorClient(config);
      // Phase 7
      case 'codedeploy':
        return this.getCodeDeployClient(config);
      case 'codeartifact':
        return this.getCodeArtifactClient(config);
      case 'xray':
        return this.getXRayClient(config);
      case 'fis':
        return this.getFISClient(config);
      case 'imagebuilder':
        return this.getImageBuilderClient(config);
      case 'servicecatalog':
        return this.getServiceCatalogClient(config);
      case 'licensemanager':
        return this.getLicenseManagerClient(config);
      case 'computeoptimizer':
        return this.getComputeOptimizerClient(config);
      // Phase 8
      case 'bedrock':
        return this.getBedrockClient(config);
      case 'comprehend':
        return this.getComprehendClient(config);
      case 'rekognition':
        return this.getRekognitionClient(config);
      case 'textract':
        return this.getTextractClient(config);
      case 'transcribe':
        return this.getTranscribeClient(config);
      case 'lex':
        return this.getLexV2Client(config);
      case 'kendra':
        return this.getKendraClient(config);
      case 'amplify':
        return this.getAmplifyClient(config);
      case 'location':
        return this.getLocationClient(config);
      case 'lightsail':
        return this.getLightsailClient(config);
      // Phase 9
      case 'kinesisvideo':
        return this.getKinesisVideoClient(config);
      case 'flink':
        return this.getKinesisAnalyticsV2Client(config);
      case 'quicksight':
        return this.getQuickSightClient(config);
      case 'pinpoint':
        return this.getPinpointClient(config);
      case 'connect':
        return this.getConnectClient(config);
      case 'ivs':
        return this.getIVSClient(config);
      case 'mediaconvert':
        return this.getMediaConvertClient(config);
      case 'medialive':
        return this.getMediaLiveClient(config);
      // Phase 10
      case 'iot':
        return this.getIoTClient(config);
      case 'forecast':
        return this.getForecastClient(config);
      case 'personalize':
        return this.getPersonalizeClient(config);
      case 'frauddetector':
        return this.getFraudDetectorClient(config);
      case 'workspaces':
        return this.getWorkSpacesClient(config);
      case 'verifiedaccess':
        return this.getEC2Client(config);
      case 'vpclattice':
        return this.getVPCLatticeClient(config);
      case 'elastictranscoder':
        return this.getElasticTranscoderClient(config);
      case 'cloudsearch':
        return this.getCloudSearchClient(config);
      case 'healthlake':
        return this.getHealthLakeClient(config);
      default:
        throw new Error(`Unknown service type: ${service}`);
    }
  }

  clearCache(): void {
    this.clientCache.clear();
  }
}

// Singleton instance
let clientFactory: ClientFactory | null = null;

export function getClientFactory(): ClientFactory {
  if (!clientFactory) {
    clientFactory = new ClientFactory();
  }
  return clientFactory;
}

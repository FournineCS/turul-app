// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

// AWS service icon labels and colors for diagram nodes
import type { ComponentType } from 'react';
import {
  ArchitectureServiceAmazonEC2,
  ArchitectureServiceAmazonVirtualPrivateCloud,
  ArchitectureServiceAWSLambda,
  ArchitectureServiceAmazonSimpleStorageService,
  ArchitectureServiceAmazonRDS,
  ArchitectureServiceAmazonDynamoDB,
  ArchitectureServiceAmazonElastiCache,
  ArchitectureServiceAmazonOpenSearchService,
  ArchitectureServiceAmazonSimpleQueueService,
  ArchitectureServiceAmazonSimpleNotificationService,
  ArchitectureServiceAmazonEventBridge,
  ArchitectureServiceAWSStepFunctions,
  ArchitectureServiceAmazonAPIGateway,
  ArchitectureServiceAmazonCloudFront,
  ArchitectureServiceAWSAppSync,
  ArchitectureServiceElasticLoadBalancing,
  ArchitectureServiceAmazonElasticContainerService,
  ArchitectureServiceAmazonElasticKubernetesService,
  ArchitectureServiceAmazonElasticBlockStore,
  ArchitectureServiceAmazonEFS,
  ArchitectureServiceAWSGlue,
  ArchitectureServiceAmazonAthena,
  ArchitectureServiceAmazonKinesis,
  ArchitectureServiceAmazonDataFirehose,
  ArchitectureServiceAmazonEMR,
  ArchitectureServiceAmazonRedshift,
  ArchitectureServiceAWSSecretsManager,
  ArchitectureServiceAWSKeyManagementService,
  ArchitectureServiceAWSCodePipeline,
  ArchitectureServiceAWSCodeBuild,
  ArchitectureServiceAmazonSageMaker,
  ArchitectureServiceAmazonManagedWorkflowsforApacheAirflow,
  ArchitectureServiceAWSCertificateManager,
  ArchitectureServiceAWSWAF,
  ArchitectureServiceAmazonRoute53,
  ArchitectureServiceAWSCloudFormation,
  ArchitectureServiceAmazonCloudWatch,
  ArchitectureServiceAWSIdentityandAccessManagement,
  ArchitectureServiceAmazonEC2AutoScaling,
  ArchitectureServiceAWSCloudTrail,
  ArchitectureServiceAmazonGuardDuty,
  ArchitectureServiceAmazonInspector,
  ArchitectureServiceAWSConfig,
  ArchitectureServiceAWSBackup,
  ArchitectureServiceAWSSystemsManager,
  ArchitectureServiceAmazonElasticContainerRegistry,
  ArchitectureServiceAmazonCognito,
  ArchitectureServiceAmazonManagedStreamingforApacheKafka,
  ArchitectureServiceAWSTransferFamily,
  ArchitectureServiceAmazonSimpleEmailService,
  ArchitectureServiceAWSFargate,
  ResourceAmazonVPCNATGateway,
  ResourceAmazonVPCInternetGateway,
  ResourceAmazonVPCElasticNetworkInterface,
  ResourceAmazonVPCRouter,
} from 'aws-react-icons';

// Map resource types to AWS icon components
const ICON_MAP: Record<string, ComponentType<{ size?: string }>> = {
  // Network
  vpc: ArchitectureServiceAmazonVirtualPrivateCloud,
  instance: ArchitectureServiceAmazonEC2,
  'nat-gateway': ResourceAmazonVPCNATGateway,
  'internet-gateway': ResourceAmazonVPCInternetGateway,
  'route-table': ResourceAmazonVPCRouter,
  'network-interface': ResourceAmazonVPCElasticNetworkInterface,
  'load-balancer': ArchitectureServiceElasticLoadBalancing,
  'security-group': ArchitectureServiceAmazonVirtualPrivateCloud,
  'target-group': ArchitectureServiceElasticLoadBalancing,
  // Compute
  function: ArchitectureServiceAWSLambda,
  cluster: ArchitectureServiceAmazonElasticContainerService,
  service: ArchitectureServiceAmazonElasticContainerService,
  'task-definition': ArchitectureServiceAmazonElasticContainerService,
  nodegroup: ArchitectureServiceAmazonElasticKubernetesService,
  'fargate-profile': ArchitectureServiceAWSFargate,
  'auto-scaling-group': ArchitectureServiceAmazonEC2AutoScaling,
  // API / Ingress
  'rest-api': ArchitectureServiceAmazonAPIGateway,
  'http-api': ArchitectureServiceAmazonAPIGateway,
  distribution: ArchitectureServiceAmazonCloudFront,
  'graphql-api': ArchitectureServiceAWSAppSync,
  // Messaging
  queue: ArchitectureServiceAmazonSimpleQueueService,
  topic: ArchitectureServiceAmazonSimpleNotificationService,
  rule: ArchitectureServiceAmazonEventBridge,
  'state-machine': ArchitectureServiceAWSStepFunctions,
  // Database
  'db-instance': ArchitectureServiceAmazonRDS,
  'db-cluster': ArchitectureServiceAmazonRDS,
  table: ArchitectureServiceAmazonDynamoDB,
  'replication-group': ArchitectureServiceAmazonElastiCache,
  'cache-cluster': ArchitectureServiceAmazonElastiCache,
  domain: ArchitectureServiceAmazonOpenSearchService,
  // Storage
  bucket: ArchitectureServiceAmazonSimpleStorageService,
  'file-system': ArchitectureServiceAmazonEFS,
  volume: ArchitectureServiceAmazonElasticBlockStore,
  // Analytics
  job: ArchitectureServiceAWSGlue,
  crawler: ArchitectureServiceAWSGlue,
  database: ArchitectureServiceAWSGlue,
  'work-group': ArchitectureServiceAmazonAthena,
  'data-stream': ArchitectureServiceAmazonKinesis,
  'delivery-stream': ArchitectureServiceAmazonDataFirehose,
  'emr-cluster': ArchitectureServiceAmazonEMR,
  // Security
  secret: ArchitectureServiceAWSSecretsManager,
  key: ArchitectureServiceAWSKeyManagementService,
  // DevTools
  pipeline: ArchitectureServiceAWSCodePipeline,
  'build-project': ArchitectureServiceAWSCodeBuild,
  // ML
  'notebook-instance': ArchitectureServiceAmazonSageMaker,
  // Other
  environment: ArchitectureServiceAmazonManagedWorkflowsforApacheAirflow,
  certificate: ArchitectureServiceAWSCertificateManager,
  'web-acl': ArchitectureServiceAWSWAF,
  snapshot: ArchitectureServiceAmazonElasticBlockStore,
};

/**
 * Returns the AWS icon component for a given resource type, or null if no icon is mapped.
 */
export function getServiceIcon(resourceType: string): ComponentType<{ size?: string }> | null {
  return ICON_MAP[resourceType] || null;
}

export const SERVICE_LABELS: Record<string, string> = {
  // Network
  vpc: 'VPC',
  subnet: 'Subnet',
  'security-group': 'SG',
  instance: 'EC2',
  'nat-gateway': 'NAT',
  'internet-gateway': 'IGW',
  'route-table': 'RT',
  'network-interface': 'ENI',
  'load-balancer': 'ALB',
  'target-group': 'TG',
  // Compute
  function: 'Lambda',
  cluster: 'Cluster',
  service: 'Service',
  'task-definition': 'Task',
  nodegroup: 'Nodes',
  'fargate-profile': 'Fargate',
  'auto-scaling-group': 'ASG',
  // API / Ingress
  'rest-api': 'REST API',
  'http-api': 'HTTP API',
  distribution: 'CloudFront',
  'graphql-api': 'AppSync',
  // Messaging
  queue: 'SQS',
  topic: 'SNS',
  rule: 'EB Rule',
  'state-machine': 'StepFn',
  // Database
  'db-instance': 'RDS',
  'db-cluster': 'RDS',
  table: 'DynamoDB',
  'replication-group': 'ElastiCache',
  'cache-cluster': 'ElastiCache',
  domain: 'OpenSearch',
  // Storage
  bucket: 'S3',
  'file-system': 'EFS',
  // Analytics
  job: 'Glue Job',
  crawler: 'Crawler',
  database: 'Glue DB',
  'work-group': 'Athena',
  'data-stream': 'Kinesis',
  'delivery-stream': 'Firehose',
  'emr-cluster': 'EMR',
  // Security
  secret: 'Secret',
  key: 'KMS',
  // DevTools
  pipeline: 'Pipeline',
  'build-project': 'CodeBuild',
  // ML
  'notebook-instance': 'SageMaker',
  // Other
  environment: 'MWAA',
  certificate: 'ACM',
  'web-acl': 'WAF',
  volume: 'EBS',
  snapshot: 'Snapshot',
};

export const TIER_LABELS: Record<string, string> = {
  // Network tiers
  gateway: 'Gateways',
  vpc: 'VPCs',
  subnet: 'Subnets & Routing',
  loadbalancer: 'Load Balancers',
  compute: 'Compute',
  security: 'Security',
  // Application tiers
  ingress: 'Ingress / API',
  messaging: 'Messaging',
  orchestration: 'Orchestration',
  // Data tiers
  ingestion: 'Ingestion / Streaming',
  database: 'Databases',
  storage: 'Storage',
  processing: 'Processing / ETL',
  analytics: 'Analytics',
  // Generic
  other: 'Other',
};

// Color scheme by diagram type and tier/service
export const NODE_COLORS: Record<string, Record<string, string>> = {
  network: {
    vpc: '#ff9500',
    subnet: '#00b894',
    'route-table': '#fdcb6e',
    instance: '#0984e3',
    'network-interface': '#a29bfe',
    'security-group': '#e84393',
    'nat-gateway': '#6c5ce7',
    'internet-gateway': '#00cec9',
    'load-balancer': '#d63031',
    'target-group': '#fab1a0',
  },
  application: {
    ingress: '#8e44ad',
    loadbalancer: '#d63031',
    compute: '#0984e3',
    messaging: '#f39c12',
    orchestration: '#27ae60',
    other: '#95a5a6',
  },
  data: {
    ingestion: '#0984e3',
    database: '#d63031',
    storage: '#27ae60',
    processing: '#f39c12',
    analytics: '#8e44ad',
    other: '#95a5a6',
  },
  full: {
    default: '#636e72',
  },
};

export function getNodeColor(viewMode: string, resourceType: string, tier?: string): string {
  const colorMap = NODE_COLORS[viewMode];
  if (!colorMap) return '#636e72';

  if (viewMode === 'network') {
    return colorMap[resourceType] || '#636e72';
  }

  return colorMap[tier || 'other'] || '#636e72';
}

export function getNodeLabel(resourceType: string): string {
  return SERVICE_LABELS[resourceType] || resourceType;
}

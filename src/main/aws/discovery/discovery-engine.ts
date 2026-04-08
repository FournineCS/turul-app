// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { discoverResourcesWithTaggingApi } from './tagging-api';
import type { DiscoveredResource, ServiceType, ScanConfig } from '../../../shared/types';

export interface DiscoveryResult {
  region: string;
  resources: DiscoveredResource[];
  errors: DiscoveryError[];
}

export interface DiscoveryError {
  region: string;
  service?: string;
  message: string;
}

export interface DiscoveryProgress {
  totalRegions: number;
  completedRegions: number;
  currentRegion: string;
  resourcesFound: number;
}

export type DiscoveryProgressCallback = (progress: DiscoveryProgress) => void;

export class DiscoveryEngine {
  async discover(
    config: ScanConfig,
    onProgress?: DiscoveryProgressCallback
  ): Promise<DiscoveryResult[]> {
    const results: DiscoveryResult[] = [];
    let totalResourcesFound = 0;

    for (let i = 0; i < config.regions.length; i++) {
      const region = config.regions[i];

      onProgress?.({
        totalRegions: config.regions.length,
        completedRegions: i,
        currentRegion: region,
        resourcesFound: totalResourcesFound,
      });

      const result = await this.discoverInRegion(
        config.profileName,
        region,
        config.services
      );

      results.push(result);
      totalResourcesFound += result.resources.length;
    }

    // Final progress update
    onProgress?.({
      totalRegions: config.regions.length,
      completedRegions: config.regions.length,
      currentRegion: 'done',
      resourcesFound: totalResourcesFound,
    });

    return results;
  }

  private async discoverInRegion(
    profile: string,
    region: string,
    services: ServiceType[]
  ): Promise<DiscoveryResult> {
    const resources: DiscoveredResource[] = [];
    const errors: DiscoveryError[] = [];

    try {
      // Use Resource Groups Tagging API for initial discovery
      const taggedResources = await discoverResourcesWithTaggingApi({
        profile,
        region,
        serviceFilter: services,
      });

      resources.push(...taggedResources);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      errors.push({
        region,
        message: `Tagging API discovery failed: ${message}`,
      });
    }

    return {
      region,
      resources,
      errors,
    };
  }

  // Group discovered resources by service type
  groupByService(resources: DiscoveredResource[]): Map<ServiceType, DiscoveredResource[]> {
    const grouped = new Map<ServiceType, DiscoveredResource[]>();

    for (const resource of resources) {
      const serviceType = this.mapToServiceType(resource.service);
      if (serviceType) {
        const existing = grouped.get(serviceType) || [];
        existing.push(resource);
        grouped.set(serviceType, existing);
      }
    }

    return grouped;
  }

  private mapToServiceType(awsService: string): ServiceType | null {
    const serviceMap: Record<string, ServiceType> = {
      // Compute
      ec2: 'ec2',
      lambda: 'lambda',
      ecs: 'ecs',
      eks: 'eks',
      autoscaling: 'autoscaling',
      'elastic-beanstalk': 'elasticbeanstalk',
      'elasticbeanstalk': 'elasticbeanstalk',
      apprunner: 'apprunner',
      batch: 'batch',
      lightsail: 'lightsail',
      // Storage
      s3: 's3',
      elasticfilesystem: 'efs',
      ecr: 'ecr',
      backup: 'backup',
      fsx: 'fsx',
      'storagegateway': 'storagegateway',
      // Database
      rds: 'rds',
      dynamodb: 'dynamodb',
      elasticache: 'elasticache',
      redshift: 'redshift',
      'es': 'opensearch',
      'opensearch': 'opensearch',
      neptune: 'neptune',
      docdb: 'documentdb',
      memorydb: 'memorydb',
      timestream: 'timestream',
      cassandra: 'keyspaces',
      // Networking
      elasticloadbalancing: 'alb',
      cloudfront: 'cloudfront',
      route53: 'route53',
      wafv2: 'wafv2',
      waf: 'wafv2',
      'ec2-transit-gateway': 'transitgateway',
      globalaccelerator: 'globalaccelerator',
      directconnect: 'directconnect',
      'network-firewall': 'networkfirewall',
      'vpc-lattice': 'vpclattice',
      // Integration
      sns: 'sns',
      sqs: 'sqs',
      states: 'stepfunctions',
      events: 'eventbridge',
      'execute-api': 'apigateway',
      apigateway: 'apigateway',
      appsync: 'appsync',
      ses: 'ses',
      mq: 'mq',
      appflow: 'appflow',
      // Migration
      dms: 'dms',
      datasync: 'datasync',
      drs: 'drs',
      // Management
      cloudformation: 'cloudformation',
      cloudwatch: 'cloudwatch',
      logs: 'cloudwatch',
      cloudtrail: 'cloudtrail',
      config: 'config',
      ssm: 'ssm',
      // Governance
      ram: 'ram',
      organizations: 'organizations',
      servicecatalog: 'servicecatalog',
      'license-manager': 'licensemanager',
      // Analytics
      glue: 'glue',
      athena: 'athena',
      kinesis: 'kinesis',
      firehose: 'firehose',
      kafka: 'msk',
      'elasticmapreduce': 'emr',
      emr: 'emr',
      lakeformation: 'lakeformation',
      'kinesisanalytics': 'flink',
      quicksight: 'quicksight',
      cloudsearch: 'cloudsearch',
      'kinesisvideo': 'kinesisvideo',
      // Security
      secretsmanager: 'secretsmanager',
      kms: 'kms',
      iam: 'iam',
      guardduty: 'guardduty',
      'access-analyzer': 'accessanalyzer',
      inspector2: 'inspector',
      acm: 'acm',
      macie2: 'macie',
      fms: 'fms',
      shield: 'shield',
      cloudhsmv2: 'cloudhsm',
      'ds': 'directoryservice',
      detective: 'detective',
      'auditmanager': 'auditmanager',
      // Identity
      cognito: 'cognito',
      'cognito-idp': 'cognito',
      // Developer Tools
      codepipeline: 'codepipeline',
      codebuild: 'codebuild',
      codedeploy: 'codedeploy',
      codeartifact: 'codeartifact',
      xray: 'xray',
      fis: 'fis',
      imagebuilder: 'imagebuilder',
      // ML & AI
      sagemaker: 'sagemaker',
      bedrock: 'bedrock',
      comprehend: 'comprehend',
      rekognition: 'rekognition',
      textract: 'textract',
      transcribe: 'transcribe',
      lex: 'lex',
      kendra: 'kendra',
      forecast: 'forecast',
      personalize: 'personalize',
      frauddetector: 'frauddetector',
      healthlake: 'healthlake',
      // Data Pipeline
      airflow: 'mwaa',
      transfer: 'transfer',
      // Frontend & Mobile
      amplify: 'amplify',
      geo: 'location',
      pinpoint: 'pinpoint',
      // Business Apps
      connect: 'connect',
      // Media
      ivs: 'ivs',
      mediaconvert: 'mediaconvert',
      medialive: 'medialive',
      'elastictranscoder': 'elastictranscoder',
      // IoT
      iot: 'iot',
      // End User Computing
      workspaces: 'workspaces',
    };

    return serviceMap[awsService] || null;
  }

  // Identify which services have resources in the account
  identifyActiveServices(resources: DiscoveredResource[]): ServiceType[] {
    const activeServices = new Set<ServiceType>();

    for (const resource of resources) {
      const serviceType = this.mapToServiceType(resource.service);
      if (serviceType) {
        activeServices.add(serviceType);
      }
    }

    return Array.from(activeServices);
  }
}

// Singleton instance
let discoveryEngine: DiscoveryEngine | null = null;

export function getDiscoveryEngine(): DiscoveryEngine {
  if (!discoveryEngine) {
    discoveryEngine = new DiscoveryEngine();
  }
  return discoveryEngine;
}

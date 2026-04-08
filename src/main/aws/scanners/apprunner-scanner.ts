// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  ListServicesCommand,
  DescribeServiceCommand,
  ListTagsForResourceCommand,
} from '@aws-sdk/client-apprunner';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class AppRunnerScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'apprunner', 'apprunner');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getAppRunnerClient({ profile: this.config.profile, region: this.config.region });

    try {
      let nextToken: string | undefined;
      do {
        const response = await this.withRateLimit(() => client.send(new ListServicesCommand({ NextToken: nextToken })));
        if (response.ServiceSummaryList) {
          for (const summary of response.ServiceSummaryList) {
            if (!summary.ServiceArn) continue;

            let details: Record<string, unknown> = {};
            try {
              const descResp = await this.withRateLimit(() => client.send(new DescribeServiceCommand({ ServiceArn: summary.ServiceArn })));
              const svc = descResp.Service;
              if (svc) {
                const srcConfig = svc.SourceConfiguration;
                details = {
                  serviceName: svc.ServiceName,
                  serviceUrl: svc.ServiceUrl,
                  status: svc.Status,
                  sourceConfiguration: srcConfig ? {
                    type: srcConfig.CodeRepository ? 'code' : srcConfig.ImageRepository ? 'image' : 'unknown',
                    repository: srcConfig.CodeRepository ? {
                      repositoryUrl: srcConfig.CodeRepository.RepositoryUrl,
                      sourceCodeVersion: srcConfig.CodeRepository.SourceCodeVersion,
                      codeConfiguration: srcConfig.CodeRepository.CodeConfiguration ? {
                        configurationSource: srcConfig.CodeRepository.CodeConfiguration.ConfigurationSource,
                      } : undefined,
                    } : undefined,
                    imageRepository: srcConfig.ImageRepository ? {
                      imageIdentifier: srcConfig.ImageRepository.ImageIdentifier,
                      imageRepositoryType: srcConfig.ImageRepository.ImageRepositoryType,
                    } : undefined,
                    autoDeploymentsEnabled: srcConfig.AutoDeploymentsEnabled,
                    authenticationConfiguration: srcConfig.AuthenticationConfiguration ? {
                      connectionArn: srcConfig.AuthenticationConfiguration.ConnectionArn,
                      accessRoleArn: srcConfig.AuthenticationConfiguration.AccessRoleArn,
                    } : undefined,
                  } : undefined,
                  instanceConfiguration: svc.InstanceConfiguration ? {
                    cpu: svc.InstanceConfiguration.Cpu,
                    memory: svc.InstanceConfiguration.Memory,
                    instanceRoleArn: svc.InstanceConfiguration.InstanceRoleArn,
                  } : undefined,
                  healthCheckConfiguration: svc.HealthCheckConfiguration ? {
                    protocol: svc.HealthCheckConfiguration.Protocol,
                    path: svc.HealthCheckConfiguration.Path,
                    interval: svc.HealthCheckConfiguration.Interval,
                    timeout: svc.HealthCheckConfiguration.Timeout,
                    healthyThreshold: svc.HealthCheckConfiguration.HealthyThreshold,
                    unhealthyThreshold: svc.HealthCheckConfiguration.UnhealthyThreshold,
                  } : undefined,
                  networkConfiguration: svc.NetworkConfiguration ? {
                    egressType: svc.NetworkConfiguration.EgressConfiguration?.EgressType,
                    vpcConnectorArn: svc.NetworkConfiguration.EgressConfiguration?.VpcConnectorArn,
                    ingressType: svc.NetworkConfiguration.IngressConfiguration?.IsPubliclyAccessible,
                  } : undefined,
                  autoScalingConfigurationSummary: svc.AutoScalingConfigurationSummary ? {
                    autoScalingConfigurationArn: svc.AutoScalingConfigurationSummary.AutoScalingConfigurationArn,
                    autoScalingConfigurationName: svc.AutoScalingConfigurationSummary.AutoScalingConfigurationName,
                  } : undefined,
                };
              }
            } catch { /* ignore */ }

            let tags: Record<string, string> = {};
            try {
              const tagsResp = await this.withRateLimit(() => client.send(new ListTagsForResourceCommand({ ResourceArn: summary.ServiceArn })));
              if (tagsResp.Tags) {
                for (const tag of tagsResp.Tags) {
                  if (tag.Key) tags[tag.Key] = tag.Value || '';
                }
              }
            } catch { /* ignore */ }

            resources.push(this.createResource(
              summary.ServiceArn,
              'apprunner-service',
              summary.ServiceName || '',
              {
                serviceId: summary.ServiceId,
                serviceArn: summary.ServiceArn,
                ...details,
              },
              tags,
              summary.CreatedAt?.toISOString(),
            ));
          }
        }
        nextToken = response.NextToken;
      } while (nextToken);
    } catch (error) { errors.push(this.createError('ListServices', error)); }

    return { resources, errors };
  }
}

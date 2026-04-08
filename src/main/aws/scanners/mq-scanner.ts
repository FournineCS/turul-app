// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  ListBrokersCommand,
  DescribeBrokerCommand,
  ListConfigurationsCommand,
} from '@aws-sdk/client-mq';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class MQScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'mq', 'mq');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getMQClient({ profile: this.config.profile, region: this.config.region });

    // Scan brokers
    try {
      let nextToken: string | undefined;
      do {
        const response = await this.withRateLimit(() => client.send(new ListBrokersCommand({ NextToken: nextToken, MaxResults: 100 })));
        if (response.BrokerSummaries) {
          for (const broker of response.BrokerSummaries) {
            if (!broker.BrokerArn) continue;

            let details: any = {};
            let tags: Record<string, string> = {};
            try {
              const descResp = await this.withRateLimit(() => client.send(new DescribeBrokerCommand({ BrokerId: broker.BrokerId })));
              details = {
                brokerName: descResp.BrokerName,
                engineType: descResp.EngineType,
                engineVersion: descResp.EngineVersion,
                deploymentMode: descResp.DeploymentMode,
                instanceType: descResp.HostInstanceType,
                brokerState: descResp.BrokerState,
                storageType: descResp.StorageType,
                endpoints: descResp.BrokerInstances?.flatMap(i => i.Endpoints || []) || [],
                publiclyAccessible: descResp.PubliclyAccessible,
                authenticationStrategy: descResp.AuthenticationStrategy,
                autoMinorVersionUpgrade: descResp.AutoMinorVersionUpgrade,
                maintenanceWindowStartTime: descResp.MaintenanceWindowStartTime,
                subnetIds: descResp.SubnetIds,
                securityGroups: descResp.SecurityGroups,
              };
              if (descResp.Tags) {
                for (const [key, value] of Object.entries(descResp.Tags)) {
                  tags[key] = value || '';
                }
              }
            } catch { /* ignore */ }

            resources.push(this.createResource(broker.BrokerArn, 'broker', broker.BrokerName || '', {
              brokerId: broker.BrokerId,
              brokerName: broker.BrokerName,
              brokerState: broker.BrokerState,
              engineType: broker.EngineType,
              deploymentMode: broker.DeploymentMode,
              ...details,
            }, tags, broker.Created?.toISOString()));
          }
        }
        nextToken = response.NextToken;
      } while (nextToken);
    } catch (error) { errors.push(this.createError('ListBrokers', error)); }

    // Scan configurations
    try {
      let nextToken: string | undefined;
      do {
        const response = await this.withRateLimit(() => client.send(new ListConfigurationsCommand({ NextToken: nextToken, MaxResults: 100 })));
        if (response.Configurations) {
          for (const config of response.Configurations) {
            if (!config.Arn) continue;

            const tags: Record<string, string> = {};
            if (config.Tags) {
              for (const [key, value] of Object.entries(config.Tags)) {
                tags[key] = value || '';
              }
            }

            resources.push(this.createResource(config.Arn, 'configuration', config.Name || '', {
              configurationName: config.Name,
              engineType: config.EngineType,
              engineVersion: config.EngineVersion,
              latestRevision: config.LatestRevision?.Revision,
              latestRevisionDescription: config.LatestRevision?.Description,
              authenticationStrategy: config.AuthenticationStrategy,
            }, tags, config.Created?.toISOString()));
          }
        }
        nextToken = response.NextToken;
      } while (nextToken);
    } catch (error) { errors.push(this.createError('ListConfigurations', error)); }

    return { resources, errors };
  }
}

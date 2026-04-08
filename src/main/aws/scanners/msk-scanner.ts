// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  ListClustersV2Command,
  ListTagsForResourceCommand,
} from '@aws-sdk/client-kafka';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class MSKScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'msk', 'msk');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getKafkaClient({ profile: this.config.profile, region: this.config.region });

    try {
      let nextToken: string | undefined;
      do {
        const response = await this.withRateLimit(() => client.send(new ListClustersV2Command({ NextToken: nextToken })));
        if (response.ClusterInfoList) {
          for (const cluster of response.ClusterInfoList) {
            if (!cluster.ClusterArn) continue;

            let tags: Record<string, string> = {};
            try {
              const tagsResp = await this.withRateLimit(() => client.send(new ListTagsForResourceCommand({ ResourceArn: cluster.ClusterArn })));
              tags = tagsResp.Tags || {};
            } catch { /* ignore */ }

            const provisioned = cluster.Provisioned;
            const serverless = cluster.Serverless;

            resources.push(this.createResource(cluster.ClusterArn, 'kafka-cluster', cluster.ClusterName || '', {
              clusterName: cluster.ClusterName,
              clusterType: cluster.ClusterType,
              state: cluster.State,
              activeOperationArn: cluster.ActiveOperationArn,
              provisioned: provisioned ? {
                brokerNodeGroupInfo: provisioned.BrokerNodeGroupInfo ? {
                  instanceType: provisioned.BrokerNodeGroupInfo.InstanceType,
                  clientSubnets: provisioned.BrokerNodeGroupInfo.ClientSubnets,
                  securityGroups: provisioned.BrokerNodeGroupInfo.SecurityGroups,
                  storageInfo: provisioned.BrokerNodeGroupInfo.StorageInfo?.EbsStorageInfo?.VolumeSize,
                } : undefined,
                numberOfBrokerNodes: provisioned.NumberOfBrokerNodes,
                kafkaVersion: provisioned.CurrentBrokerSoftwareInfo?.KafkaVersion,
                enhancedMonitoring: provisioned.EnhancedMonitoring,
                encryptionInTransit: provisioned.EncryptionInfo?.EncryptionInTransit?.ClientBroker,
                zookeeperConnectString: provisioned.ZookeeperConnectString,
              } : undefined,
              serverless: serverless ? {
                vpcConfigs: serverless.VpcConfigs?.map(v => ({
                  subnetIds: v.SubnetIds,
                  securityGroupIds: v.SecurityGroupIds,
                })),
              } : undefined,
            }, tags, cluster.CreationTime?.toISOString()));
          }
        }
        nextToken = response.NextToken;
      } while (nextToken);
    } catch (error) { errors.push(this.createError('ListClustersV2', error)); }

    return { resources, errors };
  }
}

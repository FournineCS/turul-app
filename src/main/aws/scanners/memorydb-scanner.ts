// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  DescribeClustersCommand,
  ListTagsCommand,
} from '@aws-sdk/client-memorydb';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class MemoryDBScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'memorydb', 'memorydb');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getMemoryDBClient({ profile: this.config.profile, region: this.config.region });

    try {
      let nextToken: string | undefined;
      do {
        const response = await this.withRateLimit(() => client.send(new DescribeClustersCommand({ NextToken: nextToken })));
        if (response.Clusters) {
          for (const cluster of response.Clusters) {
            if (!cluster.ARN) continue;

            let tags: Record<string, string> = {};
            try {
              const tagsResp = await this.withRateLimit(() => client.send(new ListTagsCommand({ ResourceArn: cluster.ARN })));
              if (tagsResp.TagList) {
                for (const tag of tagsResp.TagList) {
                  if (tag.Key) tags[tag.Key] = tag.Value || '';
                }
              }
            } catch { /* ignore */ }

            resources.push(this.createResource(cluster.ARN, 'cluster', cluster.Name || '', {
              clusterName: cluster.Name,
              status: cluster.Status,
              nodeType: cluster.NodeType,
              numberOfShards: cluster.NumberOfShards,
              engineVersion: cluster.EngineVersion,
              enginePatchVersion: cluster.EnginePatchVersion,
              snapshotWindow: cluster.SnapshotWindow,
              maintenanceWindow: cluster.MaintenanceWindow,
              snapshotRetentionLimit: cluster.SnapshotRetentionLimit,
              endpoint: cluster.ClusterEndpoint ? {
                address: cluster.ClusterEndpoint.Address,
                port: cluster.ClusterEndpoint.Port,
              } : undefined,
              subnetGroupName: cluster.SubnetGroupName,
              securityGroups: cluster.SecurityGroups?.map(sg => ({
                securityGroupId: sg.SecurityGroupId,
                status: sg.Status,
              })),
              parameterGroupName: cluster.ParameterGroupName,
              parameterGroupStatus: cluster.ParameterGroupStatus,
              tlsEnabled: cluster.TLSEnabled,
              aclName: cluster.ACLName,
              snsTopicArn: cluster.SnsTopicArn,
              snsTopicStatus: cluster.SnsTopicStatus,
              autoMinorVersionUpgrade: cluster.AutoMinorVersionUpgrade,
              dataTiering: cluster.DataTiering,
            }, tags));
          }
        }
        nextToken = response.NextToken;
      } while (nextToken);
    } catch (error) { errors.push(this.createError('DescribeClusters', error)); }

    return { resources, errors };
  }
}

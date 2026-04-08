// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  DescribeCacheClustersCommand,
  DescribeReplicationGroupsCommand,
  ListTagsForResourceCommand,
  type CacheCluster,
  type ReplicationGroup,
} from '@aws-sdk/client-elasticache';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class ElastiCacheScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'elasticache', 'elasticache');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getElastiCacheClient({
      profile: this.config.profile,
      region: this.config.region,
    });

    // Scan cache clusters
    try {
      let marker: string | undefined;

      do {
        const response = await this.withRateLimit(() =>
          client.send(
            new DescribeCacheClustersCommand({
              Marker: marker,
              ShowCacheNodeInfo: true,
            })
          )
        );

        if (response.CacheClusters) {
          for (const cluster of response.CacheClusters) {
            // Get tags
            let tags: Record<string, string> = {};
            try {
              const tagsResponse = await this.withRateLimit(() =>
                client.send(
                  new ListTagsForResourceCommand({
                    ResourceName: cluster.ARN,
                  })
                )
              );
              tags = this.parseTags(tagsResponse.TagList);
            } catch {
              // Ignore tag errors
            }

            resources.push(this.mapCacheCluster(cluster, tags));
          }
        }

        marker = response.Marker;
      } while (marker);
    } catch (error) {
      errors.push(this.createError('DescribeCacheClusters', error));
    }

    // Scan replication groups (Redis clusters)
    try {
      let marker: string | undefined;

      do {
        const response = await this.withRateLimit(() =>
          client.send(
            new DescribeReplicationGroupsCommand({
              Marker: marker,
            })
          )
        );

        if (response.ReplicationGroups) {
          for (const group of response.ReplicationGroups) {
            // Get tags
            let tags: Record<string, string> = {};
            try {
              const tagsResponse = await this.withRateLimit(() =>
                client.send(
                  new ListTagsForResourceCommand({
                    ResourceName: group.ARN,
                  })
                )
              );
              tags = this.parseTags(tagsResponse.TagList);
            } catch {
              // Ignore tag errors
            }

            resources.push(this.mapReplicationGroup(group, tags));
          }
        }

        marker = response.Marker;
      } while (marker);
    } catch (error) {
      errors.push(this.createError('DescribeReplicationGroups', error));
    }

    return { resources, errors };
  }

  private mapCacheCluster(
    cluster: CacheCluster,
    tags: Record<string, string>
  ): Resource {
    return this.createResource(
      cluster.ARN || '',
      'cache-cluster',
      cluster.CacheClusterId || '',
      {
        cacheClusterId: cluster.CacheClusterId,
        arn: cluster.ARN,
        cacheClusterStatus: cluster.CacheClusterStatus,
        engine: cluster.Engine,
        engineVersion: cluster.EngineVersion,
        cacheNodeType: cluster.CacheNodeType,
        numCacheNodes: cluster.NumCacheNodes,
        preferredAvailabilityZone: cluster.PreferredAvailabilityZone,
        preferredMaintenanceWindow: cluster.PreferredMaintenanceWindow,
        cacheSubnetGroupName: cluster.CacheSubnetGroupName,
        cacheParameterGroup: cluster.CacheParameterGroup?.CacheParameterGroupName,
        securityGroups: cluster.SecurityGroups?.map((sg) => ({
          securityGroupId: sg.SecurityGroupId,
          status: sg.Status,
        })),
        replicationGroupId: cluster.ReplicationGroupId,
        snapshotRetentionLimit: cluster.SnapshotRetentionLimit,
        snapshotWindow: cluster.SnapshotWindow,
        authTokenEnabled: cluster.AuthTokenEnabled,
        transitEncryptionEnabled: cluster.TransitEncryptionEnabled,
        atRestEncryptionEnabled: cluster.AtRestEncryptionEnabled,
        networkType: cluster.NetworkType,
        ipDiscovery: cluster.IpDiscovery,
        cacheNodes: cluster.CacheNodes?.map((node) => ({
          cacheNodeId: node.CacheNodeId,
          cacheNodeStatus: node.CacheNodeStatus,
          cacheNodeCreateTime: node.CacheNodeCreateTime?.toISOString(),
          endpoint: node.Endpoint
            ? {
                address: node.Endpoint.Address,
                port: node.Endpoint.Port,
              }
            : undefined,
          parameterGroupStatus: node.ParameterGroupStatus,
          customerAvailabilityZone: node.CustomerAvailabilityZone,
        })),
        configurationEndpoint: cluster.ConfigurationEndpoint
          ? {
              address: cluster.ConfigurationEndpoint.Address,
              port: cluster.ConfigurationEndpoint.Port,
            }
          : undefined,
        autoMinorVersionUpgrade: cluster.AutoMinorVersionUpgrade,
        cacheClusterCreateTime: cluster.CacheClusterCreateTime?.toISOString(),
      },
      tags,
      cluster.CacheClusterCreateTime?.toISOString()
    );
  }

  private mapReplicationGroup(
    group: ReplicationGroup,
    tags: Record<string, string>
  ): Resource {
    return this.createResource(
      group.ARN || '',
      'replication-group',
      group.ReplicationGroupId || '',
      {
        replicationGroupId: group.ReplicationGroupId,
        arn: group.ARN,
        description: group.Description,
        status: group.Status,
        globalReplicationGroupInfo: group.GlobalReplicationGroupInfo
          ? {
              globalReplicationGroupId:
                group.GlobalReplicationGroupInfo.GlobalReplicationGroupId,
              globalReplicationGroupMemberRole:
                group.GlobalReplicationGroupInfo.GlobalReplicationGroupMemberRole,
            }
          : undefined,
        memberClusters: group.MemberClusters,
        nodeGroups: group.NodeGroups?.map((ng) => ({
          nodeGroupId: ng.NodeGroupId,
          status: ng.Status,
          primaryEndpoint: ng.PrimaryEndpoint
            ? {
                address: ng.PrimaryEndpoint.Address,
                port: ng.PrimaryEndpoint.Port,
              }
            : undefined,
          readerEndpoint: ng.ReaderEndpoint
            ? {
                address: ng.ReaderEndpoint.Address,
                port: ng.ReaderEndpoint.Port,
              }
            : undefined,
          slots: ng.Slots,
          nodeGroupMembers: ng.NodeGroupMembers?.map((m) => ({
            cacheClusterId: m.CacheClusterId,
            cacheNodeId: m.CacheNodeId,
            currentRole: m.CurrentRole,
            preferredAvailabilityZone: m.PreferredAvailabilityZone,
          })),
        })),
        snapshottingClusterId: group.SnapshottingClusterId,
        automaticFailover: group.AutomaticFailover,
        multiAZ: group.MultiAZ,
        configurationEndpoint: group.ConfigurationEndpoint
          ? {
              address: group.ConfigurationEndpoint.Address,
              port: group.ConfigurationEndpoint.Port,
            }
          : undefined,
        snapshotRetentionLimit: group.SnapshotRetentionLimit,
        snapshotWindow: group.SnapshotWindow,
        clusterEnabled: group.ClusterEnabled,
        cacheNodeType: group.CacheNodeType,
        authTokenEnabled: group.AuthTokenEnabled,
        transitEncryptionEnabled: group.TransitEncryptionEnabled,
        atRestEncryptionEnabled: group.AtRestEncryptionEnabled,
        kmsKeyId: group.KmsKeyId,
        dataTiering: group.DataTiering,
        networkType: group.NetworkType,
        ipDiscovery: group.IpDiscovery,
        clusterMode: group.ClusterMode,
      },
      tags
    );
  }
}

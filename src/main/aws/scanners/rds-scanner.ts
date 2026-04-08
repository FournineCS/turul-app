// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  DescribeDBInstancesCommand,
  DescribeDBClustersCommand,
  DescribeDBSubnetGroupsCommand,
  ListTagsForResourceCommand,
  type DBInstance,
  type DBCluster,
  type DBSubnetGroup,
} from '@aws-sdk/client-rds';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class RDSScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'rds', 'rds');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];

    // Scan DB instances, clusters, and subnet groups in parallel
    const [instancesResult, clustersResult, subnetGroupsResult] = await Promise.allSettled([
      this.scanDBInstances(),
      this.scanDBClusters(),
      this.scanDBSubnetGroups(),
    ]);

    if (instancesResult.status === 'fulfilled') {
      resources.push(...instancesResult.value.resources);
      errors.push(...instancesResult.value.errors);
    } else {
      errors.push(this.createError('DescribeDBInstances', instancesResult.reason));
    }

    if (clustersResult.status === 'fulfilled') {
      resources.push(...clustersResult.value.resources);
      errors.push(...clustersResult.value.errors);
    } else {
      errors.push(this.createError('DescribeDBClusters', clustersResult.reason));
    }

    if (subnetGroupsResult.status === 'fulfilled') {
      resources.push(...subnetGroupsResult.value.resources);
      errors.push(...subnetGroupsResult.value.errors);
    } else {
      errors.push(this.createError('DescribeDBSubnetGroups', subnetGroupsResult.reason));
    }

    return { resources, errors };
  }

  private async scanDBInstances(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getRDSClient({
      profile: this.config.profile,
      region: this.config.region,
    });

    try {
      let marker: string | undefined;

      do {
        const response = await this.withRateLimit(() =>
          client.send(new DescribeDBInstancesCommand({ Marker: marker }))
        );

        if (response.DBInstances) {
          for (const instance of response.DBInstances) {
            const tags = await this.getResourceTags(instance.DBInstanceArn);
            resources.push(this.mapDBInstance(instance, tags));
          }
        }

        marker = response.Marker;
      } while (marker);
    } catch (error) {
      errors.push(this.createError('DescribeDBInstances', error));
    }

    return { resources, errors };
  }

  private async scanDBClusters(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getRDSClient({
      profile: this.config.profile,
      region: this.config.region,
    });

    try {
      let marker: string | undefined;

      do {
        const response = await this.withRateLimit(() =>
          client.send(new DescribeDBClustersCommand({ Marker: marker }))
        );

        if (response.DBClusters) {
          for (const cluster of response.DBClusters) {
            const tags = await this.getResourceTags(cluster.DBClusterArn);
            resources.push(this.mapDBCluster(cluster, tags));
          }
        }

        marker = response.Marker;
      } while (marker);
    } catch (error) {
      errors.push(this.createError('DescribeDBClusters', error));
    }

    return { resources, errors };
  }

  private async scanDBSubnetGroups(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getRDSClient({
      profile: this.config.profile,
      region: this.config.region,
    });

    try {
      let marker: string | undefined;

      do {
        const response = await this.withRateLimit(() =>
          client.send(new DescribeDBSubnetGroupsCommand({ Marker: marker }))
        );

        if (response.DBSubnetGroups) {
          for (const group of response.DBSubnetGroups) {
            resources.push(this.mapDBSubnetGroup(group));
          }
        }

        marker = response.Marker;
      } while (marker);
    } catch (error) {
      errors.push(this.createError('DescribeDBSubnetGroups', error));
    }

    return { resources, errors };
  }

  private async getResourceTags(arn?: string): Promise<Record<string, string>> {
    if (!arn) return {};

    const client = getClientFactory().getRDSClient({
      profile: this.config.profile,
      region: this.config.region,
    });

    try {
      const response = await this.withRateLimit(() =>
        client.send(new ListTagsForResourceCommand({ ResourceName: arn }))
      );

      return this.parseTags(response.TagList);
    } catch {
      return {};
    }
  }

  private mapDBInstance(instance: DBInstance, tags: Record<string, string>): Resource {
    return this.createResource(
      instance.DBInstanceArn || '',
      'db-instance',
      instance.DBInstanceIdentifier || '',
      {
        dbInstanceIdentifier: instance.DBInstanceIdentifier,
        dbInstanceClass: instance.DBInstanceClass,
        engine: instance.Engine,
        engineVersion: instance.EngineVersion,
        dbInstanceStatus: instance.DBInstanceStatus,
        masterUsername: instance.MasterUsername,
        allocatedStorage: instance.AllocatedStorage,
        endpoint: instance.Endpoint
          ? {
              address: instance.Endpoint.Address,
              port: instance.Endpoint.Port,
              hostedZoneId: instance.Endpoint.HostedZoneId,
            }
          : undefined,
        availabilityZone: instance.AvailabilityZone,
        multiAZ: instance.MultiAZ,
        publiclyAccessible: instance.PubliclyAccessible,
        storageType: instance.StorageType,
        storageEncrypted: instance.StorageEncrypted,
        vpcSecurityGroups: instance.VpcSecurityGroups?.map((sg) => ({
          vpcSecurityGroupId: sg.VpcSecurityGroupId,
          status: sg.Status,
        })),
        dbSubnetGroup: instance.DBSubnetGroup?.DBSubnetGroupName,
        dbClusterIdentifier: instance.DBClusterIdentifier,
        iamDatabaseAuthenticationEnabled: instance.IAMDatabaseAuthenticationEnabled,
        performanceInsightsEnabled: instance.PerformanceInsightsEnabled,
        deletionProtection: instance.DeletionProtection,
      },
      tags,
      instance.InstanceCreateTime?.toISOString()
    );
  }

  private mapDBCluster(cluster: DBCluster, tags: Record<string, string>): Resource {
    return this.createResource(
      cluster.DBClusterArn || '',
      'db-cluster',
      cluster.DBClusterIdentifier || '',
      {
        dbClusterIdentifier: cluster.DBClusterIdentifier,
        engine: cluster.Engine,
        engineVersion: cluster.EngineVersion,
        engineMode: cluster.EngineMode,
        status: cluster.Status,
        masterUsername: cluster.MasterUsername,
        endpoint: cluster.Endpoint,
        readerEndpoint: cluster.ReaderEndpoint,
        port: cluster.Port,
        availabilityZones: cluster.AvailabilityZones,
        multiAZ: cluster.MultiAZ,
        storageEncrypted: cluster.StorageEncrypted,
        vpcSecurityGroups: cluster.VpcSecurityGroups?.map((sg) => ({
          vpcSecurityGroupId: sg.VpcSecurityGroupId,
          status: sg.Status,
        })),
        dbSubnetGroup: cluster.DBSubnetGroup,
        dbClusterMembers: cluster.DBClusterMembers?.map((member) => ({
          dbInstanceIdentifier: member.DBInstanceIdentifier,
          isClusterWriter: member.IsClusterWriter,
        })),
        iamDatabaseAuthenticationEnabled: cluster.IAMDatabaseAuthenticationEnabled,
        deletionProtection: cluster.DeletionProtection,
        allocatedStorage: cluster.AllocatedStorage,
      },
      tags,
      cluster.ClusterCreateTime?.toISOString()
    );
  }

  private mapDBSubnetGroup(group: DBSubnetGroup): Resource {
    const arn = group.DBSubnetGroupArn || '';

    return this.createResource(
      arn,
      'db-subnet-group',
      group.DBSubnetGroupName || '',
      {
        dbSubnetGroupName: group.DBSubnetGroupName,
        dbSubnetGroupDescription: group.DBSubnetGroupDescription,
        vpcId: group.VpcId,
        subnetGroupStatus: group.SubnetGroupStatus,
        subnets: group.Subnets?.map((subnet) => ({
          subnetIdentifier: subnet.SubnetIdentifier,
          subnetAvailabilityZone: subnet.SubnetAvailabilityZone?.Name,
          subnetStatus: subnet.SubnetStatus,
        })),
      },
      {}
    );
  }
}

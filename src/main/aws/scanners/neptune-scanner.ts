// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  DescribeDBClustersCommand,
  DescribeDBInstancesCommand,
  ListTagsForResourceCommand,
  type DBCluster,
  type DBInstance,
} from '@aws-sdk/client-neptune';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class NeptuneScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'neptune', 'neptune');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];

    // Scan DB clusters and DB instances in parallel
    const [clustersResult, instancesResult] = await Promise.allSettled([
      this.scanDBClusters(),
      this.scanDBInstances(),
    ]);

    if (clustersResult.status === 'fulfilled') {
      resources.push(...clustersResult.value.resources);
      errors.push(...clustersResult.value.errors);
    } else {
      errors.push(this.createError('DescribeDBClusters', clustersResult.reason));
    }

    if (instancesResult.status === 'fulfilled') {
      resources.push(...instancesResult.value.resources);
      errors.push(...instancesResult.value.errors);
    } else {
      errors.push(this.createError('DescribeDBInstances', instancesResult.reason));
    }

    return { resources, errors };
  }

  private async scanDBClusters(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getNeptuneClient({
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
            if (!cluster.Engine?.startsWith('neptune')) continue;

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

  private async scanDBInstances(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getNeptuneClient({
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
            if (!instance.Engine?.startsWith('neptune')) continue;

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

  private async getResourceTags(arn?: string): Promise<Record<string, string>> {
    if (!arn) return {};

    const client = getClientFactory().getNeptuneClient({
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

  private mapDBCluster(cluster: DBCluster, tags: Record<string, string>): Resource {
    return this.createResource(
      cluster.DBClusterArn || '',
      'db-cluster',
      cluster.DBClusterIdentifier || '',
      {
        dbClusterIdentifier: cluster.DBClusterIdentifier,
        engine: cluster.Engine,
        engineVersion: cluster.EngineVersion,
        status: cluster.Status,
        endpoint: cluster.Endpoint,
        readerEndpoint: cluster.ReaderEndpoint,
        port: cluster.Port,
        multiAZ: cluster.MultiAZ,
        availabilityZones: cluster.AvailabilityZones,
        allocatedStorage: cluster.AllocatedStorage,
        storageEncrypted: cluster.StorageEncrypted,
        kmsKeyId: cluster.KmsKeyId,
        storageType: cluster.StorageType,
        backupRetentionPeriod: cluster.BackupRetentionPeriod,
        preferredBackupWindow: cluster.PreferredBackupWindow,
        preferredMaintenanceWindow: cluster.PreferredMaintenanceWindow,
        dbSubnetGroup: cluster.DBSubnetGroup,
        dbClusterParameterGroup: cluster.DBClusterParameterGroup,
        vpcSecurityGroups: cluster.VpcSecurityGroups?.map((sg) => ({
          vpcSecurityGroupId: sg.VpcSecurityGroupId,
          status: sg.Status,
        })),
        dbClusterMembers: cluster.DBClusterMembers?.map((member) => ({
          dbInstanceIdentifier: member.DBInstanceIdentifier,
          isClusterWriter: member.IsClusterWriter,
          promotionTier: member.PromotionTier,
        })),
        associatedRoles: cluster.AssociatedRoles?.map((role) => ({
          roleArn: role.RoleArn,
          status: role.Status,
          featureName: role.FeatureName,
        })),
        iamDatabaseAuthenticationEnabled: cluster.IAMDatabaseAuthenticationEnabled,
        deletionProtection: cluster.DeletionProtection,
        copyTagsToSnapshot: cluster.CopyTagsToSnapshot,
        enabledCloudwatchLogsExports: cluster.EnabledCloudwatchLogsExports,
        serverlessV2ScalingConfiguration: cluster.ServerlessV2ScalingConfiguration
          ? {
              minCapacity: cluster.ServerlessV2ScalingConfiguration.MinCapacity,
              maxCapacity: cluster.ServerlessV2ScalingConfiguration.MaxCapacity,
            }
          : undefined,
        globalClusterIdentifier: cluster.GlobalClusterIdentifier,
        dbClusterResourceId: cluster.DbClusterResourceId,
      },
      tags,
      cluster.ClusterCreateTime?.toISOString()
    );
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
        endpoint: instance.Endpoint
          ? {
              address: instance.Endpoint.Address,
              port: instance.Endpoint.Port,
              hostedZoneId: instance.Endpoint.HostedZoneId,
            }
          : undefined,
        allocatedStorage: instance.AllocatedStorage,
        availabilityZone: instance.AvailabilityZone,
        multiAZ: instance.MultiAZ,
        publiclyAccessible: instance.PubliclyAccessible,
        storageType: instance.StorageType,
        storageEncrypted: instance.StorageEncrypted,
        kmsKeyId: instance.KmsKeyId,
        dbClusterIdentifier: instance.DBClusterIdentifier,
        dbSubnetGroup: instance.DBSubnetGroup?.DBSubnetGroupName,
        vpcSecurityGroups: instance.VpcSecurityGroups?.map((sg) => ({
          vpcSecurityGroupId: sg.VpcSecurityGroupId,
          status: sg.Status,
        })),
        iamDatabaseAuthenticationEnabled: instance.IAMDatabaseAuthenticationEnabled,
        performanceInsightsEnabled: instance.PerformanceInsightsEnabled,
        deletionProtection: instance.DeletionProtection,
        autoMinorVersionUpgrade: instance.AutoMinorVersionUpgrade,
        promotionTier: instance.PromotionTier,
        monitoringInterval: instance.MonitoringInterval,
        enhancedMonitoringResourceArn: instance.EnhancedMonitoringResourceArn,
        enabledCloudwatchLogsExports: instance.EnabledCloudwatchLogsExports,
        dbiResourceId: instance.DbiResourceId,
        caCertificateIdentifier: instance.CACertificateIdentifier,
      },
      tags,
      instance.InstanceCreateTime?.toISOString()
    );
  }
}

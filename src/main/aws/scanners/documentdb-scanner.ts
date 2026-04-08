// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  DescribeDBClustersCommand,
  DescribeDBInstancesCommand,
  ListTagsForResourceCommand,
} from '@aws-sdk/client-docdb';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class DocumentDBScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'documentdb', 'documentdb');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getDocDBClient({ profile: this.config.profile, region: this.config.region });

    // Scan DocumentDB clusters
    try {
      let marker: string | undefined;
      do {
        const response = await this.withRateLimit(() =>
          client.send(new DescribeDBClustersCommand({
            Marker: marker,
            Filters: [{ Name: 'engine', Values: ['docdb'] }],
          }))
        );

        if (response.DBClusters) {
          for (const cluster of response.DBClusters) {
            if (!cluster.DBClusterArn) continue;

            let tags: Record<string, string> = {};
            try {
              const tagsResp = await this.withRateLimit(() =>
                client.send(new ListTagsForResourceCommand({ ResourceName: cluster.DBClusterArn }))
              );
              tags = this.parseTags(tagsResp.TagList);
            } catch { /* ignore */ }

            resources.push(this.createResource(
              cluster.DBClusterArn,
              'docdb-cluster',
              cluster.DBClusterIdentifier || '',
              {
                dbClusterIdentifier: cluster.DBClusterIdentifier,
                engine: cluster.Engine,
                engineVersion: cluster.EngineVersion,
                status: cluster.Status,
                endpoint: cluster.Endpoint,
                readerEndpoint: cluster.ReaderEndpoint,
                port: cluster.Port,
                masterUsername: cluster.MasterUsername,
                availabilityZones: cluster.AvailabilityZones,
                multiAZ: cluster.MultiAZ,
                storageEncrypted: cluster.StorageEncrypted,
                kmsKeyId: cluster.KmsKeyId,
                dbSubnetGroup: cluster.DBSubnetGroup,
                vpcSecurityGroups: cluster.VpcSecurityGroups?.map((sg) => ({
                  vpcSecurityGroupId: sg.VpcSecurityGroupId,
                  status: sg.Status,
                })),
                dbClusterMembers: cluster.DBClusterMembers?.map((member) => ({
                  dbInstanceIdentifier: member.DBInstanceIdentifier,
                  isClusterWriter: member.IsClusterWriter,
                })),
                backupRetentionPeriod: cluster.BackupRetentionPeriod,
                preferredBackupWindow: cluster.PreferredBackupWindow,
                preferredMaintenanceWindow: cluster.PreferredMaintenanceWindow,
                deletionProtection: cluster.DeletionProtection,
              },
              tags,
              cluster.ClusterCreateTime?.toISOString(),
            ));
          }
        }

        marker = response.Marker;
      } while (marker);
    } catch (error) {
      errors.push(this.createError('DescribeDBClusters', error));
    }

    // Scan DocumentDB instances
    try {
      let marker: string | undefined;
      do {
        const response = await this.withRateLimit(() =>
          client.send(new DescribeDBInstancesCommand({
            Marker: marker,
            Filters: [{ Name: 'engine', Values: ['docdb'] }],
          }))
        );

        if (response.DBInstances) {
          for (const instance of response.DBInstances) {
            if (!instance.DBInstanceArn) continue;

            let tags: Record<string, string> = {};
            try {
              const tagsResp = await this.withRateLimit(() =>
                client.send(new ListTagsForResourceCommand({ ResourceName: instance.DBInstanceArn }))
              );
              tags = this.parseTags(tagsResp.TagList);
            } catch { /* ignore */ }

            resources.push(this.createResource(
              instance.DBInstanceArn,
              'docdb-instance',
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
                availabilityZone: instance.AvailabilityZone,
                dbSubnetGroup: instance.DBSubnetGroup?.DBSubnetGroupName,
                dbClusterIdentifier: instance.DBClusterIdentifier,
                storageEncrypted: instance.StorageEncrypted,
                kmsKeyId: instance.KmsKeyId,
                autoMinorVersionUpgrade: instance.AutoMinorVersionUpgrade,
                preferredMaintenanceWindow: instance.PreferredMaintenanceWindow,
                promotionTier: instance.PromotionTier,
                vpcSecurityGroups: instance.VpcSecurityGroups?.map((sg) => ({
                  vpcSecurityGroupId: sg.VpcSecurityGroupId,
                  status: sg.Status,
                })),
              },
              tags,
              instance.InstanceCreateTime?.toISOString(),
            ));
          }
        }

        marker = response.Marker;
      } while (marker);
    } catch (error) {
      errors.push(this.createError('DescribeDBInstances', error));
    }

    return { resources, errors };
  }
}

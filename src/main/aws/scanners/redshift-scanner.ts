// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  DescribeClustersCommand,
  type Cluster,
} from '@aws-sdk/client-redshift';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class RedshiftScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'redshift', 'redshift');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getRedshiftClient({
      profile: this.config.profile,
      region: this.config.region,
    });

    try {
      let marker: string | undefined;

      do {
        const response = await this.withRateLimit(() =>
          client.send(new DescribeClustersCommand({ Marker: marker }))
        );

        if (response.Clusters) {
          for (const cluster of response.Clusters) {
            resources.push(this.mapCluster(cluster));
          }
        }

        marker = response.Marker;
      } while (marker);
    } catch (error) {
      errors.push(this.createError('DescribeClusters', error));
    }

    return { resources, errors };
  }

  private mapCluster(cluster: Cluster): Resource {
    const tags = this.parseTags(cluster.Tags);
    const arn = `arn:aws:redshift:${this.config.region}:${cluster.ClusterIdentifier}:cluster:${cluster.ClusterIdentifier}`;

    return this.createResource(
      arn,
      'cluster',
      cluster.ClusterIdentifier || '',
      {
        clusterIdentifier: cluster.ClusterIdentifier,
        nodeType: cluster.NodeType,
        clusterStatus: cluster.ClusterStatus,
        clusterAvailabilityStatus: cluster.ClusterAvailabilityStatus,
        modifyStatus: cluster.ModifyStatus,
        masterUsername: cluster.MasterUsername,
        dbName: cluster.DBName,
        endpoint: cluster.Endpoint
          ? {
              address: cluster.Endpoint.Address,
              port: cluster.Endpoint.Port,
            }
          : undefined,
        clusterCreateTime: cluster.ClusterCreateTime?.toISOString(),
        automatedSnapshotRetentionPeriod: cluster.AutomatedSnapshotRetentionPeriod,
        manualSnapshotRetentionPeriod: cluster.ManualSnapshotRetentionPeriod,
        clusterSecurityGroups: cluster.ClusterSecurityGroups?.map((sg) => ({
          clusterSecurityGroupName: sg.ClusterSecurityGroupName,
          status: sg.Status,
        })),
        vpcSecurityGroups: cluster.VpcSecurityGroups?.map((sg) => ({
          vpcSecurityGroupId: sg.VpcSecurityGroupId,
          status: sg.Status,
        })),
        clusterParameterGroups: cluster.ClusterParameterGroups?.map((pg) => ({
          parameterGroupName: pg.ParameterGroupName,
          parameterApplyStatus: pg.ParameterApplyStatus,
        })),
        clusterSubnetGroupName: cluster.ClusterSubnetGroupName,
        vpcId: cluster.VpcId,
        availabilityZone: cluster.AvailabilityZone,
        preferredMaintenanceWindow: cluster.PreferredMaintenanceWindow,
        clusterVersion: cluster.ClusterVersion,
        allowVersionUpgrade: cluster.AllowVersionUpgrade,
        numberOfNodes: cluster.NumberOfNodes,
        publiclyAccessible: cluster.PubliclyAccessible,
        encrypted: cluster.Encrypted,
        kmsKeyId: cluster.KmsKeyId,
        enhancedVpcRouting: cluster.EnhancedVpcRouting,
        iamRoles: cluster.IamRoles?.map((r) => ({
          iamRoleArn: r.IamRoleArn,
          applyStatus: r.ApplyStatus,
        })),
        maintenanceTrackName: cluster.MaintenanceTrackName,
        elasticResizeNumberOfNodeOptions:
          cluster.ElasticResizeNumberOfNodeOptions,
        clusterNamespaceArn: cluster.ClusterNamespaceArn,
        totalStorageCapacityInMegaBytes:
          cluster.TotalStorageCapacityInMegaBytes,
        aquaConfiguration: cluster.AquaConfiguration
          ? {
              aquaStatus: cluster.AquaConfiguration.AquaStatus,
              aquaConfigurationStatus:
                cluster.AquaConfiguration.AquaConfigurationStatus,
            }
          : undefined,
        reservedNodeExchangeStatus: cluster.ReservedNodeExchangeStatus
          ? {
              reservedNodeExchangeRequestId:
                cluster.ReservedNodeExchangeStatus.ReservedNodeExchangeRequestId,
              status: cluster.ReservedNodeExchangeStatus.Status,
              requestTime:
                cluster.ReservedNodeExchangeStatus.RequestTime?.toISOString(),
            }
          : undefined,
      },
      tags,
      cluster.ClusterCreateTime?.toISOString()
    );
  }
}

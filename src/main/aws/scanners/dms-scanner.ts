// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  DescribeReplicationInstancesCommand,
  DescribeReplicationTasksCommand,
  DescribeEndpointsCommand,
  ListTagsForResourceCommand,
  type ReplicationInstance,
  type ReplicationTask,
  type Endpoint,
} from '@aws-sdk/client-database-migration-service';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class DMSScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'dms', 'dms');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];

    // Scan replication instances, replication tasks, and endpoints in parallel
    const [instancesResult, tasksResult, endpointsResult] = await Promise.allSettled([
      this.scanReplicationInstances(),
      this.scanReplicationTasks(),
      this.scanEndpoints(),
    ]);

    if (instancesResult.status === 'fulfilled') {
      resources.push(...instancesResult.value.resources);
      errors.push(...instancesResult.value.errors);
    } else {
      errors.push(this.createError('DescribeReplicationInstances', instancesResult.reason));
    }

    if (tasksResult.status === 'fulfilled') {
      resources.push(...tasksResult.value.resources);
      errors.push(...tasksResult.value.errors);
    } else {
      errors.push(this.createError('DescribeReplicationTasks', tasksResult.reason));
    }

    if (endpointsResult.status === 'fulfilled') {
      resources.push(...endpointsResult.value.resources);
      errors.push(...endpointsResult.value.errors);
    } else {
      errors.push(this.createError('DescribeEndpoints', endpointsResult.reason));
    }

    return { resources, errors };
  }

  private async scanReplicationInstances(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getDMSClient({
      profile: this.config.profile,
      region: this.config.region,
    });

    try {
      let marker: string | undefined;

      do {
        const response = await this.withRateLimit(() =>
          client.send(new DescribeReplicationInstancesCommand({ Marker: marker }))
        );

        if (response.ReplicationInstances) {
          for (const instance of response.ReplicationInstances) {
            const tags = await this.getResourceTags(instance.ReplicationInstanceArn);
            resources.push(this.mapReplicationInstance(instance, tags));
          }
        }

        marker = response.Marker;
      } while (marker);
    } catch (error) {
      errors.push(this.createError('DescribeReplicationInstances', error));
    }

    return { resources, errors };
  }

  private async scanReplicationTasks(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getDMSClient({
      profile: this.config.profile,
      region: this.config.region,
    });

    try {
      let marker: string | undefined;

      do {
        const response = await this.withRateLimit(() =>
          client.send(new DescribeReplicationTasksCommand({ Marker: marker }))
        );

        if (response.ReplicationTasks) {
          for (const task of response.ReplicationTasks) {
            const tags = await this.getResourceTags(task.ReplicationTaskArn);
            resources.push(this.mapReplicationTask(task, tags));
          }
        }

        marker = response.Marker;
      } while (marker);
    } catch (error) {
      errors.push(this.createError('DescribeReplicationTasks', error));
    }

    return { resources, errors };
  }

  private async scanEndpoints(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getDMSClient({
      profile: this.config.profile,
      region: this.config.region,
    });

    try {
      let marker: string | undefined;

      do {
        const response = await this.withRateLimit(() =>
          client.send(new DescribeEndpointsCommand({ Marker: marker }))
        );

        if (response.Endpoints) {
          for (const endpoint of response.Endpoints) {
            const tags = await this.getResourceTags(endpoint.EndpointArn);
            resources.push(this.mapEndpoint(endpoint, tags));
          }
        }

        marker = response.Marker;
      } while (marker);
    } catch (error) {
      errors.push(this.createError('DescribeEndpoints', error));
    }

    return { resources, errors };
  }

  private async getResourceTags(arn?: string): Promise<Record<string, string>> {
    if (!arn) return {};

    const client = getClientFactory().getDMSClient({
      profile: this.config.profile,
      region: this.config.region,
    });

    try {
      const response = await this.withRateLimit(() =>
        client.send(new ListTagsForResourceCommand({ ResourceArn: arn }))
      );

      return this.parseTags(response.TagList);
    } catch {
      return {};
    }
  }

  private mapReplicationInstance(
    instance: ReplicationInstance,
    tags: Record<string, string>
  ): Resource {
    return this.createResource(
      instance.ReplicationInstanceArn || '',
      'replication-instance',
      instance.ReplicationInstanceIdentifier || '',
      {
        replicationInstanceIdentifier: instance.ReplicationInstanceIdentifier,
        replicationInstanceClass: instance.ReplicationInstanceClass,
        replicationInstanceStatus: instance.ReplicationInstanceStatus,
        allocatedStorage: instance.AllocatedStorage,
        availabilityZone: instance.AvailabilityZone,
        replicationSubnetGroup: instance.ReplicationSubnetGroup
          ? {
              replicationSubnetGroupIdentifier:
                instance.ReplicationSubnetGroup.ReplicationSubnetGroupIdentifier,
              replicationSubnetGroupDescription:
                instance.ReplicationSubnetGroup.ReplicationSubnetGroupDescription,
              vpcId: instance.ReplicationSubnetGroup.VpcId,
              subnetGroupStatus: instance.ReplicationSubnetGroup.SubnetGroupStatus,
              subnets: instance.ReplicationSubnetGroup.Subnets?.map((s) => ({
                subnetIdentifier: s.SubnetIdentifier,
                subnetAvailabilityZone: s.SubnetAvailabilityZone?.Name,
                subnetStatus: s.SubnetStatus,
              })),
            }
          : undefined,
        preferredMaintenanceWindow: instance.PreferredMaintenanceWindow,
        multiAZ: instance.MultiAZ,
        engineVersion: instance.EngineVersion,
        autoMinorVersionUpgrade: instance.AutoMinorVersionUpgrade,
        kmsKeyId: instance.KmsKeyId,
        publiclyAccessible: instance.PubliclyAccessible,
        vpcSecurityGroups: instance.VpcSecurityGroups?.map((sg) => ({
          vpcSecurityGroupId: sg.VpcSecurityGroupId,
          status: sg.Status,
        })),
        instanceCreateTime: instance.InstanceCreateTime?.toISOString(),
        secondaryAvailabilityZone: instance.SecondaryAvailabilityZone,
        freeUntil: instance.FreeUntil?.toISOString(),
        dnsNameServers: instance.DnsNameServers,
        networkType: instance.NetworkType,
      },
      tags,
      instance.InstanceCreateTime?.toISOString()
    );
  }

  private mapReplicationTask(
    task: ReplicationTask,
    tags: Record<string, string>
  ): Resource {
    return this.createResource(
      task.ReplicationTaskArn || '',
      'replication-task',
      task.ReplicationTaskIdentifier || '',
      {
        replicationTaskIdentifier: task.ReplicationTaskIdentifier,
        sourceEndpointArn: task.SourceEndpointArn,
        targetEndpointArn: task.TargetEndpointArn,
        replicationInstanceArn: task.ReplicationInstanceArn,
        migrationType: task.MigrationType,
        tableMappings: task.TableMappings,
        replicationTaskSettings: task.ReplicationTaskSettings,
        status: task.Status,
        lastFailureMessage: task.LastFailureMessage,
        stopReason: task.StopReason,
        replicationTaskCreationDate: task.ReplicationTaskCreationDate?.toISOString(),
        replicationTaskStartDate: task.ReplicationTaskStartDate?.toISOString(),
        cdcStartPosition: task.CdcStartPosition,
        cdcStopPosition: task.CdcStopPosition,
        recoveryCheckpoint: task.RecoveryCheckpoint,
        replicationTaskStats: task.ReplicationTaskStats
          ? {
              fullLoadProgressPercent: task.ReplicationTaskStats.FullLoadProgressPercent,
              elapsedTimeMillis: task.ReplicationTaskStats.ElapsedTimeMillis,
              tablesLoaded: task.ReplicationTaskStats.TablesLoaded,
              tablesLoading: task.ReplicationTaskStats.TablesLoading,
              tablesQueued: task.ReplicationTaskStats.TablesQueued,
              tablesErrored: task.ReplicationTaskStats.TablesErrored,
              freshStartDate: task.ReplicationTaskStats.FreshStartDate?.toISOString(),
              startDate: task.ReplicationTaskStats.StartDate?.toISOString(),
              stopDate: task.ReplicationTaskStats.StopDate?.toISOString(),
              fullLoadStartDate: task.ReplicationTaskStats.FullLoadStartDate?.toISOString(),
              fullLoadFinishDate: task.ReplicationTaskStats.FullLoadFinishDate?.toISOString(),
            }
          : undefined,
        taskData: task.TaskData,
      },
      tags,
      task.ReplicationTaskCreationDate?.toISOString()
    );
  }

  private mapEndpoint(
    endpoint: Endpoint,
    tags: Record<string, string>
  ): Resource {
    return this.createResource(
      endpoint.EndpointArn || '',
      'endpoint',
      endpoint.EndpointIdentifier || '',
      {
        endpointIdentifier: endpoint.EndpointIdentifier,
        endpointType: endpoint.EndpointType,
        engineName: endpoint.EngineName,
        engineDisplayName: endpoint.EngineDisplayName,
        serverName: endpoint.ServerName,
        port: endpoint.Port,
        databaseName: endpoint.DatabaseName,
        username: endpoint.Username,
        status: endpoint.Status,
        kmsKeyId: endpoint.KmsKeyId,
        certificateArn: endpoint.CertificateArn,
        sslMode: endpoint.SslMode,
        serviceAccessRoleArn: endpoint.ServiceAccessRoleArn,
        externalTableDefinition: endpoint.ExternalTableDefinition,
        externalId: endpoint.ExternalId,
        extraConnectionAttributes: endpoint.ExtraConnectionAttributes,
        dynamoDbSettings: endpoint.DynamoDbSettings
          ? {
              serviceAccessRoleArn: endpoint.DynamoDbSettings.ServiceAccessRoleArn,
            }
          : undefined,
        s3Settings: endpoint.S3Settings
          ? {
              serviceAccessRoleArn: endpoint.S3Settings.ServiceAccessRoleArn,
              bucketName: endpoint.S3Settings.BucketName,
              bucketFolder: endpoint.S3Settings.BucketFolder,
              compressionType: endpoint.S3Settings.CompressionType,
              csvDelimiter: endpoint.S3Settings.CsvDelimiter,
              csvRowDelimiter: endpoint.S3Settings.CsvRowDelimiter,
              dataFormat: endpoint.S3Settings.DataFormat,
              parquetVersion: endpoint.S3Settings.ParquetVersion,
              encryptionMode: endpoint.S3Settings.EncryptionMode,
              cdcPath: endpoint.S3Settings.CdcPath,
            }
          : undefined,
        redshiftSettings: endpoint.RedshiftSettings
          ? {
              serverName: endpoint.RedshiftSettings.ServerName,
              port: endpoint.RedshiftSettings.Port,
              databaseName: endpoint.RedshiftSettings.DatabaseName,
              bucketName: endpoint.RedshiftSettings.BucketName,
              bucketFolder: endpoint.RedshiftSettings.BucketFolder,
              serviceAccessRoleArn: endpoint.RedshiftSettings.ServiceAccessRoleArn,
              encryptionMode: endpoint.RedshiftSettings.EncryptionMode,
            }
          : undefined,
        mysqlSettings: endpoint.MySQLSettings
          ? {
              serverName: endpoint.MySQLSettings.ServerName,
              port: endpoint.MySQLSettings.Port,
              databaseName: endpoint.MySQLSettings.DatabaseName,
              serverTimezone: endpoint.MySQLSettings.ServerTimezone,
            }
          : undefined,
        postgresSettings: endpoint.PostgreSQLSettings
          ? {
              serverName: endpoint.PostgreSQLSettings.ServerName,
              port: endpoint.PostgreSQLSettings.Port,
              databaseName: endpoint.PostgreSQLSettings.DatabaseName,
            }
          : undefined,
        microsoftSqlServerSettings: endpoint.MicrosoftSQLServerSettings
          ? {
              serverName: endpoint.MicrosoftSQLServerSettings.ServerName,
              port: endpoint.MicrosoftSQLServerSettings.Port,
              databaseName: endpoint.MicrosoftSQLServerSettings.DatabaseName,
            }
          : undefined,
        oracleSettings: endpoint.OracleSettings
          ? {
              serverName: endpoint.OracleSettings.ServerName,
              port: endpoint.OracleSettings.Port,
              databaseName: endpoint.OracleSettings.DatabaseName,
              asmServer: endpoint.OracleSettings.AsmServer,
            }
          : undefined,
        kafkaSettings: endpoint.KafkaSettings
          ? {
              broker: endpoint.KafkaSettings.Broker,
              topic: endpoint.KafkaSettings.Topic,
              messageFormat: endpoint.KafkaSettings.MessageFormat,
              securityProtocol: endpoint.KafkaSettings.SecurityProtocol,
            }
          : undefined,
        kinesisSettings: endpoint.KinesisSettings
          ? {
              streamArn: endpoint.KinesisSettings.StreamArn,
              messageFormat: endpoint.KinesisSettings.MessageFormat,
              serviceAccessRoleArn: endpoint.KinesisSettings.ServiceAccessRoleArn,
            }
          : undefined,
      },
      tags
    );
  }
}

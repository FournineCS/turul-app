// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  ListTablesCommand,
  DescribeTableCommand,
  ListTagsOfResourceCommand,
  type TableDescription,
} from '@aws-sdk/client-dynamodb';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class DynamoDBScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'dynamodb', 'dynamodb');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getDynamoDBClient({
      profile: this.config.profile,
      region: this.config.region,
    });

    try {
      const tableNames: string[] = [];
      let exclusiveStartTableName: string | undefined;

      do {
        const response = await this.withRateLimit(() =>
          client.send(
            new ListTablesCommand({
              ExclusiveStartTableName: exclusiveStartTableName,
            })
          )
        );

        if (response.TableNames) {
          tableNames.push(...response.TableNames);
        }

        exclusiveStartTableName = response.LastEvaluatedTableName;
      } while (exclusiveStartTableName);

      // Describe each table
      for (const tableName of tableNames) {
        try {
          const describeResponse = await this.withRateLimit(() =>
            client.send(new DescribeTableCommand({ TableName: tableName }))
          );

          if (describeResponse.Table) {
            // Get tags
            let tags: Record<string, string> = {};
            try {
              const tagsResponse = await this.withRateLimit(() =>
                client.send(
                  new ListTagsOfResourceCommand({
                    ResourceArn: describeResponse.Table!.TableArn,
                  })
                )
              );
              tags = this.parseTags(tagsResponse.Tags);
            } catch {
              // Ignore tag errors
            }

            resources.push(this.mapTable(describeResponse.Table, tags));
          }
        } catch (error) {
          errors.push(this.createError(`DescribeTable:${tableName}`, error));
        }
      }
    } catch (error) {
      errors.push(this.createError('ListTables', error));
    }

    return { resources, errors };
  }

  private mapTable(table: TableDescription, tags: Record<string, string>): Resource {
    return this.createResource(
      table.TableArn || '',
      'table',
      table.TableName || '',
      {
        tableName: table.TableName,
        tableArn: table.TableArn,
        tableId: table.TableId,
        tableStatus: table.TableStatus,
        tableSizeBytes: table.TableSizeBytes,
        itemCount: table.ItemCount,
        tableClass: table.TableClassSummary?.TableClass,
        billingModeSummary: table.BillingModeSummary
          ? {
              billingMode: table.BillingModeSummary.BillingMode,
              lastUpdateToPayPerRequestDateTime:
                table.BillingModeSummary.LastUpdateToPayPerRequestDateTime?.toISOString(),
            }
          : undefined,
        provisionedThroughput: table.ProvisionedThroughput
          ? {
              readCapacityUnits: table.ProvisionedThroughput.ReadCapacityUnits,
              writeCapacityUnits: table.ProvisionedThroughput.WriteCapacityUnits,
            }
          : undefined,
        keySchema: table.KeySchema?.map((k) => ({
          attributeName: k.AttributeName,
          keyType: k.KeyType,
        })),
        attributeDefinitions: table.AttributeDefinitions?.map((a) => ({
          attributeName: a.AttributeName,
          attributeType: a.AttributeType,
        })),
        globalSecondaryIndexes: table.GlobalSecondaryIndexes?.map((gsi) => ({
          indexName: gsi.IndexName,
          indexStatus: gsi.IndexStatus,
          keySchema: gsi.KeySchema?.map((k) => ({
            attributeName: k.AttributeName,
            keyType: k.KeyType,
          })),
          projection: gsi.Projection?.ProjectionType,
          itemCount: gsi.ItemCount,
          indexSizeBytes: gsi.IndexSizeBytes,
        })),
        localSecondaryIndexes: table.LocalSecondaryIndexes?.map((lsi) => ({
          indexName: lsi.IndexName,
          keySchema: lsi.KeySchema?.map((k) => ({
            attributeName: k.AttributeName,
            keyType: k.KeyType,
          })),
          projection: lsi.Projection?.ProjectionType,
          itemCount: lsi.ItemCount,
          indexSizeBytes: lsi.IndexSizeBytes,
        })),
        streamSpecification: table.StreamSpecification
          ? {
              streamEnabled: table.StreamSpecification.StreamEnabled,
              streamViewType: table.StreamSpecification.StreamViewType,
            }
          : undefined,
        latestStreamArn: table.LatestStreamArn,
        latestStreamLabel: table.LatestStreamLabel,
        globalTableVersion: table.GlobalTableVersion,
        replicas: table.Replicas?.map((r) => ({
          regionName: r.RegionName,
          replicaStatus: r.ReplicaStatus,
        })),
        restoreSummary: table.RestoreSummary
          ? {
              sourceBackupArn: table.RestoreSummary.SourceBackupArn,
              sourceTableArn: table.RestoreSummary.SourceTableArn,
              restoreDateTime: table.RestoreSummary.RestoreDateTime?.toISOString(),
              restoreInProgress: table.RestoreSummary.RestoreInProgress,
            }
          : undefined,
        sseDescription: table.SSEDescription
          ? {
              status: table.SSEDescription.Status,
              sseType: table.SSEDescription.SSEType,
              kmsMasterKeyArn: table.SSEDescription.KMSMasterKeyArn,
            }
          : undefined,
        deletionProtectionEnabled: table.DeletionProtectionEnabled,
        creationDateTime: table.CreationDateTime?.toISOString(),
      },
      tags,
      table.CreationDateTime?.toISOString()
    );
  }
}

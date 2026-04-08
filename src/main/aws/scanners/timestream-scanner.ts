// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  ListDatabasesCommand,
  ListTablesCommand,
  DescribeTableCommand,
  ListTagsForResourceCommand,
} from '@aws-sdk/client-timestream-write';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class TimestreamScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'timestream', 'timestream');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getTimestreamWriteClient({ profile: this.config.profile, region: this.config.region });

    try {
      let dbNextToken: string | undefined;
      do {
        const dbResponse = await this.withRateLimit(() => client.send(new ListDatabasesCommand({ NextToken: dbNextToken })));
        if (dbResponse.Databases) {
          for (const database of dbResponse.Databases) {
            if (!database.Arn || !database.DatabaseName) continue;

            // Scan tables within each database
            try {
              let tableNextToken: string | undefined;
              do {
                const tableResponse = await this.withRateLimit(() => client.send(new ListTablesCommand({
                  DatabaseName: database.DatabaseName,
                  NextToken: tableNextToken,
                })));
                if (tableResponse.Tables) {
                  for (const table of tableResponse.Tables) {
                    if (!table.Arn || !table.TableName) continue;

                    let details: any = {};
                    try {
                      const descResp = await this.withRateLimit(() => client.send(new DescribeTableCommand({
                        DatabaseName: database.DatabaseName,
                        TableName: table.TableName,
                      })));
                      const desc = descResp.Table;
                      if (desc) {
                        details = {
                          databaseName: desc.DatabaseName,
                          tableName: desc.TableName,
                          tableStatus: desc.TableStatus,
                          retentionProperties: desc.RetentionProperties ? {
                            memoryStoreRetentionPeriodInHours: desc.RetentionProperties.MemoryStoreRetentionPeriodInHours,
                            magneticStoreRetentionPeriodInDays: desc.RetentionProperties.MagneticStoreRetentionPeriodInDays,
                          } : undefined,
                          magneticStoreWriteProperties: desc.MagneticStoreWriteProperties ? {
                            enableMagneticStoreWrites: desc.MagneticStoreWriteProperties.EnableMagneticStoreWrites,
                          } : undefined,
                          schema: desc.Schema,
                        };
                      }
                    } catch { /* ignore */ }

                    let tags: Record<string, string> = {};
                    try {
                      const tagsResp = await this.withRateLimit(() => client.send(new ListTagsForResourceCommand({ ResourceARN: table.Arn })));
                      if (tagsResp.Tags) {
                        for (const tag of tagsResp.Tags) {
                          if (tag.Key) tags[tag.Key] = tag.Value || '';
                        }
                      }
                    } catch { /* ignore */ }

                    resources.push(this.createResource(table.Arn, 'table', table.TableName, {
                      databaseName: database.DatabaseName,
                      tableName: table.TableName,
                      tableStatus: table.TableStatus,
                      ...details,
                    }, tags, table.CreationTime?.toISOString()));
                  }
                }
                tableNextToken = tableResponse.NextToken;
              } while (tableNextToken);
            } catch (error) { errors.push(this.createError('ListTables', error)); }
          }
        }
        dbNextToken = dbResponse.NextToken;
      } while (dbNextToken);
    } catch (error) { errors.push(this.createError('ListDatabases', error)); }

    return { resources, errors };
  }
}

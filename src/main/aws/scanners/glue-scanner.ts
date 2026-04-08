// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  GetDatabasesCommand,
  GetTablesCommand,
  GetJobsCommand,
  GetCrawlersCommand,
  type Database,
  type Table,
  type Job,
  type Crawler,
  type GetDatabasesCommandOutput,
  type GetTablesCommandOutput,
  type GetJobsCommandOutput,
  type GetCrawlersCommandOutput,
} from '@aws-sdk/client-glue';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class GlueScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'glue', 'glue');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getGlueClient({
      profile: this.config.profile,
      region: this.config.region,
    });

    // Scan databases
    try {
      const databases = await this.getDatabases(client);
      for (const database of databases) {
        resources.push(this.mapDatabase(database));

        // Get tables for each database
        const tables = await this.getTables(client, database.Name!);
        for (const table of tables) {
          resources.push(this.mapTable(table, database.Name!));
        }
      }
    } catch (error) {
      errors.push(this.createError('GetDatabases', error));
    }

    // Scan jobs
    try {
      const jobs = await this.getJobs(client);
      for (const job of jobs) {
        resources.push(this.mapJob(job));
      }
    } catch (error) {
      errors.push(this.createError('GetJobs', error));
    }

    // Scan crawlers
    try {
      const crawlers = await this.getCrawlers(client);
      for (const crawler of crawlers) {
        resources.push(this.mapCrawler(crawler));
      }
    } catch (error) {
      errors.push(this.createError('GetCrawlers', error));
    }

    return { resources, errors };
  }

  private async getDatabases(
    client: ReturnType<typeof getClientFactory.prototype.getGlueClient>
  ): Promise<Database[]> {
    const databases: Database[] = [];
    let nextToken: string | undefined;

    do {
      const response: GetDatabasesCommandOutput = await this.withRateLimit(() =>
        client.send(new GetDatabasesCommand({ NextToken: nextToken }))
      );

      if (response.DatabaseList) {
        databases.push(...response.DatabaseList);
      }

      nextToken = response.NextToken;
    } while (nextToken);

    return databases;
  }

  private async getTables(
    client: ReturnType<typeof getClientFactory.prototype.getGlueClient>,
    databaseName: string
  ): Promise<Table[]> {
    const tables: Table[] = [];

    try {
      let nextToken: string | undefined;

      do {
        const response: GetTablesCommandOutput = await this.withRateLimit(() =>
          client.send(
            new GetTablesCommand({
              DatabaseName: databaseName,
              NextToken: nextToken,
            })
          )
        );

        if (response.TableList) {
          tables.push(...response.TableList);
        }

        nextToken = response.NextToken;
      } while (nextToken);
    } catch {
      // Ignore errors getting tables
    }

    return tables;
  }

  private async getJobs(
    client: ReturnType<typeof getClientFactory.prototype.getGlueClient>
  ): Promise<Job[]> {
    const jobs: Job[] = [];
    let nextToken: string | undefined;

    do {
      const response: GetJobsCommandOutput = await this.withRateLimit(() =>
        client.send(new GetJobsCommand({ NextToken: nextToken }))
      );

      if (response.Jobs) {
        jobs.push(...response.Jobs);
      }

      nextToken = response.NextToken;
    } while (nextToken);

    return jobs;
  }

  private async getCrawlers(
    client: ReturnType<typeof getClientFactory.prototype.getGlueClient>
  ): Promise<Crawler[]> {
    const crawlers: Crawler[] = [];
    let nextToken: string | undefined;

    do {
      const response: GetCrawlersCommandOutput = await this.withRateLimit(() =>
        client.send(new GetCrawlersCommand({ NextToken: nextToken }))
      );

      if (response.Crawlers) {
        crawlers.push(...response.Crawlers);
      }

      nextToken = response.NextToken;
    } while (nextToken);

    return crawlers;
  }

  private mapDatabase(database: Database): Resource {
    const arn = `arn:aws:glue:${this.config.region}::database/${database.Name}`;

    return this.createResource(
      arn,
      'database',
      database.Name || '',
      {
        name: database.Name,
        description: database.Description,
        locationUri: database.LocationUri,
        parameters: database.Parameters,
        createTime: database.CreateTime?.toISOString(),
        catalogId: database.CatalogId,
      },
      {},
      database.CreateTime?.toISOString()
    );
  }

  private mapTable(table: Table, databaseName: string): Resource {
    const arn = `arn:aws:glue:${this.config.region}::table/${databaseName}/${table.Name}`;

    return this.createResource(
      arn,
      'table',
      table.Name || '',
      {
        name: table.Name,
        databaseName,
        description: table.Description,
        owner: table.Owner,
        createTime: table.CreateTime?.toISOString(),
        updateTime: table.UpdateTime?.toISOString(),
        lastAccessTime: table.LastAccessTime?.toISOString(),
        retention: table.Retention,
        storageDescriptor: table.StorageDescriptor
          ? {
              location: table.StorageDescriptor.Location,
              inputFormat: table.StorageDescriptor.InputFormat,
              outputFormat: table.StorageDescriptor.OutputFormat,
              compressed: table.StorageDescriptor.Compressed,
              numberOfBuckets: table.StorageDescriptor.NumberOfBuckets,
              serdeInfo: table.StorageDescriptor.SerdeInfo
                ? {
                    name: table.StorageDescriptor.SerdeInfo.Name,
                    serializationLibrary:
                      table.StorageDescriptor.SerdeInfo.SerializationLibrary,
                  }
                : undefined,
              columns: table.StorageDescriptor.Columns?.map((c) => ({
                name: c.Name,
                type: c.Type,
                comment: c.Comment,
              })),
            }
          : undefined,
        partitionKeys: table.PartitionKeys?.map((p) => ({
          name: p.Name,
          type: p.Type,
          comment: p.Comment,
        })),
        tableType: table.TableType,
        parameters: table.Parameters,
        catalogId: table.CatalogId,
        isRegisteredWithLakeFormation: table.IsRegisteredWithLakeFormation,
      },
      {},
      table.CreateTime?.toISOString()
    );
  }

  private mapJob(job: Job): Resource {
    const arn = `arn:aws:glue:${this.config.region}::job/${job.Name}`;

    return this.createResource(
      arn,
      'job',
      job.Name || '',
      {
        name: job.Name,
        description: job.Description,
        role: job.Role,
        createdOn: job.CreatedOn?.toISOString(),
        lastModifiedOn: job.LastModifiedOn?.toISOString(),
        executionProperty: job.ExecutionProperty
          ? {
              maxConcurrentRuns: job.ExecutionProperty.MaxConcurrentRuns,
            }
          : undefined,
        command: job.Command
          ? {
              name: job.Command.Name,
              scriptLocation: job.Command.ScriptLocation,
              pythonVersion: job.Command.PythonVersion,
              runtime: job.Command.Runtime,
            }
          : undefined,
        defaultArguments: job.DefaultArguments,
        connections: job.Connections?.Connections,
        maxRetries: job.MaxRetries,
        allocatedCapacity: job.AllocatedCapacity,
        timeout: job.Timeout,
        maxCapacity: job.MaxCapacity,
        workerType: job.WorkerType,
        numberOfWorkers: job.NumberOfWorkers,
        securityConfiguration: job.SecurityConfiguration,
        glueVersion: job.GlueVersion,
        executionClass: job.ExecutionClass,
      },
      {},
      job.CreatedOn?.toISOString()
    );
  }

  private mapCrawler(crawler: Crawler): Resource {
    const arn = `arn:aws:glue:${this.config.region}::crawler/${crawler.Name}`;

    return this.createResource(
      arn,
      'crawler',
      crawler.Name || '',
      {
        name: crawler.Name,
        role: crawler.Role,
        targets: crawler.Targets
          ? {
              s3Targets: crawler.Targets.S3Targets?.map((t) => ({
                path: t.Path,
                exclusions: t.Exclusions,
              })),
              jdbcTargets: crawler.Targets.JdbcTargets?.map((t) => ({
                connectionName: t.ConnectionName,
                path: t.Path,
                exclusions: t.Exclusions,
              })),
              dynamoDBTargets: crawler.Targets.DynamoDBTargets?.map((t) => ({
                path: t.Path,
                scanAll: t.scanAll,
                scanRate: t.scanRate,
              })),
              catalogTargets: crawler.Targets.CatalogTargets?.map((t) => ({
                databaseName: t.DatabaseName,
                tables: t.Tables,
              })),
            }
          : undefined,
        databaseName: crawler.DatabaseName,
        description: crawler.Description,
        classifiers: crawler.Classifiers,
        recrawlPolicy: crawler.RecrawlPolicy?.RecrawlBehavior,
        schemaChangePolicy: crawler.SchemaChangePolicy
          ? {
              updateBehavior: crawler.SchemaChangePolicy.UpdateBehavior,
              deleteBehavior: crawler.SchemaChangePolicy.DeleteBehavior,
            }
          : undefined,
        lineageConfiguration: crawler.LineageConfiguration?.CrawlerLineageSettings,
        state: crawler.State,
        tablePrefix: crawler.TablePrefix,
        schedule: crawler.Schedule?.ScheduleExpression,
        crawlElapsedTime: crawler.CrawlElapsedTime,
        creationTime: crawler.CreationTime?.toISOString(),
        lastUpdated: crawler.LastUpdated?.toISOString(),
        lastCrawl: crawler.LastCrawl
          ? {
              status: crawler.LastCrawl.Status,
              errorMessage: crawler.LastCrawl.ErrorMessage,
              logGroup: crawler.LastCrawl.LogGroup,
              logStream: crawler.LastCrawl.LogStream,
              messagePrefix: crawler.LastCrawl.MessagePrefix,
              startTime: crawler.LastCrawl.StartTime?.toISOString(),
            }
          : undefined,
        version: crawler.Version,
        configuration: crawler.Configuration,
        crawlerSecurityConfiguration: crawler.CrawlerSecurityConfiguration,
        lakeFormationConfiguration: crawler.LakeFormationConfiguration
          ? {
              useLakeFormationCredentials:
                crawler.LakeFormationConfiguration.UseLakeFormationCredentials,
              accountId: crawler.LakeFormationConfiguration.AccountId,
            }
          : undefined,
      },
      {},
      crawler.CreationTime?.toISOString()
    );
  }
}

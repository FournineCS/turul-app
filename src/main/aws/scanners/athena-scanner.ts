// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  ListWorkGroupsCommand,
  GetWorkGroupCommand,
  ListDataCatalogsCommand,
  GetDataCatalogCommand,
  type WorkGroup,
  type DataCatalog,
} from '@aws-sdk/client-athena';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class AthenaScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'athena', 'athena');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getAthenaClient({
      profile: this.config.profile,
      region: this.config.region,
    });

    // Scan workgroups
    try {
      let nextToken: string | undefined;

      do {
        const response = await this.withRateLimit(() =>
          client.send(new ListWorkGroupsCommand({ NextToken: nextToken }))
        );

        if (response.WorkGroups) {
          for (const workGroupSummary of response.WorkGroups) {
            try {
              const detailResponse = await this.withRateLimit(() =>
                client.send(
                  new GetWorkGroupCommand({
                    WorkGroup: workGroupSummary.Name,
                  })
                )
              );

              if (detailResponse.WorkGroup) {
                resources.push(this.mapWorkGroup(detailResponse.WorkGroup));
              }
            } catch {
              // Fall back to summary info
              resources.push(
                this.mapWorkGroupSummary(
                  workGroupSummary.Name || '',
                  workGroupSummary.State || '',
                  workGroupSummary.Description || ''
                )
              );
            }
          }
        }

        nextToken = response.NextToken;
      } while (nextToken);
    } catch (error) {
      errors.push(this.createError('ListWorkGroups', error));
    }

    // Scan data catalogs
    try {
      let nextToken: string | undefined;

      do {
        const response = await this.withRateLimit(() =>
          client.send(new ListDataCatalogsCommand({ NextToken: nextToken }))
        );

        if (response.DataCatalogsSummary) {
          for (const catalogSummary of response.DataCatalogsSummary) {
            try {
              const detailResponse = await this.withRateLimit(() =>
                client.send(
                  new GetDataCatalogCommand({
                    Name: catalogSummary.CatalogName,
                  })
                )
              );

              if (detailResponse.DataCatalog) {
                resources.push(this.mapDataCatalog(detailResponse.DataCatalog));
              }
            } catch {
              // Fall back to summary info
              resources.push(
                this.mapDataCatalogSummary(
                  catalogSummary.CatalogName || '',
                  catalogSummary.Type || ''
                )
              );
            }
          }
        }

        nextToken = response.NextToken;
      } while (nextToken);
    } catch (error) {
      errors.push(this.createError('ListDataCatalogs', error));
    }

    return { resources, errors };
  }

  private mapWorkGroup(workGroup: WorkGroup): Resource {
    const arn = `arn:aws:athena:${this.config.region}::workgroup/${workGroup.Name}`;

    return this.createResource(
      arn,
      'workgroup',
      workGroup.Name || '',
      {
        name: workGroup.Name,
        state: workGroup.State,
        description: workGroup.Description,
        creationTime: workGroup.CreationTime?.toISOString(),
        configuration: workGroup.Configuration
          ? {
              resultConfiguration: workGroup.Configuration.ResultConfiguration
                ? {
                    outputLocation:
                      workGroup.Configuration.ResultConfiguration.OutputLocation,
                    encryptionConfiguration:
                      workGroup.Configuration.ResultConfiguration.EncryptionConfiguration
                        ? {
                            encryptionOption:
                              workGroup.Configuration.ResultConfiguration
                                .EncryptionConfiguration.EncryptionOption,
                            kmsKey:
                              workGroup.Configuration.ResultConfiguration
                                .EncryptionConfiguration.KmsKey,
                          }
                        : undefined,
                    expectedBucketOwner:
                      workGroup.Configuration.ResultConfiguration.ExpectedBucketOwner,
                    aclConfiguration:
                      workGroup.Configuration.ResultConfiguration.AclConfiguration
                        ?.S3AclOption,
                  }
                : undefined,
              enforceWorkGroupConfiguration:
                workGroup.Configuration.EnforceWorkGroupConfiguration,
              publishCloudWatchMetricsEnabled:
                workGroup.Configuration.PublishCloudWatchMetricsEnabled,
              bytesScannedCutoffPerQuery:
                workGroup.Configuration.BytesScannedCutoffPerQuery,
              requesterPaysEnabled: workGroup.Configuration.RequesterPaysEnabled,
              engineVersion: workGroup.Configuration.EngineVersion
                ? {
                    selectedEngineVersion:
                      workGroup.Configuration.EngineVersion.SelectedEngineVersion,
                    effectiveEngineVersion:
                      workGroup.Configuration.EngineVersion.EffectiveEngineVersion,
                  }
                : undefined,
              enableMinimumEncryptionConfiguration:
                workGroup.Configuration.EnableMinimumEncryptionConfiguration,
            }
          : undefined,
      },
      {},
      workGroup.CreationTime?.toISOString()
    );
  }

  private mapWorkGroupSummary(
    name: string,
    state: string,
    description: string
  ): Resource {
    const arn = `arn:aws:athena:${this.config.region}::workgroup/${name}`;

    return this.createResource(
      arn,
      'workgroup',
      name,
      {
        name,
        state,
        description,
      },
      {}
    );
  }

  private mapDataCatalog(catalog: DataCatalog): Resource {
    const arn = `arn:aws:athena:${this.config.region}::datacatalog/${catalog.Name}`;

    return this.createResource(
      arn,
      'data-catalog',
      catalog.Name || '',
      {
        name: catalog.Name,
        description: catalog.Description,
        type: catalog.Type,
        parameters: catalog.Parameters,
      },
      {}
    );
  }

  private mapDataCatalogSummary(name: string, type: string): Resource {
    const arn = `arn:aws:athena:${this.config.region}::datacatalog/${name}`;

    return this.createResource(
      arn,
      'data-catalog',
      name,
      {
        name,
        type,
      },
      {}
    );
  }
}

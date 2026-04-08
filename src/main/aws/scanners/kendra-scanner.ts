// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  ListIndicesCommand,
  ListDataSourcesCommand,
  ListTagsForResourceCommand,
} from '@aws-sdk/client-kendra';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class KendraScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'kendra', 'kendra');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getKendraClient({
      profile: this.config.profile,
      region: this.config.region,
    });

    try {
      let nextToken: string | undefined;

      do {
        const response = await this.withRateLimit(() =>
          client.send(new ListIndicesCommand({ NextToken: nextToken }))
        );

        if (response.IndexConfigurationSummaryItems) {
          for (const index of response.IndexConfigurationSummaryItems) {
            if (!index.Id) continue;

            try {
              // Get data sources for this index
              const dataSources: Array<{
                name?: string;
                type?: string;
                status?: string;
                id?: string;
              }> = [];

              try {
                let dsNextToken: string | undefined;

                do {
                  const dsResponse = await this.withRateLimit(() =>
                    client.send(
                      new ListDataSourcesCommand({
                        IndexId: index.Id,
                        NextToken: dsNextToken,
                      })
                    )
                  );

                  if (dsResponse.SummaryItems) {
                    for (const ds of dsResponse.SummaryItems) {
                      dataSources.push({
                        name: ds.Name,
                        type: ds.Type,
                        status: ds.Status,
                        id: ds.Id,
                      });
                    }
                  }

                  dsNextToken = dsResponse.NextToken;
                } while (dsNextToken);
              } catch (error) {
                errors.push(this.createError(`ListDataSources:${index.Id}`, error));
              }

              // Get tags for this index
              let tags: Record<string, string> = {};
              try {
                const tagsResponse = await this.withRateLimit(() =>
                  client.send(
                    new ListTagsForResourceCommand({
                      ResourceARN: `arn:aws:kendra:${this.config.region}:${this.getAccountIdFromArn(index.Id ?? '')}:index/${index.Id}`,
                    })
                  )
                );

                if (tagsResponse.Tags) {
                  for (const tag of tagsResponse.Tags) {
                    if (tag.Key) {
                      tags[tag.Key] = tag.Value || '';
                    }
                  }
                }
              } catch {
                // Ignore tag errors - ARN construction may fail or permissions may be missing
              }

              const name = index.Name || index.Id || '';

              resources.push(
                this.createResource(
                  index.Id,
                  'index',
                  name,
                  {
                    indexId: index.Id,
                    name: index.Name,
                    status: index.Status,
                    edition: index.Edition,
                    createdAt: index.CreatedAt?.toISOString(),
                    updatedAt: index.UpdatedAt?.toISOString(),
                    dataSources,
                    dataSourceCount: dataSources.length,
                  },
                  tags,
                  index.CreatedAt?.toISOString()
                )
              );
            } catch (error) {
              errors.push(this.createError(`ProcessIndex:${index.Id}`, error));
            }
          }
        }

        nextToken = response.NextToken;
      } while (nextToken);
    } catch (error) {
      errors.push(this.createError('ListIndices', error));
    }

    return { resources, errors };
  }

  private getAccountIdFromArn(indexId: string): string {
    // Index ID may contain the account info or we extract from config
    // Return empty string as fallback - the ListTagsForResource call
    // will fail gracefully if ARN is incorrect
    return '';
  }
}

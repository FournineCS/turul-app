// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { ListFHIRDatastoresCommand, ListTagsForResourceCommand } from '@aws-sdk/client-healthlake';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class HealthLakeScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'healthlake', 'healthlake');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];

    try {
      const client = getClientFactory().getHealthLakeClient({
        profile: this.config.profile,
        region: this.config.region,
      });

      let nextToken: string | undefined;

      do {
        const command = new ListFHIRDatastoresCommand({
          NextToken: nextToken,
          MaxResults: 100,
        });

        const response = await this.withRateLimit(() => client.send(command));

        for (const datastore of response.DatastorePropertiesList || []) {
          try {
            let tags: Record<string, string> = {};

            if (datastore.DatastoreArn) {
              try {
                const tagsCommand = new ListTagsForResourceCommand({
                  ResourceARN: datastore.DatastoreArn,
                });
                const tagsResponse = await this.withRateLimit(() => client.send(tagsCommand));
                for (const tag of tagsResponse.Tags || []) {
                  if (tag.Key) {
                    tags[tag.Key] = tag.Value || '';
                  }
                }
              } catch (tagError) {
                // Tags are best-effort; ignore errors
              }
            }

            resources.push(this.createResource(
              datastore.DatastoreArn || datastore.DatastoreId || '',
              'datastore',
              datastore.DatastoreName || datastore.DatastoreId || '',
              {
                datastoreId: datastore.DatastoreId,
                datastoreName: datastore.DatastoreName,
                datastoreStatus: datastore.DatastoreStatus,
                datastoreTypeVersion: datastore.DatastoreTypeVersion,
                datastoreEndpoint: datastore.DatastoreEndpoint,
                createdAt: datastore.CreatedAt?.toISOString(),
                sseConfiguration: datastore.SseConfiguration?.KmsEncryptionConfig
                  ? {
                      kmsKeyId: datastore.SseConfiguration.KmsEncryptionConfig.KmsKeyId,
                    }
                  : undefined,
              },
              tags,
            ));
          } catch (datastoreError) {
            errors.push(
              this.createError(`ProcessDatastore:${datastore.DatastoreId || 'unknown'}`, datastoreError)
            );
          }
        }

        nextToken = response.NextToken;
      } while (nextToken);
    } catch (error) {
      errors.push(this.createError('ListFHIRDatastores', error));
    }

    return { resources, errors };
  }
}

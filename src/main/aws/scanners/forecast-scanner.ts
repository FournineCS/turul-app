// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  ListPredictorsCommand,
  ListDatasetsCommand,
  ListTagsForResourceCommand,
} from '@aws-sdk/client-forecast';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class ForecastScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'forecast', 'forecast');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];

    const client = getClientFactory().getForecastClient({
      profile: this.config.profile,
      region: this.config.region,
    });

    // Scan predictors
    try {
      let nextToken: string | undefined;
      do {
        const response = await this.withRateLimit(() => client.send(
          new ListPredictorsCommand({
            NextToken: nextToken,
            MaxResults: 100,
          })
        ));

        for (const predictor of response.Predictors || []) {
          const arn = predictor.PredictorArn || '';
          const name = predictor.PredictorName || '';

          let tags: Record<string, string> = {};
          if (arn) {
            try {
              const tagsResponse = await this.withRateLimit(() => client.send(
                new ListTagsForResourceCommand({ ResourceArn: arn })
              ));
              for (const tag of tagsResponse.Tags || []) {
                if (tag.Key) {
                  tags[tag.Key] = tag.Value || '';
                }
              }
            } catch {
              // Tags not available, continue
            }
          }

          resources.push(this.createResource(
            arn,
            'predictor',
            name,
            {
              predictorName: predictor.PredictorName,
              status: predictor.Status,
              creationTime: predictor.CreationTime,
              lastModificationTime: predictor.LastModificationTime,
              datasetGroupArn: predictor.DatasetGroupArn,
            },
            tags,
          ));
        }

        nextToken = response.NextToken;
      } while (nextToken);
    } catch (err) {
      errors.push(this.createError('ListPredictors', err));
    }

    // Scan datasets
    try {
      let nextToken: string | undefined;
      do {
        const response = await this.withRateLimit(() => client.send(
          new ListDatasetsCommand({
            NextToken: nextToken,
            MaxResults: 100,
          })
        ));

        for (const dataset of response.Datasets || []) {
          const arn = dataset.DatasetArn || '';
          const name = dataset.DatasetName || '';

          let tags: Record<string, string> = {};
          if (arn) {
            try {
              const tagsResponse = await this.withRateLimit(() => client.send(
                new ListTagsForResourceCommand({ ResourceArn: arn })
              ));
              for (const tag of tagsResponse.Tags || []) {
                if (tag.Key) {
                  tags[tag.Key] = tag.Value || '';
                }
              }
            } catch {
              // Tags not available, continue
            }
          }

          resources.push(this.createResource(
            arn,
            'dataset',
            name,
            {
              datasetName: dataset.DatasetName,
              datasetType: dataset.DatasetType,
              domain: dataset.Domain,
              creationTime: dataset.CreationTime,
              lastModificationTime: dataset.LastModificationTime,
            },
            tags,
          ));
        }

        nextToken = response.NextToken;
      } while (nextToken);
    } catch (err) {
      errors.push(this.createError('ListDatasets', err));
    }

    return { resources, errors };
  }
}

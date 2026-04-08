// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  GetDetectorsCommand,
  GetModelsCommand,
  ListTagsForResourceCommand,
} from '@aws-sdk/client-frauddetector';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class FraudDetectorScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'frauddetector', 'frauddetector');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];

    const client = getClientFactory().getFraudDetectorClient({
      profile: this.config.profile,
      region: this.config.region,
    });

    // Scan detectors
    try {
      let nextToken: string | undefined;
      do {
        const response = await this.withRateLimit(() => client.send(
          new GetDetectorsCommand({
            nextToken,
            maxResults: 100,
          })
        ));

        for (const detector of response.detectors ?? []) {
          let tags: Record<string, string> = {};
          if (detector.arn) {
            try {
              const tagsResponse = await this.withRateLimit(() => client.send(
                new ListTagsForResourceCommand({ resourceARN: detector.arn })
              ));
              for (const tag of tagsResponse.tags ?? []) {
                if (tag.key) {
                  tags[tag.key] = tag.value ?? '';
                }
              }
            } catch {
              // ignore tag errors
            }
          }

          resources.push(this.createResource(
            detector.arn ?? detector.detectorId ?? '',
            'detector',
            detector.detectorId ?? '',
            {
              detectorId: detector.detectorId,
              description: detector.description,
              eventTypeName: detector.eventTypeName,
              createdTime: detector.createdTime,
              lastUpdatedTime: detector.lastUpdatedTime,
            },
            tags,
          ));
        }

        nextToken = response.nextToken;
      } while (nextToken);
    } catch (err) {
      errors.push(this.createError('GetDetectors', err));
    }

    // Scan models
    try {
      let nextToken: string | undefined;
      do {
        const response = await this.withRateLimit(() => client.send(
          new GetModelsCommand({
            nextToken,
            maxResults: 100,
          })
        ));

        for (const model of response.models ?? []) {
          let tags: Record<string, string> = {};
          if (model.arn) {
            try {
              const tagsResponse = await this.withRateLimit(() => client.send(
                new ListTagsForResourceCommand({ resourceARN: model.arn })
              ));
              for (const tag of tagsResponse.tags ?? []) {
                if (tag.key) {
                  tags[tag.key] = tag.value ?? '';
                }
              }
            } catch {
              // ignore tag errors
            }
          }

          resources.push(this.createResource(
            model.arn ?? model.modelId ?? '',
            'model',
            model.modelId ?? '',
            {
              modelId: model.modelId,
              modelType: model.modelType,
              description: model.description,
              eventTypeName: model.eventTypeName,
              createdTime: model.createdTime,
              lastUpdatedTime: model.lastUpdatedTime,
            },
            tags,
          ));
        }

        nextToken = response.nextToken;
      } while (nextToken);
    } catch (err) {
      errors.push(this.createError('GetModels', err));
    }

    return { resources, errors };
  }
}

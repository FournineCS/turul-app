// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  ListEndpointsCommand,
  ListEntityRecognizersCommand,
  ListTagsForResourceCommand,
} from '@aws-sdk/client-comprehend';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class ComprehendScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'comprehend', 'comprehend');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];

    const [endpointsResult, recognizersResult] = await Promise.allSettled([
      this.scanEndpoints(),
      this.scanEntityRecognizers(),
    ]);

    if (endpointsResult.status === 'fulfilled') { resources.push(...endpointsResult.value.resources); errors.push(...endpointsResult.value.errors); }
    else errors.push(this.createError('ListEndpoints', endpointsResult.reason));
    if (recognizersResult.status === 'fulfilled') { resources.push(...recognizersResult.value.resources); errors.push(...recognizersResult.value.errors); }
    else errors.push(this.createError('ListEntityRecognizers', recognizersResult.reason));

    return { resources, errors };
  }

  private async scanEndpoints(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getComprehendClient({ profile: this.config.profile, region: this.config.region });

    try {
      let nextToken: string | undefined;
      do {
        const response = await this.withRateLimit(() => client.send(new ListEndpointsCommand({ NextToken: nextToken })));
        if (response.EndpointPropertiesList) {
          for (const endpoint of response.EndpointPropertiesList) {
            if (!endpoint.EndpointArn) continue;

            let tags: Record<string, string> = {};
            try {
              const tagsResp = await this.withRateLimit(() => client.send(new ListTagsForResourceCommand({ ResourceArn: endpoint.EndpointArn })));
              if (tagsResp.Tags) {
                for (const tag of tagsResp.Tags) {
                  if (tag.Key) tags[tag.Key] = tag.Value || '';
                }
              }
            } catch { /* ignore */ }

            resources.push(this.createResource(endpoint.EndpointArn, 'endpoint', endpoint.EndpointArn.split('/').pop() || '', {
              endpointName: endpoint.EndpointArn.split('/').pop(),
              status: endpoint.Status,
              modelArn: endpoint.ModelArn,
              desiredInferenceUnits: endpoint.DesiredInferenceUnits,
              currentInferenceUnits: endpoint.CurrentInferenceUnits,
              desiredModelArn: endpoint.DesiredModelArn,
              desiredDataAccessRoleArn: endpoint.DesiredDataAccessRoleArn,
            }, tags, endpoint.CreationTime?.toISOString()));
          }
        }
        nextToken = response.NextToken;
      } while (nextToken);
    } catch (error) { errors.push(this.createError('ListEndpoints', error)); }
    return { resources, errors };
  }

  private async scanEntityRecognizers(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getComprehendClient({ profile: this.config.profile, region: this.config.region });

    try {
      let nextToken: string | undefined;
      do {
        const response = await this.withRateLimit(() => client.send(new ListEntityRecognizersCommand({ NextToken: nextToken })));
        if (response.EntityRecognizerPropertiesList) {
          for (const recognizer of response.EntityRecognizerPropertiesList) {
            if (!recognizer.EntityRecognizerArn) continue;

            let tags: Record<string, string> = {};
            try {
              const tagsResp = await this.withRateLimit(() => client.send(new ListTagsForResourceCommand({ ResourceArn: recognizer.EntityRecognizerArn })));
              if (tagsResp.Tags) {
                for (const tag of tagsResp.Tags) {
                  if (tag.Key) tags[tag.Key] = tag.Value || '';
                }
              }
            } catch { /* ignore */ }

            const recognizerName = recognizer.EntityRecognizerArn.split('/').pop() || '';

            resources.push(this.createResource(recognizer.EntityRecognizerArn, 'entity-recognizer', recognizerName, {
              recognizerName,
              status: recognizer.Status,
              languageCode: recognizer.LanguageCode,
              dataAccessRoleArn: recognizer.DataAccessRoleArn,
              volumeKmsKeyId: recognizer.VolumeKmsKeyId,
              versionName: recognizer.VersionName,
              modelKmsKeyId: recognizer.ModelKmsKeyId,
            }, tags, recognizer.SubmitTime?.toISOString()));
          }
        }
        nextToken = response.NextToken;
      } while (nextToken);
    } catch (error) { errors.push(this.createError('ListEntityRecognizers', error)); }
    return { resources, errors };
  }
}

// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { ListPipelinesCommand, ListPresetsCommand } from '@aws-sdk/client-elastic-transcoder';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class ElasticTranscoderScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'elastictranscoder', 'elastictranscoder');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getElasticTranscoderClient({
      profile: this.config.profile,
      region: this.config.region,
    });

    // Scan pipelines
    try {
      let pageToken: string | undefined;
      do {
        const command = new ListPipelinesCommand({ PageToken: pageToken });
        const response = await this.withRateLimit(() => client.send(command));
        for (const pipeline of response.Pipelines || []) {
          resources.push(this.createResource(
            pipeline.Arn || pipeline.Id || '',
            'pipeline',
            pipeline.Name || pipeline.Id || '',
            {
              id: pipeline.Id,
              name: pipeline.Name,
              status: pipeline.Status,
              inputBucket: pipeline.InputBucket,
              outputBucket: pipeline.OutputBucket,
              role: pipeline.Role,
            },
          ));
        }
        pageToken = response.NextPageToken;
      } while (pageToken);
    } catch (err) {
      errors.push(this.createError('ListPipelines', err));
    }

    // Scan presets
    try {
      let pageToken: string | undefined;
      do {
        const command = new ListPresetsCommand({ PageToken: pageToken });
        const response = await this.withRateLimit(() => client.send(command));
        for (const preset of response.Presets || []) {
          if (preset.Type === 'System') {
            continue;
          }
          resources.push(this.createResource(
            preset.Arn || preset.Id || '',
            'preset',
            preset.Name || preset.Id || '',
            {
              id: preset.Id,
              name: preset.Name,
              description: preset.Description,
              container: preset.Container,
              type: preset.Type,
            },
          ));
        }
        pageToken = response.NextPageToken;
      } while (pageToken);
    } catch (err) {
      errors.push(this.createError('ListPresets', err));
    }

    return { resources, errors };
  }
}

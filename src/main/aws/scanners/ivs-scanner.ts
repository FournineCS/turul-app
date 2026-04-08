// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { ListChannelsCommand, ListTagsForResourceCommand } from '@aws-sdk/client-ivs';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class IVSScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'ivs', 'ivs');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];

    const client = getClientFactory().getIVSClient({
      profile: this.config.profile,
      region: this.config.region,
    });

    // Scan channels
    try {
      let nextToken: string | undefined;

      do {
        const command = new ListChannelsCommand({
          nextToken,
          maxResults: 50,
        });

        const response = await this.withRateLimit(() => client.send(command));

        for (const channel of response.channels || []) {
          const arn = channel.arn || '';
          const name = channel.name || '';

          // Get tags
          let tags: Record<string, string> = {};
          try {
            const tagsCommand = new ListTagsForResourceCommand({
              resourceArn: arn,
            });
            const tagsResponse = await this.withRateLimit(() => client.send(tagsCommand));
            tags = tagsResponse.tags || {};
          } catch (tagErr) {
            errors.push(this.createError(`GetTags:${arn}`, tagErr));
          }

          resources.push(this.createResource(
            arn,
            'channel',
            name,
            {
              latencyMode: channel.latencyMode,
              authorized: channel.authorized,
              recordingConfigurationArn: channel.recordingConfigurationArn,
            },
            tags,
          ));
        }

        nextToken = response.nextToken;
      } while (nextToken);
    } catch (err) {
      errors.push(this.createError('ListChannels', err));
    }

    return { resources, errors };
  }
}

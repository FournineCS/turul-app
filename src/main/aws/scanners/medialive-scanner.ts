// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { ListChannelsCommand, ListInputsCommand } from '@aws-sdk/client-medialive';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class MediaLiveScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'medialive', 'medialive');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];

    const client = getClientFactory().getMediaLiveClient({
      profile: this.config.profile,
      region: this.config.region,
    });

    // Scan channels
    try {
      let nextToken: string | undefined;
      do {
        const command = new ListChannelsCommand({
          NextToken: nextToken,
          MaxResults: 50,
        });
        const response = await this.withRateLimit(() => client.send(command));

        for (const channel of response.Channels || []) {
          const arn = channel.Arn || '';
          const name = channel.Name || channel.Id || '';

          const tags: Record<string, string> = {};
          if (channel.Tags) {
            for (const [key, value] of Object.entries(channel.Tags)) {
              if (value !== undefined) {
                tags[key] = value;
              }
            }
          }

          resources.push(this.createResource(
            arn,
            'channel',
            name,
            {
              channelId: channel.Id,
              name: channel.Name,
              state: channel.State,
              channelClass: channel.ChannelClass,
              pipelinesRunningCount: channel.PipelinesRunningCount,
              inputAttachments: (channel.InputAttachments || []).length,
            },
            tags,
          ));
        }

        nextToken = response.NextToken;
      } while (nextToken);
    } catch (err) {
      errors.push(this.createError('ListChannels', err));
    }

    // Scan inputs
    try {
      let nextToken: string | undefined;
      do {
        const command = new ListInputsCommand({
          NextToken: nextToken,
          MaxResults: 50,
        });
        const response = await this.withRateLimit(() => client.send(command));

        for (const input of response.Inputs || []) {
          const arn = input.Arn || '';
          const name = input.Name || input.Id || '';

          const tags: Record<string, string> = {};
          if (input.Tags) {
            for (const [key, value] of Object.entries(input.Tags)) {
              if (value !== undefined) {
                tags[key] = value;
              }
            }
          }

          resources.push(this.createResource(
            arn,
            'input',
            name,
            {
              inputId: input.Id,
              name: input.Name,
              type: input.Type,
              state: input.State,
              inputClass: input.InputClass,
              attachedChannels: input.AttachedChannels || [],
            },
            tags,
          ));
        }

        nextToken = response.NextToken;
      } while (nextToken);
    } catch (err) {
      errors.push(this.createError('ListInputs', err));
    }

    return { resources, errors };
  }
}

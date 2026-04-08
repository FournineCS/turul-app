// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { ListStreamsCommand, ListTagsForStreamCommand } from '@aws-sdk/client-kinesis-video';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class KinesisVideoScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'kinesisvideo', 'kinesis-video');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];

    try {
      const client = getClientFactory().getKinesisVideoClient({
        profile: this.config.profile,
        region: this.config.region,
      });

      let nextToken: string | undefined;

      do {
        const listResponse = await this.withRateLimit(() => client.send(
          new ListStreamsCommand({
            NextToken: nextToken,
          })
        ));

        const streams = listResponse.StreamInfoList ?? [];

        for (const stream of streams) {
          try {
            let tags: Record<string, string> = {};

            if (stream.StreamName) {
              try {
                const tagsResponse = await this.withRateLimit(() => client.send(
                  new ListTagsForStreamCommand({
                    StreamName: stream.StreamName,
                  })
                ));
                tags = tagsResponse.Tags ?? {};
              } catch (tagErr) {
                // Tags are best-effort; continue without them
              }
            }

            resources.push(this.createResource(
              stream.StreamARN ?? stream.StreamName ?? 'unknown',
              'stream',
              stream.StreamName ?? 'unknown',
              {
                streamName: stream.StreamName,
                status: stream.Status,
                dataRetentionInHours: stream.DataRetentionInHours,
                mediaType: stream.MediaType,
                kmsKeyId: stream.KmsKeyId,
                creationTime: stream.CreationTime,
              },
              tags,
            ));
          } catch (streamErr) {
            errors.push(this.createError(`ProcessStream:${stream.StreamName ?? 'unknown'}`, streamErr));
          }
        }

        nextToken = listResponse.NextToken;
      } while (nextToken);
    } catch (err) {
      errors.push(this.createError('ListStreams', err));
    }

    return { resources, errors };
  }
}

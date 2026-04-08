// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  ListStreamsCommand,
  DescribeStreamSummaryCommand,
  ListTagsForStreamCommand,
} from '@aws-sdk/client-kinesis';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class KinesisScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'kinesis', 'kinesis');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getKinesisClient({ profile: this.config.profile, region: this.config.region });

    try {
      let nextToken: string | undefined;
      do {
        const response = await this.withRateLimit(() => client.send(new ListStreamsCommand({ NextToken: nextToken })));
        if (response.StreamSummaries) {
          for (const stream of response.StreamSummaries) {
            if (!stream.StreamARN) continue;

            let details: any = {};
            try {
              const descResp = await this.withRateLimit(() => client.send(new DescribeStreamSummaryCommand({ StreamName: stream.StreamName })));
              const desc = descResp.StreamDescriptionSummary;
              if (desc) {
                details = {
                  openShardCount: desc.OpenShardCount,
                  retentionPeriodHours: desc.RetentionPeriodHours,
                  streamModeDetails: desc.StreamModeDetails?.StreamMode,
                  encryptionType: desc.EncryptionType,
                  keyId: desc.KeyId,
                  consumerCount: desc.ConsumerCount,
                };
              }
            } catch { /* ignore */ }

            let tags: Record<string, string> = {};
            try {
              const tagsResp = await this.withRateLimit(() => client.send(new ListTagsForStreamCommand({ StreamARN: stream.StreamARN })));
              if (tagsResp.Tags) {
                for (const tag of tagsResp.Tags) {
                  if (tag.Key) tags[tag.Key] = tag.Value || '';
                }
              }
            } catch { /* ignore */ }

            resources.push(this.createResource(stream.StreamARN, 'data-stream', stream.StreamName || '', {
              streamName: stream.StreamName,
              streamStatus: stream.StreamStatus,
              streamMode: stream.StreamModeDetails?.StreamMode,
              ...details,
            }, tags, stream.StreamCreationTimestamp?.toISOString()));
          }
        }
        nextToken = response.HasMoreStreams ? response.NextToken : undefined;
      } while (nextToken);
    } catch (error) { errors.push(this.createError('ListStreams', error)); }

    return { resources, errors };
  }
}

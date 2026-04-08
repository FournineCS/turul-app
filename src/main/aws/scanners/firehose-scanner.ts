// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  ListDeliveryStreamsCommand,
  DescribeDeliveryStreamCommand,
  ListTagsForDeliveryStreamCommand,
} from '@aws-sdk/client-firehose';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class FirehoseScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'firehose', 'firehose');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getFirehoseClient({ profile: this.config.profile, region: this.config.region });

    try {
      let hasMore = true;
      let exclusiveStartName: string | undefined;
      do {
        const response = await this.withRateLimit(() => client.send(new ListDeliveryStreamsCommand({
          ExclusiveStartDeliveryStreamName: exclusiveStartName,
        })));
        if (response.DeliveryStreamNames) {
          for (const streamName of response.DeliveryStreamNames) {
            try {
              const descResp = await this.withRateLimit(() => client.send(new DescribeDeliveryStreamCommand({ DeliveryStreamName: streamName })));
              const ds = descResp.DeliveryStreamDescription;
              if (!ds?.DeliveryStreamARN) continue;

              let tags: Record<string, string> = {};
              try {
                const tagsResp = await this.withRateLimit(() => client.send(new ListTagsForDeliveryStreamCommand({ DeliveryStreamName: streamName })));
                if (tagsResp.Tags) {
                  for (const tag of tagsResp.Tags) {
                    if (tag.Key) tags[tag.Key] = tag.Value || '';
                  }
                }
              } catch { /* ignore */ }

              resources.push(this.createResource(ds.DeliveryStreamARN, 'delivery-stream', streamName, {
                deliveryStreamName: ds.DeliveryStreamName,
                deliveryStreamType: ds.DeliveryStreamType,
                deliveryStreamStatus: ds.DeliveryStreamStatus,
                deliveryStreamEncryptionConfiguration: ds.DeliveryStreamEncryptionConfiguration ? {
                  status: ds.DeliveryStreamEncryptionConfiguration.Status,
                  keyType: ds.DeliveryStreamEncryptionConfiguration.KeyType,
                } : undefined,
                source: ds.Source?.KinesisStreamSourceDescription ? {
                  kinesisStreamARN: ds.Source.KinesisStreamSourceDescription.KinesisStreamARN,
                  roleARN: ds.Source.KinesisStreamSourceDescription.RoleARN,
                } : undefined,
                destinations: ds.Destinations?.map(d => ({
                  destinationId: d.DestinationId,
                  s3: d.S3DestinationDescription ? { bucketARN: d.S3DestinationDescription.BucketARN } : undefined,
                  extendedS3: d.ExtendedS3DestinationDescription ? { bucketARN: d.ExtendedS3DestinationDescription.BucketARN } : undefined,
                })),
              }, tags, ds.CreateTimestamp?.toISOString()));
            } catch (error) { errors.push(this.createError(`DescribeDeliveryStream:${streamName}`, error)); }
          }
          exclusiveStartName = response.DeliveryStreamNames[response.DeliveryStreamNames.length - 1];
        }
        hasMore = response.HasMoreDeliveryStreams || false;
      } while (hasMore);
    } catch (error) { errors.push(this.createError('ListDeliveryStreams', error)); }

    return { resources, errors };
  }
}

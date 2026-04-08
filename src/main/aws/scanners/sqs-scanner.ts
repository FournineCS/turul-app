// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  ListQueuesCommand,
  GetQueueAttributesCommand,
  ListQueueTagsCommand,
  QueueAttributeName,
} from '@aws-sdk/client-sqs';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class SQSScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'sqs', 'sqs');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getSQSClient({
      profile: this.config.profile,
      region: this.config.region,
    });

    try {
      let nextToken: string | undefined;

      do {
        const response = await this.withRateLimit(() =>
          client.send(new ListQueuesCommand({ NextToken: nextToken }))
        );

        if (response.QueueUrls) {
          for (const queueUrl of response.QueueUrls) {
            try {
              // Get queue attributes
              const attributesResponse = await this.withRateLimit(() =>
                client.send(
                  new GetQueueAttributesCommand({
                    QueueUrl: queueUrl,
                    AttributeNames: [QueueAttributeName.All],
                  })
                )
              );

              // Get tags
              let tags: Record<string, string> = {};
              try {
                const tagsResponse = await this.withRateLimit(() =>
                  client.send(new ListQueueTagsCommand({ QueueUrl: queueUrl }))
                );
                tags = tagsResponse.Tags || {};
              } catch {
                // Ignore tag errors
              }

              resources.push(
                this.mapQueue(queueUrl, attributesResponse.Attributes || {}, tags)
              );
            } catch (error) {
              errors.push(this.createError(`GetQueueAttributes:${queueUrl}`, error));
            }
          }
        }

        nextToken = response.NextToken;
      } while (nextToken);
    } catch (error) {
      errors.push(this.createError('ListQueues', error));
    }

    return { resources, errors };
  }

  private mapQueue(
    queueUrl: string,
    attributes: Record<string, string>,
    tags: Record<string, string>
  ): Resource {
    const queueArn = attributes.QueueArn || '';
    const queueName = queueUrl.split('/').pop() || '';

    return this.createResource(
      queueArn,
      'queue',
      queueName,
      {
        queueUrl,
        queueArn,
        queueName,
        approximateNumberOfMessages: parseInt(
          attributes.ApproximateNumberOfMessages || '0',
          10
        ),
        approximateNumberOfMessagesNotVisible: parseInt(
          attributes.ApproximateNumberOfMessagesNotVisible || '0',
          10
        ),
        approximateNumberOfMessagesDelayed: parseInt(
          attributes.ApproximateNumberOfMessagesDelayed || '0',
          10
        ),
        visibilityTimeout: parseInt(attributes.VisibilityTimeout || '30', 10),
        createdTimestamp: attributes.CreatedTimestamp
          ? new Date(parseInt(attributes.CreatedTimestamp, 10) * 1000).toISOString()
          : undefined,
        lastModifiedTimestamp: attributes.LastModifiedTimestamp
          ? new Date(parseInt(attributes.LastModifiedTimestamp, 10) * 1000).toISOString()
          : undefined,
        policy: attributes.Policy ? JSON.parse(attributes.Policy) : undefined,
        maxMessageSize: parseInt(attributes.MaximumMessageSize || '262144', 10),
        messageRetentionPeriod: parseInt(
          attributes.MessageRetentionPeriod || '345600',
          10
        ),
        delaySeconds: parseInt(attributes.DelaySeconds || '0', 10),
        receiveMessageWaitTimeSeconds: parseInt(
          attributes.ReceiveMessageWaitTimeSeconds || '0',
          10
        ),
        redrivePolicy: attributes.RedrivePolicy
          ? JSON.parse(attributes.RedrivePolicy)
          : undefined,
        redriveAllowPolicy: attributes.RedriveAllowPolicy
          ? JSON.parse(attributes.RedriveAllowPolicy)
          : undefined,
        fifoQueue: attributes.FifoQueue === 'true',
        contentBasedDeduplication: attributes.ContentBasedDeduplication === 'true',
        deduplicationScope: attributes.DeduplicationScope,
        fifoThroughputLimit: attributes.FifoThroughputLimit,
        kmsMasterKeyId: attributes.KmsMasterKeyId,
        kmsDataKeyReusePeriodSeconds: attributes.KmsDataKeyReusePeriodSeconds
          ? parseInt(attributes.KmsDataKeyReusePeriodSeconds, 10)
          : undefined,
        sqsManagedSseEnabled: attributes.SqsManagedSseEnabled === 'true',
      },
      tags,
      attributes.CreatedTimestamp
        ? new Date(parseInt(attributes.CreatedTimestamp, 10) * 1000).toISOString()
        : undefined
    );
  }
}

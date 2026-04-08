// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  ListTopicsCommand,
  GetTopicAttributesCommand,
  ListTagsForResourceCommand,
  ListSubscriptionsByTopicCommand,
  type Subscription,
  type ListTopicsCommandOutput,
  type GetTopicAttributesCommandOutput,
  type ListTagsForResourceCommandOutput,
  type ListSubscriptionsByTopicCommandOutput,
} from '@aws-sdk/client-sns';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class SNSScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'sns', 'sns');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getSNSClient({
      profile: this.config.profile,
      region: this.config.region,
    });

    try {
      let nextToken: string | undefined;

      do {
        const response: ListTopicsCommandOutput = await this.withRateLimit(() =>
          client.send(new ListTopicsCommand({ NextToken: nextToken }))
        );

        if (response.Topics) {
          for (const topic of response.Topics) {
            if (!topic.TopicArn) continue;

            try {
              // Get topic attributes
              const attributesResponse: GetTopicAttributesCommandOutput = await this.withRateLimit(() =>
                client.send(
                  new GetTopicAttributesCommand({ TopicArn: topic.TopicArn })
                )
              );

              // Get tags
              let tags: Record<string, string> = {};
              try {
                const tagsResponse: ListTagsForResourceCommandOutput = await this.withRateLimit(() =>
                  client.send(
                    new ListTagsForResourceCommand({ ResourceArn: topic.TopicArn })
                  )
                );
                tags = this.parseTags(tagsResponse.Tags);
              } catch {
                // Ignore tag errors
              }

              // Get subscriptions
              const subscriptions = await this.getTopicSubscriptions(
                client,
                topic.TopicArn
              );

              resources.push(
                this.mapTopic(topic.TopicArn, attributesResponse.Attributes || {}, tags, subscriptions)
              );
            } catch (error) {
              errors.push(this.createError(`GetTopicAttributes:${topic.TopicArn}`, error));
            }
          }
        }

        nextToken = response.NextToken;
      } while (nextToken);
    } catch (error) {
      errors.push(this.createError('ListTopics', error));
    }

    return { resources, errors };
  }

  private async getTopicSubscriptions(
    client: ReturnType<typeof getClientFactory.prototype.getSNSClient>,
    topicArn: string
  ): Promise<Subscription[]> {
    const subscriptions: Subscription[] = [];

    try {
      let nextToken: string | undefined;

      do {
        const response: ListSubscriptionsByTopicCommandOutput = await this.withRateLimit(() =>
          client.send(
            new ListSubscriptionsByTopicCommand({
              TopicArn: topicArn,
              NextToken: nextToken,
            })
          )
        );

        if (response.Subscriptions) {
          subscriptions.push(...response.Subscriptions);
        }

        nextToken = response.NextToken;
      } while (nextToken);
    } catch {
      // Ignore subscription errors
    }

    return subscriptions;
  }

  private mapTopic(
    topicArn: string,
    attributes: Record<string, string>,
    tags: Record<string, string>,
    subscriptions: Subscription[]
  ): Resource {
    const topicName = topicArn.split(':').pop() || '';

    return this.createResource(
      topicArn,
      'topic',
      topicName,
      {
        topicArn,
        topicName,
        displayName: attributes.DisplayName,
        owner: attributes.Owner,
        policy: attributes.Policy ? JSON.parse(attributes.Policy) : undefined,
        subscriptionsConfirmed: parseInt(attributes.SubscriptionsConfirmed || '0', 10),
        subscriptionsPending: parseInt(attributes.SubscriptionsPending || '0', 10),
        subscriptionsDeleted: parseInt(attributes.SubscriptionsDeleted || '0', 10),
        deliveryPolicy: attributes.DeliveryPolicy
          ? JSON.parse(attributes.DeliveryPolicy)
          : undefined,
        effectiveDeliveryPolicy: attributes.EffectiveDeliveryPolicy
          ? JSON.parse(attributes.EffectiveDeliveryPolicy)
          : undefined,
        fifoTopic: attributes.FifoTopic === 'true',
        contentBasedDeduplication: attributes.ContentBasedDeduplication === 'true',
        kmsMasterKeyId: attributes.KmsMasterKeyId,
        subscriptions: subscriptions.map((s) => ({
          subscriptionArn: s.SubscriptionArn,
          endpoint: s.Endpoint,
          protocol: s.Protocol,
          owner: s.Owner,
        })),
      },
      tags
    );
  }
}

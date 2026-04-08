// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GCPBaseScanner, GCPScannerConfig, GCPScanResult } from './base-scanner';
import { getGCPClientFactory } from '../client-factory';

export class PubSubScanner extends GCPBaseScanner {
  constructor(config: GCPScannerConfig) {
    super(config, 'pubsub', 'Pub/Sub');
  }

  async scan(): Promise<GCPScanResult> {
    const resources: GCPScanResult['resources'] = [];
    const errors: GCPScanResult['errors'] = [];
    const factory = getGCPClientFactory(this.config.projectId);
    const client = factory.getPubSubClient();

    // Scan topics
    try {
      const [topics] = await client.getTopics();

      for (const topic of topics) {
        const fullName = topic.name;
        // Topic name format: projects/{project}/topics/{topic}
        const topicName = fullName.split('/').pop() || fullName;

        const metadata = topic.metadata || {};

        resources.push(this.createResource(
          fullName,
          'topic',
          topicName,
          'global',
          {
            name: topicName,
            labels: metadata.labels,
          },
          this.parseLabels(metadata.labels as Record<string, string>),
        ));
      }
    } catch (error) {
      if (!this.isApiNotEnabled(error)) {
        errors.push(this.createError('getTopics', error));
      }
    }

    // Scan subscriptions
    try {
      const [subscriptions] = await client.getSubscriptions();

      for (const subscription of subscriptions) {
        const fullName = subscription.name;
        // Subscription name format: projects/{project}/subscriptions/{subscription}
        const subName = fullName.split('/').pop() || fullName;

        const metadata = subscription.metadata || {};

        resources.push(this.createResource(
          fullName,
          'subscription',
          subName,
          'global',
          {
            name: subName,
            topic: metadata.topic,
            pushConfig: metadata.pushConfig,
            ackDeadlineSeconds: metadata.ackDeadlineSeconds,
            retainAckedMessages: metadata.retainAckedMessages,
            messageRetentionDuration: metadata.messageRetentionDuration,
            filter: metadata.filter,
            deadLetterPolicy: metadata.deadLetterPolicy,
            retryPolicy: metadata.retryPolicy,
          },
          this.parseLabels(metadata.labels as Record<string, string>),
        ));
      }
    } catch (error) {
      if (!this.isApiNotEnabled(error)) {
        errors.push(this.createError('getSubscriptions', error));
      }
    }

    return { resources, errors };
  }
}

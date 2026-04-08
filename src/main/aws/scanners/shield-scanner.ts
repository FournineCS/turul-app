// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  ListProtectionsCommand,
  DescribeSubscriptionCommand,
  ListTagsForResourceCommand,
} from '@aws-sdk/client-shield';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class ShieldScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'shield', 'shield');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getShieldClient({
      profile: this.config.profile,
      region: this.config.region,
    });

    // Get subscription info
    let subscriptionDetails: Record<string, unknown> = {};
    try {
      const subscriptionResp = await this.withRateLimit(() =>
        client.send(new DescribeSubscriptionCommand({}))
      );
      const sub = subscriptionResp.Subscription;
      if (sub) {
        subscriptionDetails = {
          startTime: sub.StartTime?.toISOString(),
          endTime: sub.EndTime?.toISOString(),
          timeCommitmentInSeconds: sub.TimeCommitmentInSeconds,
          autoRenew: sub.AutoRenew,
          subscriptionArn: sub.SubscriptionArn,
          proactiveEngagementStatus: sub.ProactiveEngagementStatus,
        };
      }
    } catch (error: unknown) {
      const errorName = (error as { name?: string })?.name;
      if (errorName === 'ResourceNotFoundException') {
        // Shield Advanced is not subscribed — nothing to scan
        return { resources, errors };
      }
      errors.push(this.createError('DescribeSubscription', error));
    }

    // List protections with pagination
    try {
      let nextToken: string | undefined;

      do {
        const response = await this.withRateLimit(() =>
          client.send(new ListProtectionsCommand({ NextToken: nextToken }))
        );

        if (response.Protections) {
          for (const protection of response.Protections) {
            if (!protection.ProtectionArn) continue;

            let tags: Record<string, string> = {};
            try {
              const tagsResp = await this.withRateLimit(() =>
                client.send(new ListTagsForResourceCommand({
                  ResourceARN: protection.ProtectionArn,
                }))
              );
              if (tagsResp.Tags) {
                for (const tag of tagsResp.Tags) {
                  if (tag.Key) tags[tag.Key] = tag.Value || '';
                }
              }
            } catch {
              // Ignore tag errors
            }

            resources.push(this.createResource(
              protection.ProtectionArn,
              'protection',
              protection.Name || protection.Id || '',
              {
                protectionName: protection.Name,
                resourceArn: protection.ResourceArn,
                protectionId: protection.Id,
                applicationLayerAutomaticResponseStatus:
                  protection.ApplicationLayerAutomaticResponseConfiguration?.Status,
                subscription: subscriptionDetails,
              },
              tags,
            ));
          }
        }

        nextToken = response.NextToken;
      } while (nextToken);
    } catch (error: unknown) {
      const errorName = (error as { name?: string })?.name;
      if (errorName === 'ResourceNotFoundException') {
        // Shield Advanced not subscribed — return empty
        return { resources, errors };
      }
      errors.push(this.createError('ListProtections', error));
    }

    return { resources, errors };
  }
}

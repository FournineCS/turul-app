// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { ListJobTemplatesCommand, ListQueuesCommand, ListTagsForResourceCommand } from '@aws-sdk/client-mediaconvert';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class MediaConvertScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'mediaconvert', 'mediaconvert');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];

    const client = getClientFactory().getMediaConvertClient({
      profile: this.config.profile,
      region: this.config.region,
    });

    // Scan job templates
    try {
      let nextToken: string | undefined;
      do {
        const command = new ListJobTemplatesCommand({
          NextToken: nextToken,
          MaxResults: 20,
        });
        const response = await this.withRateLimit(() => client.send(command));

        for (const template of response.JobTemplates || []) {
          resources.push(this.createResource(
            template.Arn || template.Name || '',
            'job-template',
            template.Name || '',
            {
              name: template.Name,
              description: template.Description,
              type: template.Type,
              category: template.Category,
              createdAt: template.CreatedAt,
              lastUpdated: template.LastUpdated,
            },
          ));
        }

        nextToken = response.NextToken;
      } while (nextToken);
    } catch (err) {
      errors.push(this.createError('ListJobTemplates', err));
    }

    // Scan queues
    try {
      let nextToken: string | undefined;
      do {
        const command = new ListQueuesCommand({
          NextToken: nextToken,
          MaxResults: 20,
        });
        const response = await this.withRateLimit(() => client.send(command));

        for (const queue of response.Queues || []) {
          let tags: Record<string, string> = {};

          if (queue.Arn) {
            try {
              const tagsCommand = new ListTagsForResourceCommand({ Arn: queue.Arn });
              const tagsResponse = await this.withRateLimit(() => client.send(tagsCommand));
              tags = tagsResponse.ResourceTags?.Tags || {};
            } catch {
              // Ignore tag fetch errors
            }
          }

          resources.push(this.createResource(
            queue.Arn || queue.Name || '',
            'queue',
            queue.Name || '',
            {
              name: queue.Name,
              description: queue.Description,
              status: queue.Status,
              pricingPlan: queue.PricingPlan,
              type: queue.Type,
            },
            tags,
          ));
        }

        nextToken = response.NextToken;
      } while (nextToken);
    } catch (err) {
      errors.push(this.createError('ListQueues', err));
    }

    return { resources, errors };
  }
}

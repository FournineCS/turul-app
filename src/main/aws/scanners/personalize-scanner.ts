// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  ListCampaignsCommand,
  ListSolutionsCommand,
  ListDatasetGroupsCommand,
  ListTagsForResourceCommand,
} from '@aws-sdk/client-personalize';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class PersonalizeScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'personalize', 'personalize');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];

    const client = getClientFactory().getPersonalizeClient({
      profile: this.config.profile,
      region: this.config.region,
    });

    // Scan dataset groups
    try {
      let nextToken: string | undefined;
      do {
        const response = await this.withRateLimit(() => client.send(
          new ListDatasetGroupsCommand({
            nextToken,
            maxResults: 100,
          })
        ));

        for (const group of response.datasetGroups ?? []) {
          const arn = group.datasetGroupArn ?? '';
          let tags: Record<string, string> = {};

          if (arn) {
            try {
              const tagsResponse = await this.withRateLimit(() => client.send(
                new ListTagsForResourceCommand({ resourceArn: arn })
              ));
              tags = Object.fromEntries(
                (tagsResponse.tags ?? []).map((t) => [t.tagKey ?? '', t.tagValue ?? ''])
              );
            } catch {
              // Tags are optional; ignore failures
            }
          }

          resources.push(this.createResource(
            arn,
            'dataset-group',
            group.name ?? '',
            {
              name: group.name,
              status: group.status,
              domain: group.domain,
              creationDateTime: group.creationDateTime,
              lastUpdatedDateTime: group.lastUpdatedDateTime,
            },
            tags,
          ));
        }

        nextToken = response.nextToken;
      } while (nextToken);
    } catch (err) {
      errors.push(this.createError('ListDatasetGroups', err));
    }

    // Scan solutions
    try {
      let nextToken: string | undefined;
      do {
        const response = await this.withRateLimit(() => client.send(
          new ListSolutionsCommand({
            nextToken,
            maxResults: 100,
          })
        ));

        for (const solution of response.solutions ?? []) {
          const arn = solution.solutionArn ?? '';
          let tags: Record<string, string> = {};

          if (arn) {
            try {
              const tagsResponse = await this.withRateLimit(() => client.send(
                new ListTagsForResourceCommand({ resourceArn: arn })
              ));
              tags = Object.fromEntries(
                (tagsResponse.tags ?? []).map((t) => [t.tagKey ?? '', t.tagValue ?? ''])
              );
            } catch {
              // Tags are optional; ignore failures
            }
          }

          resources.push(this.createResource(
            arn,
            'solution',
            solution.name ?? '',
            {
              name: solution.name,
              status: solution.status,
              creationDateTime: solution.creationDateTime,
              lastUpdatedDateTime: solution.lastUpdatedDateTime,
            },
            tags,
          ));
        }

        nextToken = response.nextToken;
      } while (nextToken);
    } catch (err) {
      errors.push(this.createError('ListSolutions', err));
    }

    // Scan campaigns
    try {
      let nextToken: string | undefined;
      do {
        const response = await this.withRateLimit(() => client.send(
          new ListCampaignsCommand({
            nextToken,
            maxResults: 100,
          })
        ));

        for (const campaign of response.campaigns ?? []) {
          const arn = campaign.campaignArn ?? '';
          let tags: Record<string, string> = {};

          if (arn) {
            try {
              const tagsResponse = await this.withRateLimit(() => client.send(
                new ListTagsForResourceCommand({ resourceArn: arn })
              ));
              tags = Object.fromEntries(
                (tagsResponse.tags ?? []).map((t) => [t.tagKey ?? '', t.tagValue ?? ''])
              );
            } catch {
              // Tags are optional; ignore failures
            }
          }

          resources.push(this.createResource(
            arn,
            'campaign',
            campaign.name ?? '',
            {
              name: campaign.name,
              status: campaign.status,
              creationDateTime: campaign.creationDateTime,
              lastUpdatedDateTime: campaign.lastUpdatedDateTime,
            },
            tags,
          ));
        }

        nextToken = response.nextToken;
      } while (nextToken);
    } catch (err) {
      errors.push(this.createError('ListCampaigns', err));
    }

    return { resources, errors };
  }
}

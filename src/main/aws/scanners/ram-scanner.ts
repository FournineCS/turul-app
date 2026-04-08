// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  GetResourceSharesCommand,
  ListResourcesCommand,
} from '@aws-sdk/client-ram';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class RAMScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'ram', 'ram');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];

    const [sharesResult, sharedResourcesResult] = await Promise.allSettled([
      this.scanResourceShares(),
      this.scanSharedResources(),
    ]);

    if (sharesResult.status === 'fulfilled') {
      resources.push(...sharesResult.value.resources);
      errors.push(...sharesResult.value.errors);
    } else {
      errors.push(this.createError('GetResourceShares', sharesResult.reason));
    }

    if (sharedResourcesResult.status === 'fulfilled') {
      resources.push(...sharedResourcesResult.value.resources);
      errors.push(...sharedResourcesResult.value.errors);
    } else {
      errors.push(this.createError('ListResources', sharedResourcesResult.reason));
    }

    return { resources, errors };
  }

  private async scanResourceShares(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getRAMClient({
      profile: this.config.profile,
      region: this.config.region,
    });

    try {
      let nextToken: string | undefined;

      do {
        const response = await this.withRateLimit(() =>
          client.send(new GetResourceSharesCommand({
            resourceOwner: 'SELF',
            nextToken,
          }))
        );

        if (response.resourceShares) {
          for (const share of response.resourceShares) {
            if (!share.resourceShareArn) continue;

            const tags = this.parseTagsLowercase(share.tags);

            resources.push(this.createResource(
              share.resourceShareArn,
              'resource-share',
              share.name || '',
              {
                shareName: share.name,
                shareArn: share.resourceShareArn,
                status: share.status,
                statusMessage: share.statusMessage,
                owningAccountId: share.owningAccountId,
                allowExternalPrincipals: share.allowExternalPrincipals,
                featureSet: share.featureSet,
                lastUpdatedTime: share.lastUpdatedTime?.toISOString(),
              },
              tags,
              share.creationTime?.toISOString()
            ));
          }
        }

        nextToken = response.nextToken;
      } while (nextToken);
    } catch (error) {
      errors.push(this.createError('GetResourceShares', error));
    }

    return { resources, errors };
  }

  private async scanSharedResources(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getRAMClient({
      profile: this.config.profile,
      region: this.config.region,
    });

    try {
      let nextToken: string | undefined;

      do {
        const response = await this.withRateLimit(() =>
          client.send(new ListResourcesCommand({
            resourceOwner: 'SELF',
            nextToken,
          }))
        );

        if (response.resources) {
          for (const res of response.resources) {
            if (!res.arn) continue;

            resources.push(this.createResource(
              res.arn,
              'shared-resource',
              res.arn,
              {
                resourceArn: res.arn,
                resourceType: res.type,
                resourceShareArn: res.resourceShareArn,
                resourceGroupArn: res.resourceGroupArn,
                status: res.status,
                statusMessage: res.statusMessage,
                lastUpdatedTime: res.lastUpdatedTime?.toISOString(),
              },
              {},
              res.creationTime?.toISOString()
            ));
          }
        }

        nextToken = response.nextToken;
      } while (nextToken);
    } catch (error) {
      errors.push(this.createError('ListResources', error));
    }

    return { resources, errors };
  }
}

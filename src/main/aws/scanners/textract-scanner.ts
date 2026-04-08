// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { ListAdaptersCommand, ListTagsForResourceCommand } from '@aws-sdk/client-textract';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class TextractScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'textract', 'textract');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getTextractClient({ profile: this.config.profile, region: this.config.region });

    try {
      let nextToken: string | undefined;
      do {
        const response = await this.withRateLimit(() => client.send(new ListAdaptersCommand({ NextToken: nextToken, MaxResults: 100 })));
        if (response.Adapters) {
          for (const adapter of response.Adapters) {
            if (!adapter.AdapterId) continue;
            const arn = `arn:aws:textract:${this.config.region}:adapter/${adapter.AdapterId}`;

            let tags: Record<string, string> = {};
            try {
              const tagsResp = await this.withRateLimit(() => client.send(new ListTagsForResourceCommand({ ResourceARN: arn })));
              if (tagsResp.Tags) { for (const [k, v] of Object.entries(tagsResp.Tags)) { tags[k] = v || ''; } }
            } catch { /* ignore */ }

            resources.push(this.createResource(arn, 'adapter', adapter.AdapterId, {
              adapterId: adapter.AdapterId,
              adapterName: adapter.AdapterId,
              featureTypes: adapter.FeatureTypes,
              creationTime: adapter.CreationTime?.toISOString(),
            }, tags, adapter.CreationTime?.toISOString()));
          }
        }
        nextToken = response.NextToken;
      } while (nextToken);
    } catch (error) { errors.push(this.createError('ListAdapters', error)); }

    return { resources, errors };
  }
}

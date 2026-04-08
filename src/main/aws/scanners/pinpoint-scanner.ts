// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GetAppsCommand, ListTagsForResourceCommand } from '@aws-sdk/client-pinpoint';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class PinpointScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'pinpoint', 'pinpoint');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];

    try {
      const client = getClientFactory().getPinpointClient({
        profile: this.config.profile,
        region: this.config.region,
      });

      let token: string | undefined;

      do {
        const command = new GetAppsCommand({ Token: token });
        const response = await this.withRateLimit(() => client.send(command));

        const items = response.ApplicationsResponse?.Item ?? [];

        for (const app of items) {
          try {
            const arn = app.Arn || `arn:aws:mobiletargeting:${this.config.region}:apps/${app.Id}`;

            let tags: Record<string, string> = {};
            try {
              const tagsCommand = new ListTagsForResourceCommand({ ResourceArn: arn });
              const tagsResponse = await this.withRateLimit(() => client.send(tagsCommand));
              tags = tagsResponse.TagsModel?.tags ?? {};
            } catch (tagErr) {
              // Tags are best-effort; continue without them
            }

            resources.push(this.createResource(
              arn,
              'application',
              app.Name || app.Id || '',
              {
                applicationId: app.Id,
                name: app.Name,
                creationDate: app.CreationDate,
              },
              tags,
            ));
          } catch (appErr) {
            errors.push(this.createError(`ProcessApp:${app.Id}`, appErr));
          }
        }

        token = response.ApplicationsResponse?.NextToken;
      } while (token);
    } catch (err) {
      errors.push(this.createError('GetApps', err));
    }

    return { resources, errors };
  }
}

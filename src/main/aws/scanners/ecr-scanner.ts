// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  DescribeRepositoriesCommand,
  ListTagsForResourceCommand,
} from '@aws-sdk/client-ecr';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class ECRScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'ecr', 'ecr');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getECRClient({ profile: this.config.profile, region: this.config.region });

    try {
      let nextToken: string | undefined;
      do {
        const response = await this.withRateLimit(() => client.send(new DescribeRepositoriesCommand({ nextToken })));
        if (response.repositories) {
          for (const repo of response.repositories) {
            if (!repo.repositoryArn) continue;

            let tags: Record<string, string> = {};
            try {
              const tagsResp = await this.withRateLimit(() => client.send(new ListTagsForResourceCommand({ resourceArn: repo.repositoryArn })));
              if (tagsResp.tags) {
                for (const tag of tagsResp.tags) {
                  if (tag.Key) tags[tag.Key] = tag.Value || '';
                }
              }
            } catch { /* ignore */ }

            resources.push(this.createResource(repo.repositoryArn, 'repository', repo.repositoryName || '', {
              repositoryName: repo.repositoryName,
              repositoryUri: repo.repositoryUri,
              registryId: repo.registryId,
              imageTagMutability: repo.imageTagMutability,
              imageScanningConfiguration: repo.imageScanningConfiguration?.scanOnPush,
              encryptionType: repo.encryptionConfiguration?.encryptionType,
            }, tags, repo.createdAt?.toISOString()));
          }
        }
        nextToken = response.nextToken;
      } while (nextToken);
    } catch (error) { errors.push(this.createError('DescribeRepositories', error)); }

    return { resources, errors };
  }
}

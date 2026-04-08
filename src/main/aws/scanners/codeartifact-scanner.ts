// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  ListDomainsCommand,
  ListRepositoriesCommand,
  ListTagsForResourceCommand,
} from '@aws-sdk/client-codeartifact';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class CodeArtifactScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'codeartifact', 'codeartifact');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getCodeArtifactClient({ profile: this.config.profile, region: this.config.region });

    // Scan domains
    try {
      let nextToken: string | undefined;
      do {
        const response = await this.withRateLimit(() => client.send(new ListDomainsCommand({ nextToken })));
        if (response.domains) {
          for (const domain of response.domains) {
            if (!domain.arn) continue;

            let tags: Record<string, string> = {};
            try {
              const tagsResp = await this.withRateLimit(() => client.send(new ListTagsForResourceCommand({ resourceArn: domain.arn })));
              if (tagsResp.tags) {
                for (const tag of tagsResp.tags) {
                  if (tag.key) tags[tag.key] = tag.value || '';
                }
              }
            } catch { /* ignore */ }

            resources.push(this.createResource(domain.arn, 'domain', domain.name || '', {
              domainName: domain.name,
              owner: domain.owner,
              status: domain.status,
              encryptionKey: domain.encryptionKey,
            }, tags, domain.createdTime?.toISOString()));
          }
        }
        nextToken = response.nextToken;
      } while (nextToken);
    } catch (error) { errors.push(this.createError('ListDomains', error)); }

    // Scan repositories
    try {
      let nextToken: string | undefined;
      do {
        const response = await this.withRateLimit(() => client.send(new ListRepositoriesCommand({ nextToken })));
        if (response.repositories) {
          for (const repo of response.repositories) {
            if (!repo.arn) continue;

            let tags: Record<string, string> = {};
            try {
              const tagsResp = await this.withRateLimit(() => client.send(new ListTagsForResourceCommand({ resourceArn: repo.arn })));
              if (tagsResp.tags) {
                for (const tag of tagsResp.tags) {
                  if (tag.key) tags[tag.key] = tag.value || '';
                }
              }
            } catch { /* ignore */ }

            resources.push(this.createResource(repo.arn, 'repository', repo.name || '', {
              repositoryName: repo.name,
              description: repo.description,
              domainName: repo.domainName,
              domainOwner: repo.domainOwner,
            }, tags));
          }
        }
        nextToken = response.nextToken;
      } while (nextToken);
    } catch (error) { errors.push(this.createError('ListRepositories', error)); }

    return { resources, errors };
  }
}

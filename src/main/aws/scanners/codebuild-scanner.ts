// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  ListProjectsCommand,
  BatchGetProjectsCommand,
} from '@aws-sdk/client-codebuild';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class CodeBuildScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'codebuild', 'codebuild');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getCodeBuildClient({ profile: this.config.profile, region: this.config.region });

    try {
      let nextToken: string | undefined;
      do {
        const response = await this.withRateLimit(() => client.send(new ListProjectsCommand({ nextToken })));
        if (response.projects && response.projects.length > 0) {
          // BatchGetProjects supports max 100 at a time
          for (let i = 0; i < response.projects.length; i += 100) {
            const batch = response.projects.slice(i, i + 100);
            try {
              const batchResp = await this.withRateLimit(() => client.send(new BatchGetProjectsCommand({ names: batch })));
              if (batchResp.projects) {
                for (const project of batchResp.projects) {
                  if (!project.arn) continue;
                  const tags: Record<string, string> = {};
                  if (project.tags) {
                    for (const tag of project.tags) {
                      if (tag.key) tags[tag.key] = tag.value || '';
                    }
                  }

                  resources.push(this.createResource(project.arn, 'build-project', project.name || '', {
                    projectName: project.name,
                    description: project.description,
                    serviceRole: project.serviceRole,
                    source: project.source ? {
                      type: project.source.type,
                      location: project.source.location,
                      buildspec: project.source.buildspec ? 'inline' : undefined,
                    } : undefined,
                    environment: project.environment ? {
                      type: project.environment.type,
                      computeType: project.environment.computeType,
                      image: project.environment.image,
                      privilegedMode: project.environment.privilegedMode,
                    } : undefined,
                    timeoutInMinutes: project.timeoutInMinutes,
                    badge: project.badge?.badgeEnabled,
                    concurrentBuildLimit: project.concurrentBuildLimit,
                    lastModified: project.lastModified?.toISOString(),
                  }, tags, project.created?.toISOString()));
                }
              }
            } catch (error) { errors.push(this.createError('BatchGetProjects', error)); }
          }
        }
        nextToken = response.nextToken;
      } while (nextToken);
    } catch (error) { errors.push(this.createError('ListProjects', error)); }

    return { resources, errors };
  }
}

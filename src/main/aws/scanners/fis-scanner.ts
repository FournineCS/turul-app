// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  ListExperimentTemplatesCommand,
  GetExperimentTemplateCommand,
  ListTagsForResourceCommand,
} from '@aws-sdk/client-fis';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class FISScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'fis', 'fis');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getFISClient({
      profile: this.config.profile,
      region: this.config.region,
    });

    try {
      let nextToken: string | undefined;

      do {
        const response = await this.withRateLimit(() =>
          client.send(new ListExperimentTemplatesCommand({ nextToken }))
        );

        if (response.experimentTemplates) {
          for (const templateSummary of response.experimentTemplates) {
            if (!templateSummary.id) continue;

            let templateDetails: Record<string, unknown> = {
              templateId: templateSummary.id,
              description: templateSummary.description,
              creationTime: templateSummary.creationTime?.toISOString(),
              lastUpdateTime: templateSummary.lastUpdateTime?.toISOString(),
            };

            // Get full template details
            try {
              const detailResponse = await this.withRateLimit(() =>
                client.send(new GetExperimentTemplateCommand({ id: templateSummary.id }))
              );

              const template = detailResponse.experimentTemplate;
              if (template) {
                templateDetails = {
                  templateId: template.id,
                  description: template.description,
                  actions: template.actions
                    ? Object.entries(template.actions).map(([name, action]) => ({
                        name,
                        actionId: action.actionId,
                        description: action.description,
                        parameters: action.parameters,
                        targets: action.targets,
                        startAfter: action.startAfter,
                      }))
                    : [],
                  targets: template.targets
                    ? Object.entries(template.targets).map(([name, target]) => ({
                        name,
                        resourceType: target.resourceType,
                        resourceArns: target.resourceArns,
                        resourceTags: target.resourceTags,
                        filters: target.filters?.map(f => ({
                          path: f.path,
                          values: f.values,
                        })),
                        selectionMode: target.selectionMode,
                        parameters: target.parameters,
                      }))
                    : [],
                  stopConditions: template.stopConditions?.map(sc => ({
                    source: sc.source,
                    value: sc.value,
                  })) || [],
                  roleArn: template.roleArn,
                  creationTime: template.creationTime?.toISOString(),
                  lastUpdateTime: template.lastUpdateTime?.toISOString(),
                  logConfiguration: template.logConfiguration,
                  experimentOptions: template.experimentOptions,
                  targetAccountConfigurationsCount: template.targetAccountConfigurationsCount,
                };
              }
            } catch {
              // Fall back to summary info if detail fetch fails
            }

            // Get tags via ListTagsForResource
            let tags: Record<string, string> = {};
            if (templateSummary.arn) {
              try {
                const tagsResponse = await this.withRateLimit(() =>
                  client.send(new ListTagsForResourceCommand({ resourceArn: templateSummary.arn }))
                );
                if (tagsResponse.tags) {
                  tags = tagsResponse.tags;
                }
              } catch {
                // Ignore tag errors
              }
            }

            resources.push(
              this.createResource(
                templateSummary.arn || templateSummary.id,
                'experiment-template',
                templateSummary.description || templateSummary.id,
                templateDetails,
                tags,
                templateSummary.creationTime?.toISOString()
              )
            );
          }
        }

        nextToken = response.nextToken;
      } while (nextToken);
    } catch (error) {
      errors.push(this.createError('ListExperimentTemplates', error));
    }

    return { resources, errors };
  }
}

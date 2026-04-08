// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  ListImagePipelinesCommand,
  ListImageRecipesCommand,
  ListComponentsCommand,
  ListTagsForResourceCommand,
} from '@aws-sdk/client-imagebuilder';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class ImageBuilderScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'imagebuilder', 'imagebuilder');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getImageBuilderClient({
      profile: this.config.profile,
      region: this.config.region,
    });

    // Scan Image Pipelines
    try {
      let nextToken: string | undefined;
      do {
        const response = await this.withRateLimit(() =>
          client.send(new ListImagePipelinesCommand({ nextToken }))
        );

        if (response.imagePipelineList) {
          for (const pipeline of response.imagePipelineList) {
            if (!pipeline.arn) continue;

            let tags: Record<string, string> = {};
            try {
              const tagsResp = await this.withRateLimit(() =>
                client.send(new ListTagsForResourceCommand({ resourceArn: pipeline.arn }))
              );
              if (tagsResp.tags) {
                tags = { ...tagsResp.tags } as Record<string, string>;
              }
            } catch { /* ignore tag errors */ }

            resources.push(this.createResource(
              pipeline.arn,
              'pipeline',
              pipeline.name || '',
              {
                pipelineName: pipeline.name,
                status: pipeline.status,
                platform: pipeline.platform,
                schedule: pipeline.schedule ? {
                  scheduleExpression: pipeline.schedule.scheduleExpression,
                  pipelineExecutionStartCondition: pipeline.schedule.pipelineExecutionStartCondition,
                  timezone: pipeline.schedule.timezone,
                } : undefined,
                description: pipeline.description,
                imageRecipeArn: pipeline.imageRecipeArn,
                containerRecipeArn: pipeline.containerRecipeArn,
                infrastructureConfigurationArn: pipeline.infrastructureConfigurationArn,
                distributionConfigurationArn: pipeline.distributionConfigurationArn,
                enhancedImageMetadataEnabled: pipeline.enhancedImageMetadataEnabled,
                imageTestsConfiguration: pipeline.imageTestsConfiguration ? {
                  imageTestsEnabled: pipeline.imageTestsConfiguration.imageTestsEnabled,
                  timeoutMinutes: pipeline.imageTestsConfiguration.timeoutMinutes,
                } : undefined,
              },
              tags,
              pipeline.dateCreated
            ));
          }
        }

        nextToken = response.nextToken;
      } while (nextToken);
    } catch (error) {
      errors.push(this.createError('ListImagePipelines', error));
    }

    // Scan Image Recipes
    try {
      let nextToken: string | undefined;
      do {
        const response = await this.withRateLimit(() =>
          client.send(new ListImageRecipesCommand({ nextToken }))
        );

        if (response.imageRecipeSummaryList) {
          for (const recipe of response.imageRecipeSummaryList) {
            if (!recipe.arn) continue;

            let tags: Record<string, string> = {};
            try {
              const tagsResp = await this.withRateLimit(() =>
                client.send(new ListTagsForResourceCommand({ resourceArn: recipe.arn }))
              );
              if (tagsResp.tags) {
                tags = { ...tagsResp.tags } as Record<string, string>;
              }
            } catch { /* ignore tag errors */ }

            resources.push(this.createResource(
              recipe.arn,
              'recipe',
              recipe.name || '',
              {
                recipeName: recipe.name,
                parentImage: recipe.parentImage,
                platform: recipe.platform,
                owner: recipe.owner,
              },
              tags,
              recipe.dateCreated
            ));
          }
        }

        nextToken = response.nextToken;
      } while (nextToken);
    } catch (error) {
      errors.push(this.createError('ListImageRecipes', error));
    }

    // Scan Components
    try {
      let nextToken: string | undefined;
      do {
        const response = await this.withRateLimit(() =>
          client.send(new ListComponentsCommand({ nextToken }))
        );

        if (response.componentVersionList) {
          for (const component of response.componentVersionList) {
            if (!component.arn) continue;

            let tags: Record<string, string> = {};
            try {
              const tagsResp = await this.withRateLimit(() =>
                client.send(new ListTagsForResourceCommand({ resourceArn: component.arn }))
              );
              if (tagsResp.tags) {
                tags = { ...tagsResp.tags } as Record<string, string>;
              }
            } catch { /* ignore tag errors */ }

            resources.push(this.createResource(
              component.arn,
              'component',
              component.name || '',
              {
                componentName: component.name,
                version: component.version,
                platform: component.platform,
                type: component.type,
                owner: component.owner,
                description: component.description,
              },
              tags,
              component.dateCreated
            ));
          }
        }

        nextToken = response.nextToken;
      } while (nextToken);
    } catch (error) {
      errors.push(this.createError('ListComponents', error));
    }

    return { resources, errors };
  }
}

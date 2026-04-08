// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  ListCustomModelsCommand,
  ListProvisionedModelThroughputsCommand,
  ListGuardrailsCommand,
  ListTagsForResourceCommand,
} from '@aws-sdk/client-bedrock';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class BedrockScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'bedrock', 'bedrock');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];

    const [customModelsResult, throughputsResult, guardrailsResult] = await Promise.allSettled([
      this.scanCustomModels(),
      this.scanProvisionedThroughputs(),
      this.scanGuardrails(),
    ]);

    if (customModelsResult.status === 'fulfilled') {
      resources.push(...customModelsResult.value.resources);
      errors.push(...customModelsResult.value.errors);
    } else {
      if (!this.isServiceNotAvailable(customModelsResult.reason)) {
        errors.push(this.createError('ListCustomModels', customModelsResult.reason));
      }
    }

    if (throughputsResult.status === 'fulfilled') {
      resources.push(...throughputsResult.value.resources);
      errors.push(...throughputsResult.value.errors);
    } else {
      if (!this.isServiceNotAvailable(throughputsResult.reason)) {
        errors.push(this.createError('ListProvisionedModelThroughputs', throughputsResult.reason));
      }
    }

    if (guardrailsResult.status === 'fulfilled') {
      resources.push(...guardrailsResult.value.resources);
      errors.push(...guardrailsResult.value.errors);
    } else {
      if (!this.isServiceNotAvailable(guardrailsResult.reason)) {
        errors.push(this.createError('ListGuardrails', guardrailsResult.reason));
      }
    }

    return { resources, errors };
  }

  private async scanCustomModels(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getBedrockClient({
      profile: this.config.profile,
      region: this.config.region,
    });

    try {
      let nextToken: string | undefined;
      do {
        const response = await this.withRateLimit(() =>
          client.send(new ListCustomModelsCommand({ nextToken }))
        );

        if (response.modelSummaries) {
          for (const model of response.modelSummaries) {
            if (!model.modelArn) continue;

            let tags: Record<string, string> = {};
            try {
              const tagsResp = await this.withRateLimit(() =>
                client.send(new ListTagsForResourceCommand({ resourceARN: model.modelArn }))
              );
              if (tagsResp.tags) {
                for (const tag of tagsResp.tags) {
                  if (tag.key) tags[tag.key] = tag.value || '';
                }
              }
            } catch { /* ignore tag errors */ }

            resources.push(this.createResource(
              model.modelArn,
              'custom-model',
              model.modelName || '',
              {
                modelName: model.modelName,
                modelArn: model.modelArn,
                baseModelArn: model.baseModelArn,
                baseModelName: model.baseModelName,
                customizationType: model.customizationType,
              },
              tags,
              model.creationTime?.toISOString()
            ));
          }
        }

        nextToken = response.nextToken;
      } while (nextToken);
    } catch (error) {
      if (this.isServiceNotAvailable(error)) {
        return { resources: [], errors: [] };
      }
      errors.push(this.createError('ListCustomModels', error));
    }

    return { resources, errors };
  }

  private async scanProvisionedThroughputs(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getBedrockClient({
      profile: this.config.profile,
      region: this.config.region,
    });

    try {
      let nextToken: string | undefined;
      do {
        const response = await this.withRateLimit(() =>
          client.send(new ListProvisionedModelThroughputsCommand({ nextToken }))
        );

        if (response.provisionedModelSummaries) {
          for (const pt of response.provisionedModelSummaries) {
            if (!pt.provisionedModelArn) continue;

            let tags: Record<string, string> = {};
            try {
              const tagsResp = await this.withRateLimit(() =>
                client.send(new ListTagsForResourceCommand({ resourceARN: pt.provisionedModelArn }))
              );
              if (tagsResp.tags) {
                for (const tag of tagsResp.tags) {
                  if (tag.key) tags[tag.key] = tag.value || '';
                }
              }
            } catch { /* ignore tag errors */ }

            resources.push(this.createResource(
              pt.provisionedModelArn,
              'provisioned-throughput',
              pt.provisionedModelName || '',
              {
                provisionedModelName: pt.provisionedModelName,
                provisionedModelArn: pt.provisionedModelArn,
                modelArn: pt.modelArn,
                desiredModelArn: pt.desiredModelArn,
                foundationModelArn: pt.foundationModelArn,
                modelUnits: pt.modelUnits,
                desiredModelUnits: pt.desiredModelUnits,
                status: pt.status,
                commitmentDuration: pt.commitmentDuration,
                commitmentExpirationTime: pt.commitmentExpirationTime?.toISOString(),
              },
              tags,
              pt.creationTime?.toISOString()
            ));
          }
        }

        nextToken = response.nextToken;
      } while (nextToken);
    } catch (error) {
      if (this.isServiceNotAvailable(error)) {
        return { resources: [], errors: [] };
      }
      errors.push(this.createError('ListProvisionedModelThroughputs', error));
    }

    return { resources, errors };
  }

  private async scanGuardrails(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getBedrockClient({
      profile: this.config.profile,
      region: this.config.region,
    });

    try {
      let nextToken: string | undefined;
      do {
        const response = await this.withRateLimit(() =>
          client.send(new ListGuardrailsCommand({ nextToken }))
        );

        if (response.guardrails) {
          for (const guardrail of response.guardrails) {
            if (!guardrail.arn) continue;

            let tags: Record<string, string> = {};
            try {
              const tagsResp = await this.withRateLimit(() =>
                client.send(new ListTagsForResourceCommand({ resourceARN: guardrail.arn }))
              );
              if (tagsResp.tags) {
                for (const tag of tagsResp.tags) {
                  if (tag.key) tags[tag.key] = tag.value || '';
                }
              }
            } catch { /* ignore tag errors */ }

            resources.push(this.createResource(
              guardrail.arn,
              'guardrail',
              guardrail.name || '',
              {
                guardrailId: guardrail.id,
                guardrailName: guardrail.name,
                guardrailArn: guardrail.arn,
                status: guardrail.status,
                version: guardrail.version,
                description: guardrail.description,
              },
              tags,
              guardrail.createdAt?.toISOString()
            ));
          }
        }

        nextToken = response.nextToken;
      } while (nextToken);
    } catch (error) {
      if (this.isServiceNotAvailable(error)) {
        return { resources: [], errors: [] };
      }
      errors.push(this.createError('ListGuardrails', error));
    }

    return { resources, errors };
  }

  private isServiceNotAvailable(error: unknown): boolean {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      return (
        error.name === 'UnrecognizedClientException' ||
        error.name === 'InvalidEndpointException' ||
        message.includes('not available') ||
        message.includes('not supported') ||
        message.includes('could not resolve the endpoint') ||
        message.includes('endpoint is not valid for this region')
      );
    }
    return false;
  }
}

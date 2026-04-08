// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  ListEndpointsCommand,
  ListModelsCommand,
  ListNotebookInstancesCommand,
  ListTagsCommand,
} from '@aws-sdk/client-sagemaker';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class SageMakerScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'sagemaker', 'sagemaker');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];

    const [endpointsResult, modelsResult, notebooksResult] = await Promise.allSettled([
      this.scanEndpoints(),
      this.scanModels(),
      this.scanNotebookInstances(),
    ]);

    if (endpointsResult.status === 'fulfilled') { resources.push(...endpointsResult.value.resources); errors.push(...endpointsResult.value.errors); }
    else errors.push(this.createError('ListEndpoints', endpointsResult.reason));
    if (modelsResult.status === 'fulfilled') { resources.push(...modelsResult.value.resources); errors.push(...modelsResult.value.errors); }
    else errors.push(this.createError('ListModels', modelsResult.reason));
    if (notebooksResult.status === 'fulfilled') { resources.push(...notebooksResult.value.resources); errors.push(...notebooksResult.value.errors); }
    else errors.push(this.createError('ListNotebookInstances', notebooksResult.reason));

    return { resources, errors };
  }

  private async scanEndpoints(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getSageMakerClient({ profile: this.config.profile, region: this.config.region });

    try {
      let nextToken: string | undefined;
      do {
        const response = await this.withRateLimit(() => client.send(new ListEndpointsCommand({ NextToken: nextToken })));
        if (response.Endpoints) {
          for (const endpoint of response.Endpoints) {
            if (!endpoint.EndpointArn) continue;

            let tags: Record<string, string> = {};
            try {
              const tagsResp = await this.withRateLimit(() => client.send(new ListTagsCommand({ ResourceArn: endpoint.EndpointArn })));
              if (tagsResp.Tags) {
                for (const tag of tagsResp.Tags) {
                  if (tag.Key) tags[tag.Key] = tag.Value || '';
                }
              }
            } catch { /* ignore */ }

            resources.push(this.createResource(endpoint.EndpointArn, 'endpoint', endpoint.EndpointName || '', {
              endpointName: endpoint.EndpointName,
              endpointStatus: endpoint.EndpointStatus,
            }, tags, endpoint.CreationTime?.toISOString()));
          }
        }
        nextToken = response.NextToken;
      } while (nextToken);
    } catch (error) { errors.push(this.createError('ListEndpoints', error)); }
    return { resources, errors };
  }

  private async scanModels(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getSageMakerClient({ profile: this.config.profile, region: this.config.region });

    try {
      let nextToken: string | undefined;
      do {
        const response = await this.withRateLimit(() => client.send(new ListModelsCommand({ NextToken: nextToken })));
        if (response.Models) {
          for (const model of response.Models) {
            if (!model.ModelArn) continue;
            resources.push(this.createResource(model.ModelArn, 'model', model.ModelName || '', {
              modelName: model.ModelName,
            }, {}, model.CreationTime?.toISOString()));
          }
        }
        nextToken = response.NextToken;
      } while (nextToken);
    } catch (error) { errors.push(this.createError('ListModels', error)); }
    return { resources, errors };
  }

  private async scanNotebookInstances(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getSageMakerClient({ profile: this.config.profile, region: this.config.region });

    try {
      let nextToken: string | undefined;
      do {
        const response = await this.withRateLimit(() => client.send(new ListNotebookInstancesCommand({ NextToken: nextToken })));
        if (response.NotebookInstances) {
          for (const nb of response.NotebookInstances) {
            if (!nb.NotebookInstanceArn) continue;

            let tags: Record<string, string> = {};
            try {
              const tagsResp = await this.withRateLimit(() => client.send(new ListTagsCommand({ ResourceArn: nb.NotebookInstanceArn })));
              if (tagsResp.Tags) {
                for (const tag of tagsResp.Tags) {
                  if (tag.Key) tags[tag.Key] = tag.Value || '';
                }
              }
            } catch { /* ignore */ }

            resources.push(this.createResource(nb.NotebookInstanceArn, 'notebook-instance', nb.NotebookInstanceName || '', {
              notebookInstanceName: nb.NotebookInstanceName,
              notebookInstanceStatus: nb.NotebookInstanceStatus,
              instanceType: nb.InstanceType,
              url: nb.Url,
            }, tags, nb.CreationTime?.toISOString()));
          }
        }
        nextToken = response.NextToken;
      } while (nextToken);
    } catch (error) { errors.push(this.createError('ListNotebookInstances', error)); }
    return { resources, errors };
  }
}

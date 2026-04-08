// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GCPBaseScanner, GCPScannerConfig, GCPScanResult, GCPScanError } from './base-scanner';
import {
  ModelServiceClient,
  EndpointServiceClient,
  DatasetServiceClient,
  PipelineServiceClient,
  JobServiceClient,
} from '@google-cloud/aiplatform';
import type { Resource } from '../../../shared/types';

const VERTEX_AI_REGIONS = [
  'us-central1', 'us-east1', 'us-east4', 'us-west1', 'us-west4',
  'europe-west1', 'europe-west2', 'europe-west4',
  'asia-east1', 'asia-northeast1', 'asia-southeast1',
  'australia-southeast1',
];

export class VertexAIScanner extends GCPBaseScanner {
  constructor(config: GCPScannerConfig) {
    super(config, 'vertex-ai', 'Vertex AI');
  }

  async scan(): Promise<GCPScanResult> {
    const resources: Resource[] = [];
    const errors: GCPScanError[] = [];

    await this.scanAcrossRegions(async (region) => {
      await this.scanModels(region, resources, errors);
      await this.scanEndpoints(region, resources, errors);
      await this.scanDatasets(region, resources, errors);
      await this.scanTrainingPipelines(region, resources, errors);
      await this.scanCustomJobs(region, resources, errors);
    });

    return { resources, errors };
  }

  private async scanAcrossRegions(
    scanFn: (region: string) => Promise<void>
  ): Promise<void> {
    for (const region of VERTEX_AI_REGIONS) {
      try {
        await scanFn(region);
      } catch (error) {
        // If the entire API is not enabled for this project, stop scanning all regions
        if (this.isApiNotEnabled(error)) return;
        if (!this.isRegionNotAvailable(error)) {
          throw error;
        }
      }
    }
  }

  private isRegionNotAvailable(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return (
      message.includes('is not available in') ||
      message.includes('not supported in') ||
      message.includes('INVALID_ARGUMENT') ||
      (message.includes('Location') && message.includes('is not found'))
    );
  }

  /**
   * Vertex AI clients are regional — each must be created with the correct
   * apiEndpoint for the target region (e.g., us-east1-aiplatform.googleapis.com).
   */
  private getApiEndpoint(region: string): string {
    return `${region}-aiplatform.googleapis.com`;
  }

  private async scanModels(
    region: string,
    resources: Resource[],
    errors: GCPScanError[]
  ): Promise<void> {
    try {
      const client = new ModelServiceClient({ apiEndpoint: this.getApiEndpoint(region) });
      const parent = `projects/${this.config.projectId}/locations/${region}`;

      for await (const model of client.listModelsAsync({ parent })) {
        const name = model.name || '';
        const nameParts = name.split('/');
        const modelId = nameParts.length >= 6 ? nameParts[5] : name;
        const location = nameParts.length >= 4 ? nameParts[3] : region;

        resources.push(this.createResource(
          name,
          'model',
          model.displayName || modelId,
          location,
          {
            name: model.displayName,
            description: model.description,
            createTime: this.formatTimestamp(model.createTime),
            updateTime: this.formatTimestamp(model.updateTime),
            deployedModels: model.deployedModels?.map(dm => ({
              endpoint: dm.endpoint,
              deployedModelId: dm.deployedModelId,
            })),
            containerSpec: model.containerSpec ? {
              imageUri: model.containerSpec.imageUri,
            } : undefined,
          },
          this.parseLabels(model.labels as Record<string, string>),
          this.parseTimestamp(this.formatTimestamp(model.createTime)),
        ));
      }
    } catch (error) {
      if (!this.isApiNotEnabled(error) && !this.isRegionNotAvailable(error)) {
        errors.push(this.createError(`listModels:${region}`, error));
      }
    }
  }

  private async scanEndpoints(
    region: string,
    resources: Resource[],
    errors: GCPScanError[]
  ): Promise<void> {
    try {
      const client = new EndpointServiceClient({ apiEndpoint: this.getApiEndpoint(region) });
      const parent = `projects/${this.config.projectId}/locations/${region}`;

      for await (const endpoint of client.listEndpointsAsync({ parent })) {
        const name = endpoint.name || '';
        const nameParts = name.split('/');
        const endpointId = nameParts.length >= 6 ? nameParts[5] : name;
        const location = nameParts.length >= 4 ? nameParts[3] : region;

        resources.push(this.createResource(
          name,
          'endpoint',
          endpoint.displayName || endpointId,
          location,
          {
            name: endpoint.displayName,
            deployedModels: endpoint.deployedModels?.map(dm => ({
              id: dm.id,
              model: dm.model,
              displayName: dm.displayName,
              machineType: (dm.dedicatedResources?.machineSpec as { machineType?: string })?.machineType,
            })),
            createTime: this.formatTimestamp(endpoint.createTime),
          },
          this.parseLabels(endpoint.labels as Record<string, string>),
          this.parseTimestamp(this.formatTimestamp(endpoint.createTime)),
        ));
      }
    } catch (error) {
      if (!this.isApiNotEnabled(error) && !this.isRegionNotAvailable(error)) {
        errors.push(this.createError(`listEndpoints:${region}`, error));
      }
    }
  }

  private async scanDatasets(
    region: string,
    resources: Resource[],
    errors: GCPScanError[]
  ): Promise<void> {
    try {
      const client = new DatasetServiceClient({ apiEndpoint: this.getApiEndpoint(region) });
      const parent = `projects/${this.config.projectId}/locations/${region}`;

      for await (const dataset of client.listDatasetsAsync({ parent })) {
        const name = dataset.name || '';
        const nameParts = name.split('/');
        const datasetId = nameParts.length >= 6 ? nameParts[5] : name;
        const location = nameParts.length >= 4 ? nameParts[3] : region;

        resources.push(this.createResource(
          name,
          'dataset',
          dataset.displayName || datasetId,
          location,
          {
            name: dataset.displayName,
            metadataSchemaUri: dataset.metadataSchemaUri,
            dataItemCount: dataset.dataItemCount ? Number(dataset.dataItemCount) : undefined,
            createTime: this.formatTimestamp(dataset.createTime),
            updateTime: this.formatTimestamp(dataset.updateTime),
          },
          this.parseLabels(dataset.labels as Record<string, string>),
          this.parseTimestamp(this.formatTimestamp(dataset.createTime)),
        ));
      }
    } catch (error) {
      if (!this.isApiNotEnabled(error) && !this.isRegionNotAvailable(error)) {
        errors.push(this.createError(`listDatasets:${region}`, error));
      }
    }
  }

  private async scanTrainingPipelines(
    region: string,
    resources: Resource[],
    errors: GCPScanError[]
  ): Promise<void> {
    try {
      const client = new PipelineServiceClient({ apiEndpoint: this.getApiEndpoint(region) });
      const parent = `projects/${this.config.projectId}/locations/${region}`;

      for await (const pipeline of client.listTrainingPipelinesAsync({ parent })) {
        const name = pipeline.name || '';
        const nameParts = name.split('/');
        const pipelineId = nameParts.length >= 6 ? nameParts[5] : name;
        const location = nameParts.length >= 4 ? nameParts[3] : region;

        resources.push(this.createResource(
          name,
          'training-pipeline',
          pipeline.displayName || pipelineId,
          location,
          {
            name: pipeline.displayName,
            state: pipeline.state,
            createTime: this.formatTimestamp(pipeline.createTime),
            startTime: this.formatTimestamp(pipeline.startTime),
            endTime: this.formatTimestamp(pipeline.endTime),
            trainingTaskDefinition: pipeline.trainingTaskDefinition,
            error: pipeline.error ? {
              code: pipeline.error.code,
              message: pipeline.error.message,
            } : undefined,
            inputDataConfig: pipeline.inputDataConfig ? {
              datasetId: pipeline.inputDataConfig.datasetId,
            } : undefined,
            modelToUpload: pipeline.modelToUpload ? {
              name: pipeline.modelToUpload.name,
              displayName: pipeline.modelToUpload.displayName,
            } : undefined,
          },
          this.parseLabels(pipeline.labels as Record<string, string>),
          this.parseTimestamp(this.formatTimestamp(pipeline.createTime)),
        ));
      }
    } catch (error) {
      if (!this.isApiNotEnabled(error) && !this.isRegionNotAvailable(error)) {
        errors.push(this.createError(`listTrainingPipelines:${region}`, error));
      }
    }
  }

  private async scanCustomJobs(
    region: string,
    resources: Resource[],
    errors: GCPScanError[]
  ): Promise<void> {
    try {
      const client = new JobServiceClient({ apiEndpoint: this.getApiEndpoint(region) });
      const parent = `projects/${this.config.projectId}/locations/${region}`;

      for await (const job of client.listCustomJobsAsync({ parent })) {
        const name = job.name || '';
        const nameParts = name.split('/');
        const jobId = nameParts.length >= 6 ? nameParts[5] : name;
        const location = nameParts.length >= 4 ? nameParts[3] : region;

        resources.push(this.createResource(
          name,
          'custom-job',
          job.displayName || jobId,
          location,
          {
            name: job.displayName,
            state: job.state,
            createTime: this.formatTimestamp(job.createTime),
            startTime: this.formatTimestamp(job.startTime),
            endTime: this.formatTimestamp(job.endTime),
            workerPoolSpecs: job.jobSpec?.workerPoolSpecs?.map(spec => ({
              machineType: spec.machineSpec?.machineType,
              acceleratorType: spec.machineSpec?.acceleratorType,
              acceleratorCount: spec.machineSpec?.acceleratorCount ? Number(spec.machineSpec.acceleratorCount) : undefined,
              replicaCount: spec.replicaCount ? Number(spec.replicaCount) : undefined,
            })),
          },
          this.parseLabels(job.labels as Record<string, string>),
          this.parseTimestamp(this.formatTimestamp(job.createTime)),
        ));
      }
    } catch (error) {
      if (!this.isApiNotEnabled(error) && !this.isRegionNotAvailable(error)) {
        errors.push(this.createError(`listCustomJobs:${region}`, error));
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private formatTimestamp(ts: any): string | undefined {
    if (!ts?.seconds) return undefined;
    return new Date(Number(ts.seconds) * 1000).toISOString();
  }
}

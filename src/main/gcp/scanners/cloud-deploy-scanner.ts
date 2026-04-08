// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GCPBaseScanner, GCPScannerConfig, GCPScanResult } from './base-scanner';
import { getGCPClientFactory } from '../client-factory';

export class CloudDeployScanner extends GCPBaseScanner {
  constructor(config: GCPScannerConfig) {
    super(config, 'cloud-deploy', 'Cloud Deploy');
  }

  async scan(): Promise<GCPScanResult> {
    const resources: GCPScanResult['resources'] = [];
    const errors: GCPScanResult['errors'] = [];
    const factory = getGCPClientFactory(this.config.projectId);
    const client = factory.getCloudDeployClient();

    try {
      const iterable = client.listDeliveryPipelinesAsync({
        parent: `projects/${this.config.projectId}/locations/-`,
      });

      for await (const pipeline of iterable) {
        const name = pipeline.name || '';
        // Pipeline name format: projects/{project}/locations/{location}/deliveryPipelines/{pipeline}
        const locationMatch = name.match(/\/locations\/([^/]+)/);
        const region = locationMatch ? locationMatch[1] : 'global';
        const shortName = name.split('/').pop() || name;

        resources.push(this.createResource(
          name,
          'delivery-pipeline',
          shortName,
          region,
          {
            name: pipeline.name,
            description: pipeline.description,
            serialPipeline: pipeline.serialPipeline ? {
              stages: pipeline.serialPipeline.stages?.map(stage => ({
                targetId: stage.targetId,
                profiles: stage.profiles,
                strategy: stage.strategy,
              })),
            } : undefined,
            createTime: pipeline.createTime,
            updateTime: pipeline.updateTime,
            labels: pipeline.labels,
            condition: pipeline.condition,
          },
          this.parseLabels(pipeline.labels as Record<string, string>),
          pipeline.createTime
            ? this.parseTimestamp(
                typeof pipeline.createTime === 'object' && pipeline.createTime !== null && 'seconds' in pipeline.createTime
                  ? new Date(Number((pipeline.createTime as { seconds: number | string }).seconds) * 1000).toISOString()
                  : String(pipeline.createTime)
              )
            : undefined,
        ));
      }
    } catch (error) {
      if (!this.isApiNotEnabled(error)) {
        errors.push(this.createError('listDeliveryPipelines', error));
      }
    }

    return { resources, errors };
  }
}

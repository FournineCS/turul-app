// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GCPBaseScanner, GCPScannerConfig, GCPScanResult } from './base-scanner';
import { getGCPClientFactory } from '../client-factory';

export class SpannerScanner extends GCPBaseScanner {
  constructor(config: GCPScannerConfig) {
    super(config, 'cloud-spanner', 'Cloud Spanner');
  }

  async scan(): Promise<GCPScanResult> {
    const resources: GCPScanResult['resources'] = [];
    const errors: GCPScanResult['errors'] = [];
    const factory = getGCPClientFactory(this.config.projectId);
    const client = factory.getSpannerClient();

    try {
      const [instances] = await client.getInstances();

      for (const instance of instances) {
        const metadata = instance.metadata;
        const instanceId = metadata?.name || instance.id || '';
        const instanceName = instance.id || instanceId.split('/').pop() || '';

        // Extract region from config path: projects/{project}/instanceConfigs/{config}
        // Config names like "regional-us-central1" or "nam6"
        const configPath = metadata?.config || '';
        const configName = configPath.split('/').pop() || '';
        const regionMatch = configName.match(/regional-(.+)/);
        const region = regionMatch ? regionMatch[1] : configName || 'global';

        resources.push(this.createResource(
          metadata?.name || `projects/${this.config.projectId}/instances/${instanceName}`,
          'spanner-instance',
          instanceName,
          region,
          {
            id: instance.id,
            name: metadata?.name,
            config: metadata?.config,
            nodeCount: metadata?.nodeCount,
            processingUnits: metadata?.processingUnits,
            state: metadata?.state,
            labels: metadata?.labels,
            createTime: metadata?.createTime,
          },
          this.parseLabels(metadata?.labels as Record<string, string>),
          metadata?.createTime
            ? this.parseTimestamp(String(metadata.createTime))
            : undefined,
        ));
      }
    } catch (error) {
      if (!this.isApiNotEnabled(error)) {
        errors.push(this.createError('getInstances', error));
      }
    }

    return { resources, errors };
  }
}

// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GCPBaseScanner, GCPScannerConfig, GCPScanResult } from './base-scanner';
import { getGCPClientFactory } from '../client-factory';

export class BigtableScanner extends GCPBaseScanner {
  constructor(config: GCPScannerConfig) {
    super(config, 'bigtable', 'Cloud Bigtable');
  }

  async scan(): Promise<GCPScanResult> {
    const resources: GCPScanResult['resources'] = [];
    const errors: GCPScanResult['errors'] = [];
    const factory = getGCPClientFactory(this.config.projectId);
    const client = factory.getBigtableClient();

    try {
      const [instances] = await client.getInstances();

      for (const instance of instances) {
        const metadata = instance.metadata;
        const instanceId = instance.id || '';
        const instanceName = metadata?.name || `projects/${this.config.projectId}/instances/${instanceId}`;

        // Determine region from cluster states if available
        const clusterStates = (metadata as Record<string, unknown>)?.clusterStates as Record<string, unknown> || {};
        const clusterKeys = Object.keys(clusterStates);
        // Cluster names often contain region info; use first cluster location or 'global'
        let region = 'global';
        if (clusterKeys.length > 0) {
          // Cluster keys are cluster IDs; regions embedded in the cluster metadata aren't directly here,
          // so we fall back to global unless we can parse it
          const firstCluster = clusterKeys[0];
          const regionMatch = firstCluster.match(/^(.+?)-\d+$/);
          if (regionMatch) {
            region = regionMatch[1];
          }
        }

        resources.push(this.createResource(
          instanceName,
          'bigtable-instance',
          instanceId || instanceName.split('/').pop() || '',
          region,
          {
            id: instanceId,
            displayName: metadata?.displayName,
            clusterStates: (metadata as Record<string, unknown>)?.clusterStates,
            type: metadata?.type,
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

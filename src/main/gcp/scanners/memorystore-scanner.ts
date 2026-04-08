// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GCPBaseScanner, GCPScannerConfig, GCPScanResult } from './base-scanner';
import { getGCPClientFactory } from '../client-factory';

export class MemorystoreScanner extends GCPBaseScanner {
  constructor(config: GCPScannerConfig) {
    super(config, 'memorystore', 'Memorystore');
  }

  async scan(): Promise<GCPScanResult> {
    const resources: GCPScanResult['resources'] = [];
    const errors: GCPScanResult['errors'] = [];
    const factory = getGCPClientFactory(this.config.projectId);
    const client = factory.getRedisClient();

    try {
      const iterable = client.listInstancesAsync({
        parent: `projects/${this.config.projectId}/locations/-`,
      });

      for await (const instance of iterable) {
        const instanceName = instance.name || '';
        // Extract location from name: projects/{project}/locations/{location}/instances/{instance}
        const locationMatch = instanceName.match(/\/locations\/([^/]+)/);
        const region = locationMatch
          ? locationMatch[1]
          : instance.currentLocationId || 'global';

        const shortName = instanceName.split('/').pop() || instanceName;

        resources.push(this.createResource(
          instanceName,
          'redis-instance',
          instance.displayName || shortName,
          region,
          {
            name: instance.name,
            displayName: instance.displayName,
            tier: instance.tier,
            memorySizeGb: instance.memorySizeGb,
            host: instance.host,
            port: instance.port,
            redisVersion: instance.redisVersion,
            state: instance.state,
            createTime: instance.createTime,
            currentLocationId: instance.currentLocationId,
            connectMode: instance.connectMode,
          },
          this.parseLabels(instance.labels as Record<string, string>),
          instance.createTime
            ? this.parseTimestamp(
                typeof instance.createTime === 'object' && instance.createTime !== null && 'seconds' in instance.createTime
                  ? new Date(Number((instance.createTime as { seconds: number | string }).seconds) * 1000).toISOString()
                  : String(instance.createTime)
              )
            : undefined,
        ));
      }
    } catch (error) {
      if (!this.isApiNotEnabled(error)) {
        errors.push(this.createError('listInstances', error));
      }
    }

    return { resources, errors };
  }
}

// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GCPBaseScanner, GCPScannerConfig, GCPScanResult } from './base-scanner';
import { getGCPClientFactory } from '../client-factory';

export class ComputeScanner extends GCPBaseScanner {
  constructor(config: GCPScannerConfig) {
    super(config, 'gce', 'Compute Engine');
  }

  async scan(): Promise<GCPScanResult> {
    const resources: GCPScanResult['resources'] = [];
    const errors: GCPScanResult['errors'] = [];
    const factory = getGCPClientFactory(this.config.projectId);
    const client = factory.getInstancesClient();

    try {
      const aggListRequest = { project: this.config.projectId };
      const iterable = client.aggregatedListAsync(aggListRequest);

      for await (const [zone, scopedList] of iterable) {
        if (scopedList.instances) {
          for (const instance of scopedList.instances) {
            const region = this.extractRegionFromSelfLink(instance.selfLink || '');
            resources.push(this.createResource(
              instance.selfLink || `projects/${this.config.projectId}/zones/${zone}/instances/${instance.id}`,
              'instance',
              instance.name || '',
              region,
              {
                id: instance.id,
                machineType: instance.machineType,
                status: instance.status,
                zone: instance.zone,
                networkInterfaces: instance.networkInterfaces,
                disks: instance.disks?.map((d: { source?: string | null; type?: string | null; autoDelete?: boolean | null }) => ({ source: d.source, type: d.type, autoDelete: d.autoDelete })),
                canIpForward: instance.canIpForward,
                scheduling: instance.scheduling,
                serviceAccounts: instance.serviceAccounts,
              },
              this.parseLabels(instance.labels as Record<string, string>),
              this.parseTimestamp(instance.creationTimestamp as string),
            ));
          }
        }
      }
    } catch (error) {
      if (!this.isApiNotEnabled(error)) {
        errors.push(this.createError('aggregatedList', error));
      }
    }

    return { resources, errors };
  }
}

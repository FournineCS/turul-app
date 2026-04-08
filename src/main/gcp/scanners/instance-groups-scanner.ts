// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GCPBaseScanner, GCPScannerConfig, GCPScanResult } from './base-scanner';
import { getGCPClientFactory } from '../client-factory';

export class InstanceGroupsScanner extends GCPBaseScanner {
  constructor(config: GCPScannerConfig) {
    super(config, 'gce-instance-groups', 'Instance Groups');
  }

  async scan(): Promise<GCPScanResult> {
    const resources: GCPScanResult['resources'] = [];
    const errors: GCPScanResult['errors'] = [];
    const factory = getGCPClientFactory(this.config.projectId);
    const client = factory.getInstanceGroupsClient();

    try {
      const aggListRequest = { project: this.config.projectId };
      const iterable = client.aggregatedListAsync(aggListRequest);

      for await (const [zone, scopedList] of iterable) {
        if (scopedList.instanceGroups) {
          for (const group of scopedList.instanceGroups) {
            const region = this.extractRegionFromSelfLink(group.selfLink || '');
            resources.push(this.createResource(
              group.selfLink || `projects/${this.config.projectId}/zones/${zone}/instanceGroups/${group.name}`,
              'instance-group',
              group.name || '',
              region,
              {
                name: group.name,
                size: group.size,
                zone: group.zone,
                namedPorts: group.namedPorts,
                network: group.network,
                subnetwork: group.subnetwork,
              },
              {},
              this.parseTimestamp(group.creationTimestamp as string),
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

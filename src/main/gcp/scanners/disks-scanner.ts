// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GCPBaseScanner, GCPScannerConfig, GCPScanResult } from './base-scanner';
import { getGCPClientFactory } from '../client-factory';

export class DisksScanner extends GCPBaseScanner {
  constructor(config: GCPScannerConfig) {
    super(config, 'gce-disks', 'Persistent Disks');
  }

  async scan(): Promise<GCPScanResult> {
    const resources: GCPScanResult['resources'] = [];
    const errors: GCPScanResult['errors'] = [];
    const factory = getGCPClientFactory(this.config.projectId);
    const client = factory.getDisksClient();

    try {
      const aggListRequest = { project: this.config.projectId };
      const iterable = client.aggregatedListAsync(aggListRequest);

      for await (const [zone, scopedList] of iterable) {
        if (scopedList.disks) {
          for (const disk of scopedList.disks) {
            const region = this.extractRegionFromSelfLink(disk.selfLink || '');
            resources.push(this.createResource(
              disk.selfLink || `projects/${this.config.projectId}/zones/${zone}/disks/${disk.name}`,
              'disk',
              disk.name || '',
              region,
              {
                name: disk.name,
                sizeGb: disk.sizeGb,
                status: disk.status,
                type: disk.type,
                zone: disk.zone,
                sourceImage: disk.sourceImage,
                users: disk.users,
                physicalBlockSizeBytes: disk.physicalBlockSizeBytes,
              },
              this.parseLabels(disk.labels as Record<string, string>),
              this.parseTimestamp(disk.creationTimestamp as string),
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

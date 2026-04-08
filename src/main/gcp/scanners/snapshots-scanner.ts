// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GCPBaseScanner, GCPScannerConfig, GCPScanResult } from './base-scanner';
import { getGCPClientFactory } from '../client-factory';

export class SnapshotsScanner extends GCPBaseScanner {
  constructor(config: GCPScannerConfig) {
    super(config, 'gce-snapshots', 'Disk Snapshots');
  }

  async scan(): Promise<GCPScanResult> {
    const resources: GCPScanResult['resources'] = [];
    const errors: GCPScanResult['errors'] = [];
    const factory = getGCPClientFactory(this.config.projectId);
    const client = factory.getSnapshotsClient();

    try {
      const listRequest = { project: this.config.projectId };
      const iterable = client.listAsync(listRequest);

      for await (const snapshot of iterable) {
        resources.push(this.createResource(
          snapshot.selfLink || `projects/${this.config.projectId}/global/snapshots/${snapshot.name}`,
          'snapshot',
          snapshot.name || '',
          'global',
          {
            name: snapshot.name,
            status: snapshot.status,
            diskSizeGb: snapshot.diskSizeGb,
            sourceDisk: snapshot.sourceDisk,
            storageBytes: snapshot.storageBytes,
            storageLocations: snapshot.storageLocations,
          },
          this.parseLabels(snapshot.labels as Record<string, string>),
          this.parseTimestamp(snapshot.creationTimestamp as string),
        ));
      }
    } catch (error) {
      if (!this.isApiNotEnabled(error)) {
        errors.push(this.createError('list', error));
      }
    }

    return { resources, errors };
  }
}

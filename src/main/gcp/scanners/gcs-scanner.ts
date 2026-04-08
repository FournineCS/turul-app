// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GCPBaseScanner, GCPScannerConfig, GCPScanResult } from './base-scanner';
import { getGCPClientFactory } from '../client-factory';

export class GCSScanner extends GCPBaseScanner {
  constructor(config: GCPScannerConfig) {
    super(config, 'gcs', 'Cloud Storage');
  }

  async scan(): Promise<GCPScanResult> {
    const resources: GCPScanResult['resources'] = [];
    const errors: GCPScanResult['errors'] = [];
    const factory = getGCPClientFactory(this.config.projectId);
    const client = factory.getStorageClient();

    try {
      const [buckets] = await client.getBuckets();

      for (const bucket of buckets) {
        const metadata = bucket.metadata;
        const region = (metadata.location || 'global').toLowerCase();

        resources.push(this.createResource(
          `projects/${this.config.projectId}/buckets/${metadata.name}`,
          'bucket',
          metadata.name || '',
          region,
          {
            name: metadata.name,
            location: metadata.location,
            storageClass: metadata.storageClass,
            versioning: metadata.versioning,
            lifecycle: metadata.lifecycle,
            iamConfiguration: metadata.iamConfiguration,
            encryption: metadata.encryption,
            retentionPolicy: metadata.retentionPolicy,
            cors: metadata.cors,
            logging: metadata.logging,
            timeCreated: metadata.timeCreated,
          },
          this.parseLabels(metadata.labels as Record<string, string>),
          this.parseTimestamp(metadata.timeCreated as string),
        ));
      }
    } catch (error) {
      if (!this.isApiNotEnabled(error)) {
        errors.push(this.createError('getBuckets', error));
      }
    }

    return { resources, errors };
  }
}

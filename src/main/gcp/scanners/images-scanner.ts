// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GCPBaseScanner, GCPScannerConfig, GCPScanResult } from './base-scanner';
import { getGCPClientFactory } from '../client-factory';

export class ImagesScanner extends GCPBaseScanner {
  constructor(config: GCPScannerConfig) {
    super(config, 'gce-images', 'Custom Images');
  }

  async scan(): Promise<GCPScanResult> {
    const resources: GCPScanResult['resources'] = [];
    const errors: GCPScanResult['errors'] = [];
    const factory = getGCPClientFactory(this.config.projectId);
    const client = factory.getImagesClient();

    try {
      const listRequest = { project: this.config.projectId };
      const iterable = client.listAsync(listRequest);

      for await (const image of iterable) {
        resources.push(this.createResource(
          image.selfLink || `projects/${this.config.projectId}/global/images/${image.name}`,
          'image',
          image.name || '',
          'global',
          {
            name: image.name,
            status: image.status,
            diskSizeGb: image.diskSizeGb,
            sourceType: image.sourceType,
            family: image.family,
            architecture: image.architecture,
          },
          this.parseLabels(image.labels as Record<string, string>),
          this.parseTimestamp(image.creationTimestamp as string),
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

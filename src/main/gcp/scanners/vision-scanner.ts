// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GCPBaseScanner, GCPScannerConfig, GCPScanResult } from './base-scanner';
import { getGCPClientFactory } from '../client-factory';

export class VisionScanner extends GCPBaseScanner {
  constructor(config: GCPScannerConfig) {
    super(config, 'vision-ai', 'Vision AI');
  }

  async scan(): Promise<GCPScanResult> {
    const resources: GCPScanResult['resources'] = [];
    const errors: GCPScanResult['errors'] = [];
    const factory = getGCPClientFactory(this.config.projectId);
    const client = factory.getVisionClient();

    try {
      const parent = `projects/${this.config.projectId}/locations/us-west1`;
      const iterable = client.listProductSetsAsync({ parent });

      for await (const productSet of iterable) {
        const name = productSet.name || '';
        const nameParts = name.split('/');
        const productSetId = nameParts.length >= 6 ? nameParts[5] : name;
        const location = nameParts.length >= 4 ? nameParts[3] : 'us-west1';

        resources.push(this.createResource(
          name,
          'product-set',
          productSet.displayName || productSetId,
          location,
          {
            name: productSet.displayName,
            indexTime: productSet.indexTime ? new Date(Number(productSet.indexTime.seconds) * 1000).toISOString() : undefined,
            indexError: productSet.indexError ? {
              code: productSet.indexError.code,
              message: productSet.indexError.message,
            } : undefined,
          },
          {},
          this.parseTimestamp(productSet.indexTime ? new Date(Number(productSet.indexTime.seconds) * 1000).toISOString() : undefined),
        ));
      }
    } catch (error) {
      if (!this.isApiNotEnabled(error)) {
        errors.push(this.createError('listProductSets', error));
      }
    }

    return { resources, errors };
  }
}

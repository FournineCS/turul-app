// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GCPBaseScanner, GCPScannerConfig, GCPScanResult } from './base-scanner';
import { getGCPClientFactory } from '../client-factory';

export class DocumentAIScanner extends GCPBaseScanner {
  constructor(config: GCPScannerConfig) {
    super(config, 'document-ai', 'Document AI');
  }

  async scan(): Promise<GCPScanResult> {
    const resources: GCPScanResult['resources'] = [];
    const errors: GCPScanResult['errors'] = [];
    const factory = getGCPClientFactory(this.config.projectId);
    const client = factory.getDocumentAIClient();

    const locations = ['us', 'eu'];

    for (const location of locations) {
      try {
        const parent = `projects/${this.config.projectId}/locations/${location}`;
        const iterable = client.listProcessorsAsync({ parent });

        for await (const processor of iterable) {
          const name = processor.name || '';
          const nameParts = name.split('/');
          const processorId = nameParts.length >= 6 ? nameParts[5] : name;

          resources.push(this.createResource(
            name,
            'processor',
            processor.displayName || processorId,
            location,
            {
              name: processor.displayName,
              type: processor.type,
              state: processor.state,
              createTime: processor.createTime ? new Date(Number(processor.createTime.seconds) * 1000).toISOString() : undefined,
              defaultProcessorVersion: processor.defaultProcessorVersion,
            },
            {},
            this.parseTimestamp(processor.createTime ? new Date(Number(processor.createTime.seconds) * 1000).toISOString() : undefined),
          ));
        }
      } catch (error) {
        if (!this.isApiNotEnabled(error)) {
          errors.push(this.createError(`listProcessors:${location}`, error));
        }
      }
    }

    return { resources, errors };
  }
}

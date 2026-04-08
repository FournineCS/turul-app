// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GCPBaseScanner, GCPScannerConfig, GCPScanResult } from './base-scanner';
import { getGCPClientFactory } from '../client-factory';

export class UrlMapsScanner extends GCPBaseScanner {
  constructor(config: GCPScannerConfig) {
    super(config, 'gclb-url-maps', 'URL Maps');
  }

  async scan(): Promise<GCPScanResult> {
    const resources: GCPScanResult['resources'] = [];
    const errors: GCPScanResult['errors'] = [];
    const factory = getGCPClientFactory(this.config.projectId);
    const client = factory.getUrlMapsClient();

    try {
      const listRequest = { project: this.config.projectId };
      const iterable = client.listAsync(listRequest);

      for await (const urlMap of iterable) {
        resources.push(this.createResource(
          urlMap.selfLink || `projects/${this.config.projectId}/global/urlMaps/${urlMap.name}`,
          'url-map',
          urlMap.name || '',
          'global',
          {
            name: urlMap.name,
            defaultService: urlMap.defaultService,
            hostRules: urlMap.hostRules,
            pathMatchers: urlMap.pathMatchers,
            tests: urlMap.tests,
          },
          this.parseLabels({}),
          this.parseTimestamp(urlMap.creationTimestamp as string),
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

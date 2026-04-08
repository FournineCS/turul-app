// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GCPBaseScanner, GCPScannerConfig, GCPScanResult } from './base-scanner';
import { getGCPClientFactory } from '../client-factory';

export class BackendServicesScanner extends GCPBaseScanner {
  constructor(config: GCPScannerConfig) {
    super(config, 'gclb', 'Backend Services');
  }

  async scan(): Promise<GCPScanResult> {
    const resources: GCPScanResult['resources'] = [];
    const errors: GCPScanResult['errors'] = [];
    const factory = getGCPClientFactory(this.config.projectId);
    const client = factory.getBackendServicesClient();

    try {
      const aggListRequest = { project: this.config.projectId };
      const iterable = client.aggregatedListAsync(aggListRequest);

      for await (const [_scope, scopedList] of iterable) {
        if (scopedList.backendServices) {
          for (const bs of scopedList.backendServices) {
            const region = this.extractRegionFromSelfLink(bs.selfLink || '');
            resources.push(this.createResource(
              bs.selfLink || `projects/${this.config.projectId}/global/backendServices/${bs.name}`,
              'backend-service',
              bs.name || '',
              region,
              {
                name: bs.name,
                protocol: bs.protocol,
                port: bs.port,
                backends: bs.backends,
                healthChecks: bs.healthChecks,
                loadBalancingScheme: bs.loadBalancingScheme,
                sessionAffinity: bs.sessionAffinity,
                timeoutSec: bs.timeoutSec,
              },
              this.parseLabels({}),
              this.parseTimestamp(bs.creationTimestamp as string),
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

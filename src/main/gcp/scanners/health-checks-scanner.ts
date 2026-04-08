// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GCPBaseScanner, GCPScannerConfig, GCPScanResult } from './base-scanner';
import { getGCPClientFactory } from '../client-factory';

export class HealthChecksScanner extends GCPBaseScanner {
  constructor(config: GCPScannerConfig) {
    super(config, 'gclb', 'Health Checks');
  }

  async scan(): Promise<GCPScanResult> {
    const resources: GCPScanResult['resources'] = [];
    const errors: GCPScanResult['errors'] = [];
    const factory = getGCPClientFactory(this.config.projectId);
    const client = factory.getHealthChecksClient();

    try {
      const aggListRequest = { project: this.config.projectId };
      const iterable = client.aggregatedListAsync(aggListRequest);

      for await (const [_scope, scopedList] of iterable) {
        if (scopedList.healthChecks) {
          for (const hc of scopedList.healthChecks) {
            const region = this.extractRegionFromSelfLink(hc.selfLink || '');
            resources.push(this.createResource(
              hc.selfLink || `projects/${this.config.projectId}/global/healthChecks/${hc.name}`,
              'health-check',
              hc.name || '',
              region,
              {
                name: hc.name,
                type: hc.type,
                checkIntervalSec: hc.checkIntervalSec,
                timeoutSec: hc.timeoutSec,
                healthyThreshold: hc.healthyThreshold,
                unhealthyThreshold: hc.unhealthyThreshold,
                httpHealthCheck: hc.httpHealthCheck,
                httpsHealthCheck: hc.httpsHealthCheck,
              },
              this.parseLabels({}),
              this.parseTimestamp(hc.creationTimestamp as string),
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

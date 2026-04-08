// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GCPBaseScanner, GCPScannerConfig, GCPScanResult } from './base-scanner';
import { getGCPClientFactory } from '../client-factory';

export class ForwardingRulesScanner extends GCPBaseScanner {
  constructor(config: GCPScannerConfig) {
    super(config, 'gclb', 'Forwarding Rules');
  }

  async scan(): Promise<GCPScanResult> {
    const resources: GCPScanResult['resources'] = [];
    const errors: GCPScanResult['errors'] = [];
    const factory = getGCPClientFactory(this.config.projectId);
    const client = factory.getForwardingRulesClient();

    try {
      const aggListRequest = { project: this.config.projectId };
      const iterable = client.aggregatedListAsync(aggListRequest);

      for await (const [_scope, scopedList] of iterable) {
        if (scopedList.forwardingRules) {
          for (const rule of scopedList.forwardingRules) {
            const region = this.extractRegionFromSelfLink(rule.selfLink || '');
            resources.push(this.createResource(
              rule.selfLink || `projects/${this.config.projectId}/regions/${region}/forwardingRules/${rule.name}`,
              'forwarding-rule',
              rule.name || '',
              region,
              {
                name: rule.name,
                IPAddress: rule.IPAddress,
                IPProtocol: rule.IPProtocol,
                portRange: rule.portRange,
                target: rule.target,
                loadBalancingScheme: rule.loadBalancingScheme,
                network: rule.network,
                subnetwork: rule.subnetwork,
                backendService: rule.backendService,
              },
              this.parseLabels(rule.labels as Record<string, string>),
              this.parseTimestamp(rule.creationTimestamp as string),
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

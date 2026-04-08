// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GCPBaseScanner, GCPScannerConfig, GCPScanResult } from './base-scanner';
import { getGCPClientFactory } from '../client-factory';

export class FirewallScanner extends GCPBaseScanner {
  constructor(config: GCPScannerConfig) {
    super(config, 'vpc-firewall', 'Firewall Rules');
  }

  async scan(): Promise<GCPScanResult> {
    const resources: GCPScanResult['resources'] = [];
    const errors: GCPScanResult['errors'] = [];
    const factory = getGCPClientFactory(this.config.projectId);
    const client = factory.getFirewallsClient();

    try {
      const listRequest = { project: this.config.projectId };
      const iterable = client.listAsync(listRequest);

      for await (const rule of iterable) {
        resources.push(this.createResource(
          rule.selfLink || `projects/${this.config.projectId}/global/firewalls/${rule.name}`,
          'firewall-rule',
          rule.name || '',
          'global',
          {
            name: rule.name,
            network: rule.network,
            direction: rule.direction,
            priority: rule.priority,
            allowed: rule.allowed,
            denied: rule.denied,
            sourceRanges: rule.sourceRanges,
            destinationRanges: rule.destinationRanges,
            sourceTags: rule.sourceTags,
            targetTags: rule.targetTags,
            disabled: rule.disabled,
            logConfig: rule.logConfig,
          },
          this.parseLabels({}),
          this.parseTimestamp(rule.creationTimestamp as string),
        ));
      }
    } catch (error) {
      if (this.isApiNotEnabled(error)) {
        // API not enabled — silently skip
      } else if (this.isPermissionDenied(error)) {
        console.warn(`[GCP:vpc-firewall] Permission denied listing firewalls in ${this.config.projectId} — may be a Shared VPC service project`);
        errors.push(this.createError('list', error));
      } else {
        errors.push(this.createError('list', error));
      }
    }

    return { resources, errors };
  }
}

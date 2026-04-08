// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GCPBaseScanner, GCPScannerConfig, GCPScanResult } from './base-scanner';
import { getGCPClientFactory } from '../client-factory';

export class CloudArmorScanner extends GCPBaseScanner {
  constructor(config: GCPScannerConfig) {
    super(config, 'cloud-armor', 'Cloud Armor Security Policies');
  }

  async scan(): Promise<GCPScanResult> {
    const resources: GCPScanResult['resources'] = [];
    const errors: GCPScanResult['errors'] = [];
    const factory = getGCPClientFactory(this.config.projectId);
    const client = factory.getSecurityPoliciesClient();

    try {
      const listRequest = { project: this.config.projectId };
      const iterable = client.listAsync(listRequest);

      for await (const policy of iterable) {
        const rules = (policy.rules || []).map((rule) => ({
          priority: rule.priority,
          action: rule.action,
          match: rule.match,
          description: rule.description,
        }));

        resources.push(this.createResource(
          policy.selfLink || `projects/${this.config.projectId}/global/securityPolicies/${policy.name}`,
          'security-policy',
          policy.name || '',
          'global',
          {
            name: policy.name,
            type: policy.type,
            description: policy.description,
            rules,
            adaptiveProtectionConfig: policy.adaptiveProtectionConfig,
          },
          this.parseLabels(policy.labels as Record<string, string>),
          this.parseTimestamp(policy.creationTimestamp as string),
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

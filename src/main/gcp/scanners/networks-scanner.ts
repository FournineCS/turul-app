// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GCPBaseScanner, GCPScannerConfig, GCPScanResult } from './base-scanner';
import { getGCPClientFactory } from '../client-factory';

export class NetworksScanner extends GCPBaseScanner {
  constructor(config: GCPScannerConfig) {
    super(config, 'vpc-network', 'VPC Networks');
  }

  async scan(): Promise<GCPScanResult> {
    const resources: GCPScanResult['resources'] = [];
    const errors: GCPScanResult['errors'] = [];
    const factory = getGCPClientFactory(this.config.projectId);
    const client = factory.getNetworksClient();

    try {
      const listRequest = { project: this.config.projectId };
      const iterable = client.listAsync(listRequest);

      for await (const network of iterable) {
        resources.push(this.createResource(
          network.selfLink || `projects/${this.config.projectId}/global/networks/${network.name}`,
          'network',
          network.name || '',
          'global',
          {
            name: network.name,
            selfLink: network.selfLink,
            autoCreateSubnetworks: network.autoCreateSubnetworks,
            subnetworks: network.subnetworks,
            routingConfig: network.routingConfig,
            mtu: network.mtu,
            peerings: network.peerings,
          },
          this.parseLabels({}),
          this.parseTimestamp(network.creationTimestamp as string),
        ));
      }
    } catch (error) {
      if (this.isApiNotEnabled(error)) {
        // API not enabled — silently skip
      } else if (this.isPermissionDenied(error)) {
        console.warn(`[GCP:vpc-network] Permission denied listing networks in ${this.config.projectId} — may be a Shared VPC service project`);
        errors.push(this.createError('list', error));
      } else {
        errors.push(this.createError('list', error));
      }
    }

    return { resources, errors };
  }
}

// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GCPBaseScanner, GCPScannerConfig, GCPScanResult } from './base-scanner';
import { getGCPClientFactory } from '../client-factory';

export class AddressesScanner extends GCPBaseScanner {
  constructor(config: GCPScannerConfig) {
    super(config, 'cloud-address', 'IP Addresses');
  }

  async scan(): Promise<GCPScanResult> {
    const resources: GCPScanResult['resources'] = [];
    const errors: GCPScanResult['errors'] = [];
    const factory = getGCPClientFactory(this.config.projectId);
    const client = factory.getAddressesClient();

    try {
      const aggListRequest = { project: this.config.projectId };
      const iterable = client.aggregatedListAsync(aggListRequest);

      for await (const [_scope, scopedList] of iterable) {
        if (scopedList.addresses) {
          for (const addr of scopedList.addresses) {
            const region = this.extractRegionFromSelfLink(addr.selfLink || '');
            resources.push(this.createResource(
              addr.selfLink || `projects/${this.config.projectId}/regions/${region}/addresses/${addr.name}`,
              'address',
              addr.name || '',
              region,
              {
                name: addr.name,
                address: addr.address,
                addressType: addr.addressType,
                purpose: addr.purpose,
                status: addr.status,
                network: addr.network,
                subnetwork: addr.subnetwork,
                users: addr.users,
                region: addr.region,
              },
              this.parseLabels(addr.labels as Record<string, string>),
              this.parseTimestamp(addr.creationTimestamp as string),
            ));
          }
        }
      }
    } catch (error) {
      if (this.isApiNotEnabled(error)) {
        // API not enabled — silently skip
      } else if (this.isPermissionDenied(error)) {
        console.warn(`[GCP:cloud-address] Permission denied listing addresses in ${this.config.projectId}`);
        errors.push(this.createError('aggregatedList', error));
      } else {
        errors.push(this.createError('aggregatedList', error));
      }
    }

    return { resources, errors };
  }
}

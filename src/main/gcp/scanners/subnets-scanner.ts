// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GCPBaseScanner, GCPScannerConfig, GCPScanResult } from './base-scanner';
import { getGCPClientFactory } from '../client-factory';

export class SubnetsScanner extends GCPBaseScanner {
  constructor(config: GCPScannerConfig) {
    super(config, 'vpc-subnet', 'VPC Subnets');
  }

  async scan(): Promise<GCPScanResult> {
    const resources: GCPScanResult['resources'] = [];
    const errors: GCPScanResult['errors'] = [];
    const factory = getGCPClientFactory(this.config.projectId);
    const client = factory.getSubnetworksClient();

    try {
      const aggListRequest = { project: this.config.projectId };
      const iterable = client.aggregatedListAsync(aggListRequest);

      for await (const [_scope, scopedList] of iterable) {
        if (scopedList.subnetworks) {
          for (const subnet of scopedList.subnetworks) {
            const region = this.extractRegionFromSelfLink(subnet.selfLink || '');
            resources.push(this.createResource(
              subnet.selfLink || `projects/${this.config.projectId}/regions/${region}/subnetworks/${subnet.name}`,
              'subnet',
              subnet.name || '',
              region,
              {
                name: subnet.name,
                network: subnet.network,
                ipCidrRange: subnet.ipCidrRange,
                region: subnet.region,
                gatewayAddress: subnet.gatewayAddress,
                privateIpGoogleAccess: subnet.privateIpGoogleAccess,
                purpose: subnet.purpose,
                role: subnet.role,
                stackType: subnet.stackType,
                secondaryIpRanges: subnet.secondaryIpRanges,
              },
              this.parseLabels({}),
              this.parseTimestamp(subnet.creationTimestamp as string),
            ));
          }
        }
      }
    } catch (error) {
      if (this.isApiNotEnabled(error)) {
        // API not enabled — silently skip
      } else if (this.isPermissionDenied(error)) {
        console.warn(`[GCP:vpc-subnet] Permission denied listing subnets in ${this.config.projectId} — may be a Shared VPC service project`);
        errors.push(this.createError('aggregatedList', error));
      } else {
        errors.push(this.createError('aggregatedList', error));
      }
    }

    return { resources, errors };
  }
}

// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GCPBaseScanner, GCPScannerConfig, GCPScanResult } from './base-scanner';
import { getGCPClientFactory } from '../client-factory';

export class RoutersScanner extends GCPBaseScanner {
  constructor(config: GCPScannerConfig) {
    super(config, 'cloud-router', 'Cloud Routers');
  }

  async scan(): Promise<GCPScanResult> {
    const resources: GCPScanResult['resources'] = [];
    const errors: GCPScanResult['errors'] = [];
    const factory = getGCPClientFactory(this.config.projectId);
    const client = factory.getRoutersClient();

    try {
      const aggListRequest = { project: this.config.projectId };
      const iterable = client.aggregatedListAsync(aggListRequest);

      for await (const [_scope, scopedList] of iterable) {
        if (scopedList.routers) {
          for (const router of scopedList.routers) {
            const region = this.extractRegionFromSelfLink(router.selfLink || '');

            // Create the router resource
            resources.push(this.createResource(
              router.selfLink || `projects/${this.config.projectId}/regions/${region}/routers/${router.name}`,
              'router',
              router.name || '',
              region,
              {
                name: router.name,
                network: router.network,
                region: router.region,
                bgp: router.bgp,
                nats: router.nats,
                interfaces: router.interfaces,
              },
              this.parseLabels({}),
              this.parseTimestamp(router.creationTimestamp as string),
            ));

            // Create Cloud NAT resources from NAT configs on this router
            if (router.nats && router.nats.length > 0) {
              for (const nat of router.nats) {
                const natData = nat as Record<string, unknown>;
                const natName = natData.name as string || '';
                const natResource = this.createResource(
                  `projects/${this.config.projectId}/regions/${region}/routers/${router.name}/nats/${natName}`,
                  'nat-gateway',
                  natName,
                  region,
                  {
                    name: natName,
                    router: router.selfLink || router.name,
                    region,
                    ...natData,
                  },
                );
                // Override service to 'cloud-nat' since this scanner's serviceType is 'cloud-router'
                natResource.service = 'cloud-nat';
                resources.push(natResource);
              }
            }
          }
        }
      }
    } catch (error) {
      if (this.isApiNotEnabled(error)) {
        // API not enabled — silently skip
      } else if (this.isPermissionDenied(error)) {
        console.warn(`[GCP:cloud-router] Permission denied listing routers in ${this.config.projectId} — may be a Shared VPC service project`);
        errors.push(this.createError('aggregatedList', error));
      } else {
        errors.push(this.createError('aggregatedList', error));
      }
    }

    return { resources, errors };
  }
}

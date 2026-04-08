// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GCPBaseScanner, GCPScannerConfig, GCPScanResult } from './base-scanner';
import { getGCPClientFactory } from '../client-factory';

export class GKEScanner extends GCPBaseScanner {
  constructor(config: GCPScannerConfig) {
    super(config, 'gke', 'Google Kubernetes Engine');
  }

  async scan(): Promise<GCPScanResult> {
    const resources: GCPScanResult['resources'] = [];
    const errors: GCPScanResult['errors'] = [];
    const factory = getGCPClientFactory(this.config.projectId);
    const client = factory.getClusterManagerClient();

    try {
      const parent = `projects/${this.config.projectId}/locations/-`;
      const [response] = await client.listClusters({ parent });

      if (response.clusters) {
        for (const cluster of response.clusters) {
          const location = cluster.location || 'unknown';
          const region = this.extractRegionFromZone(location);
          const selfLink = cluster.selfLink || `projects/${this.config.projectId}/locations/${location}/clusters/${cluster.name}`;

          resources.push(this.createResource(
            selfLink,
            'cluster',
            cluster.name || '',
            region,
            {
              name: cluster.name,
              location: cluster.location,
              status: cluster.status,
              currentMasterVersion: cluster.currentMasterVersion,
              currentNodeCount: cluster.currentNodeCount,
              nodePools: cluster.nodePools?.map(np => ({
                name: np.name,
                machineType: np.config?.machineType,
                diskSizeGb: np.config?.diskSizeGb,
                initialNodeCount: np.initialNodeCount,
                status: np.status,
                version: np.version,
                autoscaling: np.autoscaling,
              })),
              network: cluster.network,
              subnetwork: cluster.subnetwork,
              endpoint: cluster.endpoint,
              clusterIpv4Cidr: cluster.clusterIpv4Cidr,
            },
            this.parseLabels(cluster.resourceLabels as Record<string, string>),
            this.parseTimestamp(cluster.createTime as string),
          ));
        }
      }
    } catch (error) {
      if (!this.isApiNotEnabled(error)) {
        errors.push(this.createError('listClusters', error));
      }
    }

    return { resources, errors };
  }
}

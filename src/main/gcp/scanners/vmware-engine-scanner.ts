// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GCPBaseScanner, GCPScannerConfig, GCPScanResult } from './base-scanner';
import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';

export class VMwareEngineScanner extends GCPBaseScanner {
  constructor(config: GCPScannerConfig) {
    super(config, 'vmware-engine', 'VMware Engine');
  }

  async scan(): Promise<GCPScanResult> {
    const resources: GCPScanResult['resources'] = [];
    const errors: GCPScanResult['errors'] = [];

    try {
      const auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      });
      const authClient = await auth.getClient();
      const vmwareengine = google.vmwareengine({ version: 'v1', auth: authClient as any });
      const projectId = this.config.projectId;

      // List private clouds
      const response = await vmwareengine.projects.locations.privateClouds.list({
        parent: `projects/${projectId}/locations/-`,
      });

      const privateClouds = response.data.privateClouds || [];

      for (const cloud of privateClouds) {
        const cloudName = cloud.name || '';
        const nameParts = cloudName.split('/');
        const shortName = nameParts[nameParts.length - 1] || cloudName;
        const location = nameParts.length >= 4 ? nameParts[3] : 'global';
        const region = this.extractRegionFromZone(location);

        resources.push(this.createResource(
          cloudName,
          'private-cloud',
          shortName,
          region,
          {
            name: cloudName,
            description: cloud.description,
            state: cloud.state,
            createTime: cloud.createTime,
            updateTime: cloud.updateTime,
            networkConfig: cloud.networkConfig,
            managementCluster: cloud.managementCluster,
            hcx: cloud.hcx,
            nsx: cloud.nsx,
            vcenter: cloud.vcenter,
            uid: cloud.uid,
          },
          {},
          this.parseTimestamp(cloud.createTime as string),
        ));

        // List clusters for each private cloud
        try {
          const clustersResponse = await vmwareengine.projects.locations.privateClouds.clusters.list({
            parent: cloudName,
          });

          const clusters = clustersResponse.data.clusters || [];

          for (const cluster of clusters) {
            const clusterName = cluster.name || '';
            const clusterShortName = clusterName.split('/').pop() || clusterName;

            resources.push(this.createResource(
              clusterName,
              'cluster',
              clusterShortName,
              region,
              {
                name: clusterName,
                state: cluster.state,
                createTime: cluster.createTime,
                nodeTypeConfigs: cluster.nodeTypeConfigs,
              },
              {},
              this.parseTimestamp(cluster.createTime as string),
            ));
          }
        } catch (clusterError) {
          if (!this.isApiNotEnabled(clusterError)) {
            errors.push(this.createError('projects.locations.privateClouds.clusters.list', clusterError));
          }
        }
      }
    } catch (error) {
      if (!this.isApiNotEnabled(error)) {
        errors.push(this.createError('projects.locations.privateClouds.list', error));
      }
    }

    return { resources, errors };
  }
}

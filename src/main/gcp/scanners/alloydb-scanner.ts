// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GCPBaseScanner, GCPScannerConfig, GCPScanResult } from './base-scanner';
import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';

export class AlloyDBScanner extends GCPBaseScanner {
  constructor(config: GCPScannerConfig) {
    super(config, 'alloydb', 'AlloyDB');
  }

  async scan(): Promise<GCPScanResult> {
    const resources: GCPScanResult['resources'] = [];
    const errors: GCPScanResult['errors'] = [];

    try {
      const auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      });
      const authClient = await auth.getClient();
      const alloydb = google.alloydb({ version: 'v1', auth: authClient as any });

      const response = await alloydb.projects.locations.clusters.list({
        parent: `projects/${this.config.projectId}/locations/-`,
      });

      const clusters = response.data.clusters || [];

      for (const cluster of clusters) {
        const clusterName = cluster.name || '';
        const shortName = cluster.displayName || clusterName.split('/').pop() || '';
        // Extract location from name: projects/{project}/locations/{location}/clusters/{cluster}
        const locationMatch = clusterName.match(/\/locations\/([^/]+)/);
        const region = locationMatch ? locationMatch[1] : 'global';

        resources.push(this.createResource(
          clusterName || `projects/${this.config.projectId}/clusters/${shortName}`,
          'alloydb-cluster',
          shortName,
          region,
          {
            name: cluster.name,
            displayName: cluster.displayName,
            state: cluster.state,
            databaseVersion: cluster.databaseVersion,
            network: cluster.network,
            clusterType: cluster.clusterType,
            createTime: cluster.createTime,
            reconciling: cluster.reconciling,
          },
          this.parseLabels(cluster.labels as Record<string, string>),
          this.parseTimestamp(cluster.createTime as string),
        ));
      }
    } catch (error) {
      if (!this.isApiNotEnabled(error)) {
        errors.push(this.createError('clusters.list', error));
      }
    }

    return { resources, errors };
  }
}

// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GCPBaseScanner, GCPScannerConfig, GCPScanResult } from './base-scanner';
import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';

export class WorkstationsScanner extends GCPBaseScanner {
  constructor(config: GCPScannerConfig) {
    super(config, 'cloud-workstations', 'Cloud Workstations');
  }

  async scan(): Promise<GCPScanResult> {
    const resources: GCPScanResult['resources'] = [];
    const errors: GCPScanResult['errors'] = [];

    try {
      const auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      });
      const authClient = await auth.getClient();
      const workstations = google.workstations({ version: 'v1', auth: authClient as any });
      const projectId = this.config.projectId;

      const response = await workstations.projects.locations.workstationClusters.list({
        parent: `projects/${projectId}/locations/-`,
      });

      const clusters = response.data.workstationClusters || [];

      for (const cluster of clusters) {
        const clusterName = cluster.name || '';
        const nameParts = clusterName.split('/');
        const shortName = nameParts[nameParts.length - 1] || clusterName;
        const location = nameParts.length >= 4 ? nameParts[3] : 'global';
        const region = this.extractRegionFromZone(location);

        resources.push(this.createResource(
          clusterName,
          'workstation-cluster',
          cluster.displayName || shortName,
          region,
          {
            name: clusterName,
            displayName: cluster.displayName,
            uid: cluster.uid,
            state: cluster.conditions ? 'ACTIVE' : 'UNKNOWN',
            network: cluster.network,
            subnetwork: cluster.subnetwork,
            createTime: cluster.createTime,
            updateTime: cluster.updateTime,
            controlPlaneIp: cluster.controlPlaneIp,
          },
          this.parseLabels(cluster.labels),
          this.parseTimestamp(cluster.createTime as string),
        ));

        // List workstation configs per cluster
        try {
          const configsResponse = await workstations.projects.locations.workstationClusters.workstationConfigs.list({
            parent: clusterName,
          });

          const configs = configsResponse.data.workstationConfigs || [];

          for (const config of configs) {
            const configName = config.name || '';
            const configNameParts = configName.split('/');
            const configShortName = configNameParts[configNameParts.length - 1] || configName;

            resources.push(this.createResource(
              configName,
              'workstation-config',
              config.displayName || configShortName,
              region,
              {
                name: configName,
                displayName: config.displayName,
                uid: config.uid,
                createTime: config.createTime,
                updateTime: config.updateTime,
                idleTimeout: config.idleTimeout,
                runningTimeout: config.runningTimeout,
                host: config.host,
              },
              this.parseLabels(config.labels),
              this.parseTimestamp(config.createTime as string),
            ));
          }
        } catch (error) {
          if (!this.isApiNotEnabled(error)) {
            errors.push(this.createError('projects.locations.workstationClusters.workstationConfigs.list', error));
          }
        }
      }
    } catch (error) {
      if (!this.isApiNotEnabled(error)) {
        errors.push(this.createError('projects.locations.workstationClusters.list', error));
      }
    }

    return { resources, errors };
  }
}

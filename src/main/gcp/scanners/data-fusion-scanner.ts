// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GCPBaseScanner, GCPScannerConfig, GCPScanResult } from './base-scanner';
import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';

export class DataFusionScanner extends GCPBaseScanner {
  constructor(config: GCPScannerConfig) {
    super(config, 'data-fusion', 'Data Fusion');
  }

  async scan(): Promise<GCPScanResult> {
    const resources: GCPScanResult['resources'] = [];
    const errors: GCPScanResult['errors'] = [];

    try {
      const auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      });
      const authClient = await auth.getClient();
      const datafusion = google.datafusion({ version: 'v1', auth: authClient as any });
      const projectId = this.config.projectId;

      const response = await datafusion.projects.locations.instances.list({
        parent: `projects/${projectId}/locations/-`,
      });

      const instances = response.data.instances || [];

      for (const instance of instances) {
        const instanceName = instance.name || '';
        const nameParts = instanceName.split('/');
        const shortName = nameParts[nameParts.length - 1] || instanceName;
        const location = nameParts.length >= 4 ? nameParts[3] : 'global';
        const region = this.extractRegionFromZone(location);

        resources.push(this.createResource(
          instanceName,
          'instance',
          shortName,
          region,
          {
            name: instanceName,
            type: instance.type,
            description: instance.description,
            state: instance.state,
            stateMessage: instance.stateMessage,
            serviceEndpoint: instance.serviceEndpoint,
            version: instance.version,
            createTime: instance.createTime,
            updateTime: instance.updateTime,
            zone: instance.zone,
            dataprocServiceAccount: instance.dataprocServiceAccount,
          },
          this.parseLabels(instance.labels),
          this.parseTimestamp(instance.createTime as string),
        ));
      }
    } catch (error) {
      if (!this.isApiNotEnabled(error)) {
        errors.push(this.createError('projects.locations.instances.list', error));
      }
    }

    return { resources, errors };
  }
}

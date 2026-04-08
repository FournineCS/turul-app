// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GCPBaseScanner, GCPScannerConfig, GCPScanResult } from './base-scanner';
import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';

export class LookerScanner extends GCPBaseScanner {
  constructor(config: GCPScannerConfig) {
    super(config, 'looker', 'Looker');
  }

  async scan(): Promise<GCPScanResult> {
    const resources: GCPScanResult['resources'] = [];
    const errors: GCPScanResult['errors'] = [];

    try {
      const auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      });
      const authClient = await auth.getClient();
      const looker = google.looker({ version: 'v1', auth: authClient as any });
      const projectId = this.config.projectId;

      // List instances
      try {
        const response = await looker.projects.locations.instances.list({
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
              state: instance.state,
              platformEdition: instance.platformEdition,
              createTime: instance.createTime,
              updateTime: instance.updateTime,
              hostUri: instance.lookerUri,
              publicIpEnabled: instance.publicIpEnabled,
              privateIpEnabled: instance.privateIpEnabled,
              maintenanceWindow: instance.maintenanceWindow,
              customDomain: instance.customDomain,
            },
            {},
            this.parseTimestamp(instance.createTime as string),
          ));
        }
      } catch (error) {
        if (!this.isApiNotEnabled(error)) {
          errors.push(this.createError('projects.locations.instances.list', error));
        }
      }
    } catch (error) {
      if (!this.isApiNotEnabled(error)) {
        errors.push(this.createError('auth', error));
      }
    }

    return { resources, errors };
  }
}

// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GCPBaseScanner, GCPScannerConfig, GCPScanResult } from './base-scanner';
import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';

export class DataplexScanner extends GCPBaseScanner {
  constructor(config: GCPScannerConfig) {
    super(config, 'dataplex', 'Dataplex');
  }

  async scan(): Promise<GCPScanResult> {
    const resources: GCPScanResult['resources'] = [];
    const errors: GCPScanResult['errors'] = [];

    try {
      const auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      });
      const authClient = await auth.getClient();
      const dataplex = google.dataplex({ version: 'v1', auth: authClient as any });
      const projectId = this.config.projectId;

      const response = await dataplex.projects.locations.lakes.list({
        parent: `projects/${projectId}/locations/-`,
      });

      const lakes = response.data.lakes || [];

      for (const lake of lakes) {
        const fullName = lake.name || '';
        // Name format: projects/{project}/locations/{location}/lakes/{lake}
        const nameParts = fullName.split('/');
        const lakeName = nameParts.length >= 6 ? nameParts[5] : fullName;
        const location = nameParts.length >= 4 ? nameParts[3] : 'global';
        const region = this.extractRegionFromZone(location);

        resources.push(this.createResource(
          fullName || `projects/${projectId}/locations/${location}/lakes/${lakeName}`,
          'lake',
          lake.displayName || lakeName,
          region,
          {
            name: lakeName,
            displayName: lake.displayName,
            state: lake.state,
            description: lake.description,
            labels: lake.labels,
            createTime: lake.createTime,
            metastore: lake.metastore,
          },
          this.parseLabels(lake.labels as Record<string, string>),
          this.parseTimestamp(lake.createTime as string),
        ));
      }
    } catch (error) {
      if (!this.isApiNotEnabled(error)) {
        errors.push(this.createError('lakes.list', error));
      }
    }

    return { resources, errors };
  }
}

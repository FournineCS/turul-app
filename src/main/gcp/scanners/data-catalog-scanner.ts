// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GCPBaseScanner, GCPScannerConfig, GCPScanResult } from './base-scanner';
import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';

export class DataCatalogScanner extends GCPBaseScanner {
  constructor(config: GCPScannerConfig) {
    super(config, 'data-catalog', 'Data Catalog');
  }

  async scan(): Promise<GCPScanResult> {
    const resources: GCPScanResult['resources'] = [];
    const errors: GCPScanResult['errors'] = [];

    try {
      const auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      });
      const authClient = await auth.getClient();
      const datacatalog = google.datacatalog({ version: 'v1', auth: authClient as any });
      const projectId = this.config.projectId;

      const response = await datacatalog.projects.locations.entryGroups.list({
        parent: `projects/${projectId}/locations/-`,
      });

      const entryGroups = response.data.entryGroups || [];

      for (const entryGroup of entryGroups) {
        const fullName = entryGroup.name || '';
        // Name format: projects/{project}/locations/{location}/entryGroups/{entryGroup}
        const nameParts = fullName.split('/');
        const entryGroupName = nameParts.length >= 6 ? nameParts[5] : fullName;
        const location = nameParts.length >= 4 ? nameParts[3] : 'global';
        const region = this.extractRegionFromZone(location);

        resources.push(this.createResource(
          fullName || `projects/${projectId}/locations/${location}/entryGroups/${entryGroupName}`,
          'entry-group',
          entryGroup.displayName || entryGroupName,
          region,
          {
            name: entryGroupName,
            displayName: entryGroup.displayName,
            description: entryGroup.description,
            dataCatalogTimestamps: entryGroup.dataCatalogTimestamps,
          },
          {},
          this.parseTimestamp(
            entryGroup.dataCatalogTimestamps?.createTime as string
          ),
        ));
      }
    } catch (error) {
      if (!this.isApiNotEnabled(error)) {
        errors.push(this.createError('entryGroups.list', error));
      }
    }

    return { resources, errors };
  }
}

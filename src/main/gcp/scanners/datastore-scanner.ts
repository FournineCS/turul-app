// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GCPBaseScanner, GCPScannerConfig, GCPScanResult } from './base-scanner';
import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';

export class DatastoreScanner extends GCPBaseScanner {
  constructor(config: GCPScannerConfig) {
    super(config, 'datastore', 'Datastore');
  }

  async scan(): Promise<GCPScanResult> {
    const resources: GCPScanResult['resources'] = [];
    const errors: GCPScanResult['errors'] = [];

    try {
      const auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      });
      const authClient = await auth.getClient();
      const datastore = google.datastore({ version: 'v1', auth: authClient as any });

      const response = await datastore.projects.indexes.list({
        projectId: this.config.projectId,
      });

      const indexes = response.data.indexes || [];

      for (const index of indexes) {
        const indexId = index.indexId || '';
        const resourceId = `projects/${this.config.projectId}/indexes/${indexId}`;
        const kind = index.kind || 'unknown';

        resources.push(this.createResource(
          resourceId,
          'datastore-index',
          `${kind}-index-${indexId}`,
          'global',
          {
            kind: index.kind,
            properties: index.properties,
            ancestor: index.ancestor,
            indexId: index.indexId,
            state: index.state,
          },
        ));
      }
    } catch (error) {
      if (!this.isApiNotEnabled(error)) {
        errors.push(this.createError('indexes.list', error));
      }
    }

    return { resources, errors };
  }
}

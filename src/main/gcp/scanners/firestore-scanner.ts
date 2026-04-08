// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GCPBaseScanner, GCPScannerConfig, GCPScanResult } from './base-scanner';
import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';

export class FirestoreScanner extends GCPBaseScanner {
  constructor(config: GCPScannerConfig) {
    super(config, 'firestore', 'Firestore');
  }

  async scan(): Promise<GCPScanResult> {
    const resources: GCPScanResult['resources'] = [];
    const errors: GCPScanResult['errors'] = [];

    try {
      const auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      });
      const authClient = await auth.getClient();
      const firestore = google.firestore({ version: 'v1', auth: authClient as any });

      const response = await firestore.projects.databases.list({
        parent: `projects/${this.config.projectId}`,
      });

      const databases = response.data.databases || [];

      for (const db of databases) {
        const dbName = db.name || '';
        const shortName = dbName.split('/').pop() || dbName;
        const region = db.locationId || 'global';

        resources.push(this.createResource(
          dbName || `projects/${this.config.projectId}/databases/${shortName}`,
          'firestore-database',
          shortName,
          region,
          {
            name: db.name,
            type: db.type,
            locationId: db.locationId,
            concurrencyMode: db.concurrencyMode,
            appEngineIntegrationMode: db.appEngineIntegrationMode,
          },
        ));
      }
    } catch (error) {
      if (!this.isApiNotEnabled(error)) {
        errors.push(this.createError('databases.list', error));
      }
    }

    return { resources, errors };
  }
}

// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GCPBaseScanner, GCPScannerConfig, GCPScanResult } from './base-scanner';
import { GoogleAuth } from 'google-auth-library';

export class ApplicationIntegrationScanner extends GCPBaseScanner {
  constructor(config: GCPScannerConfig) {
    super(config, 'application-integration', 'Application Integration');
  }

  async scan(): Promise<GCPScanResult> {
    const resources: GCPScanResult['resources'] = [];
    const errors: GCPScanResult['errors'] = [];

    try {
      const auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      });
      const client = await auth.getClient();
      const projectId = this.config.projectId;
      const baseUrl = 'https://integrations.googleapis.com/v1';

      try {
        const response = await client.request({
          url: `${baseUrl}/projects/${projectId}/locations/-/integrations`,
        });
        const data = response.data as { integrations?: Array<{ name?: string; description?: string; updateTime?: string }> };
        const integrationList = data.integrations || [];

        for (const integration of integrationList) {
          const integrationName = integration.name || '';
          const nameParts = integrationName.split('/');
          const shortName = nameParts[nameParts.length - 1] || integrationName;
          const location = nameParts.length >= 4 ? nameParts[3] : 'global';
          const region = this.extractRegionFromZone(location);

          resources.push(this.createResource(
            integrationName,
            'integration',
            shortName,
            region,
            {
              name: integrationName,
              description: integration.description,
              updateTime: integration.updateTime,
            },
            {},
          ));
        }
      } catch (error) {
        if (!this.isApiNotEnabled(error)) {
          errors.push(this.createError('projects.locations.integrations.list', error));
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

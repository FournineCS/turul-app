// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GCPBaseScanner, GCPScannerConfig, GCPScanResult } from './base-scanner';
import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';

export class APIGatewayScanner extends GCPBaseScanner {
  constructor(config: GCPScannerConfig) {
    super(config, 'api-gateway', 'API Gateway');
  }

  async scan(): Promise<GCPScanResult> {
    const resources: GCPScanResult['resources'] = [];
    const errors: GCPScanResult['errors'] = [];

    try {
      const auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      });
      const authClient = await auth.getClient();
      const apigateway = google.apigateway({ version: 'v1', auth: authClient as any });
      const projectId = this.config.projectId;

      // List gateways
      try {
        const response = await apigateway.projects.locations.gateways.list({
          parent: `projects/${projectId}/locations/-`,
        });

        const gateways = response.data.gateways || [];

        for (const gateway of gateways) {
          const gatewayName = gateway.name || '';
          const nameParts = gatewayName.split('/');
          const shortName = nameParts[nameParts.length - 1] || gatewayName;
          const location = nameParts.length >= 4 ? nameParts[3] : 'global';
          const region = this.extractRegionFromZone(location);

          resources.push(this.createResource(
            gatewayName,
            'gateway',
            gateway.displayName || shortName,
            region,
            {
              name: gatewayName,
              displayName: gateway.displayName,
              apiConfig: gateway.apiConfig,
              state: gateway.state,
              defaultHostname: gateway.defaultHostname,
              createTime: gateway.createTime,
              updateTime: gateway.updateTime,
            },
            {},
            this.parseTimestamp(gateway.createTime as string),
          ));
        }
      } catch (error) {
        if (!this.isApiNotEnabled(error)) {
          errors.push(this.createError('projects.locations.gateways.list', error));
        }
      }

      // List APIs
      try {
        const response = await apigateway.projects.locations.apis.list({
          parent: `projects/${projectId}/locations/global`,
        });

        const apis = response.data.apis || [];

        for (const api of apis) {
          const apiName = api.name || '';
          const nameParts = apiName.split('/');
          const shortName = nameParts[nameParts.length - 1] || apiName;

          resources.push(this.createResource(
            apiName,
            'api',
            api.displayName || shortName,
            'global',
            {
              name: apiName,
              displayName: api.displayName,
              state: api.state,
              createTime: api.createTime,
              managedService: api.managedService,
            },
            {},
            this.parseTimestamp(api.createTime as string),
          ));
        }
      } catch (error) {
        if (!this.isApiNotEnabled(error)) {
          errors.push(this.createError('projects.locations.apis.list', error));
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

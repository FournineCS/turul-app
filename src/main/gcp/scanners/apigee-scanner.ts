// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GCPBaseScanner, GCPScannerConfig, GCPScanResult } from './base-scanner';
import { GoogleAuth } from 'google-auth-library';

export class ApigeeScanner extends GCPBaseScanner {
  constructor(config: GCPScannerConfig) {
    super(config, 'apigee', 'Apigee');
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
      const baseUrl = 'https://apigee.googleapis.com/v1';

      // Check if this project has an Apigee organization
      let orgExists = false;
      try {
        await client.request({ url: `${baseUrl}/organizations/${projectId}` });
        orgExists = true;
      } catch (orgError) {
        if (!this.isApiNotEnabled(orgError)) {
          const message = orgError instanceof Error ? orgError.message : String(orgError);
          if (!message.includes('NOT_FOUND') && !message.includes('404')) {
            errors.push(this.createError('organizations.get', orgError));
          }
        }
      }

      if (orgExists) {
        // List environments
        try {
          const envsResponse = await client.request({
            url: `${baseUrl}/organizations/${projectId}/environments`,
          });
          const envNames: string[] = (envsResponse.data as string[]) || [];

          for (const envName of envNames) {
            resources.push(this.createResource(
              `organizations/${projectId}/environments/${envName}`,
              'environment',
              envName,
              'global',
              {
                name: envName,
                organization: projectId,
              },
              {},
            ));
          }
        } catch (envError) {
          if (!this.isApiNotEnabled(envError)) {
            errors.push(this.createError('organizations.environments.list', envError));
          }
        }

        // List API proxies
        try {
          const proxiesResponse = await client.request({
            url: `${baseUrl}/organizations/${projectId}/apis`,
          });
          const data = proxiesResponse.data as { proxies?: Array<{ name?: string; revision?: string[]; metaData?: unknown }> };
          const proxies = data.proxies || [];

          for (const proxy of proxies) {
            const proxyName = proxy.name || '';
            resources.push(this.createResource(
              `organizations/${projectId}/apis/${proxyName}`,
              'api-proxy',
              proxyName,
              'global',
              {
                name: proxyName,
                revision: proxy.revision,
                metaData: proxy.metaData,
              },
              {},
            ));
          }
        } catch (proxyError) {
          if (!this.isApiNotEnabled(proxyError)) {
            errors.push(this.createError('organizations.apis.list', proxyError));
          }
        }
      }
    } catch (error) {
      if (!this.isApiNotEnabled(error)) {
        errors.push(this.createError('apigee.init', error));
      }
    }

    return { resources, errors };
  }
}

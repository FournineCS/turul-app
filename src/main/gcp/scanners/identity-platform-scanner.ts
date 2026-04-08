// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GCPBaseScanner, GCPScannerConfig, GCPScanResult } from './base-scanner';
import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';

export class IdentityPlatformScanner extends GCPBaseScanner {
  constructor(config: GCPScannerConfig) {
    super(config, 'identity-platform', 'Identity Platform');
  }

  async scan(): Promise<GCPScanResult> {
    const resources: GCPScanResult['resources'] = [];
    const errors: GCPScanResult['errors'] = [];

    try {
      const auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      });
      const authClient = await auth.getClient();
      const identitytoolkit = google.identitytoolkit({ version: 'v2', auth: authClient as any });
      const projectId = this.config.projectId;

      // List tenants
      try {
        const response = await identitytoolkit.projects.tenants.list({
          parent: `projects/${projectId}`,
        });

        const tenants = response.data.tenants || [];

        for (const tenant of tenants) {
          const tenantName = tenant.name || '';
          const nameParts = tenantName.split('/');
          const shortName = nameParts[nameParts.length - 1] || tenantName;

          resources.push(this.createResource(
            tenantName,
            'tenant',
            tenant.displayName || shortName,
            'global',
            {
              name: tenantName,
              displayName: tenant.displayName,
              allowPasswordSignup: tenant.allowPasswordSignup,
              enableEmailLinkSignin: tenant.enableEmailLinkSignin,
              disableAuth: tenant.disableAuth,
              enableAnonymousUser: tenant.enableAnonymousUser,
            },
            {},
          ));
        }
      } catch (error) {
        if (!this.isApiNotEnabled(error)) {
          errors.push(this.createError('projects.tenants.list', error));
        }
      }

      // Get project config
      try {
        const configResponse = await identitytoolkit.projects.getConfig({
          name: `projects/${projectId}/config`,
        });

        if (configResponse.data) {
          const config = configResponse.data;
          resources.push(this.createResource(
            `projects/${projectId}/config`,
            'config',
            'project-config',
            'global',
            {
              signIn: config.signIn,
              mfa: config.mfa,
              notification: config.notification,
              quota: config.quota,
              monitoring: config.monitoring,
              multiTenant: config.multiTenant,
              authorizedDomains: config.authorizedDomains,
              subtype: config.subtype,
            },
            {},
          ));
        }
      } catch (error) {
        if (!this.isApiNotEnabled(error)) {
          errors.push(this.createError('projects.getConfig', error));
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

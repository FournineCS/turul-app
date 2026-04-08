// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GCPBaseScanner, GCPScannerConfig, GCPScanResult } from './base-scanner';
import { google } from 'googleapis';

export class IAMScanner extends GCPBaseScanner {
  constructor(config: GCPScannerConfig) {
    super(config, 'gcp-iam', 'IAM');
  }

  async scan(): Promise<GCPScanResult> {
    const resources: GCPScanResult['resources'] = [];
    const errors: GCPScanResult['errors'] = [];

    const auth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });

    // Scan service accounts
    try {
      const iam = google.iam({ version: 'v1', auth });
      const response = await iam.projects.serviceAccounts.list({
        name: `projects/${this.config.projectId}`,
      });

      const accounts = response.data.accounts || [];

      for (const account of accounts) {
        const email = account.email || '';
        const uniqueId = account.uniqueId || '';
        const name = account.displayName || email;

        resources.push(this.createResource(
          account.name || `projects/${this.config.projectId}/serviceAccounts/${email}`,
          'service-account',
          name,
          'global',
          {
            email: account.email,
            displayName: account.displayName,
            disabled: account.disabled,
            oauth2ClientId: account.oauth2ClientId,
            description: account.description,
            uniqueId: uniqueId,
          },
          {},
        ));
      }
    } catch (error) {
      if (!this.isApiNotEnabled(error)) {
        errors.push(this.createError('listServiceAccounts', error));
      }
    }

    // Scan project IAM policy
    try {
      const crm = google.cloudresourcemanager({ version: 'v1', auth });
      const response = await crm.projects.getIamPolicy({
        resource: this.config.projectId,
        requestBody: {},
      });

      const policy = response.data;

      if (policy) {
        resources.push(this.createResource(
          `projects/${this.config.projectId}/iamPolicy`,
          'iam-policy',
          `${this.config.projectId}-iam-policy`,
          'global',
          {
            bindings: policy.bindings,
            etag: policy.etag,
            version: policy.version,
          },
          {},
        ));
      }
    } catch (error) {
      if (!this.isApiNotEnabled(error)) {
        errors.push(this.createError('getIamPolicy', error));
      }
    }

    return { resources, errors };
  }
}

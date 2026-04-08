// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GCPBaseScanner, GCPScannerConfig, GCPScanResult } from './base-scanner';
import { google } from 'googleapis';

export class AccessContextManagerScanner extends GCPBaseScanner {
  constructor(config: GCPScannerConfig) {
    super(config, 'access-context-manager', 'Access Context Manager');
  }

  async scan(): Promise<GCPScanResult> {
    const resources: GCPScanResult['resources'] = [];
    const errors: GCPScanResult['errors'] = [];

    try {
      const auth = new google.auth.GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      });
      const acm = google.accesscontextmanager({ version: 'v1', auth });

      const response = await acm.accessPolicies.list({
        parent: `organizations/-`,
      });

      const policies = response.data.accessPolicies || [];

      for (const policy of policies) {
        const name = policy.name || '';
        // Access policy name format: accessPolicies/{policy_id}
        const shortName = name.split('/').pop() || name;

        resources.push(this.createResource(
          name,
          'access-policy',
          policy.title || shortName,
          'global',
          {
            name: policy.name,
            title: policy.title,
            scopes: policy.scopes,
            etag: policy.etag,
          },
          {},
          undefined,
        ));
      }
    } catch (error) {
      // Access Context Manager requires org-level permissions, gracefully handle
      if (!this.isApiNotEnabled(error)) {
        const message = error instanceof Error ? error.message : String(error);
        // Also handle 403 Forbidden which is common for org-level APIs
        if (!message.includes('403') && !message.includes('Forbidden')) {
          errors.push(this.createError('listAccessPolicies', error));
        }
      }
    }

    return { resources, errors };
  }
}

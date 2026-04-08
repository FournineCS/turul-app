// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GCPBaseScanner, GCPScannerConfig, GCPScanResult } from './base-scanner';
import { google } from 'googleapis';

export class CertificateAuthorityScanner extends GCPBaseScanner {
  constructor(config: GCPScannerConfig) {
    super(config, 'certificate-authority', 'Certificate Authority Service');
  }

  async scan(): Promise<GCPScanResult> {
    const resources: GCPScanResult['resources'] = [];
    const errors: GCPScanResult['errors'] = [];

    try {
      const auth = new google.auth.GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      });
      const privateca = google.privateca({ version: 'v1', auth });

      const response = await privateca.projects.locations.caPools.list({
        parent: `projects/${this.config.projectId}/locations/-`,
      });

      const caPools = response.data.caPools || [];

      for (const pool of caPools) {
        const name = pool.name || '';
        // CA Pool name format: projects/{project}/locations/{location}/caPools/{caPool}
        const locationMatch = name.match(/\/locations\/([^/]+)/);
        const region = locationMatch ? locationMatch[1] : 'global';
        const shortName = name.split('/').pop() || name;

        resources.push(this.createResource(
          name,
          'ca-pool',
          shortName,
          region,
          {
            name: pool.name,
            tier: pool.tier,
            issuancePolicy: pool.issuancePolicy,
            publishingOptions: pool.publishingOptions,
            labels: pool.labels,
          },
          this.parseLabels((pool.labels || {}) as Record<string, string>),
          undefined,
        ));
      }
    } catch (error) {
      if (!this.isApiNotEnabled(error)) {
        errors.push(this.createError('listCaPools', error));
      }
    }

    return { resources, errors };
  }
}

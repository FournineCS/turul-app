// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GCPBaseScanner, GCPScannerConfig, GCPScanResult } from './base-scanner';
import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';

export class NetworkIntelligenceScanner extends GCPBaseScanner {
  constructor(config: GCPScannerConfig) {
    super(config, 'network-intelligence', 'Network Intelligence');
  }

  async scan(): Promise<GCPScanResult> {
    const resources: GCPScanResult['resources'] = [];
    const errors: GCPScanResult['errors'] = [];

    try {
      const auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      });
      const authClient = await auth.getClient();
      const networkmanagement = google.networkmanagement({ version: 'v1', auth: authClient as any });
      const projectId = this.config.projectId;

      // List connectivity tests
      try {
        const response = await networkmanagement.projects.locations.global.connectivityTests.list({
          parent: `projects/${projectId}/locations/global`,
        });

        const tests = response.data.resources || [];

        for (const test of tests) {
          const testName = test.name || '';
          const nameParts = testName.split('/');
          const shortName = nameParts[nameParts.length - 1] || testName;

          resources.push(this.createResource(
            testName,
            'connectivity-test',
            test.displayName || shortName,
            'global',
            {
              name: testName,
              description: test.description,
              source: test.source,
              destination: test.destination,
              protocol: test.protocol,
              createTime: test.createTime,
              updateTime: test.updateTime,
              reachabilityDetails: test.reachabilityDetails,
            },
            this.parseLabels(test.labels as Record<string, string>),
            this.parseTimestamp(test.createTime as string),
          ));
        }
      } catch (error) {
        if (!this.isApiNotEnabled(error)) {
          errors.push(this.createError('projects.locations.global.connectivityTests.list', error));
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

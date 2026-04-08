// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GCPBaseScanner, GCPScannerConfig, GCPScanResult } from './base-scanner';
import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';

export class DeploymentManagerScanner extends GCPBaseScanner {
  constructor(config: GCPScannerConfig) {
    super(config, 'deployment-manager', 'Deployment Manager');
  }

  async scan(): Promise<GCPScanResult> {
    const resources: GCPScanResult['resources'] = [];
    const errors: GCPScanResult['errors'] = [];

    try {
      const auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      });
      const authClient = await auth.getClient();
      const deploymentmanager = google.deploymentmanager({ version: 'v2', auth: authClient as any });
      const projectId = this.config.projectId;

      const response = await deploymentmanager.deployments.list({
        project: projectId,
      });

      const deployments = response.data.deployments || [];

      for (const deployment of deployments) {
        const deploymentName = deployment.name || '';
        const deploymentId = deployment.id || deploymentName;

        resources.push(this.createResource(
          String(deploymentId),
          'deployment',
          deploymentName,
          'global',
          {
            name: deploymentName,
            id: deployment.id,
            description: deployment.description,
            operation: deployment.operation,
            fingerprint: deployment.fingerprint,
            insertTime: deployment.insertTime,
            updateTime: deployment.updateTime,
            manifest: deployment.manifest,
          },
          this.parseLabels(deployment.labels as unknown as Record<string, string>),
          this.parseTimestamp(deployment.insertTime as string),
        ));
      }
    } catch (error) {
      if (!this.isApiNotEnabled(error)) {
        errors.push(this.createError('deployments.list', error));
      }
    }

    return { resources, errors };
  }
}

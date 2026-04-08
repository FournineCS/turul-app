// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GCPBaseScanner, GCPScannerConfig, GCPScanResult } from './base-scanner';
import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';

export class ComposerScanner extends GCPBaseScanner {
  constructor(config: GCPScannerConfig) {
    super(config, 'cloud-composer', 'Cloud Composer');
  }

  async scan(): Promise<GCPScanResult> {
    const resources: GCPScanResult['resources'] = [];
    const errors: GCPScanResult['errors'] = [];

    try {
      const auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      });
      const authClient = await auth.getClient();
      const composer = google.composer({ version: 'v1', auth: authClient as any });
      const projectId = this.config.projectId;

      const response = await composer.projects.locations.environments.list({
        parent: `projects/${projectId}/locations/-`,
      });

      const environments = response.data.environments || [];

      for (const env of environments) {
        const fullName = env.name || '';
        // Name format: projects/{project}/locations/{location}/environments/{environment}
        const nameParts = fullName.split('/');
        const envName = nameParts.length >= 6 ? nameParts[5] : fullName;
        const location = nameParts.length >= 4 ? nameParts[3] : 'global';
        const region = this.extractRegionFromZone(location);

        resources.push(this.createResource(
          fullName || `projects/${projectId}/locations/${location}/environments/${envName}`,
          'environment',
          envName,
          region,
          {
            name: envName,
            state: env.state,
            config: env.config ? {
              nodeCount: env.config.nodeCount,
              softwareConfig: env.config.softwareConfig ? {
                imageVersion: env.config.softwareConfig.imageVersion,
                airflowConfigOverrides: env.config.softwareConfig.airflowConfigOverrides,
                envVariables: env.config.softwareConfig.envVariables,
                pythonVersion: env.config.softwareConfig.pythonVersion,
              } : undefined,
              nodeConfig: env.config.nodeConfig ? {
                location: env.config.nodeConfig.location,
                machineType: env.config.nodeConfig.machineType,
                network: env.config.nodeConfig.network,
                subnetwork: env.config.nodeConfig.subnetwork,
                diskSizeGb: env.config.nodeConfig.diskSizeGb,
                serviceAccount: env.config.nodeConfig.serviceAccount,
              } : undefined,
              databaseConfig: env.config.databaseConfig ? {
                machineType: env.config.databaseConfig.machineType,
              } : undefined,
            } : undefined,
            createTime: env.createTime,
            updateTime: env.updateTime,
            uuid: env.uuid,
          },
          this.parseLabels(env.labels as Record<string, string>),
          this.parseTimestamp(env.createTime as string),
        ));
      }
    } catch (error) {
      if (!this.isApiNotEnabled(error)) {
        errors.push(this.createError('environments.list', error));
      }
    }

    return { resources, errors };
  }
}

// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GCPBaseScanner, GCPScannerConfig, GCPScanResult } from './base-scanner';
import { google } from 'googleapis';

export class FunctionsScanner extends GCPBaseScanner {
  constructor(config: GCPScannerConfig) {
    super(config, 'cloud-functions', 'Cloud Functions');
  }

  async scan(): Promise<GCPScanResult> {
    const resources: GCPScanResult['resources'] = [];
    const errors: GCPScanResult['errors'] = [];

    try {
      const auth = new google.auth.GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      });
      const cloudfunctions = google.cloudfunctions({ version: 'v2', auth });

      const response = await cloudfunctions.projects.locations.functions.list({
        parent: `projects/${this.config.projectId}/locations/-`,
      });

      const functions = response.data.functions || [];

      for (const func of functions) {
        const name = func.name || '';
        // Cloud Functions name format: projects/{project}/locations/{location}/functions/{function}
        const nameParts = name.split('/');
        const functionName = nameParts.length >= 6 ? nameParts[5] : name;
        const location = nameParts.length >= 4 ? nameParts[3] : 'unknown';
        const region = this.extractRegionFromZone(location);

        resources.push(this.createResource(
          name,
          'function',
          functionName,
          region,
          {
            name: functionName,
            state: func.state,
            runtime: func.buildConfig?.runtime,
            entryPoint: func.buildConfig?.entryPoint,
            buildConfig: func.buildConfig ? {
              runtime: func.buildConfig.runtime,
              entryPoint: func.buildConfig.entryPoint,
              source: func.buildConfig.source,
              dockerRepository: func.buildConfig.dockerRepository,
              environmentVariables: func.buildConfig.environmentVariables,
            } : undefined,
            serviceConfig: func.serviceConfig ? {
              service: func.serviceConfig.service,
              timeoutSeconds: func.serviceConfig.timeoutSeconds,
              availableMemory: func.serviceConfig.availableMemory,
              maxInstanceCount: func.serviceConfig.maxInstanceCount,
              minInstanceCount: func.serviceConfig.minInstanceCount,
              vpcConnector: func.serviceConfig.vpcConnector,
              ingressSettings: func.serviceConfig.ingressSettings,
              uri: func.serviceConfig.uri,
              serviceAccountEmail: func.serviceConfig.serviceAccountEmail,
              allTrafficOnLatestRevision: func.serviceConfig.allTrafficOnLatestRevision,
              environmentVariables: func.serviceConfig.environmentVariables,
            } : undefined,
            environment: func.environment,
          },
          this.parseLabels(func.labels as Record<string, string>),
          this.parseTimestamp(func.updateTime as string),
        ));
      }
    } catch (error) {
      if (!this.isApiNotEnabled(error)) {
        errors.push(this.createError('listFunctions', error));
      }
    }

    return { resources, errors };
  }
}

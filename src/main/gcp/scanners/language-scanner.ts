// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GCPBaseScanner, GCPScannerConfig, GCPScanResult } from './base-scanner';
import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';

export class LanguageScanner extends GCPBaseScanner {
  constructor(config: GCPScannerConfig) {
    super(config, 'natural-language', 'Natural Language');
  }

  async scan(): Promise<GCPScanResult> {
    const resources: GCPScanResult['resources'] = [];
    const errors: GCPScanResult['errors'] = [];

    try {
      const auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      });
      const authClient = await auth.getClient();
      const ml = google.ml({ version: 'v1', auth: authClient as any });
      const projectId = this.config.projectId;

      // Attempt to list custom AutoML Natural Language models via ML Engine
      const response = await ml.projects.models.list({
        parent: `projects/${projectId}`,
      });

      const models = response.data.models || [];
      let foundResources = false;

      for (const model of models) {
        const name = model.name || '';
        const nameParts = name.split('/');
        const modelId = nameParts.length >= 4 ? nameParts[3] : name;

        resources.push(this.createResource(
          name || `projects/${projectId}/models/${modelId}`,
          'model',
          modelId,
          'global',
          {
            name: model.name,
            description: model.description,
            defaultVersion: model.defaultVersion ? {
              name: model.defaultVersion.name,
              state: model.defaultVersion.state,
              createTime: model.defaultVersion.createTime,
            } : undefined,
            regions: model.regions,
            onlinePredictionLogging: model.onlinePredictionLogging,
            onlinePredictionConsoleLogging: model.onlinePredictionConsoleLogging,
          },
          this.parseLabels(model.labels as Record<string, string>),
          this.parseTimestamp(model.defaultVersion?.createTime as string),
        ));
        foundResources = true;
      }

      // If no listable resources found, create a service-status resource
      if (!foundResources) {
        resources.push(this.createResource(
          `projects/${projectId}/services/natural-language`,
          'service-status',
          'Natural Language API',
          'global',
          {
            serviceEnabled: true,
          },
          {},
        ));
      }
    } catch (error) {
      if (this.isApiNotEnabled(error)) {
        // API not enabled, no resources to report
      } else {
        // If listing models fails for another reason, still create a service-status resource
        resources.push(this.createResource(
          `projects/${this.config.projectId}/services/natural-language`,
          'service-status',
          'Natural Language API',
          'global',
          {
            serviceEnabled: true,
          },
          {},
        ));
      }
    }

    return { resources, errors };
  }
}

// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GCPBaseScanner, GCPScannerConfig, GCPScanResult } from './base-scanner';
import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';

export class SpeechScanner extends GCPBaseScanner {
  constructor(config: GCPScannerConfig) {
    super(config, 'speech-ai', 'Speech-to-Text');
  }

  async scan(): Promise<GCPScanResult> {
    const resources: GCPScanResult['resources'] = [];
    const errors: GCPScanResult['errors'] = [];

    try {
      const auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      });
      const authClient = await auth.getClient();
      const speech = google.speech({ version: 'v1', auth: authClient as any });
      const projectId = this.config.projectId;

      const response = await speech.projects.locations.customClasses.list({
        parent: `projects/${projectId}/locations/global`,
      });

      const customClasses = response.data.customClasses || [];

      for (const customClass of customClasses) {
        const name = customClass.name || '';
        const nameParts = name.split('/');
        const customClassId = customClass.customClassId || (nameParts.length >= 6 ? nameParts[5] : name);

        resources.push(this.createResource(
          name || `projects/${projectId}/locations/global/customClasses/${customClassId}`,
          'custom-class',
          customClassId,
          'global',
          {
            name: customClass.name,
            customClassId: customClass.customClassId,
            items: customClass.items?.map(item => ({
              value: item.value,
            })),
          },
          {},
        ));
      }
    } catch (error) {
      if (!this.isApiNotEnabled(error)) {
        errors.push(this.createError('customClasses.list', error));
      }
    }

    return { resources, errors };
  }
}

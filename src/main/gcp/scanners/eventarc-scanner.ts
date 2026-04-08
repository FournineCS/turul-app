// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GCPBaseScanner, GCPScannerConfig, GCPScanResult } from './base-scanner';
import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';

export class EventarcScanner extends GCPBaseScanner {
  constructor(config: GCPScannerConfig) {
    super(config, 'eventarc', 'Eventarc');
  }

  async scan(): Promise<GCPScanResult> {
    const resources: GCPScanResult['resources'] = [];
    const errors: GCPScanResult['errors'] = [];

    try {
      const auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      });
      const authClient = await auth.getClient();
      const eventarc = google.eventarc({ version: 'v1', auth: authClient as any });
      const projectId = this.config.projectId;

      let pageToken: string | undefined;
      do {
        const response = await eventarc.projects.locations.triggers.list({
          parent: `projects/${projectId}/locations/-`,
          pageToken,
        });

        const triggers = response.data.triggers || [];

        for (const trigger of triggers) {
          const fullName = trigger.name || '';
          // Trigger name format: projects/{project}/locations/{location}/triggers/{trigger}
          const nameParts = fullName.split('/');
          const triggerName = nameParts.length >= 6 ? nameParts[5] : fullName;
          const location = nameParts.length >= 4 ? nameParts[3] : 'global';
          const region = this.extractRegionFromZone(location);

          resources.push(this.createResource(
            fullName || `projects/${projectId}/locations/${location}/triggers/${triggerName}`,
            'trigger',
            triggerName,
            region,
            {
              name: triggerName,
              eventFilters: trigger.eventFilters,
              destination: trigger.destination,
              transport: trigger.transport,
              serviceAccount: trigger.serviceAccount,
              createTime: trigger.createTime,
              updateTime: trigger.updateTime,
              conditions: trigger.conditions,
            },
            this.parseLabels(trigger.labels as Record<string, string>),
            this.parseTimestamp(trigger.createTime as string),
          ));
        }

        pageToken = response.data.nextPageToken || undefined;
      } while (pageToken);
    } catch (error) {
      if (!this.isApiNotEnabled(error)) {
        errors.push(this.createError('triggers.list', error));
      }
    }

    return { resources, errors };
  }
}

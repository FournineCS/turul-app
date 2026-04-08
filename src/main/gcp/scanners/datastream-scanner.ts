// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GCPBaseScanner, GCPScannerConfig, GCPScanResult } from './base-scanner';
import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';

export class DatastreamScanner extends GCPBaseScanner {
  constructor(config: GCPScannerConfig) {
    super(config, 'datastream', 'Datastream');
  }

  async scan(): Promise<GCPScanResult> {
    const resources: GCPScanResult['resources'] = [];
    const errors: GCPScanResult['errors'] = [];

    try {
      const auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      });
      const authClient = await auth.getClient();
      const datastream = google.datastream({ version: 'v1', auth: authClient as any });
      const projectId = this.config.projectId;

      // List streams
      try {
        const response = await datastream.projects.locations.streams.list({
          parent: `projects/${projectId}/locations/-`,
        });

        const streams = response.data.streams || [];

        for (const stream of streams) {
          const streamName = stream.name || '';
          const nameParts = streamName.split('/');
          const shortName = nameParts[nameParts.length - 1] || streamName;
          const location = nameParts.length >= 4 ? nameParts[3] : 'global';
          const region = this.extractRegionFromZone(location);

          resources.push(this.createResource(
            streamName,
            'stream',
            stream.displayName || shortName,
            region,
            {
              name: streamName,
              displayName: stream.displayName,
              state: stream.state,
              createTime: stream.createTime,
              updateTime: stream.updateTime,
              sourceConfig: stream.sourceConfig,
              destinationConfig: stream.destinationConfig,
              backfillAll: stream.backfillAll,
              backfillNone: stream.backfillNone,
            },
            this.parseLabels(stream.labels),
            this.parseTimestamp(stream.createTime as string),
          ));
        }
      } catch (error) {
        if (!this.isApiNotEnabled(error)) {
          errors.push(this.createError('projects.locations.streams.list', error));
        }
      }

      // List connection profiles
      try {
        const response = await datastream.projects.locations.connectionProfiles.list({
          parent: `projects/${projectId}/locations/-`,
        });

        const profiles = response.data.connectionProfiles || [];

        for (const profile of profiles) {
          const profileName = profile.name || '';
          const nameParts = profileName.split('/');
          const shortName = nameParts[nameParts.length - 1] || profileName;
          const location = nameParts.length >= 4 ? nameParts[3] : 'global';
          const region = this.extractRegionFromZone(location);

          resources.push(this.createResource(
            profileName,
            'connection-profile',
            profile.displayName || shortName,
            region,
            {
              name: profileName,
              displayName: profile.displayName,
              createTime: profile.createTime,
              updateTime: profile.updateTime,
              state: (profile as any).state,
            },
            this.parseLabels(profile.labels),
            this.parseTimestamp(profile.createTime as string),
          ));
        }
      } catch (error) {
        if (!this.isApiNotEnabled(error)) {
          errors.push(this.createError('projects.locations.connectionProfiles.list', error));
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

// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GCPBaseScanner, GCPScannerConfig, GCPScanResult } from './base-scanner';
import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';

export class DatabaseMigrationScanner extends GCPBaseScanner {
  constructor(config: GCPScannerConfig) {
    super(config, 'database-migration', 'Database Migration');
  }

  async scan(): Promise<GCPScanResult> {
    const resources: GCPScanResult['resources'] = [];
    const errors: GCPScanResult['errors'] = [];

    try {
      const auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      });
      const authClient = await auth.getClient();
      const datamigration = google.datamigration({ version: 'v1', auth: authClient as any });
      const projectId = this.config.projectId;

      // List migration jobs
      try {
        const jobsResponse = await datamigration.projects.locations.migrationJobs.list({
          parent: `projects/${projectId}/locations/-`,
        });

        const migrationJobs = jobsResponse.data.migrationJobs || [];

        for (const job of migrationJobs) {
          const jobName = job.name || '';
          const nameParts = jobName.split('/');
          const shortName = nameParts[nameParts.length - 1] || jobName;
          const location = nameParts.length >= 4 ? nameParts[3] : 'global';
          const region = this.extractRegionFromZone(location);

          resources.push(this.createResource(
            jobName,
            'migration-job',
            shortName,
            region,
            {
              name: jobName,
              displayName: job.displayName,
              state: job.state,
              type: job.type,
              source: job.source,
              destination: job.destination,
              createTime: job.createTime,
              updateTime: job.updateTime,
              phase: job.phase,
              duration: job.duration,
            },
            {},
            this.parseTimestamp(job.createTime as string),
          ));
        }
      } catch (jobError) {
        if (!this.isApiNotEnabled(jobError)) {
          errors.push(this.createError('projects.locations.migrationJobs.list', jobError));
        }
      }

      // List connection profiles
      try {
        const profilesResponse = await datamigration.projects.locations.connectionProfiles.list({
          parent: `projects/${projectId}/locations/-`,
        });

        const connectionProfiles = profilesResponse.data.connectionProfiles || [];

        for (const profile of connectionProfiles) {
          const profileName = profile.name || '';
          const nameParts = profileName.split('/');
          const shortName = nameParts[nameParts.length - 1] || profileName;
          const location = nameParts.length >= 4 ? nameParts[3] : 'global';
          const region = this.extractRegionFromZone(location);

          resources.push(this.createResource(
            profileName,
            'connection-profile',
            shortName,
            region,
            {
              name: profileName,
              displayName: profile.displayName,
              state: profile.state,
              createTime: profile.createTime,
              updateTime: profile.updateTime,
              provider: profile.provider,
            },
            {},
            this.parseTimestamp(profile.createTime as string),
          ));
        }
      } catch (profileError) {
        if (!this.isApiNotEnabled(profileError)) {
          errors.push(this.createError('projects.locations.connectionProfiles.list', profileError));
        }
      }
    } catch (error) {
      if (!this.isApiNotEnabled(error)) {
        errors.push(this.createError('datamigration.init', error));
      }
    }

    return { resources, errors };
  }
}

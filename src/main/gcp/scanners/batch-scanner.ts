// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GCPBaseScanner, GCPScannerConfig, GCPScanResult } from './base-scanner';
import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';

export class BatchScanner extends GCPBaseScanner {
  constructor(config: GCPScannerConfig) {
    super(config, 'cloud-batch', 'Cloud Batch');
  }

  async scan(): Promise<GCPScanResult> {
    const resources: GCPScanResult['resources'] = [];
    const errors: GCPScanResult['errors'] = [];

    try {
      const auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      });
      const authClient = await auth.getClient();
      const batch = google.batch({ version: 'v1', auth: authClient as any });
      const projectId = this.config.projectId;

      const response = await batch.projects.locations.jobs.list({
        parent: `projects/${projectId}/locations/-`,
      });

      const jobs = response.data.jobs || [];

      for (const job of jobs) {
        const jobName = job.name || '';
        const nameParts = jobName.split('/');
        const shortName = nameParts[nameParts.length - 1] || jobName;
        const location = nameParts.length >= 4 ? nameParts[3] : 'global';
        const region = this.extractRegionFromZone(location);

        resources.push(this.createResource(
          jobName,
          'job',
          shortName,
          region,
          {
            name: jobName,
            uid: job.uid,
            state: job.status?.state,
            createTime: job.createTime,
            updateTime: job.updateTime,
            taskGroups: job.taskGroups,
            allocationPolicy: job.allocationPolicy,
            status: job.status,
          },
          {},
          this.parseTimestamp(job.createTime as string),
        ));
      }
    } catch (error) {
      if (!this.isApiNotEnabled(error)) {
        errors.push(this.createError('projects.locations.jobs.list', error));
      }
    }

    return { resources, errors };
  }
}

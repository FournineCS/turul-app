// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GCPBaseScanner, GCPScannerConfig, GCPScanResult } from './base-scanner';
import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';

export class DataflowScanner extends GCPBaseScanner {
  constructor(config: GCPScannerConfig) {
    super(config, 'dataflow', 'Dataflow');
  }

  async scan(): Promise<GCPScanResult> {
    const resources: GCPScanResult['resources'] = [];
    const errors: GCPScanResult['errors'] = [];

    try {
      const auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      });
      const authClient = await auth.getClient();
      const dataflow = google.dataflow({ version: 'v1b3', auth: authClient as any });
      const projectId = this.config.projectId;

      const response = await dataflow.projects.jobs.list({
        projectId,
        location: '-',
      });

      const jobs = response.data.jobs || [];

      for (const job of jobs) {
        const jobId = job.id || '';
        const jobName = job.name || '';
        const location = job.location || 'global';
        const region = this.extractRegionFromZone(location);

        resources.push(this.createResource(
          `projects/${projectId}/locations/${location}/jobs/${jobId}`,
          'job',
          jobName,
          region,
          {
            id: jobId,
            name: jobName,
            type: job.type,
            currentState: job.currentState,
            createTime: job.createTime,
            startTime: job.startTime,
            location: job.location,
            stageStates: job.stageStates,
            environment: job.environment,
          },
          {},
          this.parseTimestamp(job.createTime as string),
        ));
      }
    } catch (error) {
      if (!this.isApiNotEnabled(error)) {
        errors.push(this.createError('projects.jobs.list', error));
      }
    }

    return { resources, errors };
  }
}

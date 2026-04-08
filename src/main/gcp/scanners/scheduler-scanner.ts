// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GCPBaseScanner, GCPScannerConfig, GCPScanResult } from './base-scanner';
import { getGCPClientFactory } from '../client-factory';

export class SchedulerScanner extends GCPBaseScanner {
  constructor(config: GCPScannerConfig) {
    super(config, 'cloud-scheduler', 'Cloud Scheduler');
  }

  async scan(): Promise<GCPScanResult> {
    const resources: GCPScanResult['resources'] = [];
    const errors: GCPScanResult['errors'] = [];
    const factory = getGCPClientFactory(this.config.projectId);
    const client = factory.getSchedulerClient();

    try {
      const parent = `projects/${this.config.projectId}/locations/-`;
      const iterable = client.listJobsAsync({ parent });

      for await (const job of iterable) {
        const fullName = job.name || '';
        // Job name format: projects/{project}/locations/{location}/jobs/{job}
        const nameParts = fullName.split('/');
        const jobName = nameParts.length >= 6 ? nameParts[5] : fullName;
        const location = nameParts.length >= 4 ? nameParts[3] : 'global';
        const region = this.extractRegionFromZone(location);

        resources.push(this.createResource(
          fullName,
          'job',
          jobName,
          region,
          {
            name: jobName,
            description: job.description,
            schedule: job.schedule,
            timeZone: job.timeZone,
            state: job.state,
            httpTarget: job.httpTarget ? {
              uri: job.httpTarget.uri,
              httpMethod: job.httpTarget.httpMethod,
              headers: job.httpTarget.headers,
            } : undefined,
            pubsubTarget: job.pubsubTarget ? {
              topicName: job.pubsubTarget.topicName,
              attributes: job.pubsubTarget.attributes,
            } : undefined,
            appEngineHttpTarget: job.appEngineHttpTarget ? {
              httpMethod: job.appEngineHttpTarget.httpMethod,
              appEngineRouting: job.appEngineHttpTarget.appEngineRouting,
              relativeUri: job.appEngineHttpTarget.relativeUri,
              headers: job.appEngineHttpTarget.headers,
            } : undefined,
            lastAttemptTime: job.lastAttemptTime,
            scheduleTime: job.scheduleTime,
          },
          {},
          this.parseTimestamp(
            job.scheduleTime?.seconds
              ? new Date(Number(job.scheduleTime.seconds) * 1000).toISOString()
              : undefined
          ),
        ));
      }
    } catch (error) {
      if (!this.isApiNotEnabled(error)) {
        errors.push(this.createError('listJobs', error));
      }
    }

    return { resources, errors };
  }
}

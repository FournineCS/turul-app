// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GCPBaseScanner, GCPScannerConfig, GCPScanResult } from './base-scanner';
import { getGCPClientFactory } from '../client-factory';

export class TasksScanner extends GCPBaseScanner {
  constructor(config: GCPScannerConfig) {
    super(config, 'cloud-tasks', 'Cloud Tasks');
  }

  async scan(): Promise<GCPScanResult> {
    const resources: GCPScanResult['resources'] = [];
    const errors: GCPScanResult['errors'] = [];
    const factory = getGCPClientFactory(this.config.projectId);
    const client = factory.getTasksClient();

    try {
      const parent = `projects/${this.config.projectId}/locations/-`;
      const iterable = client.listQueuesAsync({ parent });

      for await (const queue of iterable) {
        const fullName = queue.name || '';
        // Queue name format: projects/{project}/locations/{location}/queues/{queue}
        const nameParts = fullName.split('/');
        const queueName = nameParts.length >= 6 ? nameParts[5] : fullName;
        const location = nameParts.length >= 4 ? nameParts[3] : 'global';
        const region = this.extractRegionFromZone(location);

        resources.push(this.createResource(
          fullName,
          'queue',
          queueName,
          region,
          {
            name: queueName,
            state: queue.state,
            rateLimits: queue.rateLimits ? {
              maxDispatchesPerSecond: queue.rateLimits.maxDispatchesPerSecond,
              maxBurstSize: queue.rateLimits.maxBurstSize,
              maxConcurrentDispatches: queue.rateLimits.maxConcurrentDispatches,
            } : undefined,
            retryConfig: queue.retryConfig ? {
              maxAttempts: queue.retryConfig.maxAttempts,
              maxRetryDuration: queue.retryConfig.maxRetryDuration,
              minBackoff: queue.retryConfig.minBackoff,
              maxBackoff: queue.retryConfig.maxBackoff,
              maxDoublings: queue.retryConfig.maxDoublings,
            } : undefined,
            stackdriverLoggingConfig: queue.stackdriverLoggingConfig ? {
              samplingRatio: queue.stackdriverLoggingConfig.samplingRatio,
            } : undefined,
          },
          {},
        ));
      }
    } catch (error) {
      if (!this.isApiNotEnabled(error)) {
        errors.push(this.createError('listQueues', error));
      }
    }

    return { resources, errors };
  }
}

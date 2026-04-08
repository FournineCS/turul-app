// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GCPBaseScanner, GCPScannerConfig, GCPScanResult } from './base-scanner';
import { getGCPClientFactory } from '../client-factory';

export class LoggingScanner extends GCPBaseScanner {
  constructor(config: GCPScannerConfig) {
    super(config, 'cloud-logging', 'Cloud Logging');
  }

  async scan(): Promise<GCPScanResult> {
    const resources: GCPScanResult['resources'] = [];
    const errors: GCPScanResult['errors'] = [];
    const factory = getGCPClientFactory(this.config.projectId);
    const client = factory.getLoggingClient();

    // Scan log sinks
    try {
      const [sinks] = await client.getSinks();

      for (const sink of sinks) {
        const metadata = sink.metadata;
        const sinkName = metadata?.name || sink.name || '';

        resources.push(this.createResource(
          `projects/${this.config.projectId}/sinks/${sinkName}`,
          'sink',
          sinkName,
          'global',
          {
            name: sinkName,
            destination: metadata?.destination,
            filter: metadata?.filter,
            writerIdentity: metadata?.writerIdentity,
            createTime: metadata?.createTime,
          },
          {},
          this.parseTimestamp(metadata?.createTime as string),
        ));
      }
    } catch (error) {
      if (!this.isApiNotEnabled(error)) {
        errors.push(this.createError('getSinks', error));
      }
    }

    // Scan log-based metrics via googleapis (Logging client doesn't have getMetrics)
    try {
      const { google } = require('googleapis');
      const auth = new google.auth.GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      });
      const logging = google.logging({ version: 'v2', auth });
      const response = await logging.projects.metrics.list({
        parent: `projects/${this.config.projectId}`,
      });
      const metrics = response.data.metrics || [];

      for (const metric of metrics) {
        const metricName = metric.name || '';

        resources.push(this.createResource(
          `projects/${this.config.projectId}/metrics/${metricName}`,
          'log-metric',
          metricName,
          'global',
          {
            name: metricName,
            description: metric.description,
            filter: metric.filter,
          },
          {},
        ));
      }
    } catch (error) {
      if (!this.isApiNotEnabled(error)) {
        errors.push(this.createError('listMetrics', error));
      }
    }

    return { resources, errors };
  }
}

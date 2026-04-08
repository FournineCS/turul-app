// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GCPBaseScanner, GCPScannerConfig, GCPScanResult } from './base-scanner';
import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';

export class ManagedKafkaScanner extends GCPBaseScanner {
  constructor(config: GCPScannerConfig) {
    super(config, 'managed-kafka', 'Managed Kafka');
  }

  async scan(): Promise<GCPScanResult> {
    const resources: GCPScanResult['resources'] = [];
    const errors: GCPScanResult['errors'] = [];

    try {
      const auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      });
      const authClient = await auth.getClient();
      const managedkafka = google.managedkafka({ version: 'v1', auth: authClient as any });
      const projectId = this.config.projectId;

      const response = await managedkafka.projects.locations.clusters.list({
        parent: `projects/${projectId}/locations/-`,
      });

      const clusters = response.data.clusters || [];

      for (const cluster of clusters) {
        const clusterName = cluster.name || '';
        const nameParts = clusterName.split('/');
        const shortName = nameParts[nameParts.length - 1] || clusterName;
        const location = nameParts.length >= 4 ? nameParts[3] : 'global';
        const region = this.extractRegionFromZone(location);

        resources.push(this.createResource(
          clusterName,
          'cluster',
          shortName,
          region,
          {
            name: clusterName,
            state: cluster.state,
            createTime: cluster.createTime,
            updateTime: cluster.updateTime,
            capacityConfig: cluster.capacityConfig,
            gcpConfig: cluster.gcpConfig,
            rebalanceConfig: cluster.rebalanceConfig,
          },
          this.parseLabels(cluster.labels),
          this.parseTimestamp(cluster.createTime as string),
        ));

        // List topics per cluster
        try {
          const topicsResponse = await managedkafka.projects.locations.clusters.topics.list({
            parent: clusterName,
          });

          const topics = topicsResponse.data.topics || [];

          for (const topic of topics) {
            const topicName = topic.name || '';
            const topicNameParts = topicName.split('/');
            const topicShortName = topicNameParts[topicNameParts.length - 1] || topicName;

            resources.push(this.createResource(
              topicName,
              'topic',
              topicShortName,
              region,
              {
                name: topicName,
                partitionCount: topic.partitionCount,
                replicationFactor: topic.replicationFactor,
                configs: topic.configs,
              },
              {},
            ));
          }
        } catch (error) {
          if (!this.isApiNotEnabled(error)) {
            errors.push(this.createError('projects.locations.clusters.topics.list', error));
          }
        }
      }
    } catch (error) {
      if (!this.isApiNotEnabled(error)) {
        errors.push(this.createError('projects.locations.clusters.list', error));
      }
    }

    return { resources, errors };
  }
}

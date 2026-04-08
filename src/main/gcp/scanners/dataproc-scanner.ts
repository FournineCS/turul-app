// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GCPBaseScanner, GCPScannerConfig, GCPScanResult } from './base-scanner';
import { getGCPClientFactory } from '../client-factory';

export class DataprocScanner extends GCPBaseScanner {
  constructor(config: GCPScannerConfig) {
    super(config, 'dataproc', 'Dataproc');
  }

  async scan(): Promise<GCPScanResult> {
    const resources: GCPScanResult['resources'] = [];
    const errors: GCPScanResult['errors'] = [];
    const factory = getGCPClientFactory(this.config.projectId);
    const client = factory.getDataprocClient();

    try {
      const projectId = this.config.projectId;
      const iterable = client.listClustersAsync({
        projectId,
        region: '-',
      });

      for await (const cluster of iterable) {
        const clusterName = cluster.clusterName || '';
        const clusterUuid = cluster.clusterUuid || '';
        const region = cluster.config?.gceClusterConfig?.zoneUri
          ? this.extractRegionFromZone(cluster.config.gceClusterConfig.zoneUri.split('/').pop() || '')
          : 'global';

        resources.push(this.createResource(
          `projects/${projectId}/regions/${region}/clusters/${clusterName}`,
          'cluster',
          clusterName,
          region,
          {
            clusterName,
            clusterUuid,
            status: cluster.status ? {
              state: cluster.status.state,
              stateStartTime: cluster.status.stateStartTime,
              detail: cluster.status.detail,
            } : undefined,
            config: cluster.config ? {
              masterConfig: cluster.config.masterConfig ? {
                numInstances: cluster.config.masterConfig.numInstances,
                machineTypeUri: cluster.config.masterConfig.machineTypeUri,
                diskConfig: cluster.config.masterConfig.diskConfig,
              } : undefined,
              workerConfig: cluster.config.workerConfig ? {
                numInstances: cluster.config.workerConfig.numInstances,
                machineTypeUri: cluster.config.workerConfig.machineTypeUri,
                diskConfig: cluster.config.workerConfig.diskConfig,
              } : undefined,
              gceClusterConfig: cluster.config.gceClusterConfig ? {
                zoneUri: cluster.config.gceClusterConfig.zoneUri,
                networkUri: cluster.config.gceClusterConfig.networkUri,
                subnetworkUri: cluster.config.gceClusterConfig.subnetworkUri,
                serviceAccountScopes: cluster.config.gceClusterConfig.serviceAccountScopes,
              } : undefined,
            } : undefined,
          },
          this.parseLabels(cluster.labels as Record<string, string>),
          this.parseTimestamp(
            cluster.status?.stateStartTime?.seconds
              ? new Date(Number(cluster.status.stateStartTime.seconds) * 1000).toISOString()
              : undefined
          ),
        ));
      }
    } catch (error) {
      if (!this.isApiNotEnabled(error)) {
        errors.push(this.createError('listClusters', error));
      }
    }

    return { resources, errors };
  }
}

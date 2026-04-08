// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GCPBaseScanner, GCPScannerConfig, GCPScanResult } from './base-scanner';
import { getGCPClientFactory } from '../client-factory';

export class CloudRunScanner extends GCPBaseScanner {
  constructor(config: GCPScannerConfig) {
    super(config, 'cloud-run', 'Cloud Run');
  }

  async scan(): Promise<GCPScanResult> {
    const resources: GCPScanResult['resources'] = [];
    const errors: GCPScanResult['errors'] = [];
    const factory = getGCPClientFactory(this.config.projectId);
    const client = factory.getCloudRunServicesClient();

    try {
      const parent = `projects/${this.config.projectId}/locations/-`;
      const iterable = client.listServicesAsync({ parent });

      for await (const service of iterable) {
        const name = service.name || '';
        // Cloud Run service name format: projects/{project}/locations/{location}/services/{service}
        const nameParts = name.split('/');
        const serviceName = nameParts.length >= 6 ? nameParts[5] : name;
        const location = nameParts.length >= 4 ? nameParts[3] : 'unknown';
        const region = this.extractRegionFromZone(location);

        resources.push(this.createResource(
          name,
          'service',
          serviceName,
          region,
          {
            name: serviceName,
            uri: service.uri,
            creator: service.creator,
            lastModifier: service.lastModifier,
            conditions: service.conditions?.map(c => ({
              type: c.type,
              state: c.state,
              message: c.message,
              lastTransitionTime: c.lastTransitionTime,
              severity: c.severity,
            })),
            traffic: service.traffic?.map(t => ({
              type: t.type,
              revision: t.revision,
              percent: t.percent,
              tag: t.tag,
            })),
            template: service.template ? {
              revision: service.template.revision,
              containers: service.template.containers?.map(c => ({
                image: c.image,
                resources: c.resources,
                ports: c.ports,
                env: c.env?.map(e => ({ name: e.name })),
              })),
              scaling: service.template.scaling,
              serviceAccount: service.template.serviceAccount,
              maxInstanceRequestConcurrency: service.template.maxInstanceRequestConcurrency,
              timeout: service.template.timeout,
            } : undefined,
          },
          this.parseLabels(service.labels as Record<string, string>),
          this.parseTimestamp(service.createTime?.seconds ? new Date(Number(service.createTime.seconds) * 1000).toISOString() : undefined),
        ));
      }
    } catch (error) {
      if (!this.isApiNotEnabled(error)) {
        errors.push(this.createError('listServices', error));
      }
    }

    return { resources, errors };
  }
}

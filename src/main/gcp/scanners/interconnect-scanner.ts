// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GCPBaseScanner, GCPScannerConfig, GCPScanResult } from './base-scanner';
import { getGCPClientFactory } from '../client-factory';

export class InterconnectScanner extends GCPBaseScanner {
  constructor(config: GCPScannerConfig) {
    super(config, 'cloud-interconnect', 'Cloud Interconnect');
  }

  async scan(): Promise<GCPScanResult> {
    const resources: GCPScanResult['resources'] = [];
    const errors: GCPScanResult['errors'] = [];
    const factory = getGCPClientFactory(this.config.projectId);
    const client = factory.getInterconnectsClient();

    try {
      const listRequest = { project: this.config.projectId };
      const iterable = client.listAsync(listRequest);

      for await (const interconnect of iterable) {
        resources.push(this.createResource(
          interconnect.selfLink || `projects/${this.config.projectId}/global/interconnects/${interconnect.name}`,
          'interconnect',
          interconnect.name || '',
          'global',
          {
            name: interconnect.name,
            interconnectType: interconnect.interconnectType,
            linkType: interconnect.linkType,
            operationalStatus: interconnect.operationalStatus,
            location: interconnect.location,
            requestedLinkCount: interconnect.requestedLinkCount,
            provisionedLinkCount: interconnect.provisionedLinkCount,
            state: interconnect.state,
          },
          this.parseLabels(interconnect.labels as Record<string, string>),
          this.parseTimestamp(interconnect.creationTimestamp as string),
        ));
      }
    } catch (error) {
      if (!this.isApiNotEnabled(error)) {
        errors.push(this.createError('list', error));
      }
    }

    return { resources, errors };
  }
}

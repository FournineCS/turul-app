// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GCPBaseScanner, GCPScannerConfig, GCPScanResult } from './base-scanner';
import { getGCPClientFactory } from '../client-factory';

export class DNSScanner extends GCPBaseScanner {
  constructor(config: GCPScannerConfig) {
    super(config, 'cloud-dns', 'Cloud DNS');
  }

  async scan(): Promise<GCPScanResult> {
    const resources: GCPScanResult['resources'] = [];
    const errors: GCPScanResult['errors'] = [];
    const factory = getGCPClientFactory(this.config.projectId);
    const client = factory.getDNSClient();

    try {
      const [zones] = await client.getZones();

      for (const zone of zones) {
        const metadata = zone.metadata || {};
        const zoneName = metadata.name || zone.name || '';
        let recordCount = 0;

        try {
          const [records] = await zone.getRecords();
          recordCount = records.length;
        } catch (recErr) {
          // If we cannot list records, still capture the zone
          errors.push(this.createError(`getRecords:${zoneName}`, recErr));
        }

        resources.push(this.createResource(
          `projects/${this.config.projectId}/managedZones/${zoneName}`,
          'managed-zone',
          zoneName,
          'global',
          {
            name: zoneName,
            dnsName: metadata.dnsName,
            description: metadata.description,
            visibility: metadata.visibility,
            nameServers: metadata.nameServers,
            recordCount,
          },
          this.parseLabels(metadata.labels as Record<string, string>),
          this.parseTimestamp(metadata.creationTime as string),
        ));
      }
    } catch (error) {
      if (!this.isApiNotEnabled(error)) {
        errors.push(this.createError('getZones', error));
      }
    }

    return { resources, errors };
  }
}

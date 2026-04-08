// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GCPBaseScanner, GCPScannerConfig, GCPScanResult } from './base-scanner';
import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';

export class CloudSQLScanner extends GCPBaseScanner {
  constructor(config: GCPScannerConfig) {
    super(config, 'cloud-sql', 'Cloud SQL');
  }

  async scan(): Promise<GCPScanResult> {
    const resources: GCPScanResult['resources'] = [];
    const errors: GCPScanResult['errors'] = [];

    try {
      const auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      });
      const authClient = await auth.getClient();
      const sqladmin = google.sqladmin({ version: 'v1beta4', auth: authClient as any });

      const response = await sqladmin.instances.list({
        project: this.config.projectId,
      });

      const instances = response.data.items || [];

      for (const instance of instances) {
        const region = instance.region || 'global';

        resources.push(this.createResource(
          `projects/${this.config.projectId}/instances/${instance.name}`,
          'sql-instance',
          instance.name || '',
          region,
          {
            name: instance.name,
            databaseVersion: instance.databaseVersion,
            state: instance.state,
            region: instance.region,
            settings: instance.settings
              ? {
                  tier: instance.settings.tier,
                  ipConfiguration: instance.settings.ipConfiguration,
                  backupConfiguration: instance.settings.backupConfiguration,
                  dataDiskSizeGb: instance.settings.dataDiskSizeGb,
                  dataDiskType: instance.settings.dataDiskType,
                  availabilityType: instance.settings.availabilityType,
                }
              : undefined,
            connectionName: instance.connectionName,
            ipAddresses: instance.ipAddresses,
            serverCaCert: instance.serverCaCert
              ? {
                  certSerialNumber: instance.serverCaCert.certSerialNumber,
                  commonName: instance.serverCaCert.commonName,
                  expirationTime: instance.serverCaCert.expirationTime,
                  createTime: instance.serverCaCert.createTime,
                }
              : undefined,
          },
          this.parseLabels(instance.settings?.userLabels as Record<string, string>),
          this.parseTimestamp(instance.serverCaCert?.createTime as string),
        ));
      }
    } catch (error) {
      if (!this.isApiNotEnabled(error)) {
        errors.push(this.createError('instances.list', error));
      }
    }

    return { resources, errors };
  }
}

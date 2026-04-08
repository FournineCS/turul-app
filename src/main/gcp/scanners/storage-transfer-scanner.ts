// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GCPBaseScanner, GCPScannerConfig, GCPScanResult } from './base-scanner';
import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';

export class StorageTransferScanner extends GCPBaseScanner {
  constructor(config: GCPScannerConfig) {
    super(config, 'storage-transfer', 'Storage Transfer');
  }

  async scan(): Promise<GCPScanResult> {
    const resources: GCPScanResult['resources'] = [];
    const errors: GCPScanResult['errors'] = [];

    try {
      const auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      });
      const authClient = await auth.getClient();
      const storagetransfer = google.storagetransfer({ version: 'v1', auth: authClient as any });
      const projectId = this.config.projectId;

      const response = await storagetransfer.transferJobs.list({
        filter: JSON.stringify({ projectId }),
      });

      const transferJobs = response.data.transferJobs || [];

      for (const job of transferJobs) {
        const jobName = job.name || '';
        const shortName = jobName.split('/').pop() || jobName;

        resources.push(this.createResource(
          jobName,
          'transfer-job',
          shortName,
          'global',
          {
            name: jobName,
            description: job.description,
            status: job.status,
            projectId: job.projectId,
            schedule: job.schedule,
            transferSpec: job.transferSpec,
            creationTime: job.creationTime,
            lastModificationTime: job.lastModificationTime,
            latestOperationName: job.latestOperationName,
          },
          {},
          this.parseTimestamp(job.creationTime as string),
        ));
      }
    } catch (error) {
      if (!this.isApiNotEnabled(error)) {
        errors.push(this.createError('transferJobs.list', error));
      }
    }

    return { resources, errors };
  }
}

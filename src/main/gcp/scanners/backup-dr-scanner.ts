// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GCPBaseScanner, GCPScannerConfig, GCPScanResult } from './base-scanner';
import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';

export class BackupDRScanner extends GCPBaseScanner {
  constructor(config: GCPScannerConfig) {
    super(config, 'backup-dr', 'Backup and DR');
  }

  async scan(): Promise<GCPScanResult> {
    const resources: GCPScanResult['resources'] = [];
    const errors: GCPScanResult['errors'] = [];

    try {
      const auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      });
      const authClient = await auth.getClient();
      const backupdr = google.backupdr({ version: 'v1', auth: authClient as any });
      const projectId = this.config.projectId;

      // List backup plans
      try {
        const plansResponse = await backupdr.projects.locations.backupPlans.list({
          parent: `projects/${projectId}/locations/-`,
        });

        const backupPlans = plansResponse.data.backupPlans || [];

        for (const plan of backupPlans) {
          const planName = plan.name || '';
          const nameParts = planName.split('/');
          const shortName = nameParts[nameParts.length - 1] || planName;
          const location = nameParts.length >= 4 ? nameParts[3] : 'global';
          const region = this.extractRegionFromZone(location);

          resources.push(this.createResource(
            planName,
            'backup-plan',
            shortName,
            region,
            {
              name: planName,
              description: plan.description,
              state: plan.state,
              createTime: plan.createTime,
              updateTime: plan.updateTime,
              backupRules: plan.backupRules,
              resourceType: plan.resourceType,
            },
            {},
            this.parseTimestamp(plan.createTime as string),
          ));
        }
      } catch (planError) {
        if (!this.isApiNotEnabled(planError)) {
          errors.push(this.createError('projects.locations.backupPlans.list', planError));
        }
      }

      // List backup vaults
      try {
        const vaultsResponse = await backupdr.projects.locations.backupVaults.list({
          parent: `projects/${projectId}/locations/-`,
        });

        const backupVaults = vaultsResponse.data.backupVaults || [];

        for (const vault of backupVaults) {
          const vaultName = vault.name || '';
          const nameParts = vaultName.split('/');
          const shortName = nameParts[nameParts.length - 1] || vaultName;
          const location = nameParts.length >= 4 ? nameParts[3] : 'global';
          const region = this.extractRegionFromZone(location);

          resources.push(this.createResource(
            vaultName,
            'backup-vault',
            shortName,
            region,
            {
              name: vaultName,
              description: vault.description,
              state: vault.state,
              createTime: vault.createTime,
              updateTime: vault.updateTime,
              totalStoredBytes: vault.totalStoredBytes,
              backupCount: vault.backupCount,
            },
            {},
            this.parseTimestamp(vault.createTime as string),
          ));
        }
      } catch (vaultError) {
        if (!this.isApiNotEnabled(vaultError)) {
          errors.push(this.createError('projects.locations.backupVaults.list', vaultError));
        }
      }
    } catch (error) {
      if (!this.isApiNotEnabled(error)) {
        errors.push(this.createError('backupdr.init', error));
      }
    }

    return { resources, errors };
  }
}

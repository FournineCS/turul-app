// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  ListBackupPlansCommand,
  ListBackupVaultsCommand,
  GetBackupPlanCommand,
  ListTagsCommand,
} from '@aws-sdk/client-backup';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class BackupScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'backup', 'backup');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];

    const [plansResult, vaultsResult] = await Promise.allSettled([
      this.scanBackupPlans(),
      this.scanBackupVaults(),
    ]);

    if (plansResult.status === 'fulfilled') { resources.push(...plansResult.value.resources); errors.push(...plansResult.value.errors); }
    else errors.push(this.createError('ListBackupPlans', plansResult.reason));
    if (vaultsResult.status === 'fulfilled') { resources.push(...vaultsResult.value.resources); errors.push(...vaultsResult.value.errors); }
    else errors.push(this.createError('ListBackupVaults', vaultsResult.reason));

    return { resources, errors };
  }

  private async scanBackupPlans(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getBackupClient({ profile: this.config.profile, region: this.config.region });

    try {
      let nextToken: string | undefined;
      do {
        const response = await this.withRateLimit(() => client.send(new ListBackupPlansCommand({ NextToken: nextToken })));
        if (response.BackupPlansList) {
          for (const plan of response.BackupPlansList) {
            if (!plan.BackupPlanArn) continue;

            let details: any = {};
            try {
              const planResp = await this.withRateLimit(() => client.send(new GetBackupPlanCommand({ BackupPlanId: plan.BackupPlanId })));
              if (planResp.BackupPlan) {
                details = {
                  rules: planResp.BackupPlan.Rules?.map(r => ({
                    ruleName: r.RuleName,
                    targetBackupVaultName: r.TargetBackupVaultName,
                    scheduleExpression: r.ScheduleExpression,
                    lifecycle: r.Lifecycle ? {
                      deleteAfterDays: r.Lifecycle.DeleteAfterDays,
                      moveToColdStorageAfterDays: r.Lifecycle.MoveToColdStorageAfterDays,
                    } : undefined,
                  })),
                };
              }
            } catch { /* ignore */ }

            let tags: Record<string, string> = {};
            try {
              const tagsResp = await this.withRateLimit(() => client.send(new ListTagsCommand({ ResourceArn: plan.BackupPlanArn })));
              tags = tagsResp.Tags || {};
            } catch { /* ignore */ }

            resources.push(this.createResource(plan.BackupPlanArn, 'backup-plan', plan.BackupPlanName || '', {
              backupPlanId: plan.BackupPlanId,
              backupPlanName: plan.BackupPlanName,
              versionId: plan.VersionId,
              ...details,
            }, tags, plan.CreationDate?.toISOString()));
          }
        }
        nextToken = response.NextToken;
      } while (nextToken);
    } catch (error) { errors.push(this.createError('ListBackupPlans', error)); }
    return { resources, errors };
  }

  private async scanBackupVaults(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getBackupClient({ profile: this.config.profile, region: this.config.region });

    try {
      let nextToken: string | undefined;
      do {
        const response = await this.withRateLimit(() => client.send(new ListBackupVaultsCommand({ NextToken: nextToken })));
        if (response.BackupVaultList) {
          for (const vault of response.BackupVaultList) {
            if (!vault.BackupVaultArn) continue;
            resources.push(this.createResource(vault.BackupVaultArn, 'backup-vault', vault.BackupVaultName || '', {
              backupVaultName: vault.BackupVaultName,
              encryptionKeyArn: vault.EncryptionKeyArn,
              numberOfRecoveryPoints: vault.NumberOfRecoveryPoints,
              locked: vault.Locked,
            }, {}, vault.CreationDate?.toISOString()));
          }
        }
        nextToken = response.NextToken;
      } while (nextToken);
    } catch (error) { errors.push(this.createError('ListBackupVaults', error)); }
    return { resources, errors };
  }
}

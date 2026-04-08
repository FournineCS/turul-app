// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  ListLicenseConfigurationsCommand,
  ListLicensesCommand,
  ListTagsForResourceCommand,
} from '@aws-sdk/client-license-manager';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class LicenseManagerScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'licensemanager', 'licensemanager');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getLicenseManagerClient({
      profile: this.config.profile,
      region: this.config.region,
    });

    // Scan license configurations
    try {
      let nextToken: string | undefined;
      do {
        const response = await this.withRateLimit(() =>
          client.send(new ListLicenseConfigurationsCommand({ NextToken: nextToken }))
        );

        if (response.LicenseConfigurations) {
          for (const config of response.LicenseConfigurations) {
            if (!config.LicenseConfigurationArn) continue;

            let tags: Record<string, string> = {};
            try {
              const tagsResponse = await this.withRateLimit(() =>
                client.send(new ListTagsForResourceCommand({ ResourceArn: config.LicenseConfigurationArn }))
              );
              if (tagsResponse.Tags) {
                for (const tag of tagsResponse.Tags) {
                  if (tag.Key) tags[tag.Key] = tag.Value || '';
                }
              }
            } catch { /* ignore tag errors */ }

            resources.push(this.createResource(
              config.LicenseConfigurationArn,
              'license-configuration',
              config.Name || '',
              {
                name: config.Name,
                licenseConfigurationArn: config.LicenseConfigurationArn,
                licenseCountingType: config.LicenseCountingType,
                licenseCount: config.LicenseCount,
                consumedLicenses: config.ConsumedLicenses,
                status: config.Status,
                licenseCountHardLimit: config.LicenseCountHardLimit,
                ownerAccountId: config.OwnerAccountId,
                description: config.Description,
                licenseRules: config.LicenseRules,
                consumedLicenseSummaryList: config.ConsumedLicenseSummaryList?.map(s => ({
                  resourceType: s.ResourceType,
                  consumedLicenses: s.ConsumedLicenses,
                })),
                managedResourceSummaryList: config.ManagedResourceSummaryList?.map(s => ({
                  resourceType: s.ResourceType,
                  associationCount: s.AssociationCount,
                })),
              },
              tags,
            ));
          }
        }

        nextToken = response.NextToken;
      } while (nextToken);
    } catch (error) {
      errors.push(this.createError('ListLicenseConfigurations', error));
    }

    return { resources, errors };
  }
}

// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  ListResourcesCommand,
  GetDataLakeSettingsCommand,
  ListPermissionsCommand,
} from '@aws-sdk/client-lakeformation';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class LakeFormationScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'lakeformation', 'lakeformation');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];

    const [registeredResult, settingsResult, permissionsResult] = await Promise.allSettled([
      this.scanRegisteredResources(),
      this.scanDataLakeSettings(),
      this.scanPermissions(),
    ]);

    if (registeredResult.status === 'fulfilled') { resources.push(...registeredResult.value.resources); errors.push(...registeredResult.value.errors); }
    else errors.push(this.createError('ListResources', registeredResult.reason));
    if (settingsResult.status === 'fulfilled') { resources.push(...settingsResult.value.resources); errors.push(...settingsResult.value.errors); }
    else errors.push(this.createError('GetDataLakeSettings', settingsResult.reason));
    if (permissionsResult.status === 'fulfilled') { resources.push(...permissionsResult.value.resources); errors.push(...permissionsResult.value.errors); }
    else errors.push(this.createError('ListPermissions', permissionsResult.reason));

    return { resources, errors };
  }

  private async scanRegisteredResources(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getLakeFormationClient({ profile: this.config.profile, region: this.config.region });

    try {
      let nextToken: string | undefined;
      do {
        const response = await this.withRateLimit(() => client.send(new ListResourcesCommand({ NextToken: nextToken })));
        if (response.ResourceInfoList) {
          for (const resource of response.ResourceInfoList) {
            if (!resource.ResourceArn) continue;
            resources.push(this.createResource(resource.ResourceArn, 'registered-resource', resource.ResourceArn, {
              resourceArn: resource.ResourceArn,
              roleArn: resource.RoleArn,
              lastModified: resource.LastModified?.toISOString(),
            }, {}));
          }
        }
        nextToken = response.NextToken;
      } while (nextToken);
    } catch (error) { errors.push(this.createError('ListResources', error)); }
    return { resources, errors };
  }

  private async scanDataLakeSettings(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getLakeFormationClient({ profile: this.config.profile, region: this.config.region });

    try {
      const response = await this.withRateLimit(() => client.send(new GetDataLakeSettingsCommand({})));
      if (response.DataLakeSettings) {
        const settings = response.DataLakeSettings;
        const arn = `arn:aws:lakeformation:${this.config.region}::data-lake-settings`;

        resources.push(this.createResource(arn, 'data-lake-settings', 'DataLakeSettings', {
          dataLakeAdmins: settings.DataLakeAdmins?.map(admin => ({
            dataLakePrincipalIdentifier: admin.DataLakePrincipalIdentifier,
          })),
          createDatabaseDefaultPermissions: settings.CreateDatabaseDefaultPermissions?.map(perm => ({
            principal: perm.Principal?.DataLakePrincipalIdentifier,
            permissions: perm.Permissions,
          })),
          createTableDefaultPermissions: settings.CreateTableDefaultPermissions?.map(perm => ({
            principal: perm.Principal?.DataLakePrincipalIdentifier,
            permissions: perm.Permissions,
          })),
          trustedResourceOwners: settings.TrustedResourceOwners,
          allowExternalDataFiltering: settings.AllowExternalDataFiltering,
          authorizedSessionTagValueList: settings.AuthorizedSessionTagValueList,
        }, {}));
      }
    } catch (error) { errors.push(this.createError('GetDataLakeSettings', error)); }
    return { resources, errors };
  }

  private async scanPermissions(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getLakeFormationClient({ profile: this.config.profile, region: this.config.region });

    try {
      let nextToken: string | undefined;
      do {
        const response = await this.withRateLimit(() => client.send(new ListPermissionsCommand({ NextToken: nextToken })));
        if (response.PrincipalResourcePermissions) {
          for (const permission of response.PrincipalResourcePermissions) {
            const principalId = permission.Principal?.DataLakePrincipalIdentifier || 'unknown';
            const resourceArn = permission.Resource?.Database?.Name
              || permission.Resource?.Table?.Name
              || permission.Resource?.DataLocation?.ResourceArn
              || 'unknown';
            const id = `arn:aws:lakeformation:${this.config.region}::permission/${principalId}/${resourceArn}`;

            resources.push(this.createResource(id, 'permission', `${principalId} -> ${resourceArn}`, {
              principal: principalId,
              resource: {
                database: permission.Resource?.Database ? {
                  catalogId: permission.Resource.Database.CatalogId,
                  name: permission.Resource.Database.Name,
                } : undefined,
                table: permission.Resource?.Table ? {
                  catalogId: permission.Resource.Table.CatalogId,
                  databaseName: permission.Resource.Table.DatabaseName,
                  name: permission.Resource.Table.Name,
                  tableWildcard: permission.Resource.Table.TableWildcard ? true : undefined,
                } : undefined,
                dataLocation: permission.Resource?.DataLocation ? {
                  catalogId: permission.Resource.DataLocation.CatalogId,
                  resourceArn: permission.Resource.DataLocation.ResourceArn,
                } : undefined,
              },
              permissions: permission.Permissions,
              permissionsWithGrantOption: permission.PermissionsWithGrantOption,
            }, {}));
          }
        }
        nextToken = response.NextToken;
      } while (nextToken);
    } catch (error) { errors.push(this.createError('ListPermissions', error)); }
    return { resources, errors };
  }
}

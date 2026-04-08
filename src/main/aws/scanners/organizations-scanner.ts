// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  DescribeOrganizationCommand,
  ListAccountsCommand,
  ListRootsCommand,
  ListOrganizationalUnitsForParentCommand,
  OrganizationsClient,
} from '@aws-sdk/client-organizations';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class OrganizationsScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'organizations', 'organizations');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];

    const [orgResult, accountsResult, rootsResult] = await Promise.allSettled([
      this.scanOrganization(),
      this.scanAccounts(),
      this.scanRootsAndOUs(),
    ]);

    if (orgResult.status === 'fulfilled') {
      resources.push(...orgResult.value.resources);
      errors.push(...orgResult.value.errors);
    } else {
      // If the account is not part of an organization, return empty gracefully
      if (this.isNotInUseException(orgResult.reason)) {
        return { resources: [], errors: [] };
      }
      errors.push(this.createError('DescribeOrganization', orgResult.reason));
    }

    if (accountsResult.status === 'fulfilled') {
      resources.push(...accountsResult.value.resources);
      errors.push(...accountsResult.value.errors);
    } else {
      if (!this.isNotInUseException(accountsResult.reason)) {
        errors.push(this.createError('ListAccounts', accountsResult.reason));
      }
    }

    if (rootsResult.status === 'fulfilled') {
      resources.push(...rootsResult.value.resources);
      errors.push(...rootsResult.value.errors);
    } else {
      if (!this.isNotInUseException(rootsResult.reason)) {
        errors.push(this.createError('ListRoots', rootsResult.reason));
      }
    }

    return { resources, errors };
  }

  private isNotInUseException(error: unknown): boolean {
    if (error instanceof Error) {
      return error.name === 'AWSOrganizationsNotInUseException'
        || error.message.includes('AWSOrganizationsNotInUseException');
    }
    return false;
  }

  private async scanOrganization(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getOrganizationsClient({
      profile: this.config.profile,
      region: this.config.region,
    });

    try {
      const response = await this.withRateLimit(() =>
        client.send(new DescribeOrganizationCommand({}))
      );

      const org = response.Organization;
      if (org && org.Arn) {
        resources.push(this.createResource(
          org.Arn,
          'organization',
          org.Id || '',
          {
            organizationId: org.Id,
            masterAccountId: org.MasterAccountId,
            masterAccountArn: org.MasterAccountArn,
            masterAccountEmail: org.MasterAccountEmail,
            featureSet: org.FeatureSet,
            availablePolicyTypes: org.AvailablePolicyTypes?.map(pt => ({
              type: pt.Type,
              status: pt.Status,
            })),
          },
          {}
        ));
      }
    } catch (error) {
      if (this.isNotInUseException(error)) {
        return { resources: [], errors: [] };
      }
      errors.push(this.createError('DescribeOrganization', error));
    }

    return { resources, errors };
  }

  private async scanAccounts(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getOrganizationsClient({
      profile: this.config.profile,
      region: this.config.region,
    });

    try {
      let nextToken: string | undefined;

      do {
        const response = await this.withRateLimit(() =>
          client.send(new ListAccountsCommand({ NextToken: nextToken }))
        );

        if (response.Accounts) {
          for (const account of response.Accounts) {
            if (!account.Arn) continue;

            resources.push(this.createResource(
              account.Arn,
              'account',
              account.Name || account.Id || '',
              {
                accountId: account.Id,
                accountName: account.Name,
                email: account.Email,
                status: account.Status,
                joinedMethod: account.JoinedMethod,
                joinedTimestamp: account.JoinedTimestamp?.toISOString(),
              },
              {},
              account.JoinedTimestamp?.toISOString()
            ));
          }
        }

        nextToken = response.NextToken;
      } while (nextToken);
    } catch (error) {
      if (this.isNotInUseException(error)) {
        return { resources: [], errors: [] };
      }
      errors.push(this.createError('ListAccounts', error));
    }

    return { resources, errors };
  }

  private async scanRootsAndOUs(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getOrganizationsClient({
      profile: this.config.profile,
      region: this.config.region,
    });

    try {
      // List roots
      let nextToken: string | undefined;

      do {
        const response = await this.withRateLimit(() =>
          client.send(new ListRootsCommand({ NextToken: nextToken }))
        );

        if (response.Roots) {
          for (const root of response.Roots) {
            if (!root.Arn) continue;

            resources.push(this.createResource(
              root.Arn,
              'root',
              root.Name || root.Id || '',
              {
                rootId: root.Id,
                rootName: root.Name,
                policyTypes: root.PolicyTypes?.map(pt => ({
                  type: pt.Type,
                  status: pt.Status,
                })),
              },
              {}
            ));

            // List OUs under each root
            if (root.Id) {
              try {
                const ouResources = await this.scanOUsForParent(client, root.Id);
                resources.push(...ouResources);
              } catch (error) {
                errors.push(this.createError(`ListOrganizationalUnitsForParent:${root.Id}`, error));
              }
            }
          }
        }

        nextToken = response.NextToken;
      } while (nextToken);
    } catch (error) {
      if (this.isNotInUseException(error)) {
        return { resources: [], errors: [] };
      }
      errors.push(this.createError('ListRoots', error));
    }

    return { resources, errors };
  }

  private async scanOUsForParent(client: OrganizationsClient, parentId: string): Promise<Resource[]> {
    const resources: Resource[] = [];
    let nextToken: string | undefined;

    do {
      const response = await this.withRateLimit(() =>
        client.send(new ListOrganizationalUnitsForParentCommand({
          ParentId: parentId,
          NextToken: nextToken,
        }))
      );

      if (response.OrganizationalUnits) {
        for (const ou of response.OrganizationalUnits) {
          if (!ou.Arn) continue;

          resources.push(this.createResource(
            ou.Arn,
            'organizational-unit',
            ou.Name || ou.Id || '',
            {
              ouId: ou.Id,
              ouName: ou.Name,
              parentId,
            },
            {}
          ));

          // Recursively scan child OUs
          if (ou.Id) {
            const childResources = await this.scanOUsForParent(client, ou.Id);
            resources.push(...childResources);
          }
        }
      }

      nextToken = response.NextToken;
    } while (nextToken);

    return resources;
  }
}

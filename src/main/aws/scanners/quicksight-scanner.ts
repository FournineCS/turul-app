// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  ListDashboardsCommand,
  ListDataSetsCommand,
  ListDataSourcesCommand,
} from '@aws-sdk/client-quicksight';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class QuickSightScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'quicksight', 'quicksight');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];

    const client = getClientFactory().getQuickSightClient({
      profile: this.config.profile,
      region: this.config.region,
    });

    // Get AWS Account ID via STS (required for QuickSight APIs)
    let awsAccountId: string;
    try {
      const stsClient = getClientFactory().getSTSClient({
        profile: this.config.profile,
        region: this.config.region,
      });
      const { GetCallerIdentityCommand } = await import('@aws-sdk/client-sts');
      const identityResponse = await this.withRateLimit(() => stsClient.send(new GetCallerIdentityCommand({})));
      awsAccountId = identityResponse.Account!;
    } catch (err) {
      errors.push(this.createError('GetCallerIdentity', err));
      return { resources, errors };
    }

    // Scan Dashboards
    try {
      let nextToken: string | undefined;
      do {
        const response = await this.withRateLimit(() => client.send(
          new ListDashboardsCommand({
            AwsAccountId: awsAccountId,
            NextToken: nextToken,
          })
        ));

        for (const dashboard of response.DashboardSummaryList ?? []) {
          resources.push(this.createResource(
            dashboard.Arn ?? dashboard.DashboardId ?? '',
            'dashboard',
            dashboard.Name ?? dashboard.DashboardId ?? '',
            {
              dashboardId: dashboard.DashboardId,
              name: dashboard.Name,
              publishedVersionNumber: dashboard.PublishedVersionNumber,
              lastPublishedTime: dashboard.LastPublishedTime?.toISOString(),
              createdTime: dashboard.CreatedTime?.toISOString(),
              lastUpdatedTime: dashboard.LastUpdatedTime?.toISOString(),
            },
            {},
            dashboard.CreatedTime?.toISOString(),
          ));
        }

        nextToken = response.NextToken;
      } while (nextToken);
    } catch (err) {
      errors.push(this.createError('ListDashboards', err));
    }

    // Scan Datasets
    try {
      let nextToken: string | undefined;
      do {
        const response = await this.withRateLimit(() => client.send(
          new ListDataSetsCommand({
            AwsAccountId: awsAccountId,
            NextToken: nextToken,
          })
        ));

        for (const dataset of response.DataSetSummaries ?? []) {
          resources.push(this.createResource(
            dataset.Arn ?? dataset.DataSetId ?? '',
            'dataset',
            dataset.Name ?? dataset.DataSetId ?? '',
            {
              dataSetId: dataset.DataSetId,
              name: dataset.Name,
              importMode: dataset.ImportMode,
              createdTime: dataset.CreatedTime?.toISOString(),
              lastUpdatedTime: dataset.LastUpdatedTime?.toISOString(),
            },
            {},
            dataset.CreatedTime?.toISOString(),
          ));
        }

        nextToken = response.NextToken;
      } while (nextToken);
    } catch (err) {
      errors.push(this.createError('ListDataSets', err));
    }

    // Scan Data Sources
    try {
      let nextToken: string | undefined;
      do {
        const response = await this.withRateLimit(() => client.send(
          new ListDataSourcesCommand({
            AwsAccountId: awsAccountId,
            NextToken: nextToken,
          })
        ));

        for (const dataSource of response.DataSources ?? []) {
          resources.push(this.createResource(
            dataSource.Arn ?? dataSource.DataSourceId ?? '',
            'data-source',
            dataSource.Name ?? dataSource.DataSourceId ?? '',
            {
              dataSourceId: dataSource.DataSourceId,
              name: dataSource.Name,
              type: dataSource.Type,
              createdTime: dataSource.CreatedTime?.toISOString(),
              lastUpdatedTime: dataSource.LastUpdatedTime?.toISOString(),
            },
            {},
            dataSource.CreatedTime?.toISOString(),
          ));
        }

        nextToken = response.NextToken;
      } while (nextToken);
    } catch (err) {
      errors.push(this.createError('ListDataSources', err));
    }

    return { resources, errors };
  }
}

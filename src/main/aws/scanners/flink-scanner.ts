// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  ListApplicationsCommand,
  DescribeApplicationCommand,
  ListTagsForResourceCommand,
} from '@aws-sdk/client-kinesis-analytics-v2';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class FlinkScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'flink', 'kinesis-analytics-v2');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];

    try {
      const client = getClientFactory().getKinesisAnalyticsV2Client({
        profile: this.config.profile,
        region: this.config.region,
      });

      let nextToken: string | undefined;

      do {
        const listResponse = await this.withRateLimit(() => client.send(
          new ListApplicationsCommand({
            NextToken: nextToken,
          })
        ));

        const applications = listResponse.ApplicationSummaries || [];

        for (const app of applications) {
          try {
            const describeResponse = await this.withRateLimit(() => client.send(
              new DescribeApplicationCommand({
                ApplicationName: app.ApplicationName,
              })
            ));

            const detail = describeResponse.ApplicationDetail;
            if (!detail) continue;

            let tags: Record<string, string> = {};
            if (detail.ApplicationARN) {
              try {
                const tagsResponse = await this.withRateLimit(() => client.send(
                  new ListTagsForResourceCommand({
                    ResourceARN: detail.ApplicationARN,
                  })
                ));
                for (const tag of tagsResponse.Tags || []) {
                  if (tag.Key) {
                    tags[tag.Key] = tag.Value || '';
                  }
                }
              } catch (tagErr) {
                errors.push(
                  this.createError(`GetTags:${detail.ApplicationName}`, tagErr)
                );
              }
            }

            resources.push(this.createResource(
              detail.ApplicationARN || detail.ApplicationName || '',
              'application',
              detail.ApplicationName || '',
              {
                applicationName: detail.ApplicationName,
                applicationStatus: detail.ApplicationStatus,
                runtimeEnvironment: detail.RuntimeEnvironment,
                applicationVersionId: detail.ApplicationVersionId,
                createTimestamp: detail.CreateTimestamp,
                lastUpdateTimestamp: detail.LastUpdateTimestamp,
              },
              tags,
            ));
          } catch (appErr) {
            errors.push(
              this.createError(`DescribeApplication:${app.ApplicationName}`, appErr)
            );
          }
        }

        nextToken = listResponse.NextToken;
      } while (nextToken);
    } catch (err) {
      errors.push(this.createError('ListApplications', err));
    }

    return { resources, errors };
  }
}

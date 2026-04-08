// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  DescribeTrailsCommand,
  GetTrailStatusCommand,
  ListTagsCommand,
} from '@aws-sdk/client-cloudtrail';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class CloudTrailScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'cloudtrail', 'cloudtrail');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getCloudTrailClient({
      profile: this.config.profile,
      region: this.config.region,
    });

    try {
      const response = await this.withRateLimit(() =>
        client.send(new DescribeTrailsCommand({}))
      );

      if (response.trailList) {
        for (const trail of response.trailList) {
          if (!trail.TrailARN) continue;

          let status: Record<string, unknown> = {};
          try {
            const statusResp = await this.withRateLimit(() =>
              client.send(new GetTrailStatusCommand({ Name: trail.TrailARN }))
            );
            status = {
              isLogging: statusResp.IsLogging,
              latestDeliveryTime: statusResp.LatestDeliveryTime?.toISOString(),
              latestNotificationTime: statusResp.LatestNotificationTime?.toISOString(),
              startLoggingTime: statusResp.StartLoggingTime?.toISOString(),
              latestDeliveryError: statusResp.LatestDeliveryError,
            };
          } catch {
            // Ignore trail status errors
          }

          let tags: Record<string, string> = {};
          try {
            const tagsResp = await this.withRateLimit(() =>
              client.send(new ListTagsCommand({ ResourceIdList: [trail.TrailARN!] }))
            );
            if (tagsResp.ResourceTagList?.[0]?.TagsList) {
              for (const tag of tagsResp.ResourceTagList[0].TagsList) {
                if (tag.Key) tags[tag.Key] = tag.Value || '';
              }
            }
          } catch {
            // Ignore tag errors
          }

          resources.push(this.createResource(
            trail.TrailARN,
            'trail',
            trail.Name || '',
            {
              name: trail.Name,
              s3BucketName: trail.S3BucketName,
              s3KeyPrefix: trail.S3KeyPrefix,
              snsTopicARN: trail.SnsTopicARN,
              includeGlobalServiceEvents: trail.IncludeGlobalServiceEvents,
              isMultiRegionTrail: trail.IsMultiRegionTrail,
              homeRegion: trail.HomeRegion,
              logFileValidationEnabled: trail.LogFileValidationEnabled,
              cloudWatchLogsLogGroupArn: trail.CloudWatchLogsLogGroupArn,
              kmsKeyId: trail.KmsKeyId,
              hasCustomEventSelectors: trail.HasCustomEventSelectors,
              isOrganizationTrail: trail.IsOrganizationTrail,
              ...status,
            },
            tags
          ));
        }
      }
    } catch (error) {
      errors.push(this.createError('DescribeTrails', error));
    }

    return { resources, errors };
  }
}

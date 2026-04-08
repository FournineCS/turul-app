// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  ListClassificationJobsCommand,
  GetBucketStatisticsCommand,
  ListTagsForResourceCommand,
} from '@aws-sdk/client-macie2';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class MacieScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'macie', 'macie');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getMacie2Client({
      profile: this.config.profile,
      region: this.config.region,
    });

    // Scan classification jobs
    await this.scanClassificationJobs(client, resources, errors);

    // Scan S3 bucket statistics
    await this.scanBucketStatistics(client, resources, errors);

    return { resources, errors };
  }

  private async scanClassificationJobs(
    client: ReturnType<ReturnType<typeof getClientFactory>['getMacie2Client']>,
    resources: Resource[],
    errors: ScanResult['errors']
  ): Promise<void> {
    try {
      let nextToken: string | undefined;

      do {
        const response = await this.withRateLimit(() =>
          client.send(new ListClassificationJobsCommand({ nextToken }))
        );

        if (response.items) {
          for (const job of response.items) {
            if (!job.jobId) continue;

            const arn = `arn:aws:macie2:${this.config.region}::classification-job/${job.jobId}`;

            // Fetch tags for the job
            let tags: Record<string, string> = {};
            try {
              const tagsResponse = await this.withRateLimit(() =>
                client.send(new ListTagsForResourceCommand({ resourceArn: arn }))
              );
              tags = (tagsResponse.tags as Record<string, string>) || {};
            } catch {
              // Tags fetch failure is non-critical, continue with empty tags
            }

            resources.push(this.createResource(
              arn,
              'classification-job',
              job.name || job.jobId,
              {
                jobId: job.jobId,
                name: job.name,
                jobType: job.jobType,
                jobStatus: job.jobStatus,
                lastRunErrorStatus: job.lastRunErrorStatus?.code,
                bucketCriteria: job.bucketCriteria,
                bucketDefinitions: job.bucketDefinitions,
              },
              tags,
              job.createdAt?.toISOString()
            ));
          }
        }

        nextToken = response.nextToken;
      } while (nextToken);
    } catch (error) {
      if (this.isMacieNotEnabled(error)) {
        // Macie is not enabled in this region/account - return empty gracefully
        return;
      }
      errors.push(this.createError('ListClassificationJobs', error));
    }
  }

  private async scanBucketStatistics(
    client: ReturnType<ReturnType<typeof getClientFactory>['getMacie2Client']>,
    resources: Resource[],
    errors: ScanResult['errors']
  ): Promise<void> {
    try {
      const response = await this.withRateLimit(() =>
        client.send(new GetBucketStatisticsCommand({}))
      );

      // Only create a resource if there are buckets being tracked
      if (response.bucketCount && response.bucketCount > 0) {
        const arn = `arn:aws:macie2:${this.config.region}::bucket-statistics`;

        resources.push(this.createResource(
          arn,
          'bucket-statistics',
          `Macie Bucket Statistics (${this.config.region})`,
          {
            bucketCount: response.bucketCount,
            bucketCountByEffectivePermission: {
              publiclyAccessible: response.bucketCountByEffectivePermission?.publiclyAccessible,
              publiclyReadable: response.bucketCountByEffectivePermission?.publiclyReadable,
              publiclyWritable: response.bucketCountByEffectivePermission?.publiclyWritable,
              unknown: response.bucketCountByEffectivePermission?.unknown,
            },
            bucketCountByEncryptionType: {
              kmsManaged: response.bucketCountByEncryptionType?.kmsManaged,
              s3Managed: response.bucketCountByEncryptionType?.s3Managed,
              unencrypted: response.bucketCountByEncryptionType?.unencrypted,
              unknown: response.bucketCountByEncryptionType?.unknown,
            },
            bucketCountBySharedAccessType: {
              external: response.bucketCountBySharedAccessType?.external,
              internal: response.bucketCountBySharedAccessType?.internal,
              notShared: response.bucketCountBySharedAccessType?.notShared,
              unknown: response.bucketCountBySharedAccessType?.unknown,
            },
            classifiableObjectCount: response.classifiableObjectCount,
            classifiableSizeInBytes: response.classifiableSizeInBytes,
            objectCount: response.objectCount,
            sizeInBytes: response.sizeInBytes,
            sizeInBytesCompressed: response.sizeInBytesCompressed,
            unclassifiableObjectCount: response.unclassifiableObjectCount,
            unclassifiableObjectSizeInBytes: response.unclassifiableObjectSizeInBytes,
            lastUpdated: response.lastUpdated?.toISOString(),
          },
          {},
          response.lastUpdated?.toISOString()
        ));
      }
    } catch (error) {
      if (this.isMacieNotEnabled(error)) {
        // Macie is not enabled in this region/account - return empty gracefully
        return;
      }
      errors.push(this.createError('GetBucketStatistics', error));
    }
  }

  private isMacieNotEnabled(error: unknown): boolean {
    if (error instanceof Error) {
      const name = (error as { name?: string }).name || '';
      const message = error.message || '';
      // Macie2Exception when Macie is not enabled, or AccessDeniedException when no permissions
      if (
        name === 'Macie2Exception' ||
        name === 'AccessDeniedException' ||
        message.includes('Macie is not enabled') ||
        message.includes('macie is not enabled') ||
        message.includes('not enabled')
      ) {
        return true;
      }
    }
    return false;
  }
}

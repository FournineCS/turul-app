// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  ListBucketsCommand,
  GetBucketLocationCommand,
  GetBucketTaggingCommand,
  GetBucketPolicyCommand,
  GetBucketEncryptionCommand,
  GetBucketVersioningCommand,
  type Bucket,
} from '@aws-sdk/client-s3';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class S3Scanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 's3', 's3');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getS3Client({
      profile: this.config.profile,
      region: this.config.region,
    });

    try {
      const response = await this.withRateLimit(() =>
        client.send(new ListBucketsCommand({}))
      );

      if (response.Buckets) {
        // Process buckets in parallel with rate limiting
        const bucketPromises = response.Buckets.map(async (bucket) => {
          try {
            return await this.getBucketDetails(bucket);
          } catch (error) {
            // Return basic bucket info if details fail
            return this.mapBucket(bucket, null, {}, {});
          }
        });

        const bucketResources = await Promise.all(bucketPromises);

        // Filter to only buckets in the target region
        for (const resource of bucketResources) {
          if (resource) {
            const bucketRegion = resource.data.location as string;
            // S3 location returns null/empty for us-east-1
            const normalizedBucketRegion = bucketRegion || 'us-east-1';
            if (normalizedBucketRegion === this.config.region) {
              resources.push(resource);
            }
          }
        }
      }
    } catch (error) {
      errors.push(this.createError('ListBuckets', error));
    }

    return { resources, errors };
  }

  private async getBucketDetails(bucket: Bucket): Promise<Resource | null> {
    if (!bucket.Name) return null;

    const client = getClientFactory().getS3Client({
      profile: this.config.profile,
      region: this.config.region,
    });

    let location: string | null = null;
    let tags: Record<string, string> = {};
    let details: Record<string, unknown> = {};

    // Get bucket location
    try {
      const locationResponse = await this.withRateLimit(() =>
        client.send(new GetBucketLocationCommand({ Bucket: bucket.Name }))
      );
      location = locationResponse.LocationConstraint || 'us-east-1';
    } catch {
      // Ignore errors
    }

    // Get bucket tags
    try {
      const tagsResponse = await this.withRateLimit(() =>
        client.send(new GetBucketTaggingCommand({ Bucket: bucket.Name }))
      );
      if (tagsResponse.TagSet) {
        tags = this.parseTags(tagsResponse.TagSet);
      }
    } catch {
      // Ignore errors - bucket might not have tags
    }

    // Get bucket encryption
    try {
      const encryptionResponse = await this.withRateLimit(() =>
        client.send(new GetBucketEncryptionCommand({ Bucket: bucket.Name }))
      );
      details.encryption = encryptionResponse.ServerSideEncryptionConfiguration;
    } catch {
      details.encryption = null;
    }

    // Get bucket versioning
    try {
      const versioningResponse = await this.withRateLimit(() =>
        client.send(new GetBucketVersioningCommand({ Bucket: bucket.Name }))
      );
      details.versioning = {
        status: versioningResponse.Status,
        mfaDelete: versioningResponse.MFADelete,
      };
    } catch {
      details.versioning = null;
    }

    return this.mapBucket(bucket, location, tags, details);
  }

  private mapBucket(
    bucket: Bucket,
    location: string | null,
    tags: Record<string, string>,
    details: Record<string, unknown>
  ): Resource {
    const bucketRegion = location || 'us-east-1';
    const arn = `arn:aws:s3:::${bucket.Name}`;

    return this.createResource(
      arn,
      'bucket',
      bucket.Name || '',
      {
        bucketName: bucket.Name,
        location: bucketRegion,
        creationDate: bucket.CreationDate?.toISOString(),
        ...details,
      },
      tags,
      bucket.CreationDate?.toISOString()
    );
  }
}

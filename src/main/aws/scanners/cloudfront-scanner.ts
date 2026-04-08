// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  ListDistributionsCommand,
  ListTagsForResourceCommand,
} from '@aws-sdk/client-cloudfront';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class CloudFrontScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'cloudfront', 'cloudfront');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getCloudFrontClient({
      profile: this.config.profile,
      region: this.config.region,
    });

    try {
      let marker: string | undefined;

      do {
        const response = await this.withRateLimit(() =>
          client.send(new ListDistributionsCommand({ Marker: marker }))
        );

        const list = response.DistributionList;
        if (list?.Items) {
          for (const dist of list.Items) {
            if (!dist.ARN) continue;

            let tags: Record<string, string> = {};
            try {
              const tagsResponse = await this.withRateLimit(() =>
                client.send(new ListTagsForResourceCommand({ Resource: dist.ARN }))
              );
              if (tagsResponse.Tags?.Items) {
                for (const tag of tagsResponse.Tags.Items) {
                  if (tag.Key) tags[tag.Key] = tag.Value || '';
                }
              }
            } catch {
              // Ignore tag errors
            }

            resources.push(this.createResource(
              dist.ARN,
              'distribution',
              dist.DomainName || dist.Id || '',
              {
                distributionId: dist.Id,
                domainName: dist.DomainName,
                status: dist.Status,
                enabled: dist.Enabled,
                httpVersion: dist.HttpVersion,
                priceClass: dist.PriceClass,
                comment: dist.Comment,
                webACLId: dist.WebACLId,
                origins: dist.Origins?.Items?.map(o => ({
                  id: o.Id,
                  domainName: o.DomainName,
                  originPath: o.OriginPath,
                })),
                aliases: dist.Aliases?.Items,
                defaultCacheBehavior: {
                  targetOriginId: dist.DefaultCacheBehavior?.TargetOriginId,
                  viewerProtocolPolicy: dist.DefaultCacheBehavior?.ViewerProtocolPolicy,
                  compress: dist.DefaultCacheBehavior?.Compress,
                },
                viewerCertificate: {
                  cloudFrontDefaultCertificate: dist.ViewerCertificate?.CloudFrontDefaultCertificate,
                  acmCertificateArn: dist.ViewerCertificate?.ACMCertificateArn,
                  sslSupportMethod: dist.ViewerCertificate?.SSLSupportMethod,
                  minimumProtocolVersion: dist.ViewerCertificate?.MinimumProtocolVersion,
                },
                isIPV6Enabled: dist.IsIPV6Enabled,
              },
              tags,
              dist.LastModifiedTime?.toISOString()
            ));
          }
        }

        marker = list?.IsTruncated ? list.NextMarker : undefined;
      } while (marker);
    } catch (error) {
      errors.push(this.createError('ListDistributions', error));
    }

    return { resources, errors };
  }
}

// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  DescribeFileSystemsCommand,
  ListTagsForResourceCommand,
} from '@aws-sdk/client-fsx';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class FSxScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'fsx', 'fsx');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getFSxClient({
      profile: this.config.profile,
      region: this.config.region,
    });

    try {
      let nextToken: string | undefined;

      do {
        const response = await this.withRateLimit(() =>
          client.send(new DescribeFileSystemsCommand({ NextToken: nextToken }))
        );

        if (response.FileSystems) {
          for (const fs of response.FileSystems) {
            if (!fs.ResourceARN) continue;

            let tags: Record<string, string> = {};
            try {
              const tagsResp = await this.withRateLimit(() =>
                client.send(new ListTagsForResourceCommand({ ResourceARN: fs.ResourceARN }))
              );
              if (tagsResp.Tags) {
                for (const tag of tagsResp.Tags) {
                  if (tag.Key) tags[tag.Key] = tag.Value || '';
                }
              }
            } catch { /* ignore tag errors */ }

            resources.push(this.createResource(
              fs.ResourceARN,
              'file-system',
              this.getNameFromTags(tags) || fs.FileSystemId || '',
              {
                fileSystemId: fs.FileSystemId,
                fileSystemType: fs.FileSystemType,
                lifecycle: fs.Lifecycle,
                storageCapacity: fs.StorageCapacity,
                storageType: fs.StorageType,
                vpcId: fs.VpcId,
                subnetIds: fs.SubnetIds,
                dnsName: fs.DNSName,
                creationTime: fs.CreationTime?.toISOString(),
                ownerId: fs.OwnerId,
              },
              tags,
              fs.CreationTime?.toISOString()
            ));
          }
        }

        nextToken = response.NextToken;
      } while (nextToken);
    } catch (error) {
      errors.push(this.createError('DescribeFileSystems', error));
    }

    return { resources, errors };
  }
}

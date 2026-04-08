// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  DescribeDirectoriesCommand,
  ListTagsForResourceCommand,
} from '@aws-sdk/client-directory-service';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class DirectoryServiceScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'directoryservice', 'directoryservice');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getDirectoryServiceClient({ profile: this.config.profile, region: this.config.region });

    try {
      let nextToken: string | undefined;
      do {
        const response = await this.withRateLimit(() => client.send(new DescribeDirectoriesCommand({ NextToken: nextToken })));
        if (response.DirectoryDescriptions) {
          for (const dir of response.DirectoryDescriptions) {
            if (!dir.DirectoryId) continue;

            let tags: Record<string, string> = {};
            try {
              const tagsResp = await this.withRateLimit(() => client.send(new ListTagsForResourceCommand({ ResourceId: dir.DirectoryId })));
              if (tagsResp.Tags) {
                for (const tag of tagsResp.Tags) {
                  if (tag.Key) tags[tag.Key] = tag.Value || '';
                }
              }
            } catch { /* ignore tag fetch errors */ }

            const arn = `arn:aws:ds:${this.config.region}::directory/${dir.DirectoryId}`;
            resources.push(this.createResource(
              arn,
              'directory',
              dir.Name || dir.DirectoryId,
              {
                directoryId: dir.DirectoryId,
                name: dir.Name,
                type: dir.Type,
                size: dir.Size,
                edition: dir.Edition,
                alias: dir.Alias,
                accessUrl: dir.AccessUrl,
                dnsIpAddrs: dir.DnsIpAddrs,
                stage: dir.Stage,
                vpcSettings: dir.VpcSettings ? {
                  vpcId: dir.VpcSettings.VpcId,
                  subnetIds: dir.VpcSettings.SubnetIds,
                  securityGroupId: dir.VpcSettings.SecurityGroupId,
                  availabilityZones: dir.VpcSettings.AvailabilityZones,
                } : undefined,
                connectSettings: dir.ConnectSettings ? {
                  vpcId: dir.ConnectSettings.VpcId,
                  subnetIds: dir.ConnectSettings.SubnetIds,
                  customerUserName: dir.ConnectSettings.CustomerUserName,
                  securityGroupId: dir.ConnectSettings.SecurityGroupId,
                  availabilityZones: dir.ConnectSettings.AvailabilityZones,
                  connectIps: dir.ConnectSettings.ConnectIps,
                } : undefined,
              },
              tags,
              dir.LaunchTime?.toISOString(),
            ));
          }
        }
        nextToken = response.NextToken;
      } while (nextToken);
    } catch (error) { errors.push(this.createError('DescribeDirectories', error)); }

    return { resources, errors };
  }
}

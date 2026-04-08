// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  DescribeClustersCommand,
  ListTagsCommand,
} from '@aws-sdk/client-cloudhsm-v2';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class CloudHSMScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'cloudhsm', 'cloudhsm');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getCloudHSMV2Client({
      profile: this.config.profile,
      region: this.config.region,
    });

    try {
      let nextToken: string | undefined;

      do {
        const response = await this.withRateLimit(() =>
          client.send(new DescribeClustersCommand({ NextToken: nextToken }))
        );

        if (response.Clusters) {
          for (const cluster of response.Clusters) {
            if (!cluster.ClusterId) continue;

            let tags: Record<string, string> = {};
            try {
              const tagsResponse = await this.withRateLimit(() =>
                client.send(new ListTagsCommand({ ResourceId: cluster.ClusterId }))
              );
              if (tagsResponse.TagList) {
                for (const tag of tagsResponse.TagList) {
                  if (tag.Key) tags[tag.Key] = tag.Value || '';
                }
              }
            } catch {
              // Ignore tag errors
            }

            resources.push(this.createResource(
              cluster.ClusterId,
              'cluster',
              this.getNameFromTags(tags) || cluster.ClusterId,
              {
                clusterId: cluster.ClusterId,
                state: cluster.State,
                hsmType: cluster.HsmType,
                vpcId: cluster.VpcId,
                subnetMapping: cluster.SubnetMapping,
                securityGroup: cluster.SecurityGroup,
                hsms: cluster.Hsms?.map(hsm => ({
                  hsmId: hsm.HsmId,
                  availabilityZone: hsm.AvailabilityZone,
                  clusterId: hsm.ClusterId,
                  subnetId: hsm.SubnetId,
                  eniId: hsm.EniId,
                  eniIp: hsm.EniIp,
                  state: hsm.State,
                  stateMessage: hsm.StateMessage,
                })),
                backupPolicy: cluster.BackupPolicy,
                backupRetentionPolicy: cluster.BackupRetentionPolicy
                  ? {
                      type: cluster.BackupRetentionPolicy.Type,
                      value: cluster.BackupRetentionPolicy.Value,
                    }
                  : undefined,
                createTimestamp: cluster.CreateTimestamp?.toISOString(),
                sourceBackupId: cluster.SourceBackupId,
                stateMessage: cluster.StateMessage,
                preCoPassword: cluster.PreCoPassword,
              },
              tags,
              cluster.CreateTimestamp?.toISOString()
            ));
          }
        }

        nextToken = response.NextToken;
      } while (nextToken);
    } catch (error) {
      errors.push(this.createError('DescribeClusters', error));
    }

    return { resources, errors };
  }
}

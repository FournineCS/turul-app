// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  ListDomainNamesCommand,
  DescribeDomainCommand,
  ListTagsCommand,
} from '@aws-sdk/client-opensearch';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class OpenSearchScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'opensearch', 'opensearch');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getOpenSearchClient({ profile: this.config.profile, region: this.config.region });

    try {
      const response = await this.withRateLimit(() => client.send(new ListDomainNamesCommand({})));
      if (response.DomainNames) {
        for (const domain of response.DomainNames) {
          if (!domain.DomainName) continue;

          try {
            const descResp = await this.withRateLimit(() => client.send(new DescribeDomainCommand({ DomainName: domain.DomainName })));
            const ds = descResp.DomainStatus;
            if (!ds?.ARN) continue;

            let tags: Record<string, string> = {};
            try {
              const tagsResp = await this.withRateLimit(() => client.send(new ListTagsCommand({ ARN: ds.ARN })));
              if (tagsResp.TagList) {
                for (const tag of tagsResp.TagList) {
                  if (tag.Key) tags[tag.Key] = tag.Value || '';
                }
              }
            } catch { /* ignore */ }

            resources.push(this.createResource(ds.ARN, 'domain', ds.DomainName || '', {
              domainId: ds.DomainId,
              domainName: ds.DomainName,
              engineVersion: ds.EngineVersion,
              endpoint: ds.Endpoint,
              endpoints: ds.Endpoints,
              processing: ds.Processing,
              created: ds.Created,
              deleted: ds.Deleted,
              clusterConfig: ds.ClusterConfig ? {
                instanceType: ds.ClusterConfig.InstanceType,
                instanceCount: ds.ClusterConfig.InstanceCount,
                dedicatedMasterEnabled: ds.ClusterConfig.DedicatedMasterEnabled,
                dedicatedMasterType: ds.ClusterConfig.DedicatedMasterType,
                dedicatedMasterCount: ds.ClusterConfig.DedicatedMasterCount,
                warmEnabled: ds.ClusterConfig.WarmEnabled,
                warmType: ds.ClusterConfig.WarmType,
                warmCount: ds.ClusterConfig.WarmCount,
                zoneAwarenessEnabled: ds.ClusterConfig.ZoneAwarenessEnabled,
              } : undefined,
              ebsOptions: ds.EBSOptions ? {
                ebsEnabled: ds.EBSOptions.EBSEnabled,
                volumeType: ds.EBSOptions.VolumeType,
                volumeSize: ds.EBSOptions.VolumeSize,
              } : undefined,
              encryptionAtRestEnabled: ds.EncryptionAtRestOptions?.Enabled,
              nodeToNodeEncryptionEnabled: ds.NodeToNodeEncryptionOptions?.Enabled,
              vpcId: ds.VPCOptions?.VPCId,
              subnetIds: ds.VPCOptions?.SubnetIds,
              securityGroupIds: ds.VPCOptions?.SecurityGroupIds,
            }, tags));
          } catch (error) { errors.push(this.createError(`DescribeDomain:${domain.DomainName}`, error)); }
        }
      }
    } catch (error) { errors.push(this.createError('ListDomainNames', error)); }

    return { resources, errors };
  }
}

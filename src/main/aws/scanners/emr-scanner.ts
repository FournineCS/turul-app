// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  ListClustersCommand,
  DescribeClusterCommand,
} from '@aws-sdk/client-emr';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class EMRScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'emr', 'emr');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getEMRClient({ profile: this.config.profile, region: this.config.region });

    try {
      let marker: string | undefined;
      do {
        const response = await this.withRateLimit(() => client.send(new ListClustersCommand({
          Marker: marker,
          ClusterStates: ['STARTING', 'BOOTSTRAPPING', 'RUNNING', 'WAITING', 'TERMINATING'],
        })));
        if (response.Clusters) {
          for (const cluster of response.Clusters) {
            if (!cluster.Id) continue;

            try {
              const descResp = await this.withRateLimit(() => client.send(new DescribeClusterCommand({ ClusterId: cluster.Id })));
              const c = descResp.Cluster;
              if (!c?.ClusterArn) continue;

              const tags: Record<string, string> = {};
              if (c.Tags) {
                for (const tag of c.Tags) {
                  if (tag.Key) tags[tag.Key] = tag.Value || '';
                }
              }

              resources.push(this.createResource(c.ClusterArn, 'emr-cluster', c.Name || cluster.Id, {
                clusterId: c.Id,
                clusterName: c.Name,
                state: c.Status?.State,
                stateChangeReason: c.Status?.StateChangeReason?.Message,
                releaseLabel: c.ReleaseLabel,
                applications: c.Applications?.map(a => a.Name),
                autoTerminate: c.AutoTerminate,
                terminationProtected: c.TerminationProtected,
                logUri: c.LogUri,
                serviceRole: c.ServiceRole,
                masterPublicDnsName: c.MasterPublicDnsName,
                instanceCollectionType: c.InstanceCollectionType,
                normalizedInstanceHours: c.NormalizedInstanceHours,
                ec2InstanceAttributes: c.Ec2InstanceAttributes ? {
                  ec2SubnetId: c.Ec2InstanceAttributes.Ec2SubnetId,
                  ec2AvailabilityZone: c.Ec2InstanceAttributes.Ec2AvailabilityZone,
                  iamInstanceProfile: c.Ec2InstanceAttributes.IamInstanceProfile,
                } : undefined,
              }, tags, c.Status?.Timeline?.CreationDateTime?.toISOString()));
            } catch (error) { errors.push(this.createError(`DescribeCluster:${cluster.Id}`, error)); }
          }
        }
        marker = response.Marker;
      } while (marker);
    } catch (error) { errors.push(this.createError('ListClusters', error)); }

    return { resources, errors };
  }
}

// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  ListClustersCommand,
  DescribeClusterCommand,
  ListNodegroupsCommand,
  DescribeNodegroupCommand,
  ListFargateProfilesCommand,
  DescribeFargateProfileCommand,
  type Cluster,
  type Nodegroup,
  type FargateProfile,
  type ListClustersCommandOutput,
  type DescribeClusterCommandOutput,
  type ListNodegroupsCommandOutput,
  type DescribeNodegroupCommandOutput,
  type ListFargateProfilesCommandOutput,
  type DescribeFargateProfileCommandOutput,
} from '@aws-sdk/client-eks';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class EKSScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'eks', 'eks');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getEKSClient({
      profile: this.config.profile,
      region: this.config.region,
    });

    try {
      const clusterNames: string[] = [];
      let nextToken: string | undefined;

      do {
        const response: ListClustersCommandOutput = await this.withRateLimit(() =>
          client.send(new ListClustersCommand({ nextToken }))
        );

        if (response.clusters) {
          clusterNames.push(...response.clusters);
        }

        nextToken = response.nextToken;
      } while (nextToken);

      // Describe each cluster
      for (const clusterName of clusterNames) {
        try {
          const describeResponse: DescribeClusterCommandOutput = await this.withRateLimit(() =>
            client.send(new DescribeClusterCommand({ name: clusterName }))
          );

          if (describeResponse.cluster) {
            resources.push(this.mapCluster(describeResponse.cluster));

            // Get node groups for this cluster
            const nodeGroups = await this.getNodeGroups(client, clusterName);
            resources.push(...nodeGroups);

            // Get Fargate profiles for this cluster
            const fargateProfiles = await this.getFargateProfiles(client, clusterName);
            resources.push(...fargateProfiles);
          }
        } catch (error) {
          errors.push(this.createError(`DescribeCluster:${clusterName}`, error));
        }
      }
    } catch (error) {
      errors.push(this.createError('ListClusters', error));
    }

    return { resources, errors };
  }

  private async getNodeGroups(
    client: ReturnType<typeof getClientFactory.prototype.getEKSClient>,
    clusterName: string
  ): Promise<Resource[]> {
    const resources: Resource[] = [];
    const nodeGroupNames: string[] = [];

    try {
      let nextToken: string | undefined;

      do {
        const response: ListNodegroupsCommandOutput = await this.withRateLimit(() =>
          client.send(
            new ListNodegroupsCommand({
              clusterName,
              nextToken,
            })
          )
        );

        if (response.nodegroups) {
          nodeGroupNames.push(...response.nodegroups);
        }

        nextToken = response.nextToken;
      } while (nextToken);

      // Describe each node group
      for (const nodeGroupName of nodeGroupNames) {
        try {
          const describeResponse: DescribeNodegroupCommandOutput = await this.withRateLimit(() =>
            client.send(
              new DescribeNodegroupCommand({
                clusterName,
                nodegroupName: nodeGroupName,
              })
            )
          );

          if (describeResponse.nodegroup) {
            resources.push(this.mapNodeGroup(describeResponse.nodegroup));
          }
        } catch {
          // Ignore errors getting individual node groups
        }
      }
    } catch {
      // Ignore errors listing node groups
    }

    return resources;
  }

  private async getFargateProfiles(
    client: ReturnType<typeof getClientFactory.prototype.getEKSClient>,
    clusterName: string
  ): Promise<Resource[]> {
    const resources: Resource[] = [];
    const fargateProfileNames: string[] = [];

    try {
      let nextToken: string | undefined;

      do {
        const response: ListFargateProfilesCommandOutput = await this.withRateLimit(() =>
          client.send(
            new ListFargateProfilesCommand({
              clusterName,
              nextToken,
            })
          )
        );

        if (response.fargateProfileNames) {
          fargateProfileNames.push(...response.fargateProfileNames);
        }

        nextToken = response.nextToken;
      } while (nextToken);

      // Describe each Fargate profile
      for (const profileName of fargateProfileNames) {
        try {
          const describeResponse: DescribeFargateProfileCommandOutput = await this.withRateLimit(() =>
            client.send(
              new DescribeFargateProfileCommand({
                clusterName,
                fargateProfileName: profileName,
              })
            )
          );

          if (describeResponse.fargateProfile) {
            resources.push(this.mapFargateProfile(describeResponse.fargateProfile));
          }
        } catch {
          // Ignore errors getting individual Fargate profiles
        }
      }
    } catch {
      // Ignore errors listing Fargate profiles
    }

    return resources;
  }

  private mapCluster(cluster: Cluster): Resource {
    const tags = cluster.tags || {};

    return this.createResource(
      cluster.arn || '',
      'cluster',
      cluster.name || '',
      {
        name: cluster.name,
        arn: cluster.arn,
        status: cluster.status,
        version: cluster.version,
        platformVersion: cluster.platformVersion,
        endpoint: cluster.endpoint,
        roleArn: cluster.roleArn,
        resourcesVpcConfig: cluster.resourcesVpcConfig
          ? {
              vpcId: cluster.resourcesVpcConfig.vpcId,
              subnetIds: cluster.resourcesVpcConfig.subnetIds,
              securityGroupIds: cluster.resourcesVpcConfig.securityGroupIds,
              clusterSecurityGroupId: cluster.resourcesVpcConfig.clusterSecurityGroupId,
              endpointPublicAccess: cluster.resourcesVpcConfig.endpointPublicAccess,
              endpointPrivateAccess: cluster.resourcesVpcConfig.endpointPrivateAccess,
              publicAccessCidrs: cluster.resourcesVpcConfig.publicAccessCidrs,
            }
          : undefined,
        kubernetesNetworkConfig: cluster.kubernetesNetworkConfig
          ? {
              serviceIpv4Cidr: cluster.kubernetesNetworkConfig.serviceIpv4Cidr,
              serviceIpv6Cidr: cluster.kubernetesNetworkConfig.serviceIpv6Cidr,
              ipFamily: cluster.kubernetesNetworkConfig.ipFamily,
            }
          : undefined,
        logging: cluster.logging?.clusterLogging?.map((l) => ({
          types: l.types,
          enabled: l.enabled,
        })),
        identity: cluster.identity?.oidc?.issuer
          ? { oidcIssuer: cluster.identity.oidc.issuer }
          : undefined,
        encryptionConfig: cluster.encryptionConfig?.map((e) => ({
          resources: e.resources,
          keyArn: e.provider?.keyArn,
        })),
        createdAt: cluster.createdAt?.toISOString(),
        health: cluster.health?.issues?.map((i) => ({
          code: i.code,
          message: i.message,
          resourceIds: i.resourceIds,
        })),
      },
      tags as Record<string, string>,
      cluster.createdAt?.toISOString()
    );
  }

  private mapNodeGroup(nodegroup: Nodegroup): Resource {
    const tags = nodegroup.tags || {};

    return this.createResource(
      nodegroup.nodegroupArn || '',
      'nodegroup',
      nodegroup.nodegroupName || '',
      {
        nodegroupName: nodegroup.nodegroupName,
        nodegroupArn: nodegroup.nodegroupArn,
        clusterName: nodegroup.clusterName,
        status: nodegroup.status,
        version: nodegroup.version,
        releaseVersion: nodegroup.releaseVersion,
        capacityType: nodegroup.capacityType,
        instanceTypes: nodegroup.instanceTypes,
        amiType: nodegroup.amiType,
        nodeRole: nodegroup.nodeRole,
        subnets: nodegroup.subnets,
        scalingConfig: nodegroup.scalingConfig
          ? {
              minSize: nodegroup.scalingConfig.minSize,
              maxSize: nodegroup.scalingConfig.maxSize,
              desiredSize: nodegroup.scalingConfig.desiredSize,
            }
          : undefined,
        diskSize: nodegroup.diskSize,
        labels: nodegroup.labels,
        taints: nodegroup.taints?.map((t) => ({
          key: t.key,
          value: t.value,
          effect: t.effect,
        })),
        launchTemplate: nodegroup.launchTemplate
          ? {
              name: nodegroup.launchTemplate.name,
              version: nodegroup.launchTemplate.version,
              id: nodegroup.launchTemplate.id,
            }
          : undefined,
        updateConfig: nodegroup.updateConfig,
        health: nodegroup.health?.issues?.map((i) => ({
          code: i.code,
          message: i.message,
          resourceIds: i.resourceIds,
        })),
        createdAt: nodegroup.createdAt?.toISOString(),
        modifiedAt: nodegroup.modifiedAt?.toISOString(),
      },
      tags as Record<string, string>,
      nodegroup.createdAt?.toISOString()
    );
  }

  private mapFargateProfile(profile: FargateProfile): Resource {
    const tags = profile.tags || {};

    return this.createResource(
      profile.fargateProfileArn || '',
      'fargate-profile',
      profile.fargateProfileName || '',
      {
        fargateProfileName: profile.fargateProfileName,
        fargateProfileArn: profile.fargateProfileArn,
        clusterName: profile.clusterName,
        status: profile.status,
        podExecutionRoleArn: profile.podExecutionRoleArn,
        subnets: profile.subnets,
        selectors: profile.selectors?.map((s) => ({
          namespace: s.namespace,
          labels: s.labels,
        })),
        createdAt: profile.createdAt?.toISOString(),
      },
      tags as Record<string, string>,
      profile.createdAt?.toISOString()
    );
  }
}

// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  GetCostAndUsageCommand,
  type GetCostAndUsageCommandOutput,
} from '@aws-sdk/client-cost-explorer';
import {
  ListClustersCommand,
  DescribeClusterCommand,
  ListNodegroupsCommand,
  DescribeNodegroupCommand,
} from '@aws-sdk/client-eks';
import { getClientFactory } from '../client-factory';
import type { EKSCostAnalysis, EKSClusterCost, EKSNodeGroupCost, EKSTrendPoint } from '../../../shared/types';

// Approximate EC2 on-demand pricing (us-east-1) for common EKS node types
const EC2_HOURLY_ESTIMATES: Record<string, number> = {
  't3.micro': 0.0104, 't3.small': 0.0208, 't3.medium': 0.0416, 't3.large': 0.0832, 't3.xlarge': 0.1664,
  't3a.micro': 0.0094, 't3a.small': 0.0188, 't3a.medium': 0.0376, 't3a.large': 0.0752,
  'm5.large': 0.096, 'm5.xlarge': 0.192, 'm5.2xlarge': 0.384, 'm5.4xlarge': 0.768,
  'm6i.large': 0.096, 'm6i.xlarge': 0.192, 'm6i.2xlarge': 0.384,
  'm6g.large': 0.077, 'm6g.xlarge': 0.154, 'm6g.2xlarge': 0.308,
  'm7i.large': 0.1008, 'm7i.xlarge': 0.2016,
  'c5.large': 0.085, 'c5.xlarge': 0.17, 'c5.2xlarge': 0.34,
  'c6i.large': 0.085, 'c6i.xlarge': 0.17, 'c6i.2xlarge': 0.34,
  'c6g.large': 0.068, 'c6g.xlarge': 0.136,
  'r5.large': 0.126, 'r5.xlarge': 0.252, 'r5.2xlarge': 0.504,
  'r6i.large': 0.126, 'r6i.xlarge': 0.252,
  'r6g.large': 0.1008, 'r6g.xlarge': 0.2016,
  'p3.2xlarge': 3.06, 'p3.8xlarge': 12.24,
  'g4dn.xlarge': 0.526, 'g4dn.2xlarge': 0.752,
};

const EKS_CLUSTER_HOURLY = 0.10; // $0.10/hr per EKS cluster
const HOURS_PER_MONTH = 730;

/**
 * Get EKS cost analysis for a given profile and region.
 * Combines Cost Explorer billing data with EKS API for cluster/node group details.
 */
export async function getEKSCostAnalysis(
  profile: string,
  region: string,
  startDate: string,
  endDate: string,
  clusterFilter?: string
): Promise<EKSCostAnalysis> {
  const factory = getClientFactory();

  // Run Cost Explorer query and EKS cluster discovery in parallel
  const [costData, clusterDetails] = await Promise.all([
    getEKSCostFromExplorer(factory, profile, startDate, endDate),
    getEKSClusterDetails(factory, profile, region, clusterFilter),
  ]);

  // Get daily trend from Cost Explorer
  const trend = await getEKSTrend(factory, profile, startDate, endDate);

  // Combine: use Cost Explorer total as ground truth, distribute across clusters proportionally
  const totalFromExplorer = costData.totalEKSCost;
  const totalFromNodes = clusterDetails.reduce((sum, c) => sum + c.estimatedMonthlyCost, 0);

  // Scale cluster costs to match Cost Explorer total if we have both
  const scaleFactor = totalFromExplorer > 0 && totalFromNodes > 0
    ? totalFromExplorer / totalFromNodes
    : 1;

  const byCluster: EKSClusterCost[] = clusterDetails.map((c) => ({
    cluster: c.name,
    region: c.region,
    version: c.version,
    status: c.status,
    nodeGroupCount: c.nodeGroups.length,
    totalNodes: c.nodeGroups.reduce((sum, ng) => sum + (ng.desiredSize || 0), 0),
    cost: c.estimatedMonthlyCost * scaleFactor,
    controlPlaneCost: EKS_CLUSTER_HOURLY * HOURS_PER_MONTH,
    nodeGroups: c.nodeGroups,
  }));

  const totalCost = totalFromExplorer > 0
    ? totalFromExplorer
    : byCluster.reduce((sum, c) => sum + c.cost, 0);

  // Flatten node groups across all clusters
  const allNodeGroups: EKSNodeGroupCost[] = byCluster.flatMap((c) =>
    c.nodeGroups.map((ng) => ({
      ...ng,
      cluster: c.cluster,
      estimatedMonthlyCost: ng.estimatedMonthlyCost * scaleFactor,
    }))
  );

  return {
    totalCost,
    currency: 'USD',
    byCluster,
    byNodeGroup: allNodeGroups,
    trend,
    costExplorerTotal: totalFromExplorer,
    relatedServices: costData.relatedServices,
    startDate,
    endDate,
  };
}

/** Query Cost Explorer for EKS-related service costs */
async function getEKSCostFromExplorer(
  factory: ReturnType<typeof getClientFactory>,
  profile: string,
  startDate: string,
  endDate: string
): Promise<{ totalEKSCost: number; relatedServices: Array<{ service: string; cost: number }> }> {
  const ceClient = factory.getCostExplorerClient({ profile, region: 'us-east-1' });

  // EKS costs span multiple services
  const eksServices = [
    'Amazon Elastic Kubernetes Service',
    'Amazon Elastic Compute Cloud - Compute',
    'EC2 - Other',
  ];

  try {
    const response: GetCostAndUsageCommandOutput = await ceClient.send(
      new GetCostAndUsageCommand({
        TimePeriod: { Start: startDate, End: endDate },
        Granularity: 'MONTHLY',
        Metrics: ['UnblendedCost'],
        GroupBy: [{ Type: 'DIMENSION', Key: 'SERVICE' }],
        Filter: {
          Dimensions: {
            Key: 'SERVICE',
            Values: eksServices,
          },
        },
      })
    );

    const relatedServices: Array<{ service: string; cost: number }> = [];
    let totalEKSCost = 0;

    for (const result of response.ResultsByTime || []) {
      for (const group of result.Groups || []) {
        const service = group.Keys?.[0] || 'Unknown';
        const cost = parseFloat(group.Metrics?.UnblendedCost?.Amount || '0');
        if (cost > 0) {
          const existing = relatedServices.find((s) => s.service === service);
          if (existing) {
            existing.cost += cost;
          } else {
            relatedServices.push({ service, cost });
          }
          totalEKSCost += cost;
        }
      }
    }

    return { totalEKSCost, relatedServices };
  } catch (err) {
    console.warn('[eks-cost] Cost Explorer query failed:', err);
    return { totalEKSCost: 0, relatedServices: [] };
  }
}

/** Get daily EKS cost trend from Cost Explorer */
async function getEKSTrend(
  factory: ReturnType<typeof getClientFactory>,
  profile: string,
  startDate: string,
  endDate: string
): Promise<EKSTrendPoint[]> {
  const ceClient = factory.getCostExplorerClient({ profile, region: 'us-east-1' });

  try {
    const response = await ceClient.send(
      new GetCostAndUsageCommand({
        TimePeriod: { Start: startDate, End: endDate },
        Granularity: 'DAILY',
        Metrics: ['UnblendedCost'],
        Filter: {
          Dimensions: {
            Key: 'SERVICE',
            Values: [
              'Amazon Elastic Kubernetes Service',
              'Amazon Elastic Compute Cloud - Compute',
              'EC2 - Other',
            ],
          },
        },
      })
    );

    return (response.ResultsByTime || []).map((r) => ({
      date: r.TimePeriod?.Start || '',
      cost: parseFloat(r.Total?.UnblendedCost?.Amount || '0'),
    }));
  } catch {
    return [];
  }
}

interface ClusterDetail {
  name: string;
  region: string;
  version: string;
  status: string;
  estimatedMonthlyCost: number;
  nodeGroups: EKSNodeGroupCost[];
}

/** Discover EKS clusters and node groups with estimated costs */
async function getEKSClusterDetails(
  factory: ReturnType<typeof getClientFactory>,
  profile: string,
  region: string,
  clusterFilter?: string
): Promise<ClusterDetail[]> {
  const eksClient = factory.getEKSClient({ profile, region });
  const clusters: ClusterDetail[] = [];

  try {
    // List clusters
    let clusterNames: string[] = [];
    let nextToken: string | undefined;
    do {
      const response = await eksClient.send(new ListClustersCommand({ nextToken }));
      clusterNames.push(...(response.clusters || []));
      nextToken = response.nextToken;
    } while (nextToken);

    // Apply filter
    if (clusterFilter) {
      clusterNames = clusterNames.filter((n) => n === clusterFilter);
    }

    // Describe each cluster + its node groups
    for (const name of clusterNames) {
      try {
        const clusterResp = await eksClient.send(new DescribeClusterCommand({ name }));
        const cluster = clusterResp.cluster;
        if (!cluster) continue;

        // Get node groups
        const nodeGroups = await getNodeGroupCosts(eksClient, name);
        const nodeCost = nodeGroups.reduce((s, ng) => s + ng.estimatedMonthlyCost, 0);
        const controlPlaneCost = EKS_CLUSTER_HOURLY * HOURS_PER_MONTH;

        clusters.push({
          name: cluster.name || name,
          region,
          version: cluster.version || 'unknown',
          status: cluster.status || 'UNKNOWN',
          estimatedMonthlyCost: controlPlaneCost + nodeCost,
          nodeGroups,
        });
      } catch {
        // Skip clusters that fail to describe
      }
    }
  } catch (err) {
    console.warn('[eks-cost] Failed to list clusters:', err);
  }

  return clusters;
}

/** Get node group details with estimated costs for a cluster */
async function getNodeGroupCosts(
  eksClient: any,
  clusterName: string
): Promise<EKSNodeGroupCost[]> {
  const nodeGroups: EKSNodeGroupCost[] = [];

  try {
    let nextToken: string | undefined;
    const ngNames: string[] = [];
    do {
      const response = await eksClient.send(
        new ListNodegroupsCommand({ clusterName, nextToken })
      );
      ngNames.push(...(response.nodegroups || []));
      nextToken = response.nextToken;
    } while (nextToken);

    for (const ngName of ngNames) {
      try {
        const resp = await eksClient.send(
          new DescribeNodegroupCommand({ clusterName, nodegroupName: ngName })
        );
        const ng = resp.nodegroup;
        if (!ng) continue;

        const instanceTypes = ng.instanceTypes || ['t3.medium'];
        const primaryType = instanceTypes[0] || 't3.medium';
        const desiredSize = ng.scalingConfig?.desiredSize || 0;
        const hourlyRate = EC2_HOURLY_ESTIMATES[primaryType] || 0.10;
        const estimatedMonthlyCost = hourlyRate * HOURS_PER_MONTH * desiredSize;

        nodeGroups.push({
          name: ng.nodegroupName || ngName,
          cluster: clusterName,
          status: ng.status || 'UNKNOWN',
          instanceTypes,
          capacityType: ng.capacityType || 'ON_DEMAND',
          minSize: ng.scalingConfig?.minSize || 0,
          maxSize: ng.scalingConfig?.maxSize || 0,
          desiredSize,
          diskSize: ng.diskSize || 20,
          amiType: ng.amiType || 'AL2_x86_64',
          estimatedMonthlyCost,
        });
      } catch {
        // Skip node groups that fail to describe
      }
    }
  } catch {
    // Ignore errors listing node groups
  }

  return nodeGroups;
}

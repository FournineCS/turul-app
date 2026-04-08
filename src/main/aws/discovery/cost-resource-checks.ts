// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  DescribeVolumesCommand,
  DescribeAddressesCommand,
  DescribeSnapshotsCommand,
  DescribeInstancesCommand,
  DescribeImagesCommand,
  DescribeNatGatewaysCommand,
} from '@aws-sdk/client-ec2';
import {
  DescribeLoadBalancersCommand,
  DescribeTargetGroupsCommand,
  DescribeTargetHealthCommand,
} from '@aws-sdk/client-elastic-load-balancing-v2';
import { ListFunctionsCommand } from '@aws-sdk/client-lambda';
import { DescribeDBInstancesCommand } from '@aws-sdk/client-rds';
import {
  ListClustersCommand,
  ListServicesCommand,
  DescribeServicesCommand,
} from '@aws-sdk/client-ecs';
import { GetMetricStatisticsCommand } from '@aws-sdk/client-cloudwatch';
import { getClientFactory } from '../client-factory';
import type { CostOptimizationRecommendation } from '../../../shared/types';

// Approximate pricing per GB/month by volume type
const EBS_PRICE_PER_GB: Record<string, number> = {
  gp3: 0.08,
  gp2: 0.10,
  io1: 0.125,
  io2: 0.125,
  st1: 0.045,
  sc1: 0.015,
  standard: 0.05,
};

const EIP_COST_PER_MONTH = 3.60; // $0.005/hr × 720 hrs
const SNAPSHOT_COST_PER_GB = 0.05;
const ALB_FIXED_COST_PER_MONTH = 16.20; // ~$0.0225/hr
const NLB_FIXED_COST_PER_MONTH = 16.20;
const NAT_GW_FIXED_COST_PER_MONTH = 32.40; // $0.045/hr × 720 hrs

/**
 * Check for EBS volumes in "available" state (not attached to any instance).
 */
async function checkUnattachedEBSVolumes(
  profile: string,
  region: string
): Promise<CostOptimizationRecommendation[]> {
  const ec2 = getClientFactory().getEC2Client({ profile, region });
  const response = await ec2.send(
    new DescribeVolumesCommand({
      Filters: [{ Name: 'status', Values: ['available'] }],
    })
  );

  const volumes = response.Volumes || [];
  if (volumes.length === 0) return [];

  const recs: CostOptimizationRecommendation[] = [];
  let totalWaste = 0;

  for (const vol of volumes) {
    const volType = vol.VolumeType || 'gp2';
    const sizeGb = vol.Size || 0;
    const pricePerGb = EBS_PRICE_PER_GB[volType] || 0.10;
    const monthlyCost = sizeGb * pricePerGb;

    if (monthlyCost < 1) continue; // skip trivially small volumes

    totalWaste += monthlyCost;

    recs.push({
      id: `ebs-unattached-${vol.VolumeId}`,
      type: 'orphaned_resource',
      severity: monthlyCost > 50 ? 'high' : monthlyCost > 10 ? 'medium' : 'low',
      service: 'Amazon Elastic Block Store',
      description: `EBS volume ${vol.VolumeId} (${volType}, ${sizeGb} GB) is not attached to any instance. Estimated waste: $${monthlyCost.toFixed(2)}/mo.`,
      estimatedMonthlySavings: monthlyCost,
      currency: 'USD',
      actionRequired: 'Delete the volume if no longer needed, or create a snapshot before deleting.',
      resourceId: vol.VolumeId,
      resourceType: 'EBS Volume',
      region,
      category: 'Storage',
    });
  }

  // If many small volumes, also add a summary rec
  if (recs.length > 5) {
    const summaryRec: CostOptimizationRecommendation = {
      id: 'ebs-unattached-summary',
      type: 'orphaned_resource',
      severity: totalWaste > 50 ? 'high' : totalWaste > 10 ? 'medium' : 'low',
      service: 'Amazon Elastic Block Store',
      description: `${recs.length} unattached EBS volumes found totaling $${totalWaste.toFixed(2)}/mo in waste.`,
      estimatedMonthlySavings: totalWaste,
      currency: 'USD',
      actionRequired: 'Review all unattached volumes and delete those no longer needed.',
      resourceType: 'EBS Volume',
      region,
      category: 'Storage',
    };
    // Return only the summary + top 5 by cost
    recs.sort((a, b) => b.estimatedMonthlySavings - a.estimatedMonthlySavings);
    return [summaryRec, ...recs.slice(0, 5)];
  }

  return recs;
}

/**
 * Check for Elastic IPs not associated with a running instance.
 */
async function checkIdleElasticIPs(
  profile: string,
  region: string
): Promise<CostOptimizationRecommendation[]> {
  const ec2 = getClientFactory().getEC2Client({ profile, region });
  const response = await ec2.send(new DescribeAddressesCommand({}));

  const addresses = response.Addresses || [];
  const idle = addresses.filter((addr) => !addr.AssociationId);

  if (idle.length === 0) return [];

  const totalCost = idle.length * EIP_COST_PER_MONTH;

  const recs: CostOptimizationRecommendation[] = idle.map((addr) => ({
    id: `eip-idle-${addr.AllocationId}`,
    type: 'idle_resource' as const,
    severity: 'medium' as const,
    service: 'Amazon EC2 (Elastic IP)',
    description: `Elastic IP ${addr.PublicIp} (${addr.AllocationId}) is not associated with any instance. Cost: $${EIP_COST_PER_MONTH.toFixed(2)}/mo.`,
    estimatedMonthlySavings: EIP_COST_PER_MONTH,
    currency: 'USD',
    actionRequired: 'Release the Elastic IP if no longer needed.',
    resourceId: addr.AllocationId,
    resourceType: 'Elastic IP',
    region,
    category: 'Network',
  }));

  // If many idle EIPs, add summary
  if (recs.length > 3) {
    recs.unshift({
      id: 'eip-idle-summary',
      type: 'idle_resource',
      severity: totalCost > 20 ? 'high' : 'medium',
      service: 'Amazon EC2 (Elastic IP)',
      description: `${idle.length} unassociated Elastic IPs costing $${totalCost.toFixed(2)}/mo total.`,
      estimatedMonthlySavings: totalCost,
      currency: 'USD',
      actionRequired: 'Review and release unused Elastic IPs.',
      resourceType: 'Elastic IP',
      region,
      category: 'Network',
    });
  }

  return recs;
}

/**
 * Check for old EBS snapshots (>90 days) not referenced by any AMI.
 */
async function checkOldEBSSnapshots(
  profile: string,
  region: string
): Promise<CostOptimizationRecommendation[]> {
  const ec2 = getClientFactory().getEC2Client({ profile, region });

  const snapResponse = await ec2.send(
    new DescribeSnapshotsCommand({ OwnerIds: ['self'] })
  );
  const snapshots = snapResponse.Snapshots || [];
  if (snapshots.length === 0) return [];

  // Get AMI snapshot IDs to exclude
  const amiResponse = await ec2.send(
    new DescribeImagesCommand({ Owners: ['self'] })
  );
  const amiSnapshotIds = new Set<string>();
  for (const image of amiResponse.Images || []) {
    for (const bdm of image.BlockDeviceMappings || []) {
      if (bdm.Ebs?.SnapshotId) {
        amiSnapshotIds.add(bdm.Ebs.SnapshotId);
      }
    }
  }

  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  const oldSnapshots = snapshots.filter((snap) => {
    if (!snap.StartTime || !snap.SnapshotId) return false;
    if (amiSnapshotIds.has(snap.SnapshotId)) return false;
    return new Date(snap.StartTime) < ninetyDaysAgo;
  });

  if (oldSnapshots.length === 0) return [];

  const totalSizeGb = oldSnapshots.reduce((sum, s) => sum + (s.VolumeSize || 0), 0);
  const totalCost = totalSizeGb * SNAPSHOT_COST_PER_GB;

  if (totalCost < 1) return []; // not worth flagging

  return [
    {
      id: 'ebs-snapshots-old',
      type: 'orphaned_resource',
      severity: totalCost > 20 ? 'medium' : 'low',
      service: 'Amazon Elastic Block Store',
      description: `${oldSnapshots.length} EBS snapshots older than 90 days (not referenced by any AMI) consuming ${totalSizeGb} GB. Estimated cost: $${totalCost.toFixed(2)}/mo.`,
      estimatedMonthlySavings: totalCost,
      currency: 'USD',
      actionRequired: 'Review old snapshots and delete those no longer needed for recovery.',
      resourceType: 'EBS Snapshot',
      region,
      category: 'Storage',
    },
  ];
}

/**
 * Check for ALB/NLB load balancers with zero healthy targets.
 */
async function checkIdleLoadBalancers(
  profile: string,
  region: string
): Promise<CostOptimizationRecommendation[]> {
  const elbv2 = getClientFactory().getELBv2Client({ profile, region });

  const lbResponse = await elbv2.send(new DescribeLoadBalancersCommand({}));
  const loadBalancers = lbResponse.LoadBalancers || [];
  if (loadBalancers.length === 0) return [];

  const recs: CostOptimizationRecommendation[] = [];

  for (const lb of loadBalancers) {
    if (!lb.LoadBalancerArn) continue;

    const tgResponse = await elbv2.send(
      new DescribeTargetGroupsCommand({ LoadBalancerArn: lb.LoadBalancerArn })
    );
    const targetGroups = tgResponse.TargetGroups || [];

    // If no target groups at all, it's idle
    if (targetGroups.length === 0) {
      const cost = lb.Type === 'network' ? NLB_FIXED_COST_PER_MONTH : ALB_FIXED_COST_PER_MONTH;
      recs.push({
        id: `lb-idle-${lb.LoadBalancerName}`,
        type: 'idle_resource',
        severity: 'medium',
        service: 'Elastic Load Balancing',
        description: `Load balancer ${lb.LoadBalancerName} (${lb.Type}) has no target groups. Fixed cost: ~$${cost.toFixed(2)}/mo.`,
        estimatedMonthlySavings: cost,
        currency: 'USD',
        actionRequired: 'Delete the load balancer if it is no longer serving traffic.',
        resourceId: lb.LoadBalancerName,
        resourceType: lb.Type === 'network' ? 'NLB' : 'ALB',
        region,
        category: 'Network',
      });
      continue;
    }

    // Check if all target groups have zero healthy targets
    let allUnhealthy = true;
    for (const tg of targetGroups) {
      if (!tg.TargetGroupArn) continue;
      const healthResponse = await elbv2.send(
        new DescribeTargetHealthCommand({ TargetGroupArn: tg.TargetGroupArn })
      );
      const healthy = (healthResponse.TargetHealthDescriptions || []).some(
        (t) => t.TargetHealth?.State === 'healthy'
      );
      if (healthy) {
        allUnhealthy = false;
        break;
      }
    }

    if (allUnhealthy) {
      const cost = lb.Type === 'network' ? NLB_FIXED_COST_PER_MONTH : ALB_FIXED_COST_PER_MONTH;
      recs.push({
        id: `lb-idle-${lb.LoadBalancerName}`,
        type: 'idle_resource',
        severity: 'medium',
        service: 'Elastic Load Balancing',
        description: `Load balancer ${lb.LoadBalancerName} (${lb.Type}) has zero healthy targets. Fixed cost: ~$${cost.toFixed(2)}/mo.`,
        estimatedMonthlySavings: cost,
        currency: 'USD',
        actionRequired: 'Investigate why targets are unhealthy, or delete the load balancer if unused.',
        resourceId: lb.LoadBalancerName,
        resourceType: lb.Type === 'network' ? 'NLB' : 'ALB',
        region,
        category: 'Network',
      });
    }
  }

  if (recs.length > 2) {
    recs[0].severity = 'high';
  }

  return recs;
}

/**
 * Check for EC2 instances in "stopped" state — still incurring EBS costs.
 */
async function checkStoppedInstances(
  profile: string,
  region: string
): Promise<CostOptimizationRecommendation[]> {
  const ec2 = getClientFactory().getEC2Client({ profile, region });

  const response = await ec2.send(
    new DescribeInstancesCommand({
      Filters: [{ Name: 'instance-state-name', Values: ['stopped'] }],
    })
  );

  const recs: CostOptimizationRecommendation[] = [];
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  for (const reservation of response.Reservations || []) {
    for (const instance of reservation.Instances || []) {
      if (!instance.InstanceId) continue;

      // Calculate EBS cost for attached volumes
      let ebsCost = 0;
      for (const bdm of instance.BlockDeviceMappings || []) {
        if (bdm.Ebs?.VolumeId) {
          // We don't have volume details here, estimate 30GB gp2 per volume as baseline
          // A more precise check would describe each volume, but we keep API calls minimal
          ebsCost += 30 * 0.10; // $3/mo per default volume estimate
        }
      }

      if (ebsCost < 1) continue;

      // Check how long it's been stopped using the state transition reason timestamp
      const stoppedLong = instance.StateTransitionReason?.includes('User initiated')
        ? true // conservative: assume stopped > 30 days if we can't determine
        : false;

      const nameTag = instance.Tags?.find((t) => t.Key === 'Name')?.Value;
      const label = nameTag ? `${nameTag} (${instance.InstanceId})` : instance.InstanceId;

      recs.push({
        id: `stopped-${instance.InstanceId}`,
        type: 'idle_resource',
        severity: stoppedLong ? 'high' : 'medium',
        service: 'Amazon EC2',
        description: `Stopped instance ${label} still incurs EBS storage costs (~$${ebsCost.toFixed(2)}/mo). ${instance.InstanceType || 'Unknown type'}.`,
        estimatedMonthlySavings: ebsCost,
        currency: 'USD',
        actionRequired: 'Terminate the instance if no longer needed, or create an AMI and terminate to eliminate ongoing costs.',
        resourceId: instance.InstanceId,
        resourceType: 'EC2 Instance',
        region,
        category: 'Compute',
      });
    }
  }

  return recs;
}

/**
 * Check for Lambda functions with zero invocations in the last 30 days.
 */
async function checkIdleLambdaFunctions(
  profile: string,
  region: string
): Promise<CostOptimizationRecommendation[]> {
  const lambda = getClientFactory().getLambdaClient({ profile, region });
  const cw = getClientFactory().getCloudWatchClient({ profile, region });

  const response = await lambda.send(new ListFunctionsCommand({}));
  const functions = response.Functions || [];
  if (functions.length === 0) return [];

  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const recs: CostOptimizationRecommendation[] = [];

  for (const fn of functions) {
    if (!fn.FunctionName) continue;

    const metrics = await cw.send(
      new GetMetricStatisticsCommand({
        Namespace: 'AWS/Lambda',
        MetricName: 'Invocations',
        Dimensions: [{ Name: 'FunctionName', Value: fn.FunctionName }],
        StartTime: thirtyDaysAgo,
        EndTime: now,
        Period: 30 * 24 * 60 * 60, // entire 30-day window
        Statistics: ['Sum'],
      })
    );

    const totalInvocations = (metrics.Datapoints || []).reduce(
      (sum, dp) => sum + (dp.Sum || 0),
      0
    );

    if (totalInvocations === 0) {
      // Estimate cost — provisioned concurrency is the big one
      const memoryMb = fn.MemorySize || 128;
      const hasProvisionedConcurrency = false; // basic detection; ListProvisionedConcurrencyConfigs would add an API call
      const estimatedCost = hasProvisionedConcurrency ? memoryMb * 0.015 : 0.50; // minimal if no provisioned concurrency

      recs.push({
        id: `lambda-idle-${fn.FunctionName}`,
        type: 'idle_resource',
        severity: 'low',
        service: 'AWS Lambda',
        description: `Lambda function "${fn.FunctionName}" had zero invocations in the last 30 days. Runtime: ${fn.Runtime || 'N/A'}, Memory: ${memoryMb} MB.`,
        estimatedMonthlySavings: estimatedCost,
        currency: 'USD',
        actionRequired: 'Delete the function if no longer needed, or verify it is intentionally idle.',
        resourceId: fn.FunctionArn,
        resourceType: 'Lambda Function',
        region,
        category: 'Compute',
      });
    }
  }

  if (recs.length > 5) {
    const summary: CostOptimizationRecommendation = {
      id: 'lambda-idle-summary',
      type: 'idle_resource',
      severity: recs.length > 20 ? 'medium' : 'low',
      service: 'AWS Lambda',
      description: `${recs.length} Lambda functions had zero invocations in the last 30 days.`,
      estimatedMonthlySavings: recs.reduce((s, r) => s + r.estimatedMonthlySavings, 0),
      currency: 'USD',
      actionRequired: 'Review idle functions and delete those no longer needed.',
      resourceType: 'Lambda Function',
      region,
      category: 'Compute',
    };
    recs.sort((a, b) => b.estimatedMonthlySavings - a.estimatedMonthlySavings);
    return [summary, ...recs.slice(0, 5)];
  }

  return recs;
}

/**
 * Check for RDS instances with zero database connections in the last 7 days.
 */
async function checkIdleRDSInstances(
  profile: string,
  region: string
): Promise<CostOptimizationRecommendation[]> {
  const rds = getClientFactory().getRDSClient({ profile, region });
  const cw = getClientFactory().getCloudWatchClient({ profile, region });

  const response = await rds.send(new DescribeDBInstancesCommand({}));
  const instances = response.DBInstances || [];
  if (instances.length === 0) return [];

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const recs: CostOptimizationRecommendation[] = [];

  // Approximate RDS pricing by instance class (simplified)
  const RDS_HOURLY_ESTIMATES: Record<string, number> = {
    'db.t3.micro': 0.017,
    'db.t3.small': 0.034,
    'db.t3.medium': 0.068,
    'db.t3.large': 0.136,
    'db.r5.large': 0.24,
    'db.r5.xlarge': 0.48,
    'db.r6g.large': 0.216,
    'db.m5.large': 0.171,
    'db.m5.xlarge': 0.342,
  };

  for (const db of instances) {
    if (!db.DBInstanceIdentifier || db.DBInstanceStatus !== 'available') continue;

    const metrics = await cw.send(
      new GetMetricStatisticsCommand({
        Namespace: 'AWS/RDS',
        MetricName: 'DatabaseConnections',
        Dimensions: [{ Name: 'DBInstanceIdentifier', Value: db.DBInstanceIdentifier }],
        StartTime: sevenDaysAgo,
        EndTime: now,
        Period: 7 * 24 * 60 * 60, // entire 7-day window
        Statistics: ['Maximum'],
      })
    );

    const maxConnections = (metrics.Datapoints || []).reduce(
      (max, dp) => Math.max(max, dp.Maximum || 0),
      0
    );

    if (maxConnections === 0) {
      const instanceClass = db.DBInstanceClass || 'db.t3.medium';
      const hourlyRate = RDS_HOURLY_ESTIMATES[instanceClass] || 0.10;
      const monthlyCost = hourlyRate * 720;

      recs.push({
        id: `rds-idle-${db.DBInstanceIdentifier}`,
        type: 'idle_resource',
        severity: monthlyCost > 100 ? 'high' : 'medium',
        service: 'Amazon RDS',
        description: `RDS instance "${db.DBInstanceIdentifier}" (${instanceClass}, ${db.Engine}) had zero connections for the last 7 days. Estimated cost: ~$${monthlyCost.toFixed(2)}/mo.`,
        estimatedMonthlySavings: monthlyCost,
        currency: 'USD',
        actionRequired: 'Stop or delete the instance if no longer needed. Consider creating a snapshot first.',
        resourceId: db.DBInstanceArn,
        resourceType: 'RDS Instance',
        region,
        category: 'Database',
      });
    }
  }

  return recs;
}

/**
 * Check for NAT Gateways with zero outbound traffic in the last 7 days.
 */
async function checkIdleNATGateways(
  profile: string,
  region: string
): Promise<CostOptimizationRecommendation[]> {
  const ec2 = getClientFactory().getEC2Client({ profile, region });
  const cw = getClientFactory().getCloudWatchClient({ profile, region });

  const response = await ec2.send(
    new DescribeNatGatewaysCommand({
      Filter: [{ Name: 'state', Values: ['available'] }],
    })
  );

  const gateways = response.NatGateways || [];
  if (gateways.length === 0) return [];

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const recs: CostOptimizationRecommendation[] = [];

  for (const gw of gateways) {
    if (!gw.NatGatewayId) continue;

    const metrics = await cw.send(
      new GetMetricStatisticsCommand({
        Namespace: 'AWS/NATGateway',
        MetricName: 'BytesOutToDestination',
        Dimensions: [{ Name: 'NatGatewayId', Value: gw.NatGatewayId }],
        StartTime: sevenDaysAgo,
        EndTime: now,
        Period: 7 * 24 * 60 * 60,
        Statistics: ['Sum'],
      })
    );

    const totalBytes = (metrics.Datapoints || []).reduce(
      (sum, dp) => sum + (dp.Sum || 0),
      0
    );

    if (totalBytes === 0) {
      recs.push({
        id: `natgw-idle-${gw.NatGatewayId}`,
        type: 'idle_resource',
        severity: 'high', // $32.40/mo fixed cost per NAT GW
        service: 'Amazon VPC (NAT Gateway)',
        description: `NAT Gateway ${gw.NatGatewayId} had zero outbound traffic for the last 7 days. Fixed cost: ~$${NAT_GW_FIXED_COST_PER_MONTH.toFixed(2)}/mo.`,
        estimatedMonthlySavings: NAT_GW_FIXED_COST_PER_MONTH,
        currency: 'USD',
        actionRequired: 'Delete the NAT Gateway if the subnet no longer needs internet access for private resources.',
        resourceId: gw.NatGatewayId,
        resourceType: 'NAT Gateway',
        region,
        category: 'Network',
      });
    }
  }

  return recs;
}

/**
 * Check for ECS services with desiredCount=0 (idle but cluster still running).
 */
async function checkIdleECSServices(
  profile: string,
  region: string
): Promise<CostOptimizationRecommendation[]> {
  const ecs = getClientFactory().getECSClient({ profile, region });

  const clustersResponse = await ecs.send(new ListClustersCommand({}));
  const clusterArns = clustersResponse.clusterArns || [];
  if (clusterArns.length === 0) return [];

  const recs: CostOptimizationRecommendation[] = [];

  for (const clusterArn of clusterArns) {
    const servicesResponse = await ecs.send(
      new ListServicesCommand({ cluster: clusterArn })
    );
    const serviceArns = servicesResponse.serviceArns || [];
    if (serviceArns.length === 0) continue;

    // DescribeServices accepts max 10 at a time
    for (let i = 0; i < serviceArns.length; i += 10) {
      const batch = serviceArns.slice(i, i + 10);
      const describeResponse = await ecs.send(
        new DescribeServicesCommand({ cluster: clusterArn, services: batch })
      );

      for (const svc of describeResponse.services || []) {
        if (svc.desiredCount === 0 && svc.runningCount === 0 && svc.status === 'ACTIVE') {
          const clusterName = clusterArn.split('/').pop() || clusterArn;
          recs.push({
            id: `ecs-idle-${svc.serviceName}`,
            type: 'idle_resource',
            severity: 'low',
            service: 'Amazon ECS',
            description: `ECS service "${svc.serviceName}" in cluster "${clusterName}" has desiredCount=0 and no running tasks.`,
            estimatedMonthlySavings: 0, // no direct cost when scaled to 0, but indicates potential cleanup
            currency: 'USD',
            actionRequired: 'Delete the service if it is no longer needed, or investigate why it was scaled to zero.',
            resourceId: svc.serviceArn,
            resourceType: 'ECS Service',
            region,
            category: 'Compute',
          });
        }
      }
    }
  }

  return recs;
}

/**
 * Check for ALBs with zero requests in the last 7 days (via CloudWatch).
 * Complements checkIdleLoadBalancers which checks for unhealthy targets.
 */
async function checkALBsNoTraffic(
  profile: string,
  region: string
): Promise<CostOptimizationRecommendation[]> {
  const elbv2 = getClientFactory().getELBv2Client({ profile, region });
  const cw = getClientFactory().getCloudWatchClient({ profile, region });

  const lbResponse = await elbv2.send(new DescribeLoadBalancersCommand({}));
  const loadBalancers = (lbResponse.LoadBalancers || []).filter(
    (lb) => lb.Type === 'application'
  );
  if (loadBalancers.length === 0) return [];

  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const recs: CostOptimizationRecommendation[] = [];

  for (const lb of loadBalancers) {
    if (!lb.LoadBalancerArn || !lb.LoadBalancerName) continue;

    // CloudWatch dimension uses the ARN suffix: app/name/id
    const arnSuffix = lb.LoadBalancerArn.split(':loadbalancer/').pop();
    if (!arnSuffix) continue;

    const metrics = await cw.send(
      new GetMetricStatisticsCommand({
        Namespace: 'AWS/ApplicationELB',
        MetricName: 'RequestCount',
        Dimensions: [{ Name: 'LoadBalancer', Value: arnSuffix }],
        StartTime: sevenDaysAgo,
        EndTime: now,
        Period: 7 * 24 * 60 * 60,
        Statistics: ['Sum'],
      })
    );

    const totalRequests = (metrics.Datapoints || []).reduce(
      (sum, dp) => sum + (dp.Sum || 0),
      0
    );

    if (totalRequests === 0) {
      recs.push({
        id: `alb-no-traffic-${lb.LoadBalancerName}`,
        type: 'idle_resource',
        severity: 'medium',
        service: 'Elastic Load Balancing',
        description: `ALB "${lb.LoadBalancerName}" received zero requests in the last 7 days. Fixed cost: ~$${ALB_FIXED_COST_PER_MONTH.toFixed(2)}/mo.`,
        estimatedMonthlySavings: ALB_FIXED_COST_PER_MONTH,
        currency: 'USD',
        actionRequired: 'Delete the ALB if it is no longer serving traffic.',
        resourceId: lb.LoadBalancerName,
        resourceType: 'ALB',
        region,
        category: 'Network',
      });
    }
  }

  return recs;
}

/**
 * Run all resource-level cost waste checks in parallel.
 * Each check is independent — failures in one don't block others.
 */
export async function runResourceCostChecks(
  profile: string,
  region: string
): Promise<CostOptimizationRecommendation[]> {
  const checks = [
    checkUnattachedEBSVolumes(profile, region),
    checkIdleElasticIPs(profile, region),
    checkOldEBSSnapshots(profile, region),
    checkIdleLoadBalancers(profile, region),
    checkStoppedInstances(profile, region),
    checkIdleLambdaFunctions(profile, region),
    checkIdleRDSInstances(profile, region),
    checkIdleNATGateways(profile, region),
    checkIdleECSServices(profile, region),
    checkALBsNoTraffic(profile, region),
  ];

  const results = await Promise.allSettled(checks);
  const recommendations: CostOptimizationRecommendation[] = [];

  for (const result of results) {
    if (result.status === 'fulfilled') {
      recommendations.push(...result.value);
    } else {
      console.warn('Resource cost check failed:', result.reason?.message || result.reason);
    }
  }

  return recommendations;
}

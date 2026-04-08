// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  DescribeVolumesCommand,
  DescribeAddressesCommand,
  DescribeInstancesCommand,
  DescribeSnapshotsCommand,
} from '@aws-sdk/client-ec2';
import { getClientFactory } from '../../client-factory';
import type { WABPFinding } from '../../../../shared/types';
import { COST_CHECKS, type WABPCheckResult } from './types';

/**
 * WA-COST-001: Check for unattached EBS volumes
 */
async function checkUnattachedVolumes(
  profile: string,
  region: string
): Promise<WABPFinding[]> {
  const client = getClientFactory().getEC2Client({ profile, region });
  const findings: WABPFinding[] = [];
  const checkDef = COST_CHECKS.find((c) => c.id === 'WA-COST-001')!;

  try {
    let nextToken: string | undefined;
    do {
      const response = await client.send(
        new DescribeVolumesCommand({
          Filters: [{ Name: 'status', Values: ['available'] }],
          NextToken: nextToken,
          MaxResults: 100,
        })
      );
      for (const volume of response.Volumes || []) {
        const name = volume.Tags?.find((t) => t.Key === 'Name')?.Value || volume.VolumeId;
        const sizeGB = volume.Size || 0;
        findings.push({
          checkId: checkDef.id,
          title: checkDef.title,
          description: `EBS volume "${name}" (${volume.VolumeId}, ${sizeGB} GB, ${volume.VolumeType}) is not attached to any instance.`,
          pillar: 'costOptimization',
          severity: checkDef.severity,
          status: 'FAIL',
          service: checkDef.service,
          resourceId: volume.VolumeId,
          resourceArn: `arn:aws:ec2:${region}::volume/${volume.VolumeId}`,
          region,
          remediationRecommendation: checkDef.remediationRecommendation,
          remediationUrl: checkDef.remediationUrl,
        });
      }
      nextToken = response.NextToken;
    } while (nextToken);
  } catch (error) {
    throw error;
  }

  return findings;
}

/**
 * WA-COST-002: Check for unused Elastic IPs
 */
async function checkUnusedElasticIPs(
  profile: string,
  region: string
): Promise<WABPFinding[]> {
  const client = getClientFactory().getEC2Client({ profile, region });
  const findings: WABPFinding[] = [];
  const checkDef = COST_CHECKS.find((c) => c.id === 'WA-COST-002')!;

  try {
    const response = await client.send(new DescribeAddressesCommand({}));
    for (const address of response.Addresses || []) {
      if (!address.AssociationId) {
        findings.push({
          checkId: checkDef.id,
          title: checkDef.title,
          description: `Elastic IP ${address.PublicIp} (${address.AllocationId}) is not associated with any resource.`,
          pillar: 'costOptimization',
          severity: checkDef.severity,
          status: 'FAIL',
          service: checkDef.service,
          resourceId: address.AllocationId,
          resourceArn: `arn:aws:ec2:${region}::elastic-ip/${address.AllocationId}`,
          region,
          remediationRecommendation: checkDef.remediationRecommendation,
          remediationUrl: checkDef.remediationUrl,
        });
      }
    }
  } catch (error) {
    throw error;
  }

  return findings;
}

/**
 * WA-COST-003: Check for stopped EC2 instances
 */
async function checkStoppedInstances(
  profile: string,
  region: string
): Promise<WABPFinding[]> {
  const client = getClientFactory().getEC2Client({ profile, region });
  const findings: WABPFinding[] = [];
  const checkDef = COST_CHECKS.find((c) => c.id === 'WA-COST-003')!;

  try {
    let nextToken: string | undefined;
    do {
      const response = await client.send(
        new DescribeInstancesCommand({
          Filters: [{ Name: 'instance-state-name', Values: ['stopped'] }],
          NextToken: nextToken,
          MaxResults: 100,
        })
      );
      for (const reservation of response.Reservations || []) {
        for (const instance of reservation.Instances || []) {
          const name = instance.Tags?.find((t) => t.Key === 'Name')?.Value || instance.InstanceId;
          findings.push({
            checkId: checkDef.id,
            title: checkDef.title,
            description: `EC2 instance "${name}" (${instance.InstanceId}, ${instance.InstanceType}) is in stopped state.`,
            pillar: 'costOptimization',
            severity: checkDef.severity,
            status: 'FAIL',
            service: checkDef.service,
            resourceId: instance.InstanceId,
            resourceArn: `arn:aws:ec2:${region}::instance/${instance.InstanceId}`,
            region,
            remediationRecommendation: checkDef.remediationRecommendation,
            remediationUrl: checkDef.remediationUrl,
          });
        }
      }
      nextToken = response.NextToken;
    } while (nextToken);
  } catch (error) {
    throw error;
  }

  return findings;
}

/**
 * WA-COST-004: Check for old EBS snapshots (>90 days)
 */
async function checkOldSnapshots(
  profile: string,
  region: string
): Promise<WABPFinding[]> {
  const client = getClientFactory().getEC2Client({ profile, region });
  const findings: WABPFinding[] = [];
  const checkDef = COST_CHECKS.find((c) => c.id === 'WA-COST-004')!;
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

  try {
    let nextToken: string | undefined;
    do {
      const response = await client.send(
        new DescribeSnapshotsCommand({
          OwnerIds: ['self'],
          NextToken: nextToken,
          MaxResults: 100,
        })
      );
      for (const snapshot of response.Snapshots || []) {
        if (snapshot.StartTime && snapshot.StartTime < ninetyDaysAgo) {
          const ageDays = Math.floor(
            (Date.now() - snapshot.StartTime.getTime()) / (1000 * 60 * 60 * 24)
          );
          const name = snapshot.Tags?.find((t) => t.Key === 'Name')?.Value || snapshot.SnapshotId;
          findings.push({
            checkId: checkDef.id,
            title: checkDef.title,
            description: `EBS snapshot "${name}" (${snapshot.SnapshotId}, ${snapshot.VolumeSize} GB) is ${ageDays} days old.`,
            pillar: 'costOptimization',
            severity: checkDef.severity,
            status: 'FAIL',
            service: checkDef.service,
            resourceId: snapshot.SnapshotId,
            resourceArn: `arn:aws:ec2:${region}::snapshot/${snapshot.SnapshotId}`,
            region,
            remediationRecommendation: checkDef.remediationRecommendation,
            remediationUrl: checkDef.remediationUrl,
          });
        }
      }
      nextToken = response.NextToken;
    } while (nextToken);
  } catch (error) {
    throw error;
  }

  return findings;
}

/**
 * Run all Cost Optimization checks
 */
export async function runCostChecks(
  profile: string,
  region: string
): Promise<WABPCheckResult> {
  const findings: WABPFinding[] = [];
  const errors: string[] = [];
  let checksRun = 0;
  let checksWithFindings = 0;

  const checks = [
    { name: 'Unattached EBS', runner: checkUnattachedVolumes },
    { name: 'Unused Elastic IPs', runner: checkUnusedElasticIPs },
    { name: 'Stopped Instances', runner: checkStoppedInstances },
    { name: 'Old Snapshots', runner: checkOldSnapshots },
  ];

  for (const { name, runner } of checks) {
    try {
      checksRun++;
      const result = await runner(profile, region);
      if (result.length > 0) {
        checksWithFindings++;
        findings.push(...result);
      }
    } catch (error) {
      errors.push(`${name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return { findings, errors, checksRun, checksWithFindings };
}

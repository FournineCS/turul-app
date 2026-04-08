// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { DescribeDBInstancesCommand } from '@aws-sdk/client-rds';
import {
  DescribeVolumesCommand,
  DescribeSnapshotsCommand,
} from '@aws-sdk/client-ec2';
import { DescribeAutoScalingGroupsCommand } from '@aws-sdk/client-auto-scaling';
import {
  ListBucketsCommand,
  GetBucketVersioningCommand,
} from '@aws-sdk/client-s3';
import { getClientFactory } from '../../client-factory';
import type { WABPFinding } from '../../../../shared/types';
import { RELIABILITY_CHECKS, type WABPCheckResult } from './types';

/**
 * WA-REL-001: Check RDS Multi-AZ
 */
async function checkRDSMultiAZ(
  profile: string,
  region: string
): Promise<WABPFinding[]> {
  const client = getClientFactory().getRDSClient({ profile, region });
  const findings: WABPFinding[] = [];
  const checkDef = RELIABILITY_CHECKS.find((c) => c.id === 'WA-REL-001')!;

  try {
    let marker: string | undefined;
    do {
      const response = await client.send(
        new DescribeDBInstancesCommand({ Marker: marker, MaxRecords: 100 })
      );
      for (const db of response.DBInstances || []) {
        if (!db.MultiAZ) {
          findings.push({
            checkId: checkDef.id,
            title: checkDef.title,
            description: `RDS instance "${db.DBInstanceIdentifier}" is not configured for Multi-AZ deployment.`,
            pillar: 'reliability',
            severity: checkDef.severity,
            status: 'FAIL',
            service: checkDef.service,
            resourceId: db.DBInstanceIdentifier,
            resourceArn: db.DBInstanceArn,
            region,
            remediationRecommendation: checkDef.remediationRecommendation,
            remediationUrl: checkDef.remediationUrl,
          });
        }
      }
      marker = response.Marker;
    } while (marker);
  } catch (error) {
    throw error;
  }

  return findings;
}

/**
 * WA-REL-002: Check RDS automated backups
 */
async function checkRDSBackups(
  profile: string,
  region: string
): Promise<WABPFinding[]> {
  const client = getClientFactory().getRDSClient({ profile, region });
  const findings: WABPFinding[] = [];
  const checkDef = RELIABILITY_CHECKS.find((c) => c.id === 'WA-REL-002')!;

  try {
    let marker: string | undefined;
    do {
      const response = await client.send(
        new DescribeDBInstancesCommand({ Marker: marker, MaxRecords: 100 })
      );
      for (const db of response.DBInstances || []) {
        if ((db.BackupRetentionPeriod ?? 0) === 0) {
          findings.push({
            checkId: checkDef.id,
            title: checkDef.title,
            description: `RDS instance "${db.DBInstanceIdentifier}" has automated backups disabled (retention period: 0).`,
            pillar: 'reliability',
            severity: checkDef.severity,
            status: 'FAIL',
            service: checkDef.service,
            resourceId: db.DBInstanceIdentifier,
            resourceArn: db.DBInstanceArn,
            region,
            remediationRecommendation: checkDef.remediationRecommendation,
            remediationUrl: checkDef.remediationUrl,
          });
        }
      }
      marker = response.Marker;
    } while (marker);
  } catch (error) {
    throw error;
  }

  return findings;
}

/**
 * WA-REL-003: Check EBS volumes without snapshots
 */
async function checkEBSSnapshots(
  profile: string,
  region: string
): Promise<WABPFinding[]> {
  const client = getClientFactory().getEC2Client({ profile, region });
  const findings: WABPFinding[] = [];
  const checkDef = RELIABILITY_CHECKS.find((c) => c.id === 'WA-REL-003')!;

  try {
    // Get all snapshots for this account (owner: self)
    const volumesWithSnapshots = new Set<string>();
    let snapshotToken: string | undefined;
    do {
      const snapResponse = await client.send(
        new DescribeSnapshotsCommand({
          OwnerIds: ['self'],
          NextToken: snapshotToken,
          MaxResults: 100,
        })
      );
      for (const snapshot of snapResponse.Snapshots || []) {
        if (snapshot.VolumeId) {
          volumesWithSnapshots.add(snapshot.VolumeId);
        }
      }
      snapshotToken = snapResponse.NextToken;
    } while (snapshotToken);

    // Check volumes
    let volumeToken: string | undefined;
    do {
      const volResponse = await client.send(
        new DescribeVolumesCommand({ NextToken: volumeToken, MaxResults: 100 })
      );
      for (const volume of volResponse.Volumes || []) {
        if (volume.VolumeId && !volumesWithSnapshots.has(volume.VolumeId)) {
          const name = volume.Tags?.find((t) => t.Key === 'Name')?.Value || volume.VolumeId;
          findings.push({
            checkId: checkDef.id,
            title: checkDef.title,
            description: `EBS volume "${name}" (${volume.VolumeId}) has no snapshots.`,
            pillar: 'reliability',
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
      }
      volumeToken = volResponse.NextToken;
    } while (volumeToken);
  } catch (error) {
    throw error;
  }

  return findings;
}

/**
 * WA-REL-004: Check Auto Scaling group AZ distribution
 */
async function checkASGMultiAZ(
  profile: string,
  region: string
): Promise<WABPFinding[]> {
  const client = getClientFactory().getAutoScalingClient({ profile, region });
  const findings: WABPFinding[] = [];
  const checkDef = RELIABILITY_CHECKS.find((c) => c.id === 'WA-REL-004')!;

  try {
    let nextToken: string | undefined;
    do {
      const response = await client.send(
        new DescribeAutoScalingGroupsCommand({ NextToken: nextToken })
      );
      for (const asg of response.AutoScalingGroups || []) {
        const azCount = (asg.AvailabilityZones || []).length;
        if (azCount <= 1) {
          findings.push({
            checkId: checkDef.id,
            title: checkDef.title,
            description: `Auto Scaling group "${asg.AutoScalingGroupName}" is configured with only ${azCount} Availability Zone(s).`,
            pillar: 'reliability',
            severity: checkDef.severity,
            status: 'FAIL',
            service: checkDef.service,
            resourceId: asg.AutoScalingGroupName,
            resourceArn: asg.AutoScalingGroupARN,
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
 * WA-REL-005: Check S3 versioning
 */
async function checkS3Versioning(
  profile: string,
  region: string
): Promise<WABPFinding[]> {
  const client = getClientFactory().getS3Client({ profile, region });
  const findings: WABPFinding[] = [];
  const checkDef = RELIABILITY_CHECKS.find((c) => c.id === 'WA-REL-005')!;

  try {
    const bucketsResponse = await client.send(new ListBucketsCommand({}));
    for (const bucket of bucketsResponse.Buckets || []) {
      if (!bucket.Name) continue;
      try {
        const versioningResponse = await client.send(
          new GetBucketVersioningCommand({ Bucket: bucket.Name })
        );
        if (versioningResponse.Status !== 'Enabled') {
          findings.push({
            checkId: checkDef.id,
            title: checkDef.title,
            description: `S3 bucket "${bucket.Name}" does not have versioning enabled.`,
            pillar: 'reliability',
            severity: checkDef.severity,
            status: 'FAIL',
            service: checkDef.service,
            resourceId: bucket.Name,
            resourceArn: `arn:aws:s3:::${bucket.Name}`,
            region,
            remediationRecommendation: checkDef.remediationRecommendation,
            remediationUrl: checkDef.remediationUrl,
          });
        }
      } catch {
        // Skip if can't read versioning config
      }
    }
  } catch (error) {
    throw error;
  }

  return findings;
}

/**
 * Run all Reliability checks
 */
export async function runReliabilityChecks(
  profile: string,
  region: string
): Promise<WABPCheckResult> {
  const findings: WABPFinding[] = [];
  const errors: string[] = [];
  let checksRun = 0;
  let checksWithFindings = 0;

  const checks = [
    { name: 'RDS Multi-AZ', runner: checkRDSMultiAZ },
    { name: 'RDS Backups', runner: checkRDSBackups },
    { name: 'EBS Snapshots', runner: checkEBSSnapshots },
    { name: 'ASG Multi-AZ', runner: checkASGMultiAZ },
    { name: 'S3 Versioning', runner: checkS3Versioning },
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

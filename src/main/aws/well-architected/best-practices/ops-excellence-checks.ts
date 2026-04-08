// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  DescribeTrailsCommand,
  GetTrailStatusCommand,
} from '@aws-sdk/client-cloudtrail';
import { DescribeAlarmsCommand } from '@aws-sdk/client-cloudwatch';
import {
  DescribeAutoScalingGroupsCommand,
} from '@aws-sdk/client-auto-scaling';
import { DescribeInstancesCommand } from '@aws-sdk/client-ec2';
import { getClientFactory } from '../../client-factory';
import type { WABPFinding } from '../../../../shared/types';
import { OPS_EXCELLENCE_CHECKS, type WABPCheckResult } from './types';

/**
 * WA-OPS-001: Check if CloudTrail is logging in the region
 */
async function checkCloudTrailLogging(
  profile: string,
  region: string
): Promise<WABPFinding[]> {
  const client = getClientFactory().getCloudTrailClient({ profile, region });
  const findings: WABPFinding[] = [];
  const checkDef = OPS_EXCELLENCE_CHECKS.find((c) => c.id === 'WA-OPS-001')!;

  try {
    const response = await client.send(new DescribeTrailsCommand({}));
    const trails = response.trailList || [];

    if (trails.length === 0) {
      findings.push({
        checkId: checkDef.id,
        title: checkDef.title,
        description: 'No CloudTrail trails are configured in this account.',
        pillar: 'operationalExcellence',
        severity: checkDef.severity,
        status: 'FAIL',
        service: checkDef.service,
        region,
        remediationRecommendation: checkDef.remediationRecommendation,
        remediationUrl: checkDef.remediationUrl,
      });
      return findings;
    }

    // Check if any trail is actively logging
    let anyLogging = false;
    for (const trail of trails) {
      if (!trail.TrailARN) continue;
      try {
        const statusResponse = await client.send(
          new GetTrailStatusCommand({ Name: trail.TrailARN })
        );
        if (statusResponse.IsLogging) {
          anyLogging = true;
          break;
        }
      } catch {
        // Trail may be in different region, skip
      }
    }

    if (!anyLogging) {
      findings.push({
        checkId: checkDef.id,
        title: checkDef.title,
        description: 'CloudTrail trails exist but none are actively logging in this region.',
        pillar: 'operationalExcellence',
        severity: checkDef.severity,
        status: 'FAIL',
        service: checkDef.service,
        region,
        remediationRecommendation: checkDef.remediationRecommendation,
        remediationUrl: checkDef.remediationUrl,
      });
    }
  } catch (error) {
    throw error;
  }

  return findings;
}

/**
 * WA-OPS-002: Check for CloudWatch alarms
 */
async function checkCloudWatchAlarms(
  profile: string,
  region: string
): Promise<WABPFinding[]> {
  const client = getClientFactory().getCloudWatchClient({ profile, region });
  const findings: WABPFinding[] = [];
  const checkDef = OPS_EXCELLENCE_CHECKS.find((c) => c.id === 'WA-OPS-002')!;

  try {
    const response = await client.send(
      new DescribeAlarmsCommand({ MaxRecords: 1 })
    );
    const alarms = response.MetricAlarms || [];

    if (alarms.length === 0) {
      findings.push({
        checkId: checkDef.id,
        title: checkDef.title,
        description: 'No CloudWatch metric alarms are configured in this region.',
        pillar: 'operationalExcellence',
        severity: checkDef.severity,
        status: 'FAIL',
        service: checkDef.service,
        region,
        remediationRecommendation: checkDef.remediationRecommendation,
        remediationUrl: checkDef.remediationUrl,
      });
    }
  } catch (error) {
    throw error;
  }

  return findings;
}

/**
 * WA-OPS-003: Check for EC2 instances without Auto Scaling
 */
async function checkInstancesWithoutAutoScaling(
  profile: string,
  region: string
): Promise<WABPFinding[]> {
  const ec2Client = getClientFactory().getEC2Client({ profile, region });
  const asgClient = getClientFactory().getAutoScalingClient({ profile, region });
  const findings: WABPFinding[] = [];
  const checkDef = OPS_EXCELLENCE_CHECKS.find((c) => c.id === 'WA-OPS-003')!;

  try {
    // Get all ASG instance IDs
    const asgInstanceIds = new Set<string>();
    let nextToken: string | undefined;

    do {
      const asgResponse = await asgClient.send(
        new DescribeAutoScalingGroupsCommand({ NextToken: nextToken })
      );
      for (const asg of asgResponse.AutoScalingGroups || []) {
        for (const instance of asg.Instances || []) {
          if (instance.InstanceId) {
            asgInstanceIds.add(instance.InstanceId);
          }
        }
      }
      nextToken = asgResponse.NextToken;
    } while (nextToken);

    // Get all running EC2 instances
    let ec2NextToken: string | undefined;
    do {
      const ec2Response = await ec2Client.send(
        new DescribeInstancesCommand({
          Filters: [{ Name: 'instance-state-name', Values: ['running'] }],
          NextToken: ec2NextToken,
          MaxResults: 100,
        })
      );

      for (const reservation of ec2Response.Reservations || []) {
        for (const instance of reservation.Instances || []) {
          if (instance.InstanceId && !asgInstanceIds.has(instance.InstanceId)) {
            const name = instance.Tags?.find((t) => t.Key === 'Name')?.Value || instance.InstanceId;
            findings.push({
              checkId: checkDef.id,
              title: checkDef.title,
              description: `EC2 instance "${name}" (${instance.InstanceId}) is not part of any Auto Scaling group.`,
              pillar: 'operationalExcellence',
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
      }
      ec2NextToken = ec2Response.NextToken;
    } while (ec2NextToken);
  } catch (error) {
    throw error;
  }

  return findings;
}

/**
 * WA-OPS-004: Check for resources missing required tags
 */
async function checkMissingTags(
  profile: string,
  region: string
): Promise<WABPFinding[]> {
  const client = getClientFactory().getEC2Client({ profile, region });
  const findings: WABPFinding[] = [];
  const checkDef = OPS_EXCELLENCE_CHECKS.find((c) => c.id === 'WA-OPS-004')!;
  const requiredTags = ['Name', 'Environment', 'Owner'];

  try {
    let nextToken: string | undefined;
    do {
      const response = await client.send(
        new DescribeInstancesCommand({
          Filters: [{ Name: 'instance-state-name', Values: ['running'] }],
          NextToken: nextToken,
          MaxResults: 100,
        })
      );

      for (const reservation of response.Reservations || []) {
        for (const instance of reservation.Instances || []) {
          const tagKeys = (instance.Tags || []).map((t) => t.Key || '');
          const missingTags = requiredTags.filter((t) => !tagKeys.includes(t));

          if (missingTags.length > 0) {
            const name = instance.Tags?.find((t) => t.Key === 'Name')?.Value || instance.InstanceId;
            findings.push({
              checkId: checkDef.id,
              title: checkDef.title,
              description: `EC2 instance "${name}" (${instance.InstanceId}) is missing tags: ${missingTags.join(', ')}.`,
              pillar: 'operationalExcellence',
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
      }
      nextToken = response.NextToken;
    } while (nextToken);
  } catch (error) {
    throw error;
  }

  return findings;
}

/**
 * Run all Operational Excellence checks
 */
export async function runOpsExcellenceChecks(
  profile: string,
  region: string
): Promise<WABPCheckResult> {
  const findings: WABPFinding[] = [];
  const errors: string[] = [];
  let checksRun = 0;
  let checksWithFindings = 0;

  const checks = [
    { name: 'CloudTrail', runner: checkCloudTrailLogging },
    { name: 'CloudWatch Alarms', runner: checkCloudWatchAlarms },
    { name: 'Auto Scaling', runner: checkInstancesWithoutAutoScaling },
    { name: 'Resource Tags', runner: checkMissingTags },
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

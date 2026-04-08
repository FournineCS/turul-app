// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { DescribeInstancesCommand } from '@aws-sdk/client-ec2';
import { getClientFactory } from '../../client-factory';
import type { WABPFinding } from '../../../../shared/types';
import { SUSTAINABILITY_CHECKS, type WABPCheckResult } from './types';

// Instance type sizes that suggest over-provisioning
const LARGE_INSTANCE_SUFFIXES = ['4xlarge', '8xlarge', '9xlarge', '10xlarge', '12xlarge', '16xlarge', '18xlarge', '24xlarge', 'metal'];

/**
 * WA-SUS-001: Check for over-provisioned EC2 instances
 */
async function checkOverProvisionedInstances(
  profile: string,
  region: string
): Promise<WABPFinding[]> {
  const client = getClientFactory().getEC2Client({ profile, region });
  const findings: WABPFinding[] = [];
  const checkDef = SUSTAINABILITY_CHECKS.find((c) => c.id === 'WA-SUS-001')!;

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
          const instanceType = instance.InstanceType || '';
          const isLarge = LARGE_INSTANCE_SUFFIXES.some((suffix) =>
            instanceType.endsWith(suffix)
          );

          if (isLarge) {
            const name = instance.Tags?.find((t) => t.Key === 'Name')?.Value || instance.InstanceId;
            findings.push({
              checkId: checkDef.id,
              title: checkDef.title,
              description: `EC2 instance "${name}" (${instance.InstanceId}) uses large instance type "${instanceType}". Consider right-sizing based on utilization.`,
              pillar: 'sustainability',
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
 * WA-SUS-002: Check for idle resources
 */
async function checkIdleResources(
  profile: string,
  region: string
): Promise<WABPFinding[]> {
  const client = getClientFactory().getEC2Client({ profile, region });
  const findings: WABPFinding[] = [];
  const checkDef = SUSTAINABILITY_CHECKS.find((c) => c.id === 'WA-SUS-002')!;

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
            description: `Stopped EC2 instance "${name}" (${instance.InstanceId}) has associated EBS volumes still consuming storage resources.`,
            pillar: 'sustainability',
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
 * Run all Sustainability checks
 */
export async function runSustainabilityChecks(
  profile: string,
  region: string
): Promise<WABPCheckResult> {
  const findings: WABPFinding[] = [];
  const errors: string[] = [];
  let checksRun = 0;
  let checksWithFindings = 0;

  const checks = [
    { name: 'Over-provisioned Instances', runner: checkOverProvisionedInstances },
    { name: 'Idle Resources', runner: checkIdleResources },
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

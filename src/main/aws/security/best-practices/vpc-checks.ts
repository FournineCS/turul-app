// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  DescribeVpcsCommand,
  DescribeFlowLogsCommand,
  DescribeSecurityGroupsCommand,
} from '@aws-sdk/client-ec2';
import { getClientFactory } from '../../client-factory';
import type { SecurityFinding } from '../../../../shared/types';
import type { CheckResult } from './types';

export async function runVPCChecks(
  profile: string,
  region: string
): Promise<CheckResult> {
  const findings: SecurityFinding[] = [];
  const errors: string[] = [];
  let checksRun = 0;
  let checksWithFindings = 0;

  try {
    const client = getClientFactory().getEC2Client({ profile, region });

    // Check VPC flow logs
    checksRun++;
    const { Vpcs } = await client.send(new DescribeVpcsCommand({}));
    if (Vpcs && Vpcs.length > 0) {
      const { FlowLogs } = await client.send(new DescribeFlowLogsCommand({}));
      const vpcIdsWithFlowLogs = new Set(
        (FlowLogs || [])
          .filter((fl) => fl.ResourceId)
          .map((fl) => fl.ResourceId)
      );

      const vpcsWithoutFlowLogs = Vpcs.filter((vpc) => !vpcIdsWithFlowLogs.has(vpc.VpcId));
      if (vpcsWithoutFlowLogs.length > 0) {
        checksWithFindings++;
        for (const vpc of vpcsWithoutFlowLogs) {
          const nameTag = vpc.Tags?.find((t) => t.Key === 'Name')?.Value || vpc.VpcId;
          findings.push({
            id: `BP-VPC-001-${vpc.VpcId}`,
            title: 'VPC without flow logs',
            description: `VPC "${nameTag}" (${vpc.VpcId}) does not have VPC Flow Logs enabled. Flow logs provide visibility into network traffic.`,
            severity: 'MEDIUM',
            status: 'ACTIVE',
            source: 'BEST_PRACTICES',
            region,
            resourceType: 'AWS::EC2::VPC',
            resourceId: vpc.VpcId,
            remediationRecommendation: 'Enable VPC Flow Logs to capture network traffic information.',
            remediationUrl: 'https://docs.aws.amazon.com/vpc/latest/userguide/flow-logs.html',
          });
        }
      }
    }

    // Check default security group restrictions
    checksRun++;
    const { SecurityGroups } = await client.send(
      new DescribeSecurityGroupsCommand({
        Filters: [{ Name: 'group-name', Values: ['default'] }],
      })
    );

    if (SecurityGroups) {
      for (const sg of SecurityGroups) {
        const hasIngressRules = (sg.IpPermissions || []).length > 0;
        const hasEgressRules = (sg.IpPermissionsEgress || []).some((rule) => {
          // Default egress allows all — check if there's a custom rule beyond default
          return (
            rule.IpProtocol !== '-1' ||
            (rule.IpRanges || []).some((r) => r.CidrIp !== '0.0.0.0/0')
          );
        });

        if (hasIngressRules) {
          checksWithFindings++;
          findings.push({
            id: `BP-VPC-002-${sg.GroupId}`,
            title: 'Default security group has inbound rules',
            description: `Default security group (${sg.GroupId}) in VPC ${sg.VpcId} has custom inbound rules. The default SG should have no inbound rules.`,
            severity: 'MEDIUM',
            status: 'ACTIVE',
            source: 'BEST_PRACTICES',
            region,
            resourceType: 'AWS::EC2::SecurityGroup',
            resourceId: sg.GroupId,
            remediationRecommendation: 'Remove all inbound rules from the default security group. Use custom security groups instead.',
            remediationUrl: 'https://docs.aws.amazon.com/vpc/latest/userguide/default-security-group.html',
          });
        }

        // Check default SG being used (any inbound or custom egress = in use)
        if (hasIngressRules || hasEgressRules) {
          // Already captured above
        }
      }
    }
  } catch (error) {
    errors.push(`VPC: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return { findings, errors, checksRun, checksWithFindings };
}

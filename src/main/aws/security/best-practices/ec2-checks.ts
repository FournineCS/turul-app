// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  DescribeSecurityGroupsCommand,
  DescribeVolumesCommand,
  type SecurityGroup,
  type IpPermission,
  type Volume,
} from '@aws-sdk/client-ec2';
import { getClientFactory } from '../../client-factory';
import type { SecurityFinding } from '../../../../shared/types';
import { EC2_CHECKS, type CheckResult } from './types';

/**
 * Check if a CIDR is open to the world (0.0.0.0/0 or ::/0)
 */
function isOpenToWorld(cidr: string): boolean {
  return cidr === '0.0.0.0/0' || cidr === '::/0';
}

/**
 * Check if an IP permission allows access from anywhere
 */
function isPermissionOpenToWorld(permission: IpPermission): boolean {
  const ipv4Open = permission.IpRanges?.some((range) => isOpenToWorld(range.CidrIp || '')) ?? false;
  const ipv6Open =
    permission.Ipv6Ranges?.some((range) => isOpenToWorld(range.CidrIpv6 || '')) ?? false;
  return ipv4Open || ipv6Open;
}

/**
 * Check if an IP permission matches a specific port
 */
function matchesPort(permission: IpPermission, port: number): boolean {
  // If FromPort and ToPort are not set, it's all traffic
  if (permission.FromPort === undefined && permission.ToPort === undefined) {
    return true;
  }

  // Single port or port range
  const fromPort = permission.FromPort ?? 0;
  const toPort = permission.ToPort ?? 65535;

  return port >= fromPort && port <= toPort;
}

/**
 * Check if an IP permission allows all traffic
 */
function isAllTraffic(permission: IpPermission): boolean {
  // All traffic: IpProtocol is '-1' or protocol is 'all'
  return permission.IpProtocol === '-1' || permission.IpProtocol === 'all';
}

/**
 * Create a security finding for a security group issue
 */
function createSecurityGroupFinding(
  checkId: string,
  securityGroup: SecurityGroup,
  region: string,
  permission: IpPermission
): SecurityFinding {
  const checkDef = EC2_CHECKS.find((c) => c.id === checkId);
  if (!checkDef) {
    throw new Error(`Unknown check ID: ${checkId}`);
  }

  const portInfo = isAllTraffic(permission)
    ? 'all ports'
    : permission.FromPort === permission.ToPort
      ? `port ${permission.FromPort}`
      : `ports ${permission.FromPort}-${permission.ToPort}`;

  const protocolInfo = permission.IpProtocol === '-1' ? 'all protocols' : permission.IpProtocol;

  return {
    id: `${checkId}-${securityGroup.GroupId}`,
    title: checkDef.title,
    description: `${checkDef.description} Security Group "${securityGroup.GroupName}" (${securityGroup.GroupId}) allows ${protocolInfo} on ${portInfo} from 0.0.0.0/0.`,
    severity: checkDef.severity,
    status: 'ACTIVE',
    source: 'BEST_PRACTICES',
    region,
    resourceType: 'AwsEc2SecurityGroup',
    resourceId: securityGroup.GroupId,
    resourceArn: `arn:aws:ec2:${region}::security-group/${securityGroup.GroupId}`,
    remediationRecommendation: checkDef.remediationRecommendation,
    remediationUrl: checkDef.remediationUrl,
    firstObservedAt: new Date().toISOString(),
    lastObservedAt: new Date().toISOString(),
    generatorId: checkId,
    productName: 'Best Practices Scanner',
  };
}

/**
 * Check security groups for overly permissive rules
 */
async function checkSecurityGroups(
  profile: string,
  region: string
): Promise<SecurityFinding[]> {
  const client = getClientFactory().getEC2Client({ profile, region });
  const findings: SecurityFinding[] = [];

  try {
    let nextToken: string | undefined;

    do {
      const response = await client.send(
        new DescribeSecurityGroupsCommand({
          NextToken: nextToken,
          MaxResults: 100,
        })
      );

      for (const sg of response.SecurityGroups || []) {
        // Check inbound rules
        for (const permission of sg.IpPermissions || []) {
          if (!isPermissionOpenToWorld(permission)) {
            continue;
          }

          // Check for all traffic open
          if (isAllTraffic(permission)) {
            findings.push(createSecurityGroupFinding('BP-SG-003', sg, region, permission));
            continue;
          }

          // Check for SSH (port 22)
          if (matchesPort(permission, 22) && permission.IpProtocol === 'tcp') {
            findings.push(createSecurityGroupFinding('BP-SG-001', sg, region, permission));
          }

          // Check for RDP (port 3389)
          if (matchesPort(permission, 3389) && permission.IpProtocol === 'tcp') {
            findings.push(createSecurityGroupFinding('BP-SG-002', sg, region, permission));
          }
        }
      }

      nextToken = response.NextToken;
    } while (nextToken);
  } catch (error) {
    console.error('Failed to check security groups:', error);
    throw error;
  }

  return findings;
}

/**
 * Check EBS volumes for encryption
 */
async function checkEBSEncryption(
  profile: string,
  region: string
): Promise<SecurityFinding[]> {
  const client = getClientFactory().getEC2Client({ profile, region });
  const findings: SecurityFinding[] = [];
  const checkDef = EC2_CHECKS.find((c) => c.id === 'BP-EBS-001');

  if (!checkDef) {
    return findings;
  }

  try {
    let nextToken: string | undefined;

    do {
      const response = await client.send(
        new DescribeVolumesCommand({
          NextToken: nextToken,
          MaxResults: 100,
        })
      );

      for (const volume of response.Volumes || []) {
        if (!volume.Encrypted) {
          const volumeName =
            volume.Tags?.find((t) => t.Key === 'Name')?.Value || volume.VolumeId;

          findings.push({
            id: `BP-EBS-001-${volume.VolumeId}`,
            title: checkDef.title,
            description: `${checkDef.description} Volume "${volumeName}" (${volume.VolumeId}) is not encrypted.`,
            severity: checkDef.severity,
            status: 'ACTIVE',
            source: 'BEST_PRACTICES',
            region,
            resourceType: 'AwsEc2Volume',
            resourceId: volume.VolumeId,
            resourceArn: `arn:aws:ec2:${region}::volume/${volume.VolumeId}`,
            remediationRecommendation: checkDef.remediationRecommendation,
            remediationUrl: checkDef.remediationUrl,
            firstObservedAt: new Date().toISOString(),
            lastObservedAt: new Date().toISOString(),
            generatorId: checkDef.id,
            productName: 'Best Practices Scanner',
          });
        }
      }

      nextToken = response.NextToken;
    } while (nextToken);
  } catch (error) {
    console.error('Failed to check EBS encryption:', error);
    throw error;
  }

  return findings;
}

/**
 * Run all EC2 security checks
 */
export async function runEC2Checks(
  profile: string,
  region: string
): Promise<CheckResult> {
  const findings: SecurityFinding[] = [];
  const errors: string[] = [];
  let checksRun = 0;
  let checksWithFindings = 0;

  // Check security groups
  try {
    checksRun++;
    const sgFindings = await checkSecurityGroups(profile, region);
    if (sgFindings.length > 0) {
      checksWithFindings++;
      findings.push(...sgFindings);
    }
  } catch (error) {
    errors.push(`Security Groups: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  // Check EBS encryption
  try {
    checksRun++;
    const ebsFindings = await checkEBSEncryption(profile, region);
    if (ebsFindings.length > 0) {
      checksWithFindings++;
      findings.push(...ebsFindings);
    }
  } catch (error) {
    errors.push(`EBS Encryption: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return {
    findings,
    errors,
    checksRun,
    checksWithFindings,
  };
}

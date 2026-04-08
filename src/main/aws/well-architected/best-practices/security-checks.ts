// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  ListBucketsCommand,
  GetBucketEncryptionCommand,
  GetPublicAccessBlockCommand,
} from '@aws-sdk/client-s3';
import {
  DescribeVolumesCommand,
  DescribeSecurityGroupsCommand,
} from '@aws-sdk/client-ec2';
import { DescribeDBInstancesCommand } from '@aws-sdk/client-rds';
import { GetAccountPasswordPolicyCommand } from '@aws-sdk/client-iam';
import { getClientFactory } from '../../client-factory';
import type { WABPFinding } from '../../../../shared/types';
import { SECURITY_CHECKS, type WABPCheckResult } from './types';

/**
 * WA-SEC-001: Check S3 bucket encryption
 */
async function checkS3Encryption(
  profile: string,
  region: string
): Promise<WABPFinding[]> {
  const client = getClientFactory().getS3Client({ profile, region });
  const findings: WABPFinding[] = [];
  const checkDef = SECURITY_CHECKS.find((c) => c.id === 'WA-SEC-001')!;

  try {
    const bucketsResponse = await client.send(new ListBucketsCommand({}));
    for (const bucket of bucketsResponse.Buckets || []) {
      if (!bucket.Name) continue;
      try {
        await client.send(
          new GetBucketEncryptionCommand({ Bucket: bucket.Name })
        );
      } catch (error: unknown) {
        const err = error as { name?: string };
        if (err.name === 'ServerSideEncryptionConfigurationNotFoundError') {
          findings.push({
            checkId: checkDef.id,
            title: checkDef.title,
            description: `S3 bucket "${bucket.Name}" does not have default server-side encryption enabled.`,
            pillar: 'security',
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
      }
    }
  } catch (error) {
    throw error;
  }

  return findings;
}

/**
 * WA-SEC-002: Check S3 public access block
 */
async function checkS3PublicAccess(
  profile: string,
  region: string
): Promise<WABPFinding[]> {
  const client = getClientFactory().getS3Client({ profile, region });
  const findings: WABPFinding[] = [];
  const checkDef = SECURITY_CHECKS.find((c) => c.id === 'WA-SEC-002')!;

  try {
    const bucketsResponse = await client.send(new ListBucketsCommand({}));
    for (const bucket of bucketsResponse.Buckets || []) {
      if (!bucket.Name) continue;
      try {
        const publicAccess = await client.send(
          new GetPublicAccessBlockCommand({ Bucket: bucket.Name })
        );
        const config = publicAccess.PublicAccessBlockConfiguration;
        if (
          !config?.BlockPublicAcls ||
          !config?.BlockPublicPolicy ||
          !config?.IgnorePublicAcls ||
          !config?.RestrictPublicBuckets
        ) {
          findings.push({
            checkId: checkDef.id,
            title: checkDef.title,
            description: `S3 bucket "${bucket.Name}" does not have all Block Public Access settings enabled.`,
            pillar: 'security',
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
      } catch (error: unknown) {
        const err = error as { name?: string };
        if (err.name === 'NoSuchPublicAccessBlockConfiguration') {
          findings.push({
            checkId: checkDef.id,
            title: checkDef.title,
            description: `S3 bucket "${bucket.Name}" has no Block Public Access configuration.`,
            pillar: 'security',
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
      }
    }
  } catch (error) {
    throw error;
  }

  return findings;
}

/**
 * WA-SEC-003: Check EBS volume encryption
 */
async function checkEBSEncryption(
  profile: string,
  region: string
): Promise<WABPFinding[]> {
  const client = getClientFactory().getEC2Client({ profile, region });
  const findings: WABPFinding[] = [];
  const checkDef = SECURITY_CHECKS.find((c) => c.id === 'WA-SEC-003')!;

  try {
    let nextToken: string | undefined;
    do {
      const response = await client.send(
        new DescribeVolumesCommand({ NextToken: nextToken, MaxResults: 100 })
      );
      for (const volume of response.Volumes || []) {
        if (!volume.Encrypted) {
          const name = volume.Tags?.find((t) => t.Key === 'Name')?.Value || volume.VolumeId;
          findings.push({
            checkId: checkDef.id,
            title: checkDef.title,
            description: `EBS volume "${name}" (${volume.VolumeId}) is not encrypted.`,
            pillar: 'security',
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
      nextToken = response.NextToken;
    } while (nextToken);
  } catch (error) {
    throw error;
  }

  return findings;
}

/**
 * WA-SEC-004: Check RDS encryption
 */
async function checkRDSEncryption(
  profile: string,
  region: string
): Promise<WABPFinding[]> {
  const client = getClientFactory().getRDSClient({ profile, region });
  const findings: WABPFinding[] = [];
  const checkDef = SECURITY_CHECKS.find((c) => c.id === 'WA-SEC-004')!;

  try {
    let marker: string | undefined;
    do {
      const response = await client.send(
        new DescribeDBInstancesCommand({ Marker: marker, MaxRecords: 100 })
      );
      for (const db of response.DBInstances || []) {
        if (!db.StorageEncrypted) {
          findings.push({
            checkId: checkDef.id,
            title: checkDef.title,
            description: `RDS instance "${db.DBInstanceIdentifier}" is not encrypted at rest.`,
            pillar: 'security',
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
 * WA-SEC-005: Check security groups for unrestricted inbound
 */
async function checkSecurityGroups(
  profile: string,
  region: string
): Promise<WABPFinding[]> {
  const client = getClientFactory().getEC2Client({ profile, region });
  const findings: WABPFinding[] = [];
  const checkDef = SECURITY_CHECKS.find((c) => c.id === 'WA-SEC-005')!;

  try {
    let nextToken: string | undefined;
    do {
      const response = await client.send(
        new DescribeSecurityGroupsCommand({ NextToken: nextToken, MaxResults: 100 })
      );
      for (const sg of response.SecurityGroups || []) {
        for (const permission of sg.IpPermissions || []) {
          const ipv4Open = permission.IpRanges?.some((r) => r.CidrIp === '0.0.0.0/0') ?? false;
          const ipv6Open = permission.Ipv6Ranges?.some((r) => r.CidrIpv6 === '::/0') ?? false;

          if (ipv4Open || ipv6Open) {
            const isAllTraffic = permission.IpProtocol === '-1';
            const isSSH = permission.IpProtocol === 'tcp' && permission.FromPort !== undefined && permission.FromPort <= 22 && (permission.ToPort ?? 65535) >= 22;
            const isRDP = permission.IpProtocol === 'tcp' && permission.FromPort !== undefined && permission.FromPort <= 3389 && (permission.ToPort ?? 65535) >= 3389;

            if (isAllTraffic || isSSH || isRDP) {
              const portInfo = isAllTraffic ? 'all traffic' : isSSH ? 'SSH (22)' : 'RDP (3389)';
              findings.push({
                checkId: checkDef.id,
                title: checkDef.title,
                description: `Security group "${sg.GroupName}" (${sg.GroupId}) allows ${portInfo} from 0.0.0.0/0.`,
                pillar: 'security',
                severity: checkDef.severity,
                status: 'FAIL',
                service: checkDef.service,
                resourceId: sg.GroupId,
                resourceArn: `arn:aws:ec2:${region}::security-group/${sg.GroupId}`,
                region,
                remediationRecommendation: checkDef.remediationRecommendation,
                remediationUrl: checkDef.remediationUrl,
              });
              break; // One finding per SG
            }
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
 * WA-SEC-006: Check IAM password policy
 */
async function checkIAMPasswordPolicy(
  profile: string,
  region: string
): Promise<WABPFinding[]> {
  const client = getClientFactory().getIAMClient({ profile, region });
  const findings: WABPFinding[] = [];
  const checkDef = SECURITY_CHECKS.find((c) => c.id === 'WA-SEC-006')!;

  try {
    const response = await client.send(new GetAccountPasswordPolicyCommand({}));
    const policy = response.PasswordPolicy;

    if (
      !policy ||
      (policy.MinimumPasswordLength ?? 0) < 14 ||
      !policy.RequireUppercaseCharacters ||
      !policy.RequireLowercaseCharacters ||
      !policy.RequireNumbers ||
      !policy.RequireSymbols
    ) {
      findings.push({
        checkId: checkDef.id,
        title: checkDef.title,
        description: 'IAM password policy does not meet minimum security requirements (14+ chars, mixed case, numbers, symbols).',
        pillar: 'security',
        severity: checkDef.severity,
        status: 'FAIL',
        service: checkDef.service,
        region,
        remediationRecommendation: checkDef.remediationRecommendation,
        remediationUrl: checkDef.remediationUrl,
      });
    }
  } catch (error: unknown) {
    const err = error as { name?: string };
    if (err.name === 'NoSuchEntityException') {
      findings.push({
        checkId: checkDef.id,
        title: checkDef.title,
        description: 'No IAM password policy is configured for this account.',
        pillar: 'security',
        severity: checkDef.severity,
        status: 'FAIL',
        service: checkDef.service,
        region,
        remediationRecommendation: checkDef.remediationRecommendation,
        remediationUrl: checkDef.remediationUrl,
      });
    } else {
      throw error;
    }
  }

  return findings;
}

/**
 * Run all Security checks
 */
export async function runSecurityChecks(
  profile: string,
  region: string
): Promise<WABPCheckResult> {
  const findings: WABPFinding[] = [];
  const errors: string[] = [];
  let checksRun = 0;
  let checksWithFindings = 0;

  const checks = [
    { name: 'S3 Encryption', runner: checkS3Encryption },
    { name: 'S3 Public Access', runner: checkS3PublicAccess },
    { name: 'EBS Encryption', runner: checkEBSEncryption },
    { name: 'RDS Encryption', runner: checkRDSEncryption },
    { name: 'Security Groups', runner: checkSecurityGroups },
    { name: 'IAM Password Policy', runner: checkIAMPasswordPolicy },
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

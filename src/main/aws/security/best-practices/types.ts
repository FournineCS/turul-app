// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import type { FindingSeverity, SecurityFinding } from '../../../../shared/types';

/**
 * Definition for a security best practice check.
 */
export interface SecurityCheckDefinition {
  id: string;
  title: string;
  description: string;
  severity: FindingSeverity;
  service: string;
  remediationRecommendation: string;
  remediationUrl?: string;
}

/**
 * Result from running security checks.
 */
export interface CheckResult {
  findings: SecurityFinding[];
  errors: string[];
  checksRun: number;
  checksWithFindings: number;
}

/**
 * Progress callback for best practices scan.
 */
export type ScanProgressCallback = (progress: {
  phase: string;
  service: string;
  percent: number;
}) => void;

/**
 * EC2 Security Best Practice Checks
 */
export const EC2_CHECKS: SecurityCheckDefinition[] = [
  {
    id: 'BP-SG-001',
    title: 'Security Group allows SSH (22) from 0.0.0.0/0',
    description:
      'A security group rule allows inbound SSH access from any IP address. This increases the attack surface and could allow unauthorized access.',
    severity: 'HIGH',
    service: 'EC2',
    remediationRecommendation:
      'Restrict SSH access to known IP addresses or CIDR blocks. Use a bastion host or VPN for remote access.',
    remediationUrl:
      'https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-security-groups.html',
  },
  {
    id: 'BP-SG-002',
    title: 'Security Group allows RDP (3389) from 0.0.0.0/0',
    description:
      'A security group rule allows inbound RDP access from any IP address. This is a common attack vector for ransomware.',
    severity: 'HIGH',
    service: 'EC2',
    remediationRecommendation:
      'Restrict RDP access to known IP addresses or CIDR blocks. Use a bastion host or VPN for remote access.',
    remediationUrl:
      'https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-security-groups.html',
  },
  {
    id: 'BP-SG-003',
    title: 'Security Group allows all traffic from 0.0.0.0/0',
    description:
      'A security group rule allows all inbound traffic from any IP address. This completely exposes the resource to the internet.',
    severity: 'CRITICAL',
    service: 'EC2',
    remediationRecommendation:
      'Remove the rule allowing all traffic from 0.0.0.0/0. Only allow specific ports and IP ranges required for your application.',
    remediationUrl:
      'https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-security-groups.html',
  },
  {
    id: 'BP-EBS-001',
    title: 'EBS volume is not encrypted',
    description:
      'An EBS volume does not have encryption enabled. Unencrypted volumes may expose sensitive data if the underlying storage is compromised.',
    severity: 'MEDIUM',
    service: 'EC2',
    remediationRecommendation:
      'Enable encryption for all EBS volumes. For existing unencrypted volumes, create an encrypted snapshot and restore from it.',
    remediationUrl:
      'https://docs.aws.amazon.com/ebs/latest/userguide/ebs-encryption.html',
  },
];

/**
 * S3 Security Best Practice Checks
 */
export const S3_CHECKS: SecurityCheckDefinition[] = [
  {
    id: 'BP-S3-001',
    title: 'S3 bucket without server-side encryption',
    description:
      'An S3 bucket does not have default server-side encryption enabled. Objects stored without encryption may expose sensitive data.',
    severity: 'MEDIUM',
    service: 'S3',
    remediationRecommendation:
      'Enable default server-side encryption (SSE-S3 or SSE-KMS) for the bucket.',
    remediationUrl:
      'https://docs.aws.amazon.com/AmazonS3/latest/userguide/bucket-encryption.html',
  },
  {
    id: 'BP-S3-002',
    title: 'S3 bucket has public access enabled',
    description:
      'An S3 bucket allows public access. This could lead to data exposure if objects are inadvertently made public.',
    severity: 'HIGH',
    service: 'S3',
    remediationRecommendation:
      'Enable S3 Block Public Access at the bucket level unless public access is explicitly required.',
    remediationUrl:
      'https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html',
  },
  {
    id: 'BP-S3-003',
    title: 'S3 bucket without versioning enabled',
    description:
      'An S3 bucket does not have versioning enabled. Without versioning, accidentally deleted or overwritten objects cannot be recovered.',
    severity: 'LOW',
    service: 'S3',
    remediationRecommendation:
      'Enable versioning on the bucket to protect against accidental deletion and enable recovery.',
    remediationUrl:
      'https://docs.aws.amazon.com/AmazonS3/latest/userguide/Versioning.html',
  },
];

/**
 * IAM Security Best Practice Checks
 */
export const IAM_CHECKS: SecurityCheckDefinition[] = [
  {
    id: 'BP-IAM-001',
    title: 'Root account has access keys',
    description:
      'The AWS root account has access keys configured. Root access keys pose a critical security risk as they have unrestricted access.',
    severity: 'CRITICAL',
    service: 'IAM',
    remediationRecommendation:
      'Delete root account access keys and use IAM users or roles for programmatic access.',
    remediationUrl:
      'https://docs.aws.amazon.com/IAM/latest/UserGuide/id_root-user.html',
  },
  {
    id: 'BP-IAM-002',
    title: 'IAM user without MFA enabled',
    description:
      'An IAM user does not have multi-factor authentication (MFA) enabled. Accounts without MFA are vulnerable to credential theft.',
    severity: 'HIGH',
    service: 'IAM',
    remediationRecommendation:
      'Enable MFA for all IAM users, especially those with console access or administrative permissions.',
    remediationUrl:
      'https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_mfa.html',
  },
  {
    id: 'BP-IAM-003',
    title: 'IAM user with console access but no MFA',
    description:
      'An IAM user has console password enabled but no MFA configured. This combination allows password-only access to the AWS Console.',
    severity: 'CRITICAL',
    service: 'IAM',
    remediationRecommendation:
      'Enable MFA immediately for users with console access. Consider enforcing MFA via IAM policies.',
    remediationUrl:
      'https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_mfa_enable.html',
  },
];

/**
 * RDS Security Best Practice Checks
 */
export const RDS_CHECKS: SecurityCheckDefinition[] = [
  {
    id: 'BP-RDS-001',
    title: 'RDS instance without encryption',
    description:
      'An RDS database instance does not have encryption at rest enabled. Unencrypted databases may expose sensitive data.',
    severity: 'MEDIUM',
    service: 'RDS',
    remediationRecommendation:
      'Enable encryption for RDS instances. For existing unencrypted instances, create an encrypted snapshot and restore.',
    remediationUrl:
      'https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Overview.Encryption.html',
  },
  {
    id: 'BP-RDS-002',
    title: 'RDS instance is publicly accessible',
    description:
      'An RDS database instance is configured as publicly accessible. This exposes the database to internet-based attacks.',
    severity: 'HIGH',
    service: 'RDS',
    remediationRecommendation:
      'Set PubliclyAccessible to false and access databases through private subnets or VPN.',
    remediationUrl:
      'https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_VPC.WorkingWithRDSInstanceinaVPC.html',
  },
];

/**
 * CloudTrail Security Best Practice Checks
 */
export const CLOUDTRAIL_CHECKS: SecurityCheckDefinition[] = [
  {
    id: 'BP-CT-001',
    title: 'Multi-region CloudTrail not enabled',
    description: 'CloudTrail should be configured with multi-region logging to capture activity across all AWS regions.',
    severity: 'HIGH',
    service: 'CloudTrail',
    remediationRecommendation: 'Create a multi-region trail that logs to S3.',
    remediationUrl: 'https://docs.aws.amazon.com/awscloudtrail/latest/userguide/cloudtrail-create-and-update-a-trail.html',
  },
  {
    id: 'BP-CT-002',
    title: 'CloudTrail log file validation disabled',
    description: 'Log file validation should be enabled to ensure log integrity.',
    severity: 'MEDIUM',
    service: 'CloudTrail',
    remediationRecommendation: 'Enable log file validation on all trails.',
    remediationUrl: 'https://docs.aws.amazon.com/awscloudtrail/latest/userguide/cloudtrail-log-file-validation-intro.html',
  },
  {
    id: 'BP-CT-003',
    title: 'CloudTrail logs not encrypted with KMS',
    description: 'CloudTrail should encrypt logs at rest with a KMS key.',
    severity: 'MEDIUM',
    service: 'CloudTrail',
    remediationRecommendation: 'Enable KMS encryption on CloudTrail trails.',
    remediationUrl: 'https://docs.aws.amazon.com/awscloudtrail/latest/userguide/encrypting-cloudtrail-log-files-with-aws-kms.html',
  },
  {
    id: 'BP-CT-004',
    title: 'CloudTrail logging is stopped',
    description: 'A CloudTrail trail exists but is not actively logging.',
    severity: 'HIGH',
    service: 'CloudTrail',
    remediationRecommendation: 'Start logging on the trail.',
  },
];

/**
 * VPC Security Best Practice Checks
 */
export const VPC_CHECKS: SecurityCheckDefinition[] = [
  {
    id: 'BP-VPC-001',
    title: 'VPC without flow logs enabled',
    description: 'VPC Flow Logs should be enabled to monitor network traffic.',
    severity: 'MEDIUM',
    service: 'VPC',
    remediationRecommendation: 'Enable VPC Flow Logs for all VPCs.',
    remediationUrl: 'https://docs.aws.amazon.com/vpc/latest/userguide/flow-logs.html',
  },
  {
    id: 'BP-VPC-002',
    title: 'Default security group has inbound rules',
    description: 'The default security group should restrict all inbound traffic.',
    severity: 'MEDIUM',
    service: 'VPC',
    remediationRecommendation: 'Remove all inbound rules from the default security group.',
    remediationUrl: 'https://docs.aws.amazon.com/vpc/latest/userguide/default-security-group.html',
  },
];

/**
 * KMS Security Best Practice Checks
 */
export const KMS_CHECKS: SecurityCheckDefinition[] = [
  {
    id: 'BP-KMS-001',
    title: 'KMS key rotation not enabled',
    description: 'Customer-managed KMS keys should have automatic rotation enabled.',
    severity: 'MEDIUM',
    service: 'KMS',
    remediationRecommendation: 'Enable automatic key rotation for customer-managed keys.',
    remediationUrl: 'https://docs.aws.amazon.com/kms/latest/developerguide/rotate-keys.html',
  },
];

/**
 * All check definitions for easy lookup
 */
export const ALL_CHECKS: SecurityCheckDefinition[] = [
  ...EC2_CHECKS,
  ...S3_CHECKS,
  ...IAM_CHECKS,
  ...RDS_CHECKS,
  ...CLOUDTRAIL_CHECKS,
  ...VPC_CHECKS,
  ...KMS_CHECKS,
];

/**
 * Get check definition by ID
 */
export function getCheckById(checkId: string): SecurityCheckDefinition | undefined {
  return ALL_CHECKS.find((check) => check.id === checkId);
}

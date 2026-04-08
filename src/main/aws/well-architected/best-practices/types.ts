// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import type { WABPCheckDefinition, WABPFinding } from '../../../../shared/types';

/**
 * Result from running a set of best practice checks.
 */
export interface WABPCheckResult {
  findings: WABPFinding[];
  errors: string[];
  checksRun: number;
  checksWithFindings: number;
}

/**
 * Progress callback for best practices scan.
 */
export type WABPProgressCallback = (progress: {
  phase: string;
  pillar: string;
  service: string;
  percent: number;
}) => void;

// =====================================================
// Operational Excellence Checks
// =====================================================
export const OPS_EXCELLENCE_CHECKS: WABPCheckDefinition[] = [
  {
    id: 'WA-OPS-001',
    title: 'CloudTrail not logging in region',
    description:
      'CloudTrail is not enabled or not logging in this region. Without CloudTrail, you have no audit trail of API activity.',
    pillar: 'operationalExcellence',
    severity: 'HIGH',
    service: 'CloudTrail',
    remediationRecommendation:
      'Enable CloudTrail logging in all regions. Create a multi-region trail that logs to a centralized S3 bucket.',
    remediationUrl:
      'https://docs.aws.amazon.com/awscloudtrail/latest/userguide/cloudtrail-create-a-trail-using-the-console-first-time.html',
  },
  {
    id: 'WA-OPS-002',
    title: 'No CloudWatch alarms configured',
    description:
      'No CloudWatch alarms are configured in this region. Alarms are essential for monitoring and responding to operational events.',
    pillar: 'operationalExcellence',
    severity: 'MEDIUM',
    service: 'CloudWatch',
    remediationRecommendation:
      'Create CloudWatch alarms for key metrics such as CPU utilization, error rates, and latency. Set up SNS notifications for alarm state changes.',
    remediationUrl:
      'https://docs.aws.amazon.com/AmazonCloudWatch/latest/monitoring/AlarmThatSendsEmail.html',
  },
  {
    id: 'WA-OPS-003',
    title: 'EC2 instances without Auto Scaling',
    description:
      'EC2 instances are running outside of an Auto Scaling group. Without Auto Scaling, instances cannot automatically recover from failures.',
    pillar: 'operationalExcellence',
    severity: 'MEDIUM',
    service: 'EC2',
    remediationRecommendation:
      'Place EC2 instances in Auto Scaling groups to enable automatic recovery and scaling. Even single-instance workloads benefit from Auto Scaling for self-healing.',
    remediationUrl:
      'https://docs.aws.amazon.com/autoscaling/ec2/userguide/auto-scaling-groups.html',
  },
  {
    id: 'WA-OPS-004',
    title: 'Resources missing required tags',
    description:
      'EC2 instances are missing standard tags (Name, Environment, Owner). Proper tagging is essential for cost allocation, automation, and operational management.',
    pillar: 'operationalExcellence',
    severity: 'LOW',
    service: 'EC2',
    remediationRecommendation:
      'Implement a tagging strategy and apply required tags to all resources. Use AWS Tag Editor or tag policies to enforce tagging compliance.',
    remediationUrl:
      'https://docs.aws.amazon.com/general/latest/gr/aws_tagging.html',
  },
];

// =====================================================
// Security Checks
// =====================================================
export const SECURITY_CHECKS: WABPCheckDefinition[] = [
  {
    id: 'WA-SEC-001',
    title: 'S3 bucket encryption not enabled',
    description:
      'An S3 bucket does not have default server-side encryption enabled. Data at rest should always be encrypted.',
    pillar: 'security',
    severity: 'MEDIUM',
    service: 'S3',
    remediationRecommendation:
      'Enable default server-side encryption (SSE-S3 or SSE-KMS) for the bucket.',
    remediationUrl:
      'https://docs.aws.amazon.com/AmazonS3/latest/userguide/bucket-encryption.html',
  },
  {
    id: 'WA-SEC-002',
    title: 'S3 public access not blocked',
    description:
      'An S3 bucket does not have Block Public Access enabled. This increases the risk of accidental data exposure.',
    pillar: 'security',
    severity: 'HIGH',
    service: 'S3',
    remediationRecommendation:
      'Enable S3 Block Public Access at the bucket level unless public access is explicitly required.',
    remediationUrl:
      'https://docs.aws.amazon.com/AmazonS3/latest/userguide/access-control-block-public-access.html',
  },
  {
    id: 'WA-SEC-003',
    title: 'EBS volume not encrypted',
    description:
      'An EBS volume does not have encryption enabled. Unencrypted volumes may expose sensitive data.',
    pillar: 'security',
    severity: 'MEDIUM',
    service: 'EC2',
    remediationRecommendation:
      'Enable encryption for all EBS volumes. Enable default EBS encryption in the account settings.',
    remediationUrl:
      'https://docs.aws.amazon.com/ebs/latest/userguide/ebs-encryption.html',
  },
  {
    id: 'WA-SEC-004',
    title: 'RDS instance not encrypted',
    description:
      'An RDS database instance does not have encryption at rest enabled.',
    pillar: 'security',
    severity: 'MEDIUM',
    service: 'RDS',
    remediationRecommendation:
      'Enable encryption for RDS instances. For existing unencrypted instances, create an encrypted snapshot and restore.',
    remediationUrl:
      'https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Overview.Encryption.html',
  },
  {
    id: 'WA-SEC-005',
    title: 'Security group allows unrestricted inbound',
    description:
      'A security group allows inbound traffic from 0.0.0.0/0 on sensitive ports (SSH, RDP) or all traffic.',
    pillar: 'security',
    severity: 'HIGH',
    service: 'EC2',
    remediationRecommendation:
      'Restrict security group rules to only allow traffic from known IP ranges. Use VPN or bastion hosts for remote access.',
    remediationUrl:
      'https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-security-groups.html',
  },
  {
    id: 'WA-SEC-006',
    title: 'IAM password policy not configured',
    description:
      'The account does not have a custom IAM password policy configured, or the policy does not meet minimum requirements.',
    pillar: 'security',
    severity: 'MEDIUM',
    service: 'IAM',
    remediationRecommendation:
      'Configure an IAM password policy requiring minimum length (14+), uppercase, lowercase, numbers, and symbols. Enable password expiration.',
    remediationUrl:
      'https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_passwords_account-policy.html',
  },
];

// =====================================================
// Reliability Checks
// =====================================================
export const RELIABILITY_CHECKS: WABPCheckDefinition[] = [
  {
    id: 'WA-REL-001',
    title: 'RDS instance not Multi-AZ',
    description:
      'An RDS database instance is not configured for Multi-AZ deployment. Single-AZ deployments are vulnerable to AZ failures.',
    pillar: 'reliability',
    severity: 'HIGH',
    service: 'RDS',
    remediationRecommendation:
      'Enable Multi-AZ deployment for production RDS instances to provide automatic failover.',
    remediationUrl:
      'https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.MultiAZ.html',
  },
  {
    id: 'WA-REL-002',
    title: 'RDS automated backups disabled',
    description:
      'An RDS instance has automated backups disabled (retention period is 0). Without backups, data recovery is not possible.',
    pillar: 'reliability',
    severity: 'HIGH',
    service: 'RDS',
    remediationRecommendation:
      'Enable automated backups with a retention period of at least 7 days for production databases.',
    remediationUrl:
      'https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/USER_WorkingWithAutomatedBackups.html',
  },
  {
    id: 'WA-REL-003',
    title: 'EBS volume has no snapshots',
    description:
      'An EBS volume has no snapshots. Without snapshots, data cannot be recovered in case of volume failure.',
    pillar: 'reliability',
    severity: 'MEDIUM',
    service: 'EC2',
    remediationRecommendation:
      'Create regular EBS snapshots using AWS Backup or Amazon Data Lifecycle Manager (DLM) policies.',
    remediationUrl:
      'https://docs.aws.amazon.com/ebs/latest/userguide/ebs-snapshots.html',
  },
  {
    id: 'WA-REL-004',
    title: 'Auto Scaling group in single AZ',
    description:
      'An Auto Scaling group is configured to use only a single Availability Zone, reducing fault tolerance.',
    pillar: 'reliability',
    severity: 'HIGH',
    service: 'AutoScaling',
    remediationRecommendation:
      'Configure Auto Scaling groups to span at least 2 Availability Zones for high availability.',
    remediationUrl:
      'https://docs.aws.amazon.com/autoscaling/ec2/userguide/auto-scaling-benefits.html',
  },
  {
    id: 'WA-REL-005',
    title: 'S3 bucket versioning not enabled',
    description:
      'An S3 bucket does not have versioning enabled. Without versioning, deleted or overwritten objects cannot be recovered.',
    pillar: 'reliability',
    severity: 'LOW',
    service: 'S3',
    remediationRecommendation:
      'Enable versioning on S3 buckets to protect against accidental deletion and enable point-in-time recovery.',
    remediationUrl:
      'https://docs.aws.amazon.com/AmazonS3/latest/userguide/Versioning.html',
  },
];

// =====================================================
// Performance Efficiency Checks
// =====================================================
export const PERFORMANCE_CHECKS: WABPCheckDefinition[] = [
  {
    id: 'WA-PERF-001',
    title: 'EC2 using previous-gen instance type',
    description:
      'An EC2 instance is using a previous-generation instance type that may not offer the best price-performance ratio.',
    pillar: 'performance',
    severity: 'LOW',
    service: 'EC2',
    remediationRecommendation:
      'Evaluate upgrading to current-generation instance types (e.g., m6i, c6i, r6i) for better performance and cost efficiency.',
    remediationUrl:
      'https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/instance-types.html',
  },
  {
    id: 'WA-PERF-002',
    title: 'RDS using previous-gen instance class',
    description:
      'An RDS instance is using a previous-generation instance class that may not offer optimal performance.',
    pillar: 'performance',
    severity: 'LOW',
    service: 'RDS',
    remediationRecommendation:
      'Evaluate upgrading to current-generation DB instance classes (e.g., db.m6g, db.r6g) for better performance.',
    remediationUrl:
      'https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.DBInstanceClass.html',
  },
  {
    id: 'WA-PERF-003',
    title: 'ElastiCache outdated engine version',
    description:
      'An ElastiCache cluster is running an outdated engine version that may lack performance improvements and security patches.',
    pillar: 'performance',
    severity: 'LOW',
    service: 'ElastiCache',
    remediationRecommendation:
      'Upgrade ElastiCache clusters to the latest supported engine version for performance improvements and security patches.',
    remediationUrl:
      'https://docs.aws.amazon.com/AmazonElastiCache/latest/red-ug/supported-engine-versions.html',
  },
];

// =====================================================
// Cost Optimization Checks
// =====================================================
export const COST_CHECKS: WABPCheckDefinition[] = [
  {
    id: 'WA-COST-001',
    title: 'Unattached EBS volume',
    description:
      'An EBS volume is not attached to any EC2 instance. Unattached volumes continue to incur storage charges.',
    pillar: 'costOptimization',
    severity: 'MEDIUM',
    service: 'EC2',
    remediationRecommendation:
      'Delete unattached EBS volumes that are no longer needed, or create a snapshot before deleting for future reference.',
    remediationUrl:
      'https://docs.aws.amazon.com/ebs/latest/userguide/ebs-deleting-volume.html',
  },
  {
    id: 'WA-COST-002',
    title: 'Unused Elastic IP address',
    description:
      'An Elastic IP address is not associated with a running instance. Unused EIPs incur hourly charges.',
    pillar: 'costOptimization',
    severity: 'LOW',
    service: 'EC2',
    remediationRecommendation:
      'Release unused Elastic IP addresses to avoid unnecessary charges.',
    remediationUrl:
      'https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/elastic-ip-addresses-eip.html',
  },
  {
    id: 'WA-COST-003',
    title: 'Stopped EC2 instance (idle)',
    description:
      'An EC2 instance has been in a stopped state. While stopped instances do not incur compute charges, EBS volumes remain billable.',
    pillar: 'costOptimization',
    severity: 'LOW',
    service: 'EC2',
    remediationRecommendation:
      'Terminate stopped instances that are no longer needed, or create an AMI for future use before terminating.',
    remediationUrl:
      'https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ec2-instance-lifecycle.html',
  },
  {
    id: 'WA-COST-004',
    title: 'Old EBS snapshots (>90 days)',
    description:
      'An EBS snapshot is older than 90 days. Old snapshots may no longer be needed and incur storage costs.',
    pillar: 'costOptimization',
    severity: 'LOW',
    service: 'EC2',
    remediationRecommendation:
      'Review old snapshots and delete those no longer needed. Use Amazon Data Lifecycle Manager to automate snapshot retention.',
    remediationUrl:
      'https://docs.aws.amazon.com/ebs/latest/userguide/snapshot-lifecycle.html',
  },
];

// =====================================================
// Sustainability Checks
// =====================================================
export const SUSTAINABILITY_CHECKS: WABPCheckDefinition[] = [
  {
    id: 'WA-SUS-001',
    title: 'Over-provisioned EC2 instance',
    description:
      'An EC2 instance may be over-provisioned based on its instance type size (4xlarge or larger). Over-provisioned resources waste energy.',
    pillar: 'sustainability',
    severity: 'LOW',
    service: 'EC2',
    remediationRecommendation:
      'Right-size EC2 instances based on actual utilization metrics. Use AWS Compute Optimizer for recommendations.',
    remediationUrl:
      'https://docs.aws.amazon.com/compute-optimizer/latest/ug/view-ec2-recommendations.html',
  },
  {
    id: 'WA-SUS-002',
    title: 'Idle resource consuming energy',
    description:
      'A stopped EC2 instance with attached EBS volumes continues to consume storage resources. Idle resources waste energy.',
    pillar: 'sustainability',
    severity: 'LOW',
    service: 'EC2',
    remediationRecommendation:
      'Terminate idle instances and clean up associated resources. Use scheduling to stop non-production resources outside business hours.',
    remediationUrl:
      'https://docs.aws.amazon.com/wellarchitected/latest/sustainability-pillar/sus_sus_resource_a2.html',
  },
];

// =====================================================
// All checks combined
// =====================================================
export const ALL_WA_CHECKS: WABPCheckDefinition[] = [
  ...OPS_EXCELLENCE_CHECKS,
  ...SECURITY_CHECKS,
  ...RELIABILITY_CHECKS,
  ...PERFORMANCE_CHECKS,
  ...COST_CHECKS,
  ...SUSTAINABILITY_CHECKS,
];

// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import type { ComplianceControl, ComplianceFrameworkMeta } from './types';

export const CIS_AWS_V3_META: ComplianceFrameworkMeta = {
  id: 'cis-aws-v3',
  name: 'CIS AWS Foundations Benchmark',
  version: '3.0',
  description: 'CIS Amazon Web Services Foundations Benchmark v3.0 - Level 1 controls',
  controlCount: 0, // Set dynamically below
};

/**
 * CIS AWS Foundations Benchmark v3.0 - Level 1 controls
 * Mapped to our best-practices check IDs
 */
export const CIS_CONTROLS: ComplianceControl[] = [
  // Section 1: Identity and Access Management
  {
    id: '1.4',
    section: '1 - Identity and Access Management',
    title: 'Ensure no root user account access key exists',
    level: 1,
    checkIds: ['BP-IAM-001'],
  },
  {
    id: '1.5',
    section: '1 - Identity and Access Management',
    title: 'Ensure MFA is enabled for the root user account',
    level: 1,
    checkIds: ['BP-IAM-001'], // Root account checks
  },
  {
    id: '1.10',
    section: '1 - Identity and Access Management',
    title: 'Ensure MFA is enabled for all IAM users with console access',
    level: 1,
    checkIds: ['BP-IAM-002', 'BP-IAM-003'],
  },
  {
    id: '1.12',
    section: '1 - Identity and Access Management',
    title: 'Ensure credentials unused for 45 days or greater are disabled',
    level: 1,
    checkIds: ['BP-IAM-002'], // Covered by MFA/credential checks
  },

  // Section 2: Storage
  {
    id: '2.1.1',
    section: '2 - Storage',
    title: 'Ensure S3 Bucket Policy is set to deny HTTP requests',
    level: 1,
    checkIds: ['BP-S3-001'], // Encryption check covers transport security
  },
  {
    id: '2.1.2',
    section: '2 - Storage',
    title: 'Ensure MFA Delete is enabled on S3 buckets',
    level: 1,
    checkIds: ['BP-S3-003'], // Versioning is prerequisite for MFA delete
  },
  {
    id: '2.1.4',
    section: '2 - Storage',
    title: 'Ensure all data in Amazon S3 has been discovered, classified and secured',
    level: 1,
    checkIds: ['BP-S3-002'], // Public access check
  },
  {
    id: '2.3.1',
    section: '2 - Storage',
    title: 'Ensure that encryption-at-rest is enabled for RDS Instances',
    level: 1,
    checkIds: ['BP-RDS-001'],
  },

  // Section 3: Logging
  {
    id: '3.1',
    section: '3 - Logging',
    title: 'Ensure CloudTrail is enabled in all regions',
    level: 1,
    checkIds: ['BP-CT-001'],
  },
  {
    id: '3.2',
    section: '3 - Logging',
    title: 'Ensure CloudTrail log file validation is enabled',
    level: 1,
    checkIds: ['BP-CT-002'],
  },
  {
    id: '3.4',
    section: '3 - Logging',
    title: 'Ensure CloudTrail trails are integrated with CloudWatch Logs',
    level: 1,
    checkIds: ['BP-CT-004'], // Trail must be logging
  },
  {
    id: '3.5',
    section: '3 - Logging',
    title: 'Ensure AWS Config is enabled in all regions',
    level: 1,
    checkIds: [], // Not yet implemented
  },
  {
    id: '3.7',
    section: '3 - Logging',
    title: 'Ensure CloudTrail logs are encrypted at rest using KMS CMKs',
    level: 1,
    checkIds: ['BP-CT-003'],
  },
  {
    id: '3.9',
    section: '3 - Logging',
    title: 'Ensure VPC flow logging is enabled in all VPCs',
    level: 1,
    checkIds: ['BP-VPC-001'],
  },

  // Section 4: Monitoring (CIS recommends CloudWatch alarms)
  {
    id: '4.3',
    section: '4 - Monitoring',
    title: 'Ensure a log metric filter and alarm exist for usage of root user',
    level: 1,
    checkIds: [], // CloudWatch alarm checks not yet implemented
  },

  // Section 5: Networking
  {
    id: '5.1',
    section: '5 - Networking',
    title: 'Ensure no Network ACLs allow ingress from 0.0.0.0/0 to remote server admin ports',
    level: 1,
    checkIds: ['BP-SG-001', 'BP-SG-002'], // Security group checks for SSH/RDP
  },
  {
    id: '5.2',
    section: '5 - Networking',
    title: 'Ensure no security groups allow ingress from 0.0.0.0/0 to remote server admin ports',
    level: 1,
    checkIds: ['BP-SG-001', 'BP-SG-002'],
  },
  {
    id: '5.3',
    section: '5 - Networking',
    title: 'Ensure no security groups allow ingress from ::/0 to remote server admin ports',
    level: 1,
    checkIds: ['BP-SG-003'], // All traffic check
  },
  {
    id: '5.4',
    section: '5 - Networking',
    title: 'Ensure the default security group of every VPC restricts all traffic',
    level: 1,
    checkIds: ['BP-VPC-002'],
  },

  // Additional
  {
    id: '2.4.1',
    section: '2 - Storage',
    title: 'Ensure that encryption is enabled for EBS volumes',
    level: 1,
    checkIds: ['BP-EBS-001'],
  },
  {
    id: '3.8',
    section: '3 - Logging',
    title: 'Ensure rotation for customer-created symmetric CMKs is enabled',
    level: 1,
    checkIds: ['BP-KMS-001'],
  },
  {
    id: '2.3.2',
    section: '2 - Storage',
    title: 'Ensure RDS instances are not publicly accessible',
    level: 1,
    checkIds: ['BP-RDS-002'],
  },
];

// Set the actual control count
CIS_AWS_V3_META.controlCount = CIS_CONTROLS.length;

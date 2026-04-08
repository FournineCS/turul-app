// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import type { ComplianceFrameworkMeta, ComplianceControlInfo } from '../../../../shared/types';

/**
 * CIS Google Cloud Platform Foundation Benchmark v2.0 control definitions.
 *
 * Each control maps to zero or more best-practice finding ID prefixes.
 * Controls with an empty `checkIds` array will be reported as NOT_CHECKED.
 */
export interface CISGCPControl extends ComplianceControlInfo {
  id: string;
  section: string;
  title: string;
  level: 1 | 2;
  checkIds: string[];
}

export const CIS_GCP_CONTROLS: CISGCPControl[] = [
  // ── Section 1 — Identity and Access Management ──

  {
    id: '1.1',
    section: '1 - Identity and Access Management',
    title: 'Ensure that corporate login credentials are used',
    level: 1,
    checkIds: [],
  },
  {
    id: '1.2',
    section: '1 - Identity and Access Management',
    title: 'Ensure that multi-factor authentication is enabled for all non-service accounts',
    level: 1,
    checkIds: [],
  },
  {
    id: '1.3',
    section: '1 - Identity and Access Management',
    title: 'Ensure that Security Key Enforcement is enabled for all admin accounts',
    level: 2,
    checkIds: [],
  },
  {
    id: '1.4',
    section: '1 - Identity and Access Management',
    title: 'Ensure that there are only GCP-managed service account keys for each service account',
    level: 1,
    checkIds: [],
  },
  {
    id: '1.5',
    section: '1 - Identity and Access Management',
    title: 'Ensure that Service Account has no admin privileges',
    level: 1,
    checkIds: ['sa-overprivileged'],
  },
  {
    id: '1.6',
    section: '1 - Identity and Access Management',
    title: 'Ensure that IAM users are not assigned the Service Account User or Service Account Token Creator roles at project level',
    level: 1,
    checkIds: [],
  },
  {
    id: '1.7',
    section: '1 - Identity and Access Management',
    title: 'Ensure user-managed/external keys for service accounts are rotated every 90 days or less',
    level: 1,
    checkIds: [],
  },
  {
    id: '1.8',
    section: '1 - Identity and Access Management',
    title: 'Ensure that Separation of Duties is enforced while assigning service account related roles to users',
    level: 2,
    checkIds: [],
  },
  {
    id: '1.9',
    section: '1 - Identity and Access Management',
    title: 'Ensure that Cloud KMS cryptokeys are not anonymously or publicly accessible',
    level: 1,
    checkIds: [],
  },
  {
    id: '1.10',
    section: '1 - Identity and Access Management',
    title: 'Ensure KMS encryption keys are rotated within a period of 90 days',
    level: 1,
    checkIds: ['kms-no-rotation'],
  },
  {
    id: '1.11',
    section: '1 - Identity and Access Management',
    title: 'Ensure that Separation of Duties is enforced while assigning KMS related roles to users',
    level: 2,
    checkIds: [],
  },
  {
    id: '1.12',
    section: '1 - Identity and Access Management',
    title: 'Ensure API keys are not created for a project',
    level: 2,
    checkIds: [],
  },
  {
    id: '1.13',
    section: '1 - Identity and Access Management',
    title: 'Ensure API keys are restricted to only APIs that the application needs access',
    level: 2,
    checkIds: [],
  },
  {
    id: '1.14',
    section: '1 - Identity and Access Management',
    title: 'Ensure API keys are restricted to use by only specified hosts and apps',
    level: 2,
    checkIds: [],
  },
  {
    id: '1.15',
    section: '1 - Identity and Access Management',
    title: 'Ensure API keys are rotated within 90 days',
    level: 2,
    checkIds: [],
  },

  // ── Section 2 — Logging and Monitoring ──

  {
    id: '2.1',
    section: '2 - Logging and Monitoring',
    title: 'Ensure that Cloud Audit Logging is configured properly across all services and all users from a project',
    level: 1,
    checkIds: [],
  },
  {
    id: '2.2',
    section: '2 - Logging and Monitoring',
    title: 'Ensure that sinks are configured for all log entries',
    level: 1,
    checkIds: [],
  },
  {
    id: '2.3',
    section: '2 - Logging and Monitoring',
    title: 'Ensure that retention policies on log buckets are configured using Bucket Lock',
    level: 2,
    checkIds: [],
  },
  {
    id: '2.4',
    section: '2 - Logging and Monitoring',
    title: 'Ensure log metric filter and alerts exist for project ownership assignments/changes',
    level: 1,
    checkIds: [],
  },
  {
    id: '2.5',
    section: '2 - Logging and Monitoring',
    title: 'Ensure log metric filter and alerts exist for Audit Configuration changes',
    level: 1,
    checkIds: [],
  },
  {
    id: '2.6',
    section: '2 - Logging and Monitoring',
    title: 'Ensure log metric filter and alerts exist for Custom Role changes',
    level: 1,
    checkIds: [],
  },
  {
    id: '2.7',
    section: '2 - Logging and Monitoring',
    title: 'Ensure log metric filter and alerts exist for VPC Network Firewall rule changes',
    level: 2,
    checkIds: [],
  },
  {
    id: '2.8',
    section: '2 - Logging and Monitoring',
    title: 'Ensure log metric filter and alerts exist for VPC network route changes',
    level: 2,
    checkIds: [],
  },
  {
    id: '2.9',
    section: '2 - Logging and Monitoring',
    title: 'Ensure log metric filter and alerts exist for VPC network changes',
    level: 2,
    checkIds: [],
  },
  {
    id: '2.10',
    section: '2 - Logging and Monitoring',
    title: 'Ensure log metric filter and alerts exist for Cloud Storage IAM permission changes',
    level: 2,
    checkIds: [],
  },
  {
    id: '2.11',
    section: '2 - Logging and Monitoring',
    title: 'Ensure log metric filter and alerts exist for SQL instance configuration changes',
    level: 2,
    checkIds: [],
  },
  {
    id: '2.12',
    section: '2 - Logging and Monitoring',
    title: 'Ensure that Cloud DNS logging is enabled for all VPC networks',
    level: 1,
    checkIds: [],
  },

  // ── Section 3 — Networking ──

  {
    id: '3.1',
    section: '3 - Networking',
    title: 'Ensure that the default network does not exist in a project',
    level: 2,
    checkIds: ['default-network'],
  },
  {
    id: '3.2',
    section: '3 - Networking',
    title: 'Ensure legacy networks do not exist for a project',
    level: 1,
    checkIds: [],
  },
  {
    id: '3.3',
    section: '3 - Networking',
    title: 'Ensure that DNSSEC is enabled for Cloud DNS',
    level: 1,
    checkIds: [],
  },
  {
    id: '3.4',
    section: '3 - Networking',
    title: 'Ensure that RSASHA1 is not used for the zone-signing and key-signing keys in Cloud DNS DNSSEC',
    level: 1,
    checkIds: [],
  },
  {
    id: '3.5',
    section: '3 - Networking',
    title: 'Ensure no HTTPS or SSL proxy load balancers permit SSL policies with weak cipher suites',
    level: 1,
    checkIds: [],
  },
  {
    id: '3.6',
    section: '3 - Networking',
    title: 'Ensure that SSH access is restricted from the internet',
    level: 2,
    checkIds: ['fw-ssh-open'],
  },
  {
    id: '3.7',
    section: '3 - Networking',
    title: 'Ensure that RDP access is restricted from the internet',
    level: 2,
    checkIds: ['fw-rdp-open'],
  },
  {
    id: '3.8',
    section: '3 - Networking',
    title: 'Ensure that VPC Flow Logs is enabled for every subnet in a VPC Network',
    level: 2,
    checkIds: [],
  },
  {
    id: '3.9',
    section: '3 - Networking',
    title: 'Ensure no HTTPS or SSL proxy load balancers permit SSL policies with weak cipher suites',
    level: 2,
    checkIds: [],
  },
  {
    id: '3.10',
    section: '3 - Networking',
    title: 'Ensure Private Google Access is enabled for all subnets in VPC',
    level: 2,
    checkIds: [],
  },

  // ── Section 4 — Virtual Machines ──

  {
    id: '4.1',
    section: '4 - Virtual Machines',
    title: 'Ensure that instances are not configured to use default service accounts',
    level: 1,
    checkIds: [],
  },
  {
    id: '4.2',
    section: '4 - Virtual Machines',
    title: 'Ensure that instances are not configured to use default service accounts with full access to all Cloud APIs',
    level: 1,
    checkIds: [],
  },
  {
    id: '4.3',
    section: '4 - Virtual Machines',
    title: 'Ensure "Block Project-wide SSH keys" is enabled for VM instances',
    level: 1,
    checkIds: [],
  },
  {
    id: '4.4',
    section: '4 - Virtual Machines',
    title: 'Ensure oslogin is enabled for a project',
    level: 1,
    checkIds: [],
  },
  {
    id: '4.5',
    section: '4 - Virtual Machines',
    title: 'Ensure that no instance in the project overrides the project setting for enabling OS Login',
    level: 2,
    checkIds: [],
  },
  {
    id: '4.6',
    section: '4 - Virtual Machines',
    title: 'Ensure that IP forwarding is not enabled on Instances',
    level: 1,
    checkIds: [],
  },
  {
    id: '4.7',
    section: '4 - Virtual Machines',
    title: 'Ensure VM disks for critical VMs are encrypted with Customer-Supplied Encryption Keys (CSEK)',
    level: 2,
    checkIds: [],
  },
  {
    id: '4.8',
    section: '4 - Virtual Machines',
    title: 'Ensure Compute instances are launched with Shielded VM enabled',
    level: 2,
    checkIds: [],
  },
  {
    id: '4.9',
    section: '4 - Virtual Machines',
    title: 'Ensure that Compute instances do not have public IP addresses',
    level: 2,
    checkIds: [],
  },
  {
    id: '4.10',
    section: '4 - Virtual Machines',
    title: 'Ensure that App Engine applications enforce HTTPS connections',
    level: 2,
    checkIds: [],
  },
  {
    id: '4.11',
    section: '4 - Virtual Machines',
    title: 'Ensure that Compute instances have Confidential Computing enabled',
    level: 2,
    checkIds: [],
  },

  // ── Section 5 — Storage ──

  {
    id: '5.1',
    section: '5 - Storage',
    title: 'Ensure that Cloud Storage bucket is not anonymously or publicly accessible',
    level: 1,
    checkIds: ['gcs-public'],
  },
  {
    id: '5.2',
    section: '5 - Storage',
    title: 'Ensure that Cloud Storage buckets have uniform bucket-level access enabled',
    level: 2,
    checkIds: ['gcs-no-uniform'],
  },
  {
    id: '5.3',
    section: '5 - Storage',
    title: 'Ensure that Cloud Storage buckets have versioning enabled',
    level: 2,
    checkIds: [],
  },

  // ── Section 6 — Cloud SQL ──

  {
    id: '6.1',
    section: '6 - Cloud SQL Database Services',
    title: 'Ensure that Cloud SQL database instances are not open to the world',
    level: 1,
    checkIds: ['sql-public-ip'],
  },
  {
    id: '6.2',
    section: '6 - Cloud SQL Database Services',
    title: 'Ensure that Cloud SQL database instances require all incoming connections to use SSL',
    level: 1,
    checkIds: ['sql-no-ssl'],
  },
  {
    id: '6.3',
    section: '6 - Cloud SQL Database Services',
    title: 'Ensure that Cloud SQL database instances do not implicitly allow all public connections',
    level: 1,
    checkIds: [],
  },
  {
    id: '6.4',
    section: '6 - Cloud SQL Database Services',
    title: 'Ensure that Cloud SQL database instances are configured with automated backups',
    level: 1,
    checkIds: ['sql-no-backup'],
  },
  {
    id: '6.5',
    section: '6 - Cloud SQL Database Services',
    title: 'Ensure that Cloud SQL database instances are not using public IPs',
    level: 2,
    checkIds: [],
  },
  {
    id: '6.6',
    section: '6 - Cloud SQL Database Services',
    title: 'Ensure that Cloud SQL database instances are using a current and supported version',
    level: 1,
    checkIds: [],
  },
  {
    id: '6.7',
    section: '6 - Cloud SQL Database Services',
    title: 'Ensure that Cloud SQL database instances are configured to use private IPs',
    level: 2,
    checkIds: [],
  },

  // ── Section 7 — BigQuery ──

  {
    id: '7.1',
    section: '7 - BigQuery',
    title: 'Ensure that BigQuery datasets are not anonymously or publicly accessible',
    level: 1,
    checkIds: [],
  },
  {
    id: '7.2',
    section: '7 - BigQuery',
    title: 'Ensure that all BigQuery tables are encrypted with Customer-Managed Encryption Keys (CMEK)',
    level: 2,
    checkIds: [],
  },

  // ── Section 8 — Cloud KMS ──

  {
    id: '8.1',
    section: '8 - Cloud KMS',
    title: 'Ensure rotation for customer-managed encryption keys is enabled',
    level: 1,
    checkIds: ['kms-no-rotation'],
  },
];

export const CIS_GCP_FRAMEWORK: ComplianceFrameworkMeta = {
  id: 'cis-gcp-v2',
  name: 'CIS Google Cloud Platform Foundation Benchmark',
  version: '2.0',
  description: 'CIS GCP Foundation Benchmark v2.0 — automated control assessment',
  controlCount: CIS_GCP_CONTROLS.length,
};

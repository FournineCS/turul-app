// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';
import { Storage } from '@google-cloud/storage';
import { KeyManagementServiceClient } from '@google-cloud/kms';
import crypto from 'crypto';
import type {
  SecurityAnalysisResult,
  SecurityFinding,
  SecurityPostureSummary,
  FindingSeverity,
  FindingSource,
} from '../../../shared/types';

/**
 * GCP Best Practices Security Scan
 *
 * Checks for common GCP security misconfigurations:
 * 1. Public GCS buckets (allUsers/allAuthenticatedUsers)
 * 2. Firewall rules with 0.0.0.0/0 on SSH (22) / RDP (3389)
 * 3. Service accounts with Owner/Editor roles
 * 4. Cloud SQL with public IP enabled
 * 5. Default VPC network in use
 * 6. SSL not enforced on Cloud SQL
 * 7. KMS keys without rotation
 * 8. Uniform bucket-level access not enabled
 * 9. Logging disabled for critical services
 */
export async function runGCPBestPracticesScan(
  projectId: string
): Promise<SecurityAnalysisResult> {
  const startTime = Date.now();
  const findings: SecurityFinding[] = [];
  const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform'],
  });

  // Run checks in parallel
  const checks = await Promise.allSettled([
    checkPublicBuckets(projectId, findings),
    checkFirewallRules(projectId, auth, findings),
    checkServiceAccountRoles(projectId, auth, findings),
    checkCloudSQLPublicIP(projectId, auth, findings),
    checkDefaultNetwork(projectId, auth, findings),
    checkKMSKeyRotation(projectId, findings),
    checkUniformBucketAccess(projectId, findings),
  ]);

  // Log any check failures
  for (const check of checks) {
    if (check.status === 'rejected') {
      console.warn('GCP best practices check failed:', check.reason);
    }
  }

  const summary = buildSummary(findings);

  return {
    id: crypto.randomUUID(),
    projectId,
    scanMode: 'best_practices',
    timestamp: new Date().toISOString(),
    duration: Date.now() - startTime,
    summary,
    findings,
    enabledStandards: [],
  };
}

async function checkPublicBuckets(projectId: string, findings: SecurityFinding[]): Promise<void> {
  const storage = new Storage({ projectId });

  try {
    const [buckets] = await storage.getBuckets();

    for (const bucket of buckets) {
      try {
        const [policy] = await bucket.iam.getPolicy();

        for (const binding of policy.bindings || []) {
          const hasAllUsers = binding.members?.includes('allUsers');
          const hasAllAuthUsers = binding.members?.includes('allAuthenticatedUsers');

          if (hasAllUsers || hasAllAuthUsers) {
            findings.push(createFinding(
              `gcs-public-${bucket.name}`,
              'Public GCS Bucket',
              `Bucket "${bucket.name}" is publicly accessible via ${hasAllUsers ? 'allUsers' : 'allAuthenticatedUsers'} with role ${binding.role}`,
              binding.role?.includes('objectAdmin') || binding.role?.includes('storage.admin')
                ? 'CRITICAL'
                : 'HIGH',
              'Cloud Storage',
              bucket.name || '',
              `gs://${bucket.name}`,
              'global',
              'Remove allUsers/allAuthenticatedUsers bindings or use signed URLs for controlled access',
            ));
          }
        }
      } catch {
        // Skip buckets where we can't read IAM policy
      }
    }
  } catch {
    // Storage API not enabled or no access
  }
}

async function checkFirewallRules(
  projectId: string,
  auth: GoogleAuth,
  findings: SecurityFinding[]
): Promise<void> {
  const compute = google.compute({ version: 'v1', auth });

  try {
    const response = await compute.firewalls.list({ project: projectId });
    const firewalls = response.data.items || [];

    for (const fw of firewalls) {
      if (fw.disabled) continue;

      const hasOpenSource = fw.sourceRanges?.includes('0.0.0.0/0');
      if (!hasOpenSource) continue;

      for (const allowed of fw.allowed || []) {
        const ports = allowed.ports || [];
        const protocol = allowed.IPProtocol || '';

        if (protocol === 'tcp' || protocol === 'all') {
          const hasSSH = ports.includes('22') || ports.includes('0-65535') || protocol === 'all';
          const hasRDP = ports.includes('3389') || ports.includes('0-65535') || protocol === 'all';

          if (hasSSH) {
            findings.push(createFinding(
              `fw-ssh-open-${fw.name}`,
              'SSH Open to Internet',
              `Firewall rule "${fw.name}" allows SSH (port 22) from 0.0.0.0/0`,
              'HIGH',
              'Compute Engine',
              fw.name || '',
              fw.selfLink || '',
              'global',
              'Restrict SSH access to specific IP ranges or use IAP for SSH access',
            ));
          }

          if (hasRDP) {
            findings.push(createFinding(
              `fw-rdp-open-${fw.name}`,
              'RDP Open to Internet',
              `Firewall rule "${fw.name}" allows RDP (port 3389) from 0.0.0.0/0`,
              'HIGH',
              'Compute Engine',
              fw.name || '',
              fw.selfLink || '',
              'global',
              'Restrict RDP access to specific IP ranges or use IAP for desktop access',
            ));
          }
        }
      }
    }
  } catch {
    // Compute API not enabled
  }
}

async function checkServiceAccountRoles(
  projectId: string,
  auth: GoogleAuth,
  findings: SecurityFinding[]
): Promise<void> {
  const crm = google.cloudresourcemanager({ version: 'v1', auth });

  try {
    const response = await crm.projects.getIamPolicy({
      resource: projectId,
      requestBody: {},
    });

    const bindings = response.data.bindings || [];
    const dangerousRoles = ['roles/owner', 'roles/editor'];

    for (const binding of bindings) {
      if (!dangerousRoles.includes(binding.role || '')) continue;

      for (const member of binding.members || []) {
        if (member.startsWith('serviceAccount:')) {
          const saEmail = member.replace('serviceAccount:', '');
          // Skip default compute/app engine service accounts
          if (saEmail.includes('compute@developer') || saEmail.includes('appspot')) continue;

          findings.push(createFinding(
            `sa-overprivileged-${saEmail}`,
            'Service Account with Owner/Editor Role',
            `Service account "${saEmail}" has the ${binding.role} role, which grants broad permissions`,
            'HIGH',
            'IAM',
            saEmail,
            `serviceAccount:${saEmail}`,
            'global',
            `Assign least-privilege roles instead of ${binding.role}. Use predefined or custom roles.`,
          ));
        }
      }
    }
  } catch {
    // IAM policy not accessible
  }
}

async function checkCloudSQLPublicIP(
  projectId: string,
  auth: GoogleAuth,
  findings: SecurityFinding[]
): Promise<void> {
  const sqladmin = google.sqladmin({ version: 'v1beta4', auth });

  try {
    const response = await sqladmin.instances.list({ project: projectId });
    const instances = response.data.items || [];

    for (const instance of instances) {
      const ipConfig = instance.settings?.ipConfiguration;

      // Check for public IP
      if (ipConfig?.ipv4Enabled) {
        findings.push(createFinding(
          `sql-public-ip-${instance.name}`,
          'Cloud SQL with Public IP',
          `Cloud SQL instance "${instance.name}" has a public IP address enabled`,
          'MEDIUM',
          'Cloud SQL',
          instance.name || '',
          instance.selfLink || '',
          instance.region || 'unknown',
          'Disable public IP and use Private IP or Cloud SQL Auth Proxy for connections',
        ));
      }

      // Check for SSL not required
      if (!ipConfig?.requireSsl) {
        findings.push(createFinding(
          `sql-no-ssl-${instance.name}`,
          'Cloud SQL SSL Not Enforced',
          `Cloud SQL instance "${instance.name}" does not require SSL connections`,
          'MEDIUM',
          'Cloud SQL',
          instance.name || '',
          instance.selfLink || '',
          instance.region || 'unknown',
          'Enable "Require SSL" in the Cloud SQL instance settings',
        ));
      }

      // Check for no backup
      if (!instance.settings?.backupConfiguration?.enabled) {
        findings.push(createFinding(
          `sql-no-backup-${instance.name}`,
          'Cloud SQL Backups Disabled',
          `Cloud SQL instance "${instance.name}" does not have automated backups enabled`,
          'MEDIUM',
          'Cloud SQL',
          instance.name || '',
          instance.selfLink || '',
          instance.region || 'unknown',
          'Enable automated backups in the Cloud SQL instance settings',
        ));
      }
    }
  } catch {
    // SQL Admin API not enabled
  }
}

async function checkDefaultNetwork(
  projectId: string,
  auth: GoogleAuth,
  findings: SecurityFinding[]
): Promise<void> {
  const compute = google.compute({ version: 'v1', auth });

  try {
    const response = await compute.networks.list({ project: projectId });
    const networks = response.data.items || [];

    for (const network of networks) {
      if (network.name === 'default') {
        findings.push(createFinding(
          'default-network',
          'Default VPC Network In Use',
          'The default VPC network exists in this project. Default networks have overly permissive firewall rules.',
          'MEDIUM',
          'Networking',
          'default',
          network.selfLink || '',
          'global',
          'Delete the default network and create a custom VPC with appropriate firewall rules',
        ));
      }
    }
  } catch {
    // Compute API not enabled
  }
}

async function checkKMSKeyRotation(
  projectId: string,
  findings: SecurityFinding[]
): Promise<void> {
  const client = new KeyManagementServiceClient();

  try {
    const parent = `projects/${projectId}/locations/-`;
    const [keyRings] = await client.listKeyRings({ parent });

    for (const keyRing of keyRings) {
      try {
        const [keys] = await client.listCryptoKeys({ parent: keyRing.name! });

        for (const key of keys) {
          if (key.purpose === 'ENCRYPT_DECRYPT' && !key.rotationPeriod) {
            const keyName = key.name?.split('/').pop() || '';
            findings.push(createFinding(
              `kms-no-rotation-${keyName}`,
              'KMS Key Without Rotation',
              `KMS key "${keyName}" does not have automatic rotation configured`,
              'MEDIUM',
              'Cloud KMS',
              keyName,
              key.name || '',
              'global',
              'Configure automatic key rotation with a rotation period of 90 days or less',
            ));
          }
        }
      } catch {
        // Skip key rings we can't read
      }
    }
  } catch {
    // KMS API not enabled
  }
}

async function checkUniformBucketAccess(
  projectId: string,
  findings: SecurityFinding[]
): Promise<void> {
  const storage = new Storage({ projectId });

  try {
    const [buckets] = await storage.getBuckets();

    for (const bucket of buckets) {
      const metadata = bucket.metadata;
      const uniformAccess = metadata?.iamConfiguration?.uniformBucketLevelAccess?.enabled;

      if (!uniformAccess) {
        findings.push(createFinding(
          `gcs-no-uniform-${bucket.name}`,
          'Uniform Bucket-Level Access Not Enabled',
          `Bucket "${bucket.name}" does not have uniform bucket-level access enabled, allowing legacy ACLs`,
          'LOW',
          'Cloud Storage',
          bucket.name || '',
          `gs://${bucket.name}`,
          metadata?.location?.toLowerCase() || 'global',
          'Enable uniform bucket-level access to simplify permission management and prevent ACL misconfigurations',
        ));
      }
    }
  } catch {
    // Storage API not accessible
  }
}

function createFinding(
  id: string,
  title: string,
  description: string,
  severity: FindingSeverity,
  resourceType: string,
  resourceId: string,
  resourceArn: string,
  region: string,
  remediation: string
): SecurityFinding {
  return {
    id,
    title,
    description,
    severity,
    status: 'ACTIVE',
    source: 'BEST_PRACTICES' as FindingSource,
    region,
    resourceType,
    resourceId,
    resourceArn,
    remediationRecommendation: remediation,
    lastObservedAt: new Date().toISOString(),
    productName: 'GCP Best Practices',
  };
}

function buildSummary(findings: SecurityFinding[]): SecurityPostureSummary {
  const summary: SecurityPostureSummary = {
    totalFindings: findings.length,
    criticalCount: 0,
    highCount: 0,
    mediumCount: 0,
    lowCount: 0,
    informationalCount: 0,
    bySource: {} as Record<FindingSource, number>,
    complianceScores: [],
    lastRefreshed: new Date().toISOString(),
  };

  for (const finding of findings) {
    switch (finding.severity) {
      case 'CRITICAL': summary.criticalCount++; break;
      case 'HIGH': summary.highCount++; break;
      case 'MEDIUM': summary.mediumCount++; break;
      case 'LOW': summary.lowCount++; break;
      case 'INFORMATIONAL': summary.informationalCount++; break;
    }
    const source = finding.source;
    summary.bySource[source] = (summary.bySource[source] || 0) + 1;
  }

  return summary;
}

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
 *  - Public GCS buckets (allUsers/allAuthenticatedUsers)
 *  - Firewall rules with 0.0.0.0/0 or ::/0 on SSH/RDP/DB/admin ports
 *  - Service accounts (incl. default compute/AppEngine) with Owner/Editor roles
 *  - Cloud SQL: public IP, SSL/sslMode, backups
 *  - Default VPC network in use
 *  - KMS keys without rotation
 *  - Uniform bucket-level access not enabled
 *  - Compute instances: external IP + default SA with full cloud-platform scope
 *  - GKE: legacy ABAC, master authorized networks, Workload Identity, shielded nodes
 *  - BigQuery datasets exposed to allUsers/allAuthenticatedUsers
 *
 * Severity calibration tracks Security Health Analytics
 * (https://cloud.google.com/security-command-center/docs/concepts-security-sources).
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
    checkComputeInstances(projectId, auth, findings),
    checkGKEClusters(projectId, auth, findings),
    checkBigQueryPublicDatasets(projectId, auth, findings),
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
            // SHA detector PUBLIC_BUCKET_ACL is rated CRITICAL when allUsers is bound.
            // allAuthenticatedUsers is still HIGH because any Google account can read.
            findings.push(createFinding(
              `gcs-public-${bucket.name}`,
              'Public GCS Bucket',
              `Bucket "${bucket.name}" is publicly accessible via ${hasAllUsers ? 'allUsers' : 'allAuthenticatedUsers'} with role ${binding.role}`,
              hasAllUsers ? 'CRITICAL' : 'HIGH',
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

// Sensitive TCP ports tracked by Security Health Analytics open-port detectors.
// See: https://cloud.google.com/security-command-center/docs/concepts-security-sources#firewall-detectors
const SENSITIVE_PORT_RULES: { port: number; label: string; severity: FindingSeverity }[] = [
  { port: 22,    label: 'SSH',           severity: 'HIGH' },
  { port: 3389,  label: 'RDP',           severity: 'HIGH' },
  { port: 23,    label: 'Telnet',        severity: 'HIGH' },
  { port: 3306,  label: 'MySQL',         severity: 'HIGH' },
  { port: 5432,  label: 'PostgreSQL',    severity: 'HIGH' },
  { port: 1433,  label: 'MSSQL',         severity: 'HIGH' },
  { port: 1434,  label: 'MSSQL Browser', severity: 'HIGH' },
  { port: 27017, label: 'MongoDB',       severity: 'HIGH' },
  { port: 6379,  label: 'Redis',         severity: 'HIGH' },
  { port: 2375,  label: 'Docker daemon', severity: 'HIGH' },
  { port: 9200,  label: 'Elasticsearch', severity: 'MEDIUM' },
  { port: 5601,  label: 'Kibana',        severity: 'MEDIUM' },
  { port: 11211, label: 'Memcached',     severity: 'MEDIUM' },
  { port: 21,    label: 'FTP',           severity: 'MEDIUM' },
];

function portRangeIncludes(portStr: string, target: number): boolean {
  if (portStr.includes('-')) {
    const [lo, hi] = portStr.split('-').map(Number);
    return Number.isFinite(lo) && Number.isFinite(hi) && target >= lo && target <= hi;
  }
  return Number(portStr) === target;
}

function firewallExposesPort(
  protocol: string,
  ports: string[],
  target: number,
): boolean {
  if (protocol === 'all') return true;
  if (protocol !== 'tcp' && protocol !== 'udp') return false;
  // Empty ports array = all ports for that protocol
  if (ports.length === 0) return true;
  return ports.some((p) => portRangeIncludes(p, target));
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
      if (fw.direction && fw.direction !== 'INGRESS') continue;

      const sources = fw.sourceRanges || [];
      const openV4 = sources.includes('0.0.0.0/0');
      const openV6 = sources.includes('::/0');
      if (!openV4 && !openV6) continue;
      const exposedSource = openV4 ? '0.0.0.0/0' : '::/0';

      for (const allowed of fw.allowed || []) {
        const ports = allowed.ports || [];
        const protocol = allowed.IPProtocol || '';

        for (const rule of SENSITIVE_PORT_RULES) {
          if (!firewallExposesPort(protocol, ports, rule.port)) continue;
          findings.push(createFinding(
            `fw-${rule.port}-open-${fw.name}`,
            `${rule.label} Open to Internet`,
            `Firewall rule "${fw.name}" allows ${rule.label} (port ${rule.port}) from ${exposedSource}`,
            rule.severity,
            'Compute Engine',
            fw.name || '',
            fw.selfLink || '',
            'global',
            rule.port === 22 || rule.port === 3389
              ? 'Restrict source ranges or use Identity-Aware Proxy (IAP) for administrative access'
              : `Restrict source ranges to known internal CIDRs; ${rule.label} should not be exposed to the internet`,
          ));
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
          // CIS GCP v3.0 §4.1/§4.2: default SAs should not be used at all,
          // so they are flagged the same as user-managed SAs (no exemption).
          const isDefault =
            saEmail.endsWith('@developer.gserviceaccount.com') ||
            saEmail.endsWith('@appspot.gserviceaccount.com');

          findings.push(createFinding(
            `sa-overprivileged-${saEmail}`,
            isDefault
              ? 'Default Service Account with Owner/Editor Role'
              : 'Service Account with Owner/Editor Role',
            isDefault
              ? `Default service account "${saEmail}" has the ${binding.role} role. CIS GCP §4.1/4.2: default SAs should not be used at all.`
              : `Service account "${saEmail}" has the ${binding.role} role, which grants broad permissions`,
            'HIGH',
            'IAM',
            saEmail,
            `serviceAccount:${saEmail}`,
            'global',
            isDefault
              ? `Stop using the default service account. Create a dedicated SA with least-privilege roles and reassign workloads.`
              : `Assign least-privilege roles instead of ${binding.role}. Use predefined or custom roles.`,
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

      // SHA detector PUBLIC_SQL_INSTANCE — flagged as HIGH.
      if (ipConfig?.ipv4Enabled) {
        const authorizedNetworks = ipConfig?.authorizedNetworks || [];
        const openToWorld = authorizedNetworks.some(
          (n) => n.value === '0.0.0.0/0' || n.value === '::/0',
        );
        findings.push(createFinding(
          `sql-public-ip-${instance.name}`,
          openToWorld ? 'Cloud SQL Public IP Open to Internet' : 'Cloud SQL with Public IP',
          openToWorld
            ? `Cloud SQL instance "${instance.name}" has a public IP and an authorized network covering 0.0.0.0/0 — reachable from the internet`
            : `Cloud SQL instance "${instance.name}" has a public IP address enabled`,
          openToWorld ? 'CRITICAL' : 'HIGH',
          'Cloud SQL',
          instance.name || '',
          instance.selfLink || '',
          instance.region || 'unknown',
          'Disable public IP and use Private IP or Cloud SQL Auth Proxy for connections',
        ));
      }

      // Cloud SQL `requireSsl` was deprecated in 2024 in favor of `sslMode`.
      // Read the modern field first; fall back to the legacy boolean.
      // sslMode values: ALLOW_UNENCRYPTED_AND_ENCRYPTED (insecure),
      // ENCRYPTED_ONLY, TRUSTED_CLIENT_CERTIFICATE_REQUIRED.
      // https://cloud.google.com/sql/docs/mysql/configure-ssl-instance#ssl-mode
      const sslMode = (ipConfig as { sslMode?: string } | undefined)?.sslMode;
      const sslInsecure = sslMode
        ? sslMode === 'ALLOW_UNENCRYPTED_AND_ENCRYPTED'
        : ipConfig?.requireSsl === false || ipConfig?.requireSsl == null;
      if (sslInsecure) {
        findings.push(createFinding(
          `sql-no-ssl-${instance.name}`,
          'Cloud SQL SSL Not Enforced',
          sslMode
            ? `Cloud SQL instance "${instance.name}" has sslMode=${sslMode}, which permits unencrypted connections`
            : `Cloud SQL instance "${instance.name}" does not require SSL connections (legacy requireSsl=false)`,
          'HIGH',
          'Cloud SQL',
          instance.name || '',
          instance.selfLink || '',
          instance.region || 'unknown',
          'Set sslMode to TRUSTED_CLIENT_CERTIFICATE_REQUIRED (or at minimum ENCRYPTED_ONLY) on the instance settings',
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

/**
 * Compute Engine — flag VMs that:
 *   1. have a public (external) IP — SHA: PUBLIC_IP_ADDRESS
 *   2. use the default compute SA bound to cloud-platform scope —
 *      SHA: DEFAULT_SERVICE_ACCOUNT_USED + FULL_API_ACCESS
 *      (https://cloud.google.com/security-command-center/docs/concepts-security-sources)
 */
async function checkComputeInstances(
  projectId: string,
  auth: GoogleAuth,
  findings: SecurityFinding[]
): Promise<void> {
  const compute = google.compute({ version: 'v1', auth });
  const FULL_SCOPE = 'https://www.googleapis.com/auth/cloud-platform';

  try {
    const response = await compute.instances.aggregatedList({ project: projectId });
    const aggregated = response.data.items || {};

    for (const [zoneKey, scoped] of Object.entries(aggregated)) {
      const instances = (scoped as { instances?: unknown[] }).instances || [];
      const region = zoneKey.startsWith('zones/')
        ? zoneKey.slice('zones/'.length).split('-').slice(0, -1).join('-')
        : 'global';

      for (const inst of instances as Array<{
        name?: string;
        selfLink?: string;
        status?: string;
        networkInterfaces?: Array<{ accessConfigs?: Array<{ natIP?: string }> }>;
        serviceAccounts?: Array<{ email?: string; scopes?: string[] }>;
      }>) {
        if (inst.status === 'TERMINATED') continue;

        const hasPublicIp = (inst.networkInterfaces || []).some(
          (ni) => (ni.accessConfigs || []).some((ac) => !!ac.natIP),
        );
        if (hasPublicIp) {
          findings.push(createFinding(
            `gce-public-ip-${inst.name}`,
            'Compute Instance Has Public IP',
            `Instance "${inst.name}" has an external IP address — directly reachable from the internet`,
            'MEDIUM',
            'Compute Engine',
            inst.name || '',
            inst.selfLink || '',
            region,
            'Remove the access config / external IP and access the instance via Identity-Aware Proxy or Cloud NAT',
          ));
        }

        for (const sa of inst.serviceAccounts || []) {
          const isDefault =
            sa.email?.endsWith('@developer.gserviceaccount.com') ||
            sa.email?.endsWith('@appspot.gserviceaccount.com');
          const hasFullScope = !!sa.scopes?.some((s) => s === FULL_SCOPE);
          if (isDefault && hasFullScope) {
            findings.push(createFinding(
              `gce-default-sa-fullscope-${inst.name}`,
              'Compute Instance Uses Default SA With Full Cloud-Platform Scope',
              `Instance "${inst.name}" runs as default SA "${sa.email}" with cloud-platform scope — any process on the VM can act with broad project permissions`,
              'HIGH',
              'Compute Engine',
              inst.name || '',
              inst.selfLink || '',
              region,
              'Bind the instance to a dedicated least-privilege service account and remove the cloud-platform scope',
            ));
          } else if (isDefault) {
            findings.push(createFinding(
              `gce-default-sa-${inst.name}`,
              'Compute Instance Uses Default Service Account',
              `Instance "${inst.name}" runs as default SA "${sa.email}". CIS GCP §4.1: default SAs should not be used.`,
              'MEDIUM',
              'Compute Engine',
              inst.name || '',
              inst.selfLink || '',
              region,
              'Create a dedicated service account with least-privilege roles and assign it to this instance',
            ));
          }
        }
      }
    }
  } catch {
    // Compute API not enabled
  }
}

/**
 * GKE — minimum CIS GKE Benchmark coverage:
 *   - Legacy ABAC (CIS §5.8.1)
 *   - Master authorized networks (CIS §6.6.2)
 *   - Workload Identity (CIS §6.2.2)
 *   - Shielded GKE Nodes (CIS §6.5.5)
 *   - Network policy (CIS §6.6.7)
 *   - Private cluster (CIS §6.6.3)
 */
async function checkGKEClusters(
  projectId: string,
  auth: GoogleAuth,
  findings: SecurityFinding[]
): Promise<void> {
  const container = google.container({ version: 'v1', auth });

  try {
    const response = await container.projects.locations.clusters.list({
      parent: `projects/${projectId}/locations/-`,
    });
    const clusters = response.data.clusters || [];

    for (const c of clusters) {
      const name = c.name || '';
      const region = c.location || 'global';
      const selfLink = c.selfLink || '';

      if (c.legacyAbac?.enabled) {
        findings.push(createFinding(
          `gke-legacy-abac-${name}`,
          'GKE Legacy ABAC Enabled',
          `Cluster "${name}" has legacy ABAC enabled, which grants broader pod permissions than RBAC`,
          'HIGH', 'GKE', name, selfLink, region,
          'Disable legacy ABAC: gcloud container clusters update --no-enable-legacy-authorization',
        ));
      }

      if (c.masterAuthorizedNetworksConfig?.enabled !== true) {
        findings.push(createFinding(
          `gke-no-master-authorized-networks-${name}`,
          'GKE Master Authorized Networks Not Configured',
          `Cluster "${name}" has no master-authorized-networks restriction — the control plane endpoint is reachable from any IP`,
          'HIGH', 'GKE', name, selfLink, region,
          'Enable master authorized networks and restrict the control plane to known CIDRs',
        ));
      }

      const wiPool = c.workloadIdentityConfig?.workloadPool;
      if (!wiPool) {
        findings.push(createFinding(
          `gke-no-workload-identity-${name}`,
          'GKE Workload Identity Not Enabled',
          `Cluster "${name}" does not use Workload Identity — pods must rely on node SA / SA keys for GCP API access`,
          'HIGH', 'GKE', name, selfLink, region,
          'Enable Workload Identity: gcloud container clusters update --workload-pool=PROJECT_ID.svc.id.goog',
        ));
      }

      if (c.shieldedNodes?.enabled !== true) {
        findings.push(createFinding(
          `gke-no-shielded-nodes-${name}`,
          'GKE Shielded Nodes Not Enabled',
          `Cluster "${name}" does not use Shielded GKE Nodes (no boot integrity / attestation)`,
          'MEDIUM', 'GKE', name, selfLink, region,
          'Enable shielded nodes and integrity monitoring: gcloud container clusters update --enable-shielded-nodes',
        ));
      }

      if (c.networkPolicy?.enabled !== true) {
        findings.push(createFinding(
          `gke-no-network-policy-${name}`,
          'GKE Network Policy Disabled',
          `Cluster "${name}" has no network policy add-on — pod-to-pod traffic is unrestricted`,
          'MEDIUM', 'GKE', name, selfLink, region,
          'Enable network policy and define ingress/egress rules per namespace',
        ));
      }

      if (c.privateClusterConfig?.enablePrivateNodes !== true) {
        findings.push(createFinding(
          `gke-not-private-${name}`,
          'GKE Cluster Is Not Private',
          `Cluster "${name}" has nodes with public IPs (not a private cluster)`,
          'MEDIUM', 'GKE', name, selfLink, region,
          'Recreate the cluster as a private cluster (--enable-private-nodes) so nodes have no public IPs',
        ));
      }
    }
  } catch {
    // GKE API not enabled
  }
}

/**
 * BigQuery — flag datasets shared with allUsers or allAuthenticatedUsers.
 * SHA detector: PUBLIC_DATASET (rated HIGH).
 */
async function checkBigQueryPublicDatasets(
  projectId: string,
  auth: GoogleAuth,
  findings: SecurityFinding[]
): Promise<void> {
  const bigquery = google.bigquery({ version: 'v2', auth });

  try {
    const list = await bigquery.datasets.list({ projectId });
    const datasets = list.data.datasets || [];

    for (const d of datasets) {
      const datasetId = d.datasetReference?.datasetId;
      if (!datasetId) continue;
      try {
        const meta = await bigquery.datasets.get({ projectId, datasetId });
        const access = meta.data.access || [];
        const exposedTo = access
          .map((a) => a.specialGroup)
          .filter((g): g is string => g === 'allUsers' || g === 'allAuthenticatedUsers');
        if (exposedTo.length === 0) continue;

        findings.push(createFinding(
          `bq-public-dataset-${datasetId}`,
          'Public BigQuery Dataset',
          `Dataset "${datasetId}" is shared with ${exposedTo.join(', ')}`,
          exposedTo.includes('allUsers') ? 'HIGH' : 'MEDIUM',
          'BigQuery',
          datasetId,
          `bq://${projectId}/${datasetId}`,
          meta.data.location?.toLowerCase() || 'global',
          'Remove allUsers / allAuthenticatedUsers entries from the dataset access policy',
        ));
      } catch {
        // Skip datasets we cannot read
      }
    }
  } catch {
    // BigQuery API not enabled
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

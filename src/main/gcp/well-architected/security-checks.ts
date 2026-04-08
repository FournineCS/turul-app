// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';
import { GCPWAFinding, GCPWAPillarSummary, GCPWACheckDefinition, GCPWAPillarId } from './types';

const CHECKS: GCPWACheckDefinition[] = [
  {
    id: 'GCP-SEC-001',
    title: 'KMS keys have rotation configured',
    description: 'Cloud KMS encryption keys should have automatic rotation enabled to limit the exposure window of a compromised key.',
    pillar: 'security',
    severity: 'HIGH',
    service: 'KMS',
    remediationRecommendation: 'Enable automatic key rotation for all Cloud KMS encryption keys. Set rotation period to 90 days or less.',
  },
  {
    id: 'GCP-SEC-002',
    title: 'No publicly accessible GCS buckets',
    description: 'Cloud Storage buckets should not be publicly accessible to prevent data exposure.',
    pillar: 'security',
    severity: 'HIGH',
    service: 'Cloud Storage',
    remediationRecommendation: 'Remove allUsers and allAuthenticatedUsers IAM bindings from Cloud Storage buckets. Use signed URLs for controlled public access.',
  },
  {
    id: 'GCP-SEC-003',
    title: 'No overly permissive firewall rules',
    description: 'VPC firewall rules should not allow SSH (port 22) or RDP (port 3389) from 0.0.0.0/0, which exposes instances to brute-force attacks.',
    pillar: 'security',
    severity: 'HIGH',
    service: 'VPC',
    remediationRecommendation: 'Restrict SSH and RDP firewall rules to specific source IP ranges. Use Identity-Aware Proxy (IAP) for secure remote access.',
  },
  {
    id: 'GCP-SEC-004',
    title: 'SSL enforced on Cloud SQL instances',
    description: 'Cloud SQL instances should enforce SSL connections to encrypt data in transit.',
    pillar: 'security',
    severity: 'MEDIUM',
    service: 'Cloud SQL',
    remediationRecommendation: 'Enable the "require SSL" setting on all Cloud SQL instances to enforce encrypted connections.',
  },
  {
    id: 'GCP-SEC-005',
    title: 'VPC Service Controls configured',
    description: 'VPC Service Controls should be configured to create security perimeters around sensitive services and data.',
    pillar: 'security',
    severity: 'MEDIUM',
    service: 'Access Context Manager',
    remediationRecommendation: 'Configure VPC Service Controls perimeters to protect sensitive GCP services. Start with dry-run mode to assess impact.',
  },
];

export async function runSecurityChecks(projectId: string): Promise<GCPWAPillarSummary> {
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  const findings: GCPWAFinding[] = [];

  // GCP-SEC-001: Check KMS key rotation
  try {
    const cloudkms = google.cloudkms({ version: 'v1', auth });
    const locationsResponse = await cloudkms.projects.locations.list({
      name: `projects/${projectId}`,
    });
    const locations = locationsResponse.data.locations || [];
    let totalKeys = 0;
    let keysWithoutRotation = 0;
    const keysWithoutRotationNames: string[] = [];

    for (const location of locations) {
      if (!location.name) continue;
      try {
        const keyRingsResponse = await cloudkms.projects.locations.keyRings.list({
          parent: location.name,
        });
        const keyRings = keyRingsResponse.data.keyRings || [];

        for (const keyRing of keyRings) {
          if (!keyRing.name) continue;
          try {
            const keysResponse = await cloudkms.projects.locations.keyRings.cryptoKeys.list({
              parent: keyRing.name,
            });
            const keys = keysResponse.data.cryptoKeys || [];

            for (const key of keys) {
              if (key.purpose !== 'ENCRYPT_DECRYPT') continue;
              totalKeys++;
              if (!key.rotationPeriod) {
                keysWithoutRotation++;
                keysWithoutRotationNames.push(key.name || '');
              }
            }
          } catch {
            // Skip key rings we cannot list
          }
        }
      } catch {
        // Skip locations we cannot list
      }
    }

    if (totalKeys === 0) {
      findings.push({
        check: CHECKS[0],
        status: 'PASS',
        resources: [],
        detail: 'No KMS encryption keys found (check not applicable)',
      });
    } else {
      findings.push({
        check: CHECKS[0],
        status: keysWithoutRotation === 0 ? 'PASS' : 'FAIL',
        resources: keysWithoutRotationNames,
        detail: keysWithoutRotation === 0
          ? `All ${totalKeys} KMS keys have rotation configured`
          : `${keysWithoutRotation} of ${totalKeys} KMS keys do not have rotation configured`,
      });
    }
  } catch (error) {
    findings.push({
      check: CHECKS[0],
      status: 'ERROR',
      resources: [],
      detail: `Failed to check KMS keys: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }

  // GCP-SEC-002: Check for public GCS buckets
  try {
    const storage = google.storage({ version: 'v1', auth });
    const bucketsResponse = await storage.buckets.list({ project: projectId });
    const buckets = bucketsResponse.data.items || [];
    const publicBuckets: string[] = [];

    for (const bucket of buckets) {
      if (!bucket.name) continue;
      try {
        const iamResponse = await storage.buckets.getIamPolicy({ bucket: bucket.name });
        const bindings = iamResponse.data.bindings || [];
        const isPublic = bindings.some((binding) =>
          (binding.members || []).some(
            (member) => member === 'allUsers' || member === 'allAuthenticatedUsers'
          )
        );
        if (isPublic) {
          publicBuckets.push(bucket.name);
        }
      } catch {
        // Skip buckets we cannot check IAM for
      }
    }

    findings.push({
      check: CHECKS[1],
      status: publicBuckets.length === 0 ? 'PASS' : 'FAIL',
      resources: publicBuckets,
      detail: publicBuckets.length === 0
        ? `All ${buckets.length} buckets have no public access`
        : `${publicBuckets.length} ${publicBuckets.length === 1 ? 'bucket is' : 'buckets are'} publicly accessible`,
    });
  } catch (error) {
    findings.push({
      check: CHECKS[1],
      status: 'ERROR',
      resources: [],
      detail: `Failed to check GCS buckets: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }

  // GCP-SEC-003: Check for overly permissive firewall rules (SSH/RDP from 0.0.0.0/0)
  try {
    const compute = google.compute({ version: 'v1', auth });
    const firewallsResponse = await compute.firewalls.list({ project: projectId });
    const firewalls = firewallsResponse.data.items || [];
    const permissiveRules: string[] = [];
    const sensitivePorts = ['22', '3389'];

    for (const rule of firewalls) {
      if (rule.direction !== 'INGRESS' || rule.disabled) continue;
      const sourceRanges = rule.sourceRanges || [];
      const hasOpenSource = sourceRanges.includes('0.0.0.0/0') || sourceRanges.includes('::/0');
      if (!hasOpenSource) continue;

      const allowed = rule.allowed || [];
      for (const allow of allowed) {
        const ports = allow.ports || [];
        const protocol = allow.IPProtocol || '';

        // Flag if allowing all traffic or specific sensitive ports
        if (protocol === 'all') {
          permissiveRules.push(rule.name || '');
          break;
        }
        if (protocol === 'tcp' || protocol === 'udp') {
          const exposedSensitive = ports.some((portRange) => {
            for (const sensitivePort of sensitivePorts) {
              if (portRange === sensitivePort) return true;
              if (portRange.includes('-')) {
                const [start, end] = portRange.split('-').map(Number);
                const port = Number(sensitivePort);
                if (port >= start && port <= end) return true;
              }
            }
            return false;
          });
          // Also flag if no ports specified (means all ports for that protocol)
          if (exposedSensitive || ports.length === 0) {
            permissiveRules.push(rule.name || '');
            break;
          }
        }
      }
    }

    findings.push({
      check: CHECKS[2],
      status: permissiveRules.length === 0 ? 'PASS' : 'FAIL',
      resources: permissiveRules,
      detail: permissiveRules.length === 0
        ? 'No firewall rules expose SSH or RDP from 0.0.0.0/0'
        : `${permissiveRules.length} firewall ${permissiveRules.length === 1 ? 'rule allows' : 'rules allow'} SSH/RDP from 0.0.0.0/0`,
    });
  } catch (error) {
    findings.push({
      check: CHECKS[2],
      status: 'ERROR',
      resources: [],
      detail: `Failed to check firewall rules: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }

  // GCP-SEC-004: Check SSL enforcement on Cloud SQL
  try {
    const sqladmin = google.sqladmin({ version: 'v1beta4', auth });
    const instancesResponse = await sqladmin.instances.list({ project: projectId });
    const instances = instancesResponse.data.items || [];
    const noSslInstances: string[] = [];

    for (const instance of instances) {
      const requireSsl = instance.settings?.ipConfiguration?.requireSsl;
      if (!requireSsl) {
        noSslInstances.push(instance.name || '');
      }
    }

    if (instances.length === 0) {
      findings.push({
        check: CHECKS[3],
        status: 'PASS',
        resources: [],
        detail: 'No Cloud SQL instances found (check not applicable)',
      });
    } else {
      findings.push({
        check: CHECKS[3],
        status: noSslInstances.length === 0 ? 'PASS' : 'FAIL',
        resources: noSslInstances,
        detail: noSslInstances.length === 0
          ? `All ${instances.length} Cloud SQL instances enforce SSL`
          : `${noSslInstances.length} of ${instances.length} Cloud SQL ${noSslInstances.length === 1 ? 'instance does' : 'instances do'} not enforce SSL`,
      });
    }
  } catch (error) {
    findings.push({
      check: CHECKS[3],
      status: 'ERROR',
      resources: [],
      detail: `Failed to check Cloud SQL instances: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }

  // GCP-SEC-005: Check if Access Context Manager / VPC Service Controls is configured
  try {
    const accesscontextmanager = google.accesscontextmanager({ version: 'v1', auth });
    const policiesResponse = await accesscontextmanager.accessPolicies.list({});
    const policies = policiesResponse.data.accessPolicies || [];
    const projectPolicies = policies.filter((p) => {
      const scopes = p.scopes || [];
      return scopes.length === 0 || scopes.some((s) => s.includes(projectId));
    });

    findings.push({
      check: CHECKS[4],
      status: projectPolicies.length > 0 ? 'PASS' : 'FAIL',
      resources: projectPolicies.map((p) => p.title || p.name || ''),
      detail: projectPolicies.length > 0
        ? `${projectPolicies.length} access ${projectPolicies.length === 1 ? 'policy' : 'policies'} found`
        : 'No VPC Service Controls access policies configured',
    });
  } catch (error) {
    findings.push({
      check: CHECKS[4],
      status: 'ERROR',
      resources: [],
      detail: `Failed to check VPC Service Controls: ${error instanceof Error ? error.message : 'Unknown error'}`,
    });
  }

  return buildSummary('security', 'Security, Privacy & Compliance', findings);
}

function buildSummary(pillar: GCPWAPillarId, pillarName: string, findings: GCPWAFinding[]): GCPWAPillarSummary {
  return {
    pillar,
    pillarName,
    totalChecks: findings.length,
    passCount: findings.filter((f) => f.status === 'PASS').length,
    failCount: findings.filter((f) => f.status === 'FAIL').length,
    errorCount: findings.filter((f) => f.status === 'ERROR').length,
    findings,
  };
}

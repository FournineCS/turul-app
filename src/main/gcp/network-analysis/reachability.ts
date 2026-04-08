// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';
import { GCPFirewallFinding, GCPExposedResource } from './types';

export async function analyzeFirewallRules(projectId: string): Promise<{
  findings: GCPFirewallFinding[];
  exposedResources: GCPExposedResource[];
  totalRules: number;
}> {
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  const compute = google.compute({ version: 'v1', auth });

  // 1. List all firewall rules
  const fwResponse = await compute.firewalls.list({ project: projectId });
  const firewalls = fwResponse.data.items || [];
  const findings: GCPFirewallFinding[] = [];

  // 2. Analyze each ingress rule for overly permissive sources
  for (const fw of firewalls) {
    if (fw.direction === 'EGRESS') continue;
    const hasOpenSource = fw.sourceRanges?.some(r => r === '0.0.0.0/0' || r === '::/0');
    if (!hasOpenSource) continue;

    for (const allowed of fw.allowed || []) {
      const protocol = allowed.IPProtocol || '';
      const ports = allowed.ports || [];

      const severity = getSeverity(protocol, ports);
      const issue = buildIssue(fw.name || '', protocol, ports);

      findings.push({
        ruleName: fw.name || '',
        network: extractNetworkName(fw.network || ''),
        direction: 'INGRESS',
        priority: fw.priority || 1000,
        sourceRanges: fw.sourceRanges || [],
        targetTags: fw.targetTags || [],
        targetServiceAccounts: fw.targetServiceAccounts || [],
        allowedPorts: [{ protocol, ports }],
        severity,
        issue,
        disabled: fw.disabled || false,
      });
    }
  }

  // 3. Find exposed compute instances (VMs with external IPs behind permissive rules)
  const exposedResources: GCPExposedResource[] = [];

  try {
    const instancesResponse = await compute.instances.aggregatedList({ project: projectId });
    const items = instancesResponse.data.items || {};

    for (const [zone, scopedList] of Object.entries(items)) {
      for (const instance of (scopedList as any).instances || []) {
        for (const ni of instance.networkInterfaces || []) {
          const externalIp = ni.accessConfigs?.find((ac: any) => ac.natIP)?.natIP;
          if (!externalIp) continue;

          const networkName = extractNetworkName(ni.network || '');
          const instanceTags = instance.tags?.items || [];

          // Match firewall rules by network and tags
          const matchingRules = findings.filter(f => {
            if (f.network !== networkName) return false;
            // Rules with no target tags/SAs apply to all instances in the network
            if (f.targetTags.length === 0 && f.targetServiceAccounts.length === 0) return true;
            return f.targetTags.some((t: string) => instanceTags.includes(t));
          });

          if (matchingRules.length > 0) {
            const openPorts = matchingRules.flatMap(r =>
              r.allowedPorts.map(ap => ({
                protocol: ap.protocol,
                port: ap.ports.join(',') || 'all',
                source: r.sourceRanges.join(', '),
              }))
            );

            const maxSeverity = getMaxSeverity(matchingRules.map(r => r.severity));

            exposedResources.push({
              resourceId: instance.id?.toString() || '',
              resourceType: 'instance',
              name: instance.name || '',
              zone: zone.replace('zones/', ''),
              network: networkName,
              externalIp,
              openPorts,
              severity: maxSeverity,
              exposureDetails: `${matchingRules.length} permissive firewall rule(s) allow internet traffic`,
            });
          }
        }
      }
    }
  } catch {
    // Compute instances API may not be available or accessible
  }

  // 4. Check Cloud SQL instances with public IP
  try {
    const sqladmin = google.sqladmin({ version: 'v1beta4', auth });
    const sqlResponse = await sqladmin.instances.list({ project: projectId });
    for (const instance of sqlResponse.data.items || []) {
      if (instance.settings?.ipConfiguration?.ipv4Enabled) {
        const publicIp = instance.ipAddresses?.find(ip => ip.type === 'PRIMARY')?.ipAddress;
        exposedResources.push({
          resourceId: instance.name || '',
          resourceType: 'cloud-sql',
          name: instance.name || '',
          zone: instance.gceZone || '',
          network: '',
          externalIp: publicIp || 'enabled',
          openPorts: [{ protocol: 'tcp', port: getDatabasePort(instance.databaseVersion || ''), source: 'public' }],
          severity: 'HIGH',
          exposureDetails: 'Cloud SQL instance has a public IP address',
        });
      }
    }
  } catch {
    // SQL Admin API may not be enabled
  }

  // 5. Check GKE clusters with public endpoints
  try {
    const container = google.container({ version: 'v1', auth });
    const clusterResponse = await container.projects.locations.clusters.list({
      parent: `projects/${projectId}/locations/-`,
    });
    for (const cluster of clusterResponse.data.clusters || []) {
      const isPrivate = cluster.privateClusterConfig?.enablePrivateEndpoint || false;
      const masterAuthorizedEnabled = cluster.masterAuthorizedNetworksConfig?.enabled || false;

      if (!isPrivate) {
        const endpoint = cluster.endpoint || '';
        exposedResources.push({
          resourceId: cluster.id || cluster.name || '',
          resourceType: 'gke-cluster',
          name: cluster.name || '',
          zone: cluster.location || '',
          network: extractNetworkName(cluster.network || ''),
          externalIp: endpoint,
          openPorts: [{ protocol: 'tcp', port: '443', source: masterAuthorizedEnabled ? 'authorized-networks' : '0.0.0.0/0' }],
          severity: masterAuthorizedEnabled ? 'MEDIUM' : 'HIGH',
          exposureDetails: masterAuthorizedEnabled
            ? 'GKE cluster has public endpoint with master authorized networks'
            : 'GKE cluster has public endpoint without master authorized networks restriction',
        });
      }
    }
  } catch {
    // Container API may not be enabled
  }

  return { findings, exposedResources, totalRules: firewalls.length };
}

function extractNetworkName(networkUrl: string): string {
  return networkUrl.split('/').pop() || '';
}

function getSeverity(protocol: string, ports: string[]): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' {
  if (protocol === 'all' || ports.includes('0-65535')) return 'CRITICAL';

  const criticalPorts = ['22', '3389'];
  const highPorts = ['3306', '5432', '1433', '27017', '6379', '9200'];
  const mediumPorts = ['80', '443', '8080', '8443'];

  for (const p of ports) {
    if (criticalPorts.includes(p)) return 'CRITICAL';
    if (highPorts.includes(p)) return 'HIGH';
    if (mediumPorts.includes(p)) return 'MEDIUM';
  }
  return 'LOW';
}

function getMaxSeverity(severities: string[]): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' {
  const order: Array<'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'> = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
  for (const s of order) {
    if (severities.includes(s)) return s;
  }
  return 'LOW';
}

function buildIssue(name: string, protocol: string, ports: string[]): string {
  if (protocol === 'all') return `Rule "${name}" allows ALL protocols from 0.0.0.0/0`;
  return `Rule "${name}" allows ${protocol} ports ${ports.join(',') || 'all'} from 0.0.0.0/0`;
}

function getDatabasePort(version: string): string {
  if (version.startsWith('MYSQL')) return '3306';
  if (version.startsWith('POSTGRES')) return '5432';
  if (version.startsWith('SQLSERVER')) return '1433';
  return '3306';
}

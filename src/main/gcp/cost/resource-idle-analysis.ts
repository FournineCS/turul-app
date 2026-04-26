// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import crypto from 'crypto';
import type { DatabaseManager } from '../../database/db-manager';
import type {
  ResourceIdleFinding,
  ResourceIdleAnalysisResult,
  IdleResourceIssueType,
} from '../../../shared/types/common';

// Pricing constants (US regions, approximate)
const DISK_PRICE_PER_GB: Record<string, number> = {
  'pd-ssd': 0.17,
  'pd-standard': 0.04,
  'pd-balanced': 0.10,
  'pd-extreme': 0.12,
  'hyperdisk-balanced': 0.12,
  'hyperdisk-throughput': 0.06,
  'hyperdisk-extreme': 0.14,
};
const DEFAULT_DISK_PRICE_PER_GB = 0.10;
const IDLE_STATIC_IP_MONTHLY = 7.30;
const IDLE_LB_MONTHLY = 18.00;
const EMPTY_DNS_ZONE_MONTHLY = 0.20;
// Conservative monthly cost estimates for new heuristics.
// Vertex AI endpoints with no deployed models still incur a base cost via the
// underlying resource pool; ~$0.50/hr for the smallest n1-standard-2 baseline ≈ $365/mo.
const IDLE_VERTEX_ENDPOINT_MONTHLY = 365.00;
// Composer 2 environments in ERROR state still bill for the GKE control plane,
// Composer fee, and database — a small environment is ~$300/mo when stuck in ERROR.
const ERRORED_COMPOSER_ENV_MONTHLY = 300.00;
// Orphaned forwarding rules — internal/external regional rules ~$0.025/hr ≈ $18/mo.
const ORPHANED_FORWARDING_RULE_MONTHLY = 18.00;
// Pub/Sub: empty topics carry no charge, but message-retention dead letters could.
// Use a low symbolic value to surface them without inflating savings totals.
const ORPHANED_PUBSUB_TOPIC_MONTHLY = 0.50;
const ORPHANED_PUBSUB_SUBSCRIPTION_MONTHLY = 0.50;

function getDiskPrice(diskType: string): number {
  return DISK_PRICE_PER_GB[diskType] ?? DEFAULT_DISK_PRICE_PER_GB;
}

function zoneToRegion(zone: string): string {
  // e.g. "us-central1-a" → "us-central1"
  const parts = zone.split('-');
  return parts.length >= 3 ? parts.slice(0, -1).join('-') : zone;
}

/**
 * Analyze idle GCP resources from existing scan data in SQLite.
 * Makes zero GCP API calls — reads only from the local DB.
 */
export async function analyzeIdleResources(
  scanId: string,
  dbManager: DatabaseManager
): Promise<ResourceIdleAnalysisResult> {
  const findings: ResourceIdleFinding[] = [];

  // ── 1. Stopped / Suspended VMs ──
  const gceInstances = dbManager.getResourcesByService(scanId, 'gce');
  for (const res of gceInstances) {
    if (res.resourceType !== 'instance') continue;
    const status = String(res.data.status ?? '');
    if (status !== 'TERMINATED' && status !== 'SUSPENDED') continue;

    // Estimate disk cost from attached disks in data
    let diskCost = 0;
    const disks = Array.isArray(res.data.disks) ? res.data.disks : [];
    for (const d of disks as Array<Record<string, unknown>>) {
      const sizeGb = Number(d.diskSizeGb ?? d.sizeGb ?? 0);
      const diskType = String(d.type ?? '').split('/').pop() ?? '';
      diskCost += sizeGb * getDiskPrice(diskType);
    }

    const zone = String(res.data.zone ?? res.region ?? '').split('/').pop() ?? res.region;
    const region = zoneToRegion(zone);

    findings.push({
      id: crypto.randomUUID(),
      resourceId: res.id,
      resourceName: res.name,
      service: 'gce',
      resourceType: 'instance',
      region,
      projectId: String(res.data.projectId ?? res.data.project ?? ''),
      issueType: 'stopped_vm',
      description: `VM is ${status.toLowerCase()} and accruing disk costs`,
      estimatedMonthlySavings: diskCost,
      details: { status, zone, diskCost },
    });
  }

  // ── 2. Unused External IPs ──
  const addresses = dbManager.getResourcesByService(scanId, 'cloud-address');
  for (const res of addresses) {
    if (res.resourceType !== 'address') continue;
    const addressType = String(res.data.addressType ?? '');
    const users = res.data.users;
    const hasUsers = Array.isArray(users) ? users.length > 0 : !!users;
    if (addressType !== 'EXTERNAL' || hasUsers) continue;

    findings.push({
      id: crypto.randomUUID(),
      resourceId: res.id,
      resourceName: res.name,
      service: 'cloud-address',
      resourceType: 'address',
      region: res.region,
      projectId: String(res.data.projectId ?? ''),
      issueType: 'unused_ip',
      description: 'Static external IP is reserved but not attached to any resource',
      estimatedMonthlySavings: IDLE_STATIC_IP_MONTHLY,
      details: { addressType, address: res.data.address },
    });
  }

  // ── 3. Unattached Persistent Disks ──
  const disks = dbManager.getResourcesByService(scanId, 'gce-disks');
  for (const res of disks) {
    if (res.resourceType !== 'disk') continue;
    const users = res.data.users;
    const hasUsers = Array.isArray(users) ? users.length > 0 : !!users;
    if (hasUsers) continue;

    const sizeGb = Number(res.data.sizeGb ?? 0);
    const diskType = String(res.data.type ?? '').split('/').pop() ?? '';
    const cost = sizeGb * getDiskPrice(diskType);
    const zone = String(res.data.zone ?? res.region ?? '').split('/').pop() ?? res.region;
    const region = zoneToRegion(zone);

    findings.push({
      id: crypto.randomUUID(),
      resourceId: res.id,
      resourceName: res.name,
      service: 'gce-disks',
      resourceType: 'disk',
      region,
      projectId: String(res.data.projectId ?? ''),
      issueType: 'unattached_disk',
      description: `Persistent disk (${sizeGb} GB, ${diskType || 'unknown type'}) is not attached to any VM`,
      estimatedMonthlySavings: cost,
      details: { sizeGb, diskType, zone },
    });
  }

  // ── 4. Unused Load Balancers (backend services with no backends) ──
  const lbs = dbManager.getResourcesByService(scanId, 'gclb');
  for (const res of lbs) {
    if (res.resourceType !== 'backend-service') continue;
    const backends = res.data.backends;
    const hasBackends = Array.isArray(backends) ? backends.length > 0 : !!backends;
    if (hasBackends) continue;

    findings.push({
      id: crypto.randomUUID(),
      resourceId: res.id,
      resourceName: res.name,
      service: 'gclb',
      resourceType: 'backend-service',
      region: res.region,
      projectId: String(res.data.projectId ?? ''),
      issueType: 'unused_lb',
      description: 'Load balancer backend service has no backends configured',
      estimatedMonthlySavings: IDLE_LB_MONTHLY,
      details: { protocol: res.data.protocol },
    });
  }

  // ── 5. Empty DNS Zones ──
  const dnsZones = dbManager.getResourcesByService(scanId, 'cloud-dns');
  for (const res of dnsZones) {
    if (res.resourceType !== 'managed-zone') continue;
    const recordCount = Number(res.data.recordCount ?? res.data.rrsets ?? 0);
    // SOA + NS = 2 default records; zone is effectively empty if <= 2
    if (recordCount > 2) continue;

    findings.push({
      id: crypto.randomUUID(),
      resourceId: res.id,
      resourceName: res.name,
      service: 'cloud-dns',
      resourceType: 'managed-zone',
      region: res.region,
      projectId: String(res.data.projectId ?? ''),
      issueType: 'empty_dns_zone',
      description: `DNS zone has ${recordCount} record(s) (only default SOA/NS) and appears unused`,
      estimatedMonthlySavings: EMPTY_DNS_ZONE_MONTHLY,
      details: { recordCount, dnsName: res.data.dnsName },
    });
  }

  // ── 6. Vertex AI endpoints with no deployed models ──
  const vertexEndpoints = dbManager.getResourcesByService(scanId, 'vertex-ai');
  for (const res of vertexEndpoints) {
    if (res.resourceType !== 'endpoint') continue;
    const deployedModels = res.data.deployedModels;
    const hasModels = Array.isArray(deployedModels) ? deployedModels.length > 0 : !!deployedModels;
    if (hasModels) continue;

    findings.push({
      id: crypto.randomUUID(),
      resourceId: res.id,
      resourceName: res.name,
      service: 'vertex-ai',
      resourceType: 'endpoint',
      region: res.region,
      projectId: String(res.data.projectId ?? ''),
      issueType: 'idle_vertex_endpoint',
      description: 'Vertex AI endpoint has no deployed models — delete to stop incurring infrastructure cost',
      estimatedMonthlySavings: IDLE_VERTEX_ENDPOINT_MONTHLY,
      details: { createTime: res.data.createTime },
    });
  }

  // ── 7. Composer environments stuck in ERROR state ──
  const composerEnvs = dbManager.getResourcesByService(scanId, 'composer');
  for (const res of composerEnvs) {
    if (res.resourceType !== 'environment') continue;
    const state = String(res.data.state ?? '').toUpperCase();
    if (state !== 'ERROR') continue;

    findings.push({
      id: crypto.randomUUID(),
      resourceId: res.id,
      resourceName: res.name,
      service: 'composer',
      resourceType: 'environment',
      region: res.region,
      projectId: String(res.data.projectId ?? ''),
      issueType: 'errored_composer_env',
      description: 'Composer environment is stuck in ERROR state — recreate or delete to stop ongoing charges',
      estimatedMonthlySavings: ERRORED_COMPOSER_ENV_MONTHLY,
      details: { state, createTime: res.data.createTime },
    });
  }

  // ── 8. Orphaned forwarding rules (no backend service / no target) ──
  const forwardingRules = dbManager.getResourcesByService(scanId, 'gclb-url-maps')
    .concat(dbManager.getResourcesByService(scanId, 'gclb'))
    .concat(dbManager.getResourcesByService(scanId, 'cloud-address'));
  for (const res of forwardingRules) {
    if (res.resourceType !== 'forwarding-rule') continue;
    const hasBackend = !!(res.data.backendService || res.data.target || res.data.targetService);
    if (hasBackend) continue;

    findings.push({
      id: crypto.randomUUID(),
      resourceId: res.id,
      resourceName: res.name,
      service: String(res.service ?? 'gclb'),
      resourceType: 'forwarding-rule',
      region: res.region,
      projectId: String(res.data.projectId ?? ''),
      issueType: 'orphaned_forwarding_rule',
      description: 'Forwarding rule has no backend service or target — delete to stop the per-rule monthly fee',
      estimatedMonthlySavings: ORPHANED_FORWARDING_RULE_MONTHLY,
      details: { ipAddress: res.data.IPAddress ?? res.data.ipAddress },
    });
  }

  // ── 9. Pub/Sub topics with no subscriptions ──
  const pubsubResources = dbManager.getResourcesByService(scanId, 'pubsub');
  const subscribedTopicNames = new Set<string>();
  for (const res of pubsubResources) {
    if (res.resourceType !== 'subscription') continue;
    const topicRef = String(res.data.topic ?? '');
    if (topicRef) subscribedTopicNames.add(topicRef);
  }
  for (const res of pubsubResources) {
    if (res.resourceType !== 'topic') continue;
    if (subscribedTopicNames.has(res.id)) continue;

    findings.push({
      id: crypto.randomUUID(),
      resourceId: res.id,
      resourceName: res.name,
      service: 'pubsub',
      resourceType: 'topic',
      region: res.region,
      projectId: String(res.data.projectId ?? ''),
      issueType: 'orphaned_pubsub_topic',
      description: 'Pub/Sub topic has no subscriptions — likely abandoned; review and delete',
      estimatedMonthlySavings: ORPHANED_PUBSUB_TOPIC_MONTHLY,
      details: {},
    });
  }

  // ── 10. Pub/Sub subscriptions whose topic is "_deleted-topic_" ──
  for (const res of pubsubResources) {
    if (res.resourceType !== 'subscription') continue;
    const topicRef = String(res.data.topic ?? '');
    // GCP marks subs whose topic was deleted with the literal "_deleted-topic_"
    if (!topicRef.includes('_deleted-topic_')) continue;

    findings.push({
      id: crypto.randomUUID(),
      resourceId: res.id,
      resourceName: res.name,
      service: 'pubsub',
      resourceType: 'subscription',
      region: res.region,
      projectId: String(res.data.projectId ?? ''),
      issueType: 'orphaned_pubsub_subscription',
      description: 'Pub/Sub subscription points to a deleted topic — message retention may still incur cost',
      estimatedMonthlySavings: ORPHANED_PUBSUB_SUBSCRIPTION_MONTHLY,
      details: { topic: topicRef },
    });
  }

  findings.sort((a, b) => b.estimatedMonthlySavings - a.estimatedMonthlySavings);

  const byType: Record<IdleResourceIssueType, number> = {
    stopped_vm: 0,
    unused_ip: 0,
    unattached_disk: 0,
    unused_lb: 0,
    empty_dns_zone: 0,
    idle_vertex_endpoint: 0,
    errored_composer_env: 0,
    orphaned_forwarding_rule: 0,
    orphaned_pubsub_topic: 0,
    orphaned_pubsub_subscription: 0,
  };
  for (const f of findings) byType[f.issueType]++;

  return {
    findings,
    scanId,
    scannedAt: new Date().toISOString(),
    totalFindings: findings.length,
    byType,
    estimatedMonthlySavings: findings.reduce((s, f) => s + f.estimatedMonthlySavings, 0),
  };
}

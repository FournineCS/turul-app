// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { getGCPClientFactory } from '../client-factory';
import { getGCPProjectManager } from '../project-manager';
import type { StoppedVMResult, StoppedVMInfo } from '../../../shared/types/common';

// GCP disk pricing per GB/month (US regions, approximate)
const DISK_PRICE_PER_GB: Record<string, number> = {
  'pd-ssd': 0.17,
  'pd-standard': 0.04,
  'pd-balanced': 0.10,
  'pd-extreme': 0.12,
  'hyperdisk-balanced': 0.12,
  'hyperdisk-throughput': 0.06,
  'hyperdisk-extreme': 0.14,
};

const DEFAULT_DISK_PRICE_PER_GB = 0.10; // pd-balanced fallback
const IDLE_STATIC_IP_MONTHLY = 7.30;    // GCP charges ~$7.30/mo for idle static external IPs

function getDiskPrice(diskType: string): number {
  return DISK_PRICE_PER_GB[diskType] ?? DEFAULT_DISK_PRICE_PER_GB;
}

/**
 * Scan all TERMINATED and SUSPENDED VMs in a GCP project and estimate their
 * ongoing monthly costs (persistent disks + idle static IPs).
 *
 * Uses the same @google-cloud/compute Cloud Client Library as compute-scanner.ts
 * to ensure auth consistency and correct response shape.
 */
export async function getStoppedVMs(projectId: string): Promise<StoppedVMResult> {
  const factory = getGCPClientFactory(projectId);
  const instancesClient = factory.getInstancesClient();
  const disksClient = factory.getDisksClient();

  // ── Step 1: Build a disk lookup map keyed by disk selfLink URL ──
  // DisksClient.aggregatedListAsync() returns full Disk resources including
  // sizeGb and type (unlike the disk attachment metadata in the Instance resource).
  const diskMap = new Map<string, { sizeGb: number; type: string }>();
  try {
    for await (const [, scopedList] of disksClient.aggregatedListAsync({ project: projectId })) {
      for (const disk of (scopedList.disks ?? [])) {
        if (disk.selfLink) {
          // disk.type is a full URL: .../diskTypes/pd-ssd → extract last segment
          const diskType = (disk.type ?? '').split('/').pop() ?? 'pd-standard';
          diskMap.set(disk.selfLink, {
            sizeGb: Number(disk.sizeGb ?? 0),
            type: diskType,
          });
        }
      }
    }
  } catch {
    // Non-fatal — cost estimates will fall back to 0 if disks can't be fetched
  }

  // ── Step 2: List all non-RUNNING instances, filter to TERMINATED/SUSPENDED ──
  // Use `status!=RUNNING` which is reliably supported by the Compute Engine filter API.
  // Then filter in code to exclude transient states (STAGING, PROVISIONING, REPAIRING).
  const vms: StoppedVMInfo[] = [];

  for await (const [, scopedList] of instancesClient.aggregatedListAsync({
    project: projectId,
    filter: 'status!=RUNNING',
  })) {
    for (const instance of (scopedList.instances ?? [])) {
      const status = instance.status as string;
      if (status !== 'TERMINATED' && status !== 'SUSPENDED') continue;

      // ── Disk cost calculation ──
      let totalDiskSizeGb = 0;
      let estimatedDiskMonthlyCost = 0;

      for (const attachedDisk of (instance.disks ?? [])) {
        const diskInfo = diskMap.get(attachedDisk.source ?? '');
        if (diskInfo) {
          totalDiskSizeGb += diskInfo.sizeGb;
          estimatedDiskMonthlyCost += diskInfo.sizeGb * getDiskPrice(diskInfo.type);
        }
      }

      // ── Static external IP detection ──
      let hasStaticExternalIp = false;
      let staticIpMonthlyCost = 0;

      for (const iface of (instance.networkInterfaces ?? [])) {
        for (const ac of (iface.accessConfigs ?? [])) {
          if (ac.natIP) {
            hasStaticExternalIp = true;
            staticIpMonthlyCost += IDLE_STATIC_IP_MONTHLY;
          }
        }
      }

      vms.push({
        name: instance.name ?? 'unknown',
        zone: (instance.zone ?? '').split('/').pop() ?? 'unknown',
        machineType: (instance.machineType ?? '').split('/').pop() ?? 'unknown',
        status: status as 'TERMINATED' | 'SUSPENDED',
        stoppedSince: instance.lastStartTimestamp ?? undefined,
        attachedDiskCount: instance.disks?.length ?? 0,
        totalDiskSizeGb,
        estimatedDiskMonthlyCost,
        hasStaticExternalIp,
        staticIpMonthlyCost,
        totalMonthlyCost: estimatedDiskMonthlyCost + staticIpMonthlyCost,
        labels: (instance.labels as Record<string, string>) ?? {},
      });
    }
  }

  vms.sort((a, b) => b.totalMonthlyCost - a.totalMonthlyCost);

  return {
    vms,
    totalEstimatedMonthlyCost: vms.reduce((s, v) => s + v.totalMonthlyCost, 0),
    currency: 'USD',
  };
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

/**
 * Scan stopped/suspended VMs across all accessible GCP projects.
 */
export async function getStoppedVMsOrgWide(_orgId: string): Promise<StoppedVMResult> {
  const projectManager = getGCPProjectManager();
  const allProjects = await projectManager.getProjectsWithBillingEnabled();

  const CONCURRENCY = 5;
  const allVMs: StoppedVMInfo[] = [];

  for (const batch of chunk(allProjects, CONCURRENCY)) {
    const results = await Promise.allSettled(
      batch.map(async (p) => {
        const result = await getStoppedVMs(p.projectId);
        return result.vms.map((vm) => ({ ...vm, projectId: p.projectId }));
      })
    );
    for (const r of results) {
      if (r.status === 'fulfilled') allVMs.push(...r.value);
    }
  }

  allVMs.sort((a, b) => b.totalMonthlyCost - a.totalMonthlyCost);

  return {
    vms: allVMs,
    totalEstimatedMonthlyCost: allVMs.reduce((s, v) => s + v.totalMonthlyCost, 0),
    currency: 'USD',
  };
}

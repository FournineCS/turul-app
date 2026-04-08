// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { v4 as uuidv4 } from 'uuid';
import { BrowserWindow } from 'electron';
import type { GCPScanConfig, GCPServiceType, ScanProgress, ScanError, Resource } from '../../shared/types';
import { DatabaseManager } from '../database/db-manager';
import { createGCPScanner, shouldSkipService, type GCPScanError } from '../gcp/scanners';
import { getGCPRelationshipBuilder } from './gcp-relationship-builder';
import { getGCPClientFactory } from '../gcp/client-factory';

/** Network service types that live in the host project for Shared VPC */
const SHARED_VPC_NETWORK_SERVICES: GCPServiceType[] = [
  'vpc-network', 'vpc-subnet', 'vpc-firewall', 'cloud-router',
];

interface ActiveGCPScan {
  scanId: string;
  cancelled: boolean;
}

let orchestratorInstance: GCPScanOrchestrator | null = null;

export class GCPScanOrchestrator {
  private dbManager: DatabaseManager;
  private mainWindow: BrowserWindow | null = null;
  private activeScan: ActiveGCPScan | null = null;
  private progressCallback: ((progress: ScanProgress) => void) | null = null;

  constructor(dbManager: DatabaseManager) {
    this.dbManager = dbManager;
  }

  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  setProgressCallback(callback: (progress: ScanProgress) => void): void {
    this.progressCallback = callback;
  }

  async startScan(config: GCPScanConfig): Promise<string> {
    if (this.activeScan) {
      throw new Error('A GCP scan is already in progress');
    }

    const scanId = uuidv4();
    const startedAt = new Date().toISOString();

    // Create scan record
    this.dbManager.createScan({
      id: scanId,
      profile: config.projectId, // Use projectId as "profile" for GCP
      regions: ['global'],       // GCP scans are project-scoped
      services: config.services,
      startedAt,
      status: 'running',
      cloudProvider: 'gcp',
    });

    this.activeScan = { scanId, cancelled: false };

    // Run asynchronously
    this.runScan(scanId, config).catch((error) => {
      console.error('GCP scan failed:', error);
      this.dbManager.updateScanStatus(
        scanId,
        'failed',
        new Date().toISOString(),
        error instanceof Error ? error.message : String(error)
      );
      this.activeScan = null;
      // Signal completion so the frontend resets scanning state
      this.sendProgress({
        scanId,
        currentRegion: 'done',
        currentService: 'failed',
        totalRegions: 1,
        completedRegions: 1,
        totalServices: 0,
        completedServices: 0,
        resourcesFound: 0,
        errors: [{ region: 'global', service: 'gcp', message: error instanceof Error ? error.message : String(error), timestamp: new Date().toISOString() }],
      });
    });

    return scanId;
  }

  stopScan(scanId: string): void {
    if (this.activeScan && this.activeScan.scanId === scanId) {
      this.activeScan.cancelled = true;
    }
  }

  private async runScan(scanId: string, config: GCPScanConfig): Promise<void> {
    const allResources: Resource[] = [];
    const allErrors: ScanError[] = [];

    // Filter out services that share scanners
    const servicesToScan = config.services.filter(s => !shouldSkipService(s));
    const totalServices = servicesToScan.length;
    let completedServices = 0;

    for (const serviceType of servicesToScan) {
      // Check cancellation
      if (this.activeScan?.cancelled) {
        this.dbManager.updateScanStatus(scanId, 'cancelled', new Date().toISOString());
        this.activeScan = null;
        this.sendProgress({
          scanId,
          currentRegion: 'done',
          currentService: 'cancelled',
          totalRegions: 1,
          completedRegions: 1,
          totalServices,
          completedServices,
          resourcesFound: allResources.length,
          errors: allErrors,
        });
        return;
      }

      // Send progress
      this.sendProgress({
        scanId,
        currentRegion: config.projectId,
        currentService: serviceType,
        totalRegions: 1,
        completedRegions: 0,
        totalServices,
        completedServices,
        resourcesFound: allResources.length,
        errors: allErrors,
      });

      // Create and run scanner
      const scanner = createGCPScanner(serviceType, {
        projectId: config.projectId,
        scanId,
      });

      if (!scanner) {
        completedServices++;
        continue;
      }

      try {
        const result = await scanner.scan();
        allResources.push(...result.resources);

        for (const err of result.errors) {
          allErrors.push({
            region: config.projectId,
            service: err.service,
            message: err.message,
            timestamp: new Date().toISOString(),
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[GCP Scan] ${serviceType}: FAILED — ${message}`);
        allErrors.push({
          region: config.projectId,
          service: serviceType,
          message,
          timestamp: new Date().toISOString(),
        });
      }

      completedServices++;
    }

    // ── Shared VPC detection and cross-project scanning ──
    const hasNetworkServices = config.services.some(s => SHARED_VPC_NETWORK_SERVICES.includes(s));
    const hasNetworkResources = allResources.some(r =>
      ['network', 'subnet', 'firewall-rule', 'router'].includes(r.resourceType)
    );

    if (hasNetworkServices && !hasNetworkResources) {
      try {
        this.sendProgress({
          scanId,
          currentRegion: config.projectId,
          currentService: 'Detecting Shared VPC...',
          totalRegions: 1,
          completedRegions: 0,
          totalServices,
          completedServices,
          resourcesFound: allResources.length,
          errors: allErrors,
        });

        // Step 1: Try to detect host project from instance data
        let hostProjectId = this.detectSharedVPCHost(allResources, config.projectId);

        // Step 2: Fallback to getXpnHost API if no host found from instances
        if (!hostProjectId) {
          hostProjectId = await this.detectSharedVPCHostViaAPI(config.projectId);
        }

        // Step 3: Scan network resources from the host project
        if (hostProjectId) {
          this.sendProgress({
            scanId,
            currentRegion: `${hostProjectId} (shared VPC host)`,
            currentService: 'Scanning network resources...',
            totalRegions: 1,
            completedRegions: 0,
            totalServices,
            completedServices,
            resourcesFound: allResources.length,
            errors: allErrors,
          });

          const hostResult = await this.scanHostProjectNetworkResources(
            scanId,
            hostProjectId,
            config.services,
          );
          allResources.push(...hostResult.resources);
          allErrors.push(...hostResult.errors);
        }

        // Step 4: Fallback — use listUsable for shared subnets even if host project scanning failed
        const hasSubnetsNow = allResources.some(r => r.resourceType === 'subnet');
        if (!hasSubnetsNow && config.services.includes('vpc-subnet')) {
          const usableSubnets = await this.scanUsableSubnets(scanId, config.projectId);
          allResources.push(...usableSubnets);

          // Also extract network IDs from usable subnets for VPC node creation
          if (usableSubnets.length > 0 && !allResources.some(r => r.resourceType === 'network')) {
            const networkLinks = new Set<string>();
            for (const subnet of usableSubnets) {
              const netLink = (subnet.data?.network as string) || '';
              if (netLink) networkLinks.add(netLink);
            }
            for (const netLink of networkLinks) {
              const nameMatch = netLink.match(/\/networks\/([^/]+)$/);
              const name = nameMatch ? nameMatch[1] : netLink;
              allResources.push({
                id: netLink || `shared-vpc-${name}`,
                scanId,
                service: 'vpc-network',
                resourceType: 'network',
                region: 'global',
                name,
                data: { name, selfLink: netLink, sharedVPC: true },
                tags: {},
                cloudProvider: 'gcp',
              });
            }
          }
        }
      } catch (sharedVpcError) {
        console.error('[GCP Shared VPC] Detection/scanning failed:', sharedVpcError);
        allErrors.push({
          region: config.projectId,
          service: 'vpc-network' as GCPServiceType,
          message: `Shared VPC detection failed: ${sharedVpcError instanceof Error ? sharedVpcError.message : String(sharedVpcError)}`,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Persist resources
    if (allResources.length > 0) {
      // Insert in batches of 500
      for (let i = 0; i < allResources.length; i += 500) {
        const batch = allResources.slice(i, i + 500);
        this.dbManager.insertResources(batch);
      }

      // Build and persist GCP relationships
      try {
        const gcpBuilder = getGCPRelationshipBuilder();
        const relationships = gcpBuilder.buildRelationships(scanId, allResources);
        if (relationships.length > 0) {
          this.dbManager.insertRelationships(relationships);
        }
      } catch (relError) {
        console.error('[GCP Scan] Relationship building failed:', relError);
        allErrors.push({
          region: config.projectId,
          service: 'gce' as GCPServiceType,
          message: `Relationship building failed: ${relError instanceof Error ? relError.message : String(relError)}`,
          timestamp: new Date().toISOString(),
        });
      }
    }

    // Update scan record
    this.dbManager.updateScanResourceCount(scanId, allResources.length);
    this.dbManager.updateScanStatus(scanId, 'completed', new Date().toISOString());

    // Final progress — use 'done' as currentRegion so the scan store detects completion
    this.sendProgress({
      scanId,
      currentRegion: 'done',
      currentService: 'complete',
      totalRegions: 1,
      completedRegions: 1,
      totalServices,
      completedServices: totalServices,
      resourcesFound: allResources.length,
      errors: allErrors,
    });

    this.activeScan = null;
  }

  /**
   * Detect Shared VPC host project from scanned instance networkInterfaces.
   * Returns the host project ID if instances reference a different project's network.
   */
  private detectSharedVPCHost(resources: Resource[], serviceProjectId: string): string | null {
    const hostProjects = new Set<string>();

    for (const resource of resources) {
      if (resource.resourceType !== 'instance') continue;
      const interfaces = resource.data?.networkInterfaces as
        | { network?: string; subnetwork?: string }[]
        | undefined;
      if (!interfaces) continue;
      for (const ni of interfaces) {
        const netLink = ni.network || ni.subnetwork || '';
        const match = netLink.match(/^(?:https:\/\/www\.googleapis\.com\/compute\/v1\/)?projects\/([^/]+)\//);
        if (match && match[1] !== serviceProjectId) {
          hostProjects.add(match[1]);
        }
      }
    }

    if (hostProjects.size === 0) return null;
    if (hostProjects.size > 1) {
      console.warn(`[GCP Shared VPC] Multiple host projects detected: ${[...hostProjects].join(', ')} — using first`);
    }
    const hostProjectId = [...hostProjects][0];
    return hostProjectId;
  }

  /**
   * Also try the getXpnHost API as a fallback when instance data doesn't reveal the host project.
   */
  private async detectSharedVPCHostViaAPI(serviceProjectId: string): Promise<string | null> {
    try {
      const factory = getGCPClientFactory(serviceProjectId);
      const client = factory.getProjectsClient();
      const [hostProject] = await client.getXpnHost({ project: serviceProjectId });
      if (hostProject && hostProject.name && hostProject.name !== serviceProjectId) {
        return hostProject.name;
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      // Not a shared VPC project, or no permission — both are fine
      if (!msg.includes('PERMISSION_DENIED') && !msg.includes('is not a shared VPC')) {
        console.warn(`[GCP Shared VPC] getXpnHost failed: ${msg}`);
      }
    }
    return null;
  }

  /**
   * Scan network resources from the Shared VPC host project.
   * Only scans the network service types that the user originally selected.
   */
  private async scanHostProjectNetworkResources(
    scanId: string,
    hostProjectId: string,
    requestedServices: GCPServiceType[],
  ): Promise<{ resources: Resource[]; errors: ScanError[] }> {
    const resources: Resource[] = [];
    const errors: ScanError[] = [];

    // Only scan network services that were in the user's original selection
    const networkServicesToScan = SHARED_VPC_NETWORK_SERVICES.filter(
      (s) => requestedServices.includes(s) && !shouldSkipService(s)
    );

    if (networkServicesToScan.length === 0) {
      return { resources, errors };
    }


    for (const serviceType of networkServicesToScan) {
      const scanner = createGCPScanner(serviceType, {
        projectId: hostProjectId,
        scanId,
      });
      if (!scanner) continue;

      try {
        const result = await scanner.scan();
        resources.push(...result.resources);

        for (const err of result.errors) {
          errors.push({
            region: hostProjectId,
            service: err.service,
            message: err.message,
            timestamp: new Date().toISOString(),
          });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`[GCP Shared VPC] ${serviceType} from ${hostProjectId}: FAILED — ${message}`);
        errors.push({
          region: hostProjectId,
          service: serviceType,
          message: `Shared VPC host (${hostProjectId}): ${message}`,
          timestamp: new Date().toISOString(),
        });
      }
    }

    return { resources, errors };
  }

  /**
   * Fallback: use listUsable to get shared subnets even without host project access.
   */
  private async scanUsableSubnets(
    scanId: string,
    serviceProjectId: string,
  ): Promise<Resource[]> {
    const resources: Resource[] = [];
    try {
      const factory = getGCPClientFactory(serviceProjectId);
      const client = factory.getSubnetworksClient();
      const iterable = client.listUsableAsync({ project: serviceProjectId });

      for await (const subnet of iterable) {
        const subnetLink = (subnet.subnetwork as string) || '';
        const networkLink = (subnet.network as string) || '';
        const ipCidrRange = (subnet.ipCidrRange as string) || '';

        // Extract region from subnet selfLink
        const regionMatch = subnetLink.match(/\/regions\/([^/]+)/);
        const region = regionMatch ? regionMatch[1] : 'global';
        const nameMatch = subnetLink.match(/\/subnetworks\/([^/]+)$/);
        const name = nameMatch ? nameMatch[1] : subnetLink;

        resources.push({
          id: subnetLink || `usable-subnet-${name}`,
          scanId,
          service: 'vpc-subnet',
          resourceType: 'subnet',
          region,
          name,
          data: {
            name,
            network: networkLink,
            ipCidrRange,
            subnetwork: subnetLink,
            sharedVPC: true,
          },
          tags: {},
          cloudProvider: 'gcp',
        });
      }

    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (!msg.includes('PERMISSION_DENIED') && !msg.includes('is not enabled')) {
        console.warn(`[GCP Shared VPC] listUsable failed: ${msg}`);
      }
    }
    return resources;
  }

  private sendProgress(progress: ScanProgress): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('scan:progress', progress);
    }
    if (this.progressCallback) {
      this.progressCallback(progress);
    }
  }
}

export function getGCPScanOrchestrator(dbManager: DatabaseManager): GCPScanOrchestrator {
  if (!orchestratorInstance) {
    orchestratorInstance = new GCPScanOrchestrator(dbManager);
  }
  return orchestratorInstance;
}

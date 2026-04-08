// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { v4 as uuidv4 } from 'uuid';
import { BrowserWindow } from 'electron';
import type {
  ScanConfig,
  Scan,
  ScanProgress,
  ScanStatus,
  ServiceType,
  Resource,
} from '../../shared/types';
import { DatabaseManager } from '../database/db-manager';
import { createScanner, type ScanResult } from '../aws/scanners';
import { getRelationshipBuilder } from './relationship-builder';
import { getRateLimiter } from '../aws/rate-limiter';

export class ScanOrchestrator {
  private dbManager: DatabaseManager;
  private activeScan: { id: string; cancelled: boolean } | null = null;
  private mainWindow: BrowserWindow | null = null;
  private progressCallback: ((progress: ScanProgress) => void) | null = null;

  // Global services only need to be scanned once regardless of selected regions
  private static readonly GLOBAL_SERVICES: Set<ServiceType> = new Set([
    'cloudfront', 'route53', 'iam', 'globalaccelerator',
    'shield', 'fms', 'organizations', 'trustedadvisor',
  ]);

  constructor(dbManager: DatabaseManager) {
    this.dbManager = dbManager;
  }

  setMainWindow(window: BrowserWindow): void {
    this.mainWindow = window;
  }

  setProgressCallback(callback: ((progress: ScanProgress) => void) | null): void {
    this.progressCallback = callback;
  }

  async startScan(config: ScanConfig): Promise<string> {
    if (this.activeScan) {
      throw new Error('A scan is already in progress');
    }

    const scanId = uuidv4();
    const scan: Omit<Scan, 'resourceCount'> = {
      id: scanId,
      profile: config.profileName,
      regions: config.regions,
      services: config.services,
      startedAt: new Date().toISOString(),
      status: 'running',
    };

    // Create scan record in database
    this.dbManager.createScan(scan);

    this.activeScan = { id: scanId, cancelled: false };

    // Run scan asynchronously
    this.runScan(scanId, config).catch((error) => {
      console.error('Scan failed:', error);
      this.dbManager.updateScanStatus(
        scanId,
        'failed',
        new Date().toISOString(),
        error.message
      );
    });

    return scanId;
  }

  async stopScan(scanId: string): Promise<void> {
    if (this.activeScan?.id === scanId) {
      this.activeScan.cancelled = true;
      this.dbManager.updateScanStatus(scanId, 'cancelled', new Date().toISOString());
    }
  }

  private async runScan(scanId: string, config: ScanConfig): Promise<void> {
    const allResources: Resource[] = [];
    const allErrors: ScanProgress['errors'] = [];

    const progress: ScanProgress = {
      scanId,
      currentRegion: '',
      currentService: '',
      totalRegions: config.regions.length,
      completedRegions: 0,
      totalServices: config.services.length,
      completedServices: 0,
      resourcesFound: 0,
      errors: [],
    };

    // Deduplicate services (EC2/VPC/Subnet/SecurityGroup all use EC2Scanner)
    const uniqueServices = this.deduplicateServices(config.services);

    // Track which global services have already been scanned
    const scannedGlobalServices = new Set<ServiceType>();

    try {
      for (let regionIdx = 0; regionIdx < config.regions.length; regionIdx++) {
        const region = config.regions[regionIdx];

        if (this.activeScan?.cancelled) {
          break;
        }

        progress.currentRegion = region;
        progress.completedServices = 0;

        for (let serviceIdx = 0; serviceIdx < uniqueServices.length; serviceIdx++) {
          const service = uniqueServices[serviceIdx];

          if (this.activeScan?.cancelled) {
            break;
          }

          // Skip global services if already scanned in a previous region
          if (ScanOrchestrator.GLOBAL_SERVICES.has(service) && scannedGlobalServices.has(service)) {
            progress.completedServices = serviceIdx + 1;
            this.sendProgress(progress);
            continue;
          }

          progress.currentService = service;
          this.sendProgress(progress);

          // Create scanner for this service
          const scanner = createScanner(service, {
            profile: config.profileName,
            region,
            scanId,
          });

          if (scanner) {
            try {
              const result = await scanner.scan();
              allResources.push(...result.resources);

              // Mark global service as scanned
              if (ScanOrchestrator.GLOBAL_SERVICES.has(service)) {
                scannedGlobalServices.add(service);
              }

              // Add errors to progress
              for (const error of result.errors) {
                allErrors.push({
                  region,
                  service: error.service,
                  message: error.message,
                  timestamp: new Date().toISOString(),
                });
              }
            } catch (error) {
              const message = error instanceof Error ? error.message : String(error);
              allErrors.push({
                region,
                service,
                message,
                timestamp: new Date().toISOString(),
              });
            }
          }

          progress.completedServices = serviceIdx + 1;
          progress.resourcesFound = allResources.length;
          progress.errors = allErrors;
          this.sendProgress(progress);
        }

        progress.completedRegions = regionIdx + 1;
      }

      // Store resources in database
      if (allResources.length > 0) {
        this.dbManager.insertResources(allResources);
      }

      // Build and store relationships
      const relationshipBuilder = getRelationshipBuilder();
      const relationships = relationshipBuilder.buildRelationships(scanId, allResources);

      if (relationships.length > 0) {
        this.dbManager.insertRelationships(relationships);
      }

      // Update scan status
      const finalStatus: ScanStatus = this.activeScan?.cancelled ? 'cancelled' : 'completed';
      this.dbManager.updateScanStatus(scanId, finalStatus, new Date().toISOString());
      this.dbManager.updateScanResourceCount(scanId, allResources.length);

      // Send final progress
      progress.currentRegion = 'done';
      progress.currentService = 'done';
      this.sendProgress(progress);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.dbManager.updateScanStatus(
        scanId,
        'failed',
        new Date().toISOString(),
        message
      );
      throw error;
    } finally {
      // Reset rate limiter
      getRateLimiter().resetAll();
      this.activeScan = null;
    }
  }

  private deduplicateServices(services: ServiceType[]): ServiceType[] {
    // EC2, VPC, Subnet, SecurityGroup all use the same scanner
    const ec2Related = new Set<ServiceType>(['ec2', 'vpc', 'subnet', 'securityGroup']);
    const hasEc2Related = services.some((s) => ec2Related.has(s));

    const result: ServiceType[] = [];
    const seen = new Set<ServiceType>();

    for (const service of services) {
      if (ec2Related.has(service)) {
        if (!seen.has('ec2')) {
          result.push('ec2');
          seen.add('ec2');
        }
      } else if (!seen.has(service)) {
        result.push(service);
        seen.add(service);
      }
    }

    return result;
  }

  private sendProgress(progress: ScanProgress): void {
    if (this.mainWindow && !this.mainWindow.isDestroyed()) {
      this.mainWindow.webContents.send('scan:progress', progress);
    }
    if (this.progressCallback) {
      this.progressCallback(progress);
    }
  }

  isScanning(): boolean {
    return this.activeScan !== null;
  }

  getActiveScanId(): string | null {
    return this.activeScan?.id || null;
  }
}

// Singleton instance
let scanOrchestrator: ScanOrchestrator | null = null;

export function getScanOrchestrator(dbManager?: DatabaseManager): ScanOrchestrator {
  if (!scanOrchestrator && dbManager) {
    scanOrchestrator = new ScanOrchestrator(dbManager);
  }
  if (!scanOrchestrator) {
    throw new Error('ScanOrchestrator not initialized');
  }
  return scanOrchestrator;
}

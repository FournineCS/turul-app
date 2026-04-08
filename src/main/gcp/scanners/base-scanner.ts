// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import type { Resource, GCPServiceType } from '../../../shared/types';

export interface GCPScannerConfig {
  projectId: string;
  scanId: string;
}

export interface GCPScanResult {
  resources: Resource[];
  errors: GCPScanError[];
}

export interface GCPScanError {
  service: GCPServiceType;
  operation: string;
  message: string;
}

// GCP regions for multi-region iteration
export const GCP_REGIONS = [
  'us-central1', 'us-east1', 'us-east4', 'us-west1', 'us-west2', 'us-west3', 'us-west4',
  'us-south1', 'northamerica-northeast1', 'northamerica-northeast2',
  'southamerica-east1', 'southamerica-west1',
  'europe-west1', 'europe-west2', 'europe-west3', 'europe-west4', 'europe-west6',
  'europe-west8', 'europe-west9', 'europe-north1', 'europe-central2',
  'asia-east1', 'asia-east2', 'asia-northeast1', 'asia-northeast2', 'asia-northeast3',
  'asia-south1', 'asia-south2', 'asia-southeast1', 'asia-southeast2',
  'australia-southeast1', 'australia-southeast2',
  'me-west1', 'me-central1', 'africa-south1',
];

export abstract class GCPBaseScanner {
  protected config: GCPScannerConfig;
  protected serviceType: GCPServiceType;
  protected serviceName: string;

  constructor(config: GCPScannerConfig, serviceType: GCPServiceType, serviceName: string) {
    this.config = config;
    this.serviceType = serviceType;
    this.serviceName = serviceName;
  }

  abstract scan(): Promise<GCPScanResult>;

  protected createResource(
    id: string,
    resourceType: string,
    name: string,
    region: string,
    data: Record<string, unknown>,
    tags: Record<string, string> = {},
    createdAt?: string
  ): Resource {
    return {
      id,
      scanId: this.config.scanId,
      service: this.serviceType,
      resourceType,
      region,
      name,
      data,
      tags,
      createdAt,
      cloudProvider: 'gcp',
    };
  }

  protected createError(operation: string, error: unknown): GCPScanError {
    const message = error instanceof Error ? error.message : String(error);
    return {
      service: this.serviceType,
      operation,
      message,
    };
  }

  protected isApiNotEnabled(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return (
      message.includes('has not been used in project') ||
      message.includes('is not enabled') ||
      message.includes('API_NOT_ENABLED') ||
      message.includes('accessNotConfigured')
    );
  }

  /** Check if the error is a permission issue (reported but non-fatal) */
  protected isPermissionDenied(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error);
    return message.includes('PERMISSION_DENIED') || message.includes('Caller does not have required permission');
  }

  protected extractRegionFromZone(zone: string): string {
    // e.g., "us-central1-a" -> "us-central1"
    const parts = zone.split('-');
    if (parts.length >= 3) {
      // Remove the zone letter suffix
      return parts.slice(0, -1).join('-');
    }
    return zone;
  }

  protected extractZoneFromSelfLink(selfLink: string): string {
    const match = selfLink.match(/\/zones\/([^/]+)/);
    return match ? match[1] : 'global';
  }

  protected extractRegionFromSelfLink(selfLink: string): string {
    const zoneMatch = selfLink.match(/\/zones\/([^/]+)/);
    if (zoneMatch) {
      return this.extractRegionFromZone(zoneMatch[1]);
    }
    const regionMatch = selfLink.match(/\/regions\/([^/]+)/);
    if (regionMatch) {
      return regionMatch[1];
    }
    return 'global';
  }

  protected parseLabels(labels?: Record<string, string> | null): Record<string, string> {
    return labels ? { ...labels } : {};
  }

  protected parseTimestamp(timestamp?: string | null): string | undefined {
    if (!timestamp) return undefined;
    return new Date(timestamp).toISOString();
  }
}

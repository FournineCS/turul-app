// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import type { Resource, ServiceType } from '../../../shared/types';
import { withRateLimit } from '../rate-limiter';

export interface ScannerConfig {
  profile: string;
  region: string;
  scanId: string;
}

export interface ScanResult {
  resources: Resource[];
  errors: ScanError[];
}

export interface ScanError {
  service: ServiceType;
  operation: string;
  message: string;
}

export abstract class BaseScanner {
  protected config: ScannerConfig;
  protected serviceType: ServiceType;
  protected serviceName: string;

  constructor(config: ScannerConfig, serviceType: ServiceType, serviceName: string) {
    this.config = config;
    this.serviceType = serviceType;
    this.serviceName = serviceName;
  }

  abstract scan(): Promise<ScanResult>;

  protected async withRateLimit<T>(operation: () => Promise<T>): Promise<T> {
    return withRateLimit(this.serviceName, this.config.region, operation);
  }

  protected createResource(
    id: string,
    resourceType: string,
    name: string,
    data: Record<string, unknown>,
    tags: Record<string, string> = {},
    createdAt?: string
  ): Resource {
    return {
      id,
      scanId: this.config.scanId,
      service: this.serviceType,
      resourceType,
      region: this.config.region,
      name,
      data,
      tags,
      createdAt,
    };
  }

  protected createError(operation: string, error: unknown): ScanError {
    const message = error instanceof Error ? error.message : String(error);
    return {
      service: this.serviceType,
      operation,
      message,
    };
  }

  protected parseTags(
    tags?: { Key?: string; Value?: string }[]
  ): Record<string, string> {
    const result: Record<string, string> = {};

    if (tags) {
      for (const tag of tags) {
        if (tag.Key) {
          result[tag.Key] = tag.Value || '';
        }
      }
    }

    return result;
  }

  // Parse tags with lowercase key/value (used by ECS, EKS, Step Functions, etc.)
  protected parseTagsLowercase(
    tags?: { key?: string; value?: string }[]
  ): Record<string, string> {
    const result: Record<string, string> = {};

    if (tags) {
      for (const tag of tags) {
        if (tag.key) {
          result[tag.key] = tag.value || '';
        }
      }
    }

    return result;
  }

  protected getNameFromTags(tags: Record<string, string>): string {
    return tags['Name'] || tags['name'] || '';
  }
}

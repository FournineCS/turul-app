// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  ListCoverageCommand,
} from '@aws-sdk/client-inspector2';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class InspectorScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'inspector', 'inspector');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getInspector2Client({
      profile: this.config.profile,
      region: this.config.region,
    });

    try {
      let nextToken: string | undefined;

      do {
        const response = await this.withRateLimit(() =>
          client.send(new ListCoverageCommand({ nextToken }))
        );

        if (response.coveredResources) {
          for (const coveredResource of response.coveredResources) {
            if (!coveredResource.resourceId) continue;

            const arn = coveredResource.resourceId;
            const name = coveredResource.resourceId.split('/').pop() || coveredResource.resourceId;

            resources.push(this.createResource(
              arn,
              'coverage',
              name,
              {
                resourceId: coveredResource.resourceId,
                resourceType: coveredResource.resourceType,
                accountId: coveredResource.accountId,
                scanType: coveredResource.scanType,
                scanStatus: coveredResource.scanStatus ? {
                  statusCode: coveredResource.scanStatus.statusCode,
                  reason: coveredResource.scanStatus.reason,
                } : undefined,
                lastScannedAt: coveredResource.lastScannedAt?.toISOString(),
              },
              {}
            ));
          }
        }

        nextToken = response.nextToken;
      } while (nextToken);
    } catch (error) {
      errors.push(this.createError('ListCoverage', error));
    }

    return { resources, errors };
  }
}

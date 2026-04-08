// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  ListAnalyzersCommand,
} from '@aws-sdk/client-accessanalyzer';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class AccessAnalyzerScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'accessanalyzer', 'accessanalyzer');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getAccessAnalyzerClient({
      profile: this.config.profile,
      region: this.config.region,
    });

    try {
      let nextToken: string | undefined;

      do {
        const response = await this.withRateLimit(() =>
          client.send(new ListAnalyzersCommand({ nextToken }))
        );

        if (response.analyzers) {
          for (const analyzer of response.analyzers) {
            if (!analyzer.arn) continue;

            const tags: Record<string, string> = analyzer.tags || {};

            resources.push(this.createResource(
              analyzer.arn,
              'analyzer',
              analyzer.name || '',
              {
                analyzerName: analyzer.name,
                type: analyzer.type,
                status: analyzer.status,
                lastResourceAnalyzed: analyzer.lastResourceAnalyzed,
                lastResourceAnalyzedAt: analyzer.lastResourceAnalyzedAt?.toISOString(),
              },
              tags,
              analyzer.createdAt?.toISOString()
            ));
          }
        }

        nextToken = response.nextToken;
      } while (nextToken);
    } catch (error) {
      errors.push(this.createError('ListAnalyzers', error));
    }

    return { resources, errors };
  }
}

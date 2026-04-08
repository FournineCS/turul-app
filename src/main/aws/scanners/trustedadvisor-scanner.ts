// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  ListRecommendationsCommand,
  ListChecksCommand,
} from '@aws-sdk/client-trustedadvisor';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class TrustedAdvisorScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'trustedadvisor', 'trustedadvisor');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getTrustedAdvisorClient({
      profile: this.config.profile,
      region: this.config.region,
    });

    // List recommendations with pagination
    try {
      let nextToken: string | undefined;

      do {
        const response = await this.withRateLimit(() =>
          client.send(new ListRecommendationsCommand({ nextToken }))
        );

        if (response.recommendationSummaries) {
          for (const rec of response.recommendationSummaries) {
            if (!rec.arn) continue;

            resources.push(this.createResource(
              rec.arn,
              'recommendation',
              rec.name || rec.id || '',
              {
                recommendationId: rec.id,
                name: rec.name,
                type: rec.type,
                status: rec.status,
                pillars: rec.pillars,
                source: rec.source,
                awsServices: rec.awsServices,
                checkArn: rec.checkArn,
                lifecycleStage: rec.lifecycleStage,
                resourcesAggregates: rec.resourcesAggregates ? {
                  okCount: rec.resourcesAggregates.okCount,
                  warningCount: rec.resourcesAggregates.warningCount,
                  errorCount: rec.resourcesAggregates.errorCount,
                  excludedCount: rec.resourcesAggregates.excludedCount,
                } : undefined,
                pillarSpecificAggregates: rec.pillarSpecificAggregates?.costOptimizing ? {
                  estimatedMonthlySavings: rec.pillarSpecificAggregates.costOptimizing.estimatedMonthlySavings,
                  estimatedPercentMonthlySavings: rec.pillarSpecificAggregates.costOptimizing.estimatedPercentMonthlySavings,
                } : undefined,
                lastUpdatedAt: rec.lastUpdatedAt?.toISOString(),
              },
              {},
              rec.createdAt?.toISOString(),
            ));
          }
        }

        nextToken = response.nextToken;
      } while (nextToken);
    } catch (error: unknown) {
      if (this.isSubscriptionError(error)) {
        // Trusted Advisor requires Business or Enterprise Support plan
        return { resources, errors };
      }
      errors.push(this.createError('ListRecommendations', error));
    }

    // List checks with pagination
    try {
      let nextToken: string | undefined;

      do {
        const response = await this.withRateLimit(() =>
          client.send(new ListChecksCommand({ nextToken }))
        );

        if (response.checkSummaries) {
          for (const check of response.checkSummaries) {
            if (!check.arn) continue;

            resources.push(this.createResource(
              check.arn,
              'check',
              check.name || check.id || '',
              {
                checkId: check.id,
                name: check.name,
                description: check.description,
                pillars: check.pillars,
                source: check.source,
                awsServices: check.awsServices,
                metadata: check.metadata,
              },
              {},
            ));
          }
        }

        nextToken = response.nextToken;
      } while (nextToken);
    } catch (error: unknown) {
      if (this.isSubscriptionError(error)) {
        // Trusted Advisor requires Business or Enterprise Support plan
        return { resources, errors };
      }
      errors.push(this.createError('ListChecks', error));
    }

    return { resources, errors };
  }

  /**
   * Check if the error indicates the account lacks the required
   * Business/Enterprise Support plan for Trusted Advisor API access.
   */
  private isSubscriptionError(error: unknown): boolean {
    const errorName = (error as { name?: string })?.name;
    const errorMessage = error instanceof Error ? error.message : String(error);
    return (
      errorName === 'AccessDeniedException' ||
      errorName === 'SubscriptionRequiredException' ||
      errorMessage.includes('not subscribed') ||
      errorMessage.includes('subscription is required')
    );
  }
}

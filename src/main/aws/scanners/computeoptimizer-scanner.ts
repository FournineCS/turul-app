// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  GetEC2InstanceRecommendationsCommand,
  GetEBSVolumeRecommendationsCommand,
  GetLambdaFunctionRecommendationsCommand,
} from '@aws-sdk/client-compute-optimizer';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class ComputeOptimizerScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'computeoptimizer', 'computeoptimizer');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getComputeOptimizerClient({
      profile: this.config.profile,
      region: this.config.region,
    });

    // Scan EC2 instance recommendations
    try {
      let nextToken: string | undefined;

      do {
        const response = await this.withRateLimit(() =>
          client.send(new GetEC2InstanceRecommendationsCommand({
            nextToken,
          }))
        );

        if (response.instanceRecommendations) {
          for (const rec of response.instanceRecommendations) {
            if (!rec.instanceArn) continue;

            const name = rec.instanceName || rec.instanceArn.split('/').pop() || rec.instanceArn;

            resources.push(this.createResource(
              rec.instanceArn,
              'ec2-recommendation',
              name,
              {
                instanceArn: rec.instanceArn,
                instanceName: rec.instanceName,
                accountId: rec.accountId,
                finding: rec.finding,
                findingReasonCodes: rec.findingReasonCodes,
                currentInstanceType: rec.currentInstanceType,
                currentPerformanceRisk: rec.currentPerformanceRisk,
                lookBackPeriodInDays: rec.lookBackPeriodInDays,
                lastRefreshTimestamp: rec.lastRefreshTimestamp?.toISOString(),
                utilizationMetrics: rec.utilizationMetrics?.map((m) => ({
                  name: m.name,
                  statistic: m.statistic,
                  value: m.value,
                })),
                recommendationOptions: rec.recommendationOptions?.map((opt) => ({
                  instanceType: opt.instanceType,
                  performanceRisk: opt.performanceRisk,
                  rank: opt.rank,
                  savingsOpportunity: opt.savingsOpportunity ? {
                    savingsOpportunityPercentage: opt.savingsOpportunity.savingsOpportunityPercentage,
                    estimatedMonthlySavings: opt.savingsOpportunity.estimatedMonthlySavings ? {
                      currency: opt.savingsOpportunity.estimatedMonthlySavings.currency,
                      value: opt.savingsOpportunity.estimatedMonthlySavings.value,
                    } : undefined,
                  } : undefined,
                  projectedUtilizationMetrics: opt.projectedUtilizationMetrics?.map((m) => ({
                    name: m.name,
                    statistic: m.statistic,
                    value: m.value,
                  })),
                  migrationEffort: opt.migrationEffort,
                })),
                effectiveRecommendationPreferences: rec.effectiveRecommendationPreferences ? {
                  cpuVendorArchitectures: rec.effectiveRecommendationPreferences.cpuVendorArchitectures,
                  enhancedInfrastructureMetrics: rec.effectiveRecommendationPreferences.enhancedInfrastructureMetrics,
                  inferredWorkloadTypes: rec.effectiveRecommendationPreferences.inferredWorkloadTypes,
                } : undefined,
                inferredWorkloadTypes: rec.inferredWorkloadTypes,
              },
              {},
              rec.lastRefreshTimestamp?.toISOString(),
            ));
          }
        }

        nextToken = response.nextToken;
      } while (nextToken);
    } catch (error: unknown) {
      if (this.isOptInRequiredException(error)) {
        return { resources, errors };
      }
      errors.push(this.createError('GetEC2InstanceRecommendations', error));
    }

    // Scan EBS volume recommendations
    try {
      let nextToken: string | undefined;

      do {
        const response = await this.withRateLimit(() =>
          client.send(new GetEBSVolumeRecommendationsCommand({
            nextToken,
          }))
        );

        if (response.volumeRecommendations) {
          for (const rec of response.volumeRecommendations) {
            if (!rec.volumeArn) continue;

            const name = rec.volumeArn.split('/').pop() || rec.volumeArn;

            resources.push(this.createResource(
              rec.volumeArn,
              'ebs-recommendation',
              name,
              {
                volumeArn: rec.volumeArn,
                accountId: rec.accountId,
                finding: rec.finding,
                lookBackPeriodInDays: rec.lookBackPeriodInDays,
                lastRefreshTimestamp: rec.lastRefreshTimestamp?.toISOString(),
                currentConfiguration: rec.currentConfiguration ? {
                  volumeType: rec.currentConfiguration.volumeType,
                  volumeSize: rec.currentConfiguration.volumeSize,
                  volumeBaselineIOPS: rec.currentConfiguration.volumeBaselineIOPS,
                  volumeBurstIOPS: rec.currentConfiguration.volumeBurstIOPS,
                  volumeBaselineThroughput: rec.currentConfiguration.volumeBaselineThroughput,
                  volumeBurstThroughput: rec.currentConfiguration.volumeBurstThroughput,
                  rootVolume: rec.currentConfiguration.rootVolume,
                } : undefined,
                utilizationMetrics: rec.utilizationMetrics?.map((m) => ({
                  name: m.name,
                  statistic: m.statistic,
                  value: m.value,
                })),
                volumeRecommendationOptions: rec.volumeRecommendationOptions?.map((opt) => ({
                  configuration: opt.configuration ? {
                    volumeType: opt.configuration.volumeType,
                    volumeSize: opt.configuration.volumeSize,
                    volumeBaselineIOPS: opt.configuration.volumeBaselineIOPS,
                    volumeBurstIOPS: opt.configuration.volumeBurstIOPS,
                    volumeBaselineThroughput: opt.configuration.volumeBaselineThroughput,
                    volumeBurstThroughput: opt.configuration.volumeBurstThroughput,
                  } : undefined,
                  performanceRisk: opt.performanceRisk,
                  rank: opt.rank,
                  savingsOpportunity: opt.savingsOpportunity ? {
                    savingsOpportunityPercentage: opt.savingsOpportunity.savingsOpportunityPercentage,
                    estimatedMonthlySavings: opt.savingsOpportunity.estimatedMonthlySavings ? {
                      currency: opt.savingsOpportunity.estimatedMonthlySavings.currency,
                      value: opt.savingsOpportunity.estimatedMonthlySavings.value,
                    } : undefined,
                  } : undefined,
                })),
              },
              {},
              rec.lastRefreshTimestamp?.toISOString(),
            ));
          }
        }

        nextToken = response.nextToken;
      } while (nextToken);
    } catch (error: unknown) {
      if (this.isOptInRequiredException(error)) {
        return { resources, errors };
      }
      errors.push(this.createError('GetEBSVolumeRecommendations', error));
    }

    // Scan Lambda function recommendations
    try {
      let nextToken: string | undefined;

      do {
        const response = await this.withRateLimit(() =>
          client.send(new GetLambdaFunctionRecommendationsCommand({
            nextToken,
          }))
        );

        if (response.lambdaFunctionRecommendations) {
          for (const rec of response.lambdaFunctionRecommendations) {
            if (!rec.functionArn) continue;

            const name = rec.functionArn.split(':').pop() || rec.functionArn;

            resources.push(this.createResource(
              rec.functionArn,
              'lambda-recommendation',
              name,
              {
                functionArn: rec.functionArn,
                functionVersion: rec.functionVersion,
                accountId: rec.accountId,
                finding: rec.finding,
                findingReasonCodes: rec.findingReasonCodes,
                lookbackPeriodInDays: rec.lookbackPeriodInDays,
                lastRefreshTimestamp: rec.lastRefreshTimestamp?.toISOString(),
                numberOfInvocations: rec.numberOfInvocations,
                currentMemorySize: rec.currentMemorySize,
                currentPerformanceRisk: rec.currentPerformanceRisk,
                utilizationMetrics: rec.utilizationMetrics?.map((m) => ({
                  name: m.name,
                  statistic: m.statistic,
                  value: m.value,
                })),
                memorySizeRecommendationOptions: rec.memorySizeRecommendationOptions?.map((opt) => ({
                  memorySize: opt.memorySize,
                  rank: opt.rank,
                  savingsOpportunity: opt.savingsOpportunity ? {
                    savingsOpportunityPercentage: opt.savingsOpportunity.savingsOpportunityPercentage,
                    estimatedMonthlySavings: opt.savingsOpportunity.estimatedMonthlySavings ? {
                      currency: opt.savingsOpportunity.estimatedMonthlySavings.currency,
                      value: opt.savingsOpportunity.estimatedMonthlySavings.value,
                    } : undefined,
                  } : undefined,
                  projectedUtilizationMetrics: opt.projectedUtilizationMetrics?.map((m) => ({
                    name: m.name,
                    statistic: m.statistic,
                    value: m.value,
                  })),
                })),
              },
              {},
              rec.lastRefreshTimestamp?.toISOString(),
            ));
          }
        }

        nextToken = response.nextToken;
      } while (nextToken);
    } catch (error: unknown) {
      if (this.isOptInRequiredException(error)) {
        return { resources, errors };
      }
      errors.push(this.createError('GetLambdaFunctionRecommendations', error));
    }

    return { resources, errors };
  }

  private isOptInRequiredException(error: unknown): boolean {
    const errorName = (error as { name?: string })?.name;
    return errorName === 'OptInRequiredException';
  }
}

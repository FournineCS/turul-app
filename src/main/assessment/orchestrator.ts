// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { v4 as uuidv4 } from 'uuid';
import type {
  AssessmentConfig,
  AssessmentResult,
  AssessmentProgress,
  CostAnalysisResult,
  CostOptimizationResult,
  SecurityAnalysisResult,
  WABPScanResult,
} from '../../shared/types';
import { getDetailedCostAnalysis, getCostOptimizations } from '../aws/discovery/cost-explorer';
import { getSecurityFindings } from '../aws/security/security-hub';
import { runBestPracticesScan as runSecurityBPScan } from '../aws/security/best-practices';
import { runWABestPracticesScan } from '../aws/well-architected';
import { getProfileManager } from '../aws/profile-manager';
import {
  scoreCostDomain,
  scoreSecurityDomain,
  scoreWellArchitectedDomain,
  scoreInventoryDomain,
  computeOverallScore,
} from './scoring';
import {
  extractCostRecommendations,
  extractSecurityRecommendations,
  extractWARecommendations,
  extractInventoryRecommendations,
  resetRecommendationCounter,
} from './recommendations';

type ProgressCallback = (progress: AssessmentProgress) => void;

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

export async function runAssessment(
  config: AssessmentConfig,
  onProgress?: ProgressCallback
): Promise<AssessmentResult> {
  const startTime = Date.now();
  const assessmentId = uuidv4();
  const errors: string[] = [];

  resetRecommendationCounter();

  // Validate profile and get account ID
  onProgress?.({ stage: 'validating', percent: 5, message: 'Validating AWS profile...' });

  let accountId: string | undefined;
  try {
    const profileManager = getProfileManager();
    const validation = await profileManager.validateProfile(config.profile);
    accountId = validation.accountId;
  } catch (err) {
    errors.push(`Profile validation failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
  }

  // Determine which domains to run
  const domains = config.domains;
  const totalDomains = domains.length;
  let completedDomains = 0;

  const updateProgress = (stage: string, message: string) => {
    const basePercent = 10;
    const domainPercent = 80;
    const percent = basePercent + Math.round((completedDomains / totalDomains) * domainPercent);
    onProgress?.({ stage, percent, message });
  };

  // Run domains in parallel
  let costData: CostAnalysisResult | undefined;
  let costOptimizations: CostOptimizationResult | undefined;
  let securityData: SecurityAnalysisResult | undefined;
  let waData: WABPScanResult | undefined;
  let resourceSummary: AssessmentResult['resourceSummary'] | undefined;

  const promises: Promise<void>[] = [];

  // Cost domain
  if (domains.includes('cost')) {
    promises.push(
      (async () => {
        updateProgress('cost', 'Analyzing costs...');
        try {
          const days = config.costDays || 30;
          const endDate = new Date();
          const startDate = new Date();
          startDate.setDate(startDate.getDate() - days);

          const [analysis, optimizations] = await Promise.all([
            getDetailedCostAnalysis(config.profile, formatDate(startDate), formatDate(endDate), 'DAILY'),
            getCostOptimizations(config.profile, days, config.region),
          ]);

          costData = analysis;
          costOptimizations = optimizations;
        } catch (err) {
          errors.push(`Cost analysis failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
        completedDomains++;
        updateProgress('cost', 'Cost analysis complete');
      })()
    );
  }

  // Security domain
  if (domains.includes('security')) {
    promises.push(
      (async () => {
        updateProgress('security', 'Analyzing security posture...');
        try {
          // Try Security Hub first, fall back to best practices
          try {
            const hubResult = await getSecurityFindings(config.profile, config.region, false);
            if (hubResult.error && (hubResult.error.includes('not enabled') || hubResult.error.includes('not subscribed'))) {
              // Fall back to best practices scan
              securityData = await runSecurityBPScan(config.profile, config.region);
            } else {
              securityData = hubResult;
            }
          } catch {
            // Fall back to best practices scan
            securityData = await runSecurityBPScan(config.profile, config.region);
          }
        } catch (err) {
          errors.push(`Security analysis failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
        completedDomains++;
        updateProgress('security', 'Security analysis complete');
      })()
    );
  }

  // Well-Architected domain
  if (domains.includes('wellArchitected')) {
    promises.push(
      (async () => {
        updateProgress('well-architected', 'Running Well-Architected best practices scan...');
        try {
          waData = await runWABestPracticesScan(config.profile, config.region);
        } catch (err) {
          errors.push(`Well-Architected scan failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
        completedDomains++;
        updateProgress('well-architected', 'Well-Architected scan complete');
      })()
    );
  }

  // Inventory domain — uses a lightweight approach via ResourceGroupsTaggingAPI
  if (domains.includes('inventory') && config.includeResourceScan) {
    promises.push(
      (async () => {
        updateProgress('inventory', 'Scanning resource inventory...');
        try {
          const { getClientFactory } = await import('../aws/client-factory');
          const factory = getClientFactory();
          const taggingClient = factory.getTaggingClient({
            profile: config.profile,
            region: config.region,
          });

          const { GetResourcesCommand } = await import('@aws-sdk/client-resource-groups-tagging-api');

          const byService: Record<string, number> = {};
          let totalResources = 0;
          let taggedCount = 0;
          let paginationToken: string | undefined;

          do {
            const response = await taggingClient.send(new GetResourcesCommand({
              PaginationToken: paginationToken || undefined,
              ResourcesPerPage: 100,
            }));

            for (const resource of response.ResourceTagMappingList || []) {
              totalResources++;
              // Extract service from ARN (arn:aws:SERVICE:region:account:...)
              const arnParts = resource.ResourceARN?.split(':') || [];
              const service = arnParts[2] || 'unknown';
              byService[service] = (byService[service] || 0) + 1;

              if (resource.Tags && resource.Tags.length > 0) {
                taggedCount++;
              }
            }

            paginationToken = response.PaginationToken;
          } while (paginationToken);

          resourceSummary = {
            totalResources,
            byService,
            tagCoverage: totalResources > 0 ? (taggedCount / totalResources) * 100 : 0,
          };
        } catch (err) {
          errors.push(`Inventory scan failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
        }
        completedDomains++;
        updateProgress('inventory', 'Inventory scan complete');
      })()
    );
  } else if (domains.includes('inventory')) {
    // No resource scan — provide a placeholder score
    completedDomains++;
  }

  await Promise.allSettled(promises);

  // Scoring phase
  onProgress?.({ stage: 'scoring', percent: 92, message: 'Computing scores...' });

  const costRecs = extractCostRecommendations(costOptimizations);
  const secRecs = extractSecurityRecommendations(securityData);
  const waRecs = extractWARecommendations(waData);
  const invRecs = extractInventoryRecommendations(resourceSummary);

  const domainScores = [];

  if (domains.includes('cost')) {
    domainScores.push(scoreCostDomain(costData, costOptimizations, costRecs));
  }
  if (domains.includes('security')) {
    domainScores.push(scoreSecurityDomain(securityData, secRecs));
  }
  if (domains.includes('wellArchitected')) {
    domainScores.push(scoreWellArchitectedDomain(waData, waRecs));
  }
  if (domains.includes('inventory')) {
    domainScores.push(scoreInventoryDomain(resourceSummary, invRecs));
  }

  const { score: overallScore, grade: overallGrade } = computeOverallScore(domainScores);

  // Count recommendations by severity
  const allRecs = [...costRecs, ...secRecs, ...waRecs, ...invRecs];
  const criticalCount = allRecs.filter(r => r.severity === 'critical').length;
  const highCount = allRecs.filter(r => r.severity === 'high').length;
  const mediumCount = allRecs.filter(r => r.severity === 'medium').length;
  const lowCount = allRecs.filter(r => r.severity === 'low').length;

  onProgress?.({ stage: 'complete', percent: 100, message: 'Assessment complete' });

  return {
    id: assessmentId,
    profile: config.profile,
    region: config.region,
    accountId,
    timestamp: new Date().toISOString(),
    overallScore,
    overallGrade,
    domainScores,
    totalRecommendations: allRecs.length,
    criticalCount,
    highCount,
    mediumCount,
    lowCount,
    costData,
    costOptimizations,
    securityData,
    waData,
    resourceSummary,
    duration: Date.now() - startTime,
    errors,
  };
}

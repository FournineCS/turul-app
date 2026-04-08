// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GetLensReviewCommand } from '@aws-sdk/client-wellarchitected';
import { getClientFactory } from '../client-factory';
import type { WALensReview, WAPillarReviewSummary, WAPillarId, WARiskLevel } from './types';

// Map AWS pillar IDs to our standardized format
const pillarIdMap: Record<string, WAPillarId> = {
  operationalExcellence: 'operationalExcellence',
  security: 'security',
  reliability: 'reliability',
  performance: 'performance',
  performanceEfficiency: 'performance',
  costOptimization: 'costOptimization',
  sustainability: 'sustainability',
};

export async function getLensReview(
  profile: string,
  region: string,
  workloadId: string,
  lensAlias: string = 'wellarchitected'
): Promise<WALensReview | null> {
  const client = getClientFactory().getWellArchitectedClient({ profile, region });

  try {
    const response = await client.send(
      new GetLensReviewCommand({
        WorkloadId: workloadId,
        LensAlias: lensAlias,
      })
    );

    const review = response.LensReview;
    if (!review) {
      return null;
    }

    const riskCounts: Record<WARiskLevel, number> = {
      HIGH: 0,
      MEDIUM: 0,
      NONE: 0,
      NOT_APPLICABLE: 0,
      UNANSWERED: 0,
    };

    if (review.RiskCounts) {
      for (const [key, value] of Object.entries(review.RiskCounts)) {
        if (key in riskCounts) {
          riskCounts[key as WARiskLevel] = value ?? 0;
        }
      }
    }

    const pillarReviewSummaries: WAPillarReviewSummary[] = (
      review.PillarReviewSummaries || []
    ).map((p) => {
      const pillarRiskCounts: Record<WARiskLevel, number> = {
        HIGH: 0,
        MEDIUM: 0,
        NONE: 0,
        NOT_APPLICABLE: 0,
        UNANSWERED: 0,
      };

      if (p.RiskCounts) {
        for (const [key, value] of Object.entries(p.RiskCounts)) {
          if (key in pillarRiskCounts) {
            pillarRiskCounts[key as WARiskLevel] = value ?? 0;
          }
        }
      }

      // Normalize pillar ID
      const rawPillarId = p.PillarId || '';
      const normalizedPillarId = pillarIdMap[rawPillarId] || (rawPillarId as WAPillarId);

      return {
        pillarId: normalizedPillarId,
        pillarName: p.PillarName || rawPillarId,
        riskCounts: pillarRiskCounts,
        notes: p.Notes,
      };
    });

    return {
      lensAlias: review.LensAlias || lensAlias,
      lensName: review.LensName || 'AWS Well-Architected Framework',
      lensVersion: review.LensVersion || '1.0',
      riskCounts,
      pillarReviewSummaries,
      updatedAt: review.UpdatedAt?.toISOString() || new Date().toISOString(),
    };
  } catch (error) {
    console.error('Error getting lens review:', error);
    return null;
  }
}

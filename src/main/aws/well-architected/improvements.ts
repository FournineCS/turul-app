// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { ListLensReviewImprovementsCommand } from '@aws-sdk/client-wellarchitected';
import { getClientFactory } from '../client-factory';
import type { WAImprovementItem, WAPillarId, WARiskLevel } from './types';

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

export async function getImprovements(
  profile: string,
  region: string,
  workloadId: string,
  lensAlias: string = 'wellarchitected',
  pillarId?: string
): Promise<WAImprovementItem[]> {
  const client = getClientFactory().getWellArchitectedClient({ profile, region });

  const improvements: WAImprovementItem[] = [];
  let nextToken: string | undefined;

  try {
    do {
      const command = new ListLensReviewImprovementsCommand({
        WorkloadId: workloadId,
        LensAlias: lensAlias,
        PillarId: pillarId,
        NextToken: nextToken,
        MaxResults: 50,
      });

      const response = await client.send(command);

      for (const item of response.ImprovementSummaries || []) {
        // Normalize pillar ID
        const rawPillarId = item.PillarId || '';
        const normalizedPillarId = pillarIdMap[rawPillarId] || (rawPillarId as WAPillarId);

        // Build improvement plans from choices
        const improvementPlans: WAImprovementItem['improvementPlans'] = [];
        if (item.ImprovementPlans) {
          for (const plan of item.ImprovementPlans) {
            improvementPlans.push({
              choiceId: plan.ChoiceId || '',
              displayText: plan.DisplayText || '',
              improvementPlanUrl: plan.ImprovementPlanUrl,
            });
          }
        }

        improvements.push({
          pillarId: normalizedPillarId,
          questionId: item.QuestionId || '',
          questionTitle: item.QuestionTitle || '',
          risk: (item.Risk as WARiskLevel) || 'UNANSWERED',
          improvementPlanUrl: item.ImprovementPlanUrl,
          improvementPlans,
        });
      }

      nextToken = response.NextToken;
    } while (nextToken);

    // Sort by risk level (HIGH first, then MEDIUM)
    const riskOrder: Record<WARiskLevel, number> = {
      HIGH: 0,
      MEDIUM: 1,
      UNANSWERED: 2,
      NONE: 3,
      NOT_APPLICABLE: 4,
    };

    improvements.sort((a, b) => {
      return (riskOrder[a.risk] ?? 5) - (riskOrder[b.risk] ?? 5);
    });

    return improvements;
  } catch (error) {
    console.error('Error getting improvements:', error);
    return [];
  }
}

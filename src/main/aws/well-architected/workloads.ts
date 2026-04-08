// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  ListWorkloadsCommand,
  GetWorkloadCommand,
} from '@aws-sdk/client-wellarchitected';
import { getClientFactory } from '../client-factory';
import type { WAWorkloadSummary, WAAnalysisResult, WARiskLevel } from './types';

export async function listWorkloads(
  profile: string,
  region: string
): Promise<WAAnalysisResult> {
  const client = getClientFactory().getWellArchitectedClient({ profile, region });

  const workloads: WAWorkloadSummary[] = [];
  let nextToken: string | undefined;

  try {
    do {
      const response = await client.send(
        new ListWorkloadsCommand({
          NextToken: nextToken,
          MaxResults: 50,
        })
      );

      for (const ws of response.WorkloadSummaries || []) {
        const riskCounts: Record<WARiskLevel, number> = {
          HIGH: 0,
          MEDIUM: 0,
          NONE: 0,
          NOT_APPLICABLE: 0,
          UNANSWERED: 0,
        };

        // Map risk counts from API response
        if (ws.RiskCounts) {
          for (const [key, value] of Object.entries(ws.RiskCounts)) {
            if (key in riskCounts) {
              riskCounts[key as WARiskLevel] = value ?? 0;
            }
          }
        }

        workloads.push({
          workloadId: ws.WorkloadId!,
          workloadName: ws.WorkloadName!,
          workloadArn: ws.WorkloadArn!,
          description: ws.Owner,
          // WorkloadSummary doesn't include Environment, use default
          environment: 'PRODUCTION',
          updatedAt: ws.UpdatedAt?.toISOString() || new Date().toISOString(),
          riskCounts,
          lenses: ws.Lenses || [],
        });
      }

      nextToken = response.NextToken;
    } while (nextToken);

    return { workloads };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to list workloads';
    return { workloads: [], error: errorMessage };
  }
}

export async function getWorkloadDetails(
  profile: string,
  region: string,
  workloadId: string
): Promise<WAWorkloadSummary | null> {
  const client = getClientFactory().getWellArchitectedClient({ profile, region });

  try {
    const response = await client.send(
      new GetWorkloadCommand({
        WorkloadId: workloadId,
      })
    );

    const workload = response.Workload;
    if (!workload) {
      return null;
    }

    const riskCounts: Record<WARiskLevel, number> = {
      HIGH: 0,
      MEDIUM: 0,
      NONE: 0,
      NOT_APPLICABLE: 0,
      UNANSWERED: 0,
    };

    if (workload.RiskCounts) {
      for (const [key, value] of Object.entries(workload.RiskCounts)) {
        if (key in riskCounts) {
          riskCounts[key as WARiskLevel] = value ?? 0;
        }
      }
    }

    return {
      workloadId: workload.WorkloadId!,
      workloadName: workload.WorkloadName!,
      workloadArn: workload.WorkloadArn!,
      description: workload.Description,
      environment: workload.Environment || 'PRODUCTION',
      updatedAt: workload.UpdatedAt?.toISOString() || new Date().toISOString(),
      riskCounts,
      lenses: workload.Lenses || [],
    };
  } catch (error) {
    console.error('Error getting workload details:', error);
    return null;
  }
}

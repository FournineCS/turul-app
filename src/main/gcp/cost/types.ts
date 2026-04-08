// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

// Re-exports from shared types for convenience within backend cost modules
export type {
  GCPCostRecommendationSource,
  GCPCostCategory,
  GCPCostRecommendationMeta,
  GCPCommitment,
  GCPCostFilters,
} from '../../../shared/types/gcp';

export type {
  CostOptimizationRecommendation,
  CostOptimizationResult,
  GCPExpandedRecommendationsResult,
  GCPCostBestPracticesResult,
  GCPCUDCoverageResult,
  GCPCommitmentCostBreakdown,
} from '../../../shared/types/common';

// Internal helper type
export interface RecommenderScanConfig {
  projectId: string;
  regions: string[];
  recommenderTypes: string[];
  concurrencyLimit: number;
}

// GCP Recommender API response shape (subset)
export interface GCPRecommendation {
  name?: string;
  description?: string;
  recommenderSubtype?: string;
  priority?: string;
  primaryImpact?: {
    category?: string;
    costProjection?: {
      cost?: { currencyCode?: string; units?: string; nanos?: number };
      duration?: { seconds?: string | number };
    };
  };
  content?: {
    operationGroups?: Array<{
      operations?: Array<{ action?: string; resource?: string }>;
    }>;
  };
  stateInfo?: { state?: string };
  lastRefreshTime?: string;
}

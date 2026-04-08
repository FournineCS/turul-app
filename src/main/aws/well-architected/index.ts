// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

// Well-Architected Framework API
export { listWorkloads, getWorkloadDetails } from './workloads';
export { getLensReview } from './lens-reviews';
export { getImprovements } from './improvements';
export { runWABestPracticesScan } from './best-practices';

// Re-export types
export type {
  WAPillarId,
  WARiskLevel,
  WAWorkloadSummary,
  WAPillarReviewSummary,
  WALensReview,
  WAImprovementItem,
  WAAnalysisResult,
} from './types';

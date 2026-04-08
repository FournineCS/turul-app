// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

export type GCPAssessmentDomain = 'cost' | 'security' | 'reliability' | 'compliance' | 'iam';

export interface GCPAssessmentConfig {
  projectId: string;
  domains: GCPAssessmentDomain[];
  bqProject?: string;
  bqDataset?: string;
}

export interface GCPAssessmentProgress {
  stage: string;
  percent: number;
  message: string;
}

export interface GCPDomainScore {
  domain: GCPAssessmentDomain;
  score: number;
  grade: string;
  weight: number;
  findings: number;
  recommendations: GCPAssessmentRecommendation[];
  details: Record<string, unknown>;
}

export interface GCPAssessmentRecommendation {
  id: string;
  domain: GCPAssessmentDomain;
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  title: string;
  description: string;
  impact?: string;
  remediation?: string;
  estimatedSavings?: number;
  resourceId?: string;
}

export interface GCPAssessmentResult {
  id: string;
  projectId: string;
  timestamp: string;
  overallScore: number;
  overallGrade: string;
  domainScores: GCPDomainScore[];
  totalRecommendations: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  duration: number;
  errors: string[];
}

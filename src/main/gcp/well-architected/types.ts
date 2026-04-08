// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

export type GCPWAPillarId = 'ops_excellence' | 'security' | 'reliability' | 'performance_cost' | 'system_design';

export interface GCPWACheckDefinition {
  id: string;
  title: string;
  description: string;
  pillar: GCPWAPillarId;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  service: string;
  remediationRecommendation: string;
}

export interface GCPWAFinding {
  check: GCPWACheckDefinition;
  status: 'PASS' | 'FAIL' | 'ERROR';
  resources: string[];
  detail?: string;
}

export interface GCPWAPillarSummary {
  pillar: GCPWAPillarId;
  pillarName: string;
  totalChecks: number;
  passCount: number;
  failCount: number;
  errorCount: number;
  findings: GCPWAFinding[];
}

export interface GCPWAScanResult {
  id?: string;
  projectId?: string;
  pillarSummaries: GCPWAPillarSummary[];
  totalChecks: number;
  totalPass: number;
  totalFail: number;
  totalError: number;
  duration: number;
  timestamp: string;
  error?: string;
}

export interface GCPWAScanProgress {
  phase: 'Scanning' | 'Complete';
  pillar: string;
  percent: number;
  service: string;
}

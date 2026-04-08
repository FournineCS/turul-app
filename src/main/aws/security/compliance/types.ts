// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

export type ComplianceFrameworkId = 'cis-aws-v3';

export interface ComplianceFrameworkMeta {
  id: ComplianceFrameworkId;
  name: string;
  version: string;
  description: string;
  controlCount: number;
}

export interface ComplianceControl {
  id: string; // e.g. "1.1", "2.1.1"
  section: string; // e.g. "1 - Identity and Access Management"
  title: string;
  level: 1 | 2;
  checkIds: string[]; // Best practice check IDs that map to this control
}

export interface ComplianceControlResult {
  control: ComplianceControl;
  status: 'PASS' | 'FAIL' | 'NOT_CHECKED';
  findingCount: number;
}

export interface ComplianceSectionResult {
  section: string;
  totalControls: number;
  passedControls: number;
  failedControls: number;
  notCheckedControls: number;
  controls: ComplianceControlResult[];
}

export interface ComplianceAssessmentResult {
  framework: ComplianceFrameworkMeta;
  overallScore: number; // 0-100 percentage of passed controls
  totalControls: number;
  passedControls: number;
  failedControls: number;
  notCheckedControls: number;
  sections: ComplianceSectionResult[];
  assessedAt: string;
  error?: string;
}

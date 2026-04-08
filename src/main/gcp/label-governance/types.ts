// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

export interface GCPLabelGovernanceConfig {
  requiredLabels: string[];
}

export interface GCPLabelServiceCompliance {
  service: string;
  totalResources: number;
  compliantResources: number;
  compliancePercent: number;
}

export interface GCPLabelKeyCompliance {
  labelKey: string;
  totalResources: number;
  labeledResources: number;
  coveragePercent: number;
}

export interface GCPUnlabeledResource {
  id: string;
  name: string;
  service: string;
  region: string;
  missingLabels: string[];
}

export interface GCPLabelComplianceResult {
  id: string;
  projectId: string;
  totalResources: number;
  fullyCompliantResources: number;
  overallCompliancePercent: number;
  byService: GCPLabelServiceCompliance[];
  byLabelKey: GCPLabelKeyCompliance[];
  unlabeledResources: GCPUnlabeledResource[];
  analyzedAt: string;
  duration: number;
}

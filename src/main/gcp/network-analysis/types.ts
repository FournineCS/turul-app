// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

export interface GCPFirewallFinding {
  ruleName: string;
  network: string;
  direction: 'INGRESS' | 'EGRESS';
  priority: number;
  sourceRanges: string[];
  targetTags: string[];
  targetServiceAccounts: string[];
  allowedPorts: { protocol: string; ports: string[] }[];
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  issue: string;
  disabled: boolean;
}

export interface GCPExposedResource {
  resourceId: string;
  resourceType: 'instance' | 'cloud-sql' | 'gke-cluster' | 'load-balancer';
  name: string;
  zone: string;
  network: string;
  externalIp?: string;
  openPorts: { protocol: string; port: string; source: string }[];
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  exposureDetails: string;
}

export interface GCPVPCAnalysis {
  networkName: string;
  networkMode: 'auto' | 'custom' | 'legacy';
  subnetCount: number;
  peeringConnections: { network: string; state: string; importRoutes: boolean; exportRoutes: boolean }[];
  isSharedVpc: boolean;
  isDefault: boolean;
  privateGoogleAccess: boolean;
}

export interface GCPNetworkAnalysisResult {
  id: string;
  projectId: string;
  firewallFindings: GCPFirewallFinding[];
  exposedResources: GCPExposedResource[];
  vpcAnalysis: GCPVPCAnalysis[];
  totalNetworks: number;
  totalFirewallRules: number;
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  analyzedAt: string;
  duration: number;
  errors: string[];
}

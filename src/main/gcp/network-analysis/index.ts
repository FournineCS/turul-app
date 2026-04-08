// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import crypto from 'crypto';
import { GCPNetworkAnalysisResult, GCPFirewallFinding, GCPExposedResource, GCPVPCAnalysis } from './types';
import { analyzeFirewallRules } from './reachability';
import { analyzeVPCs } from './vpc-analysis';

export async function runGCPNetworkAnalysis(projectId: string): Promise<GCPNetworkAnalysisResult> {
  const startTime = Date.now();
  const errors: string[] = [];

  const [firewallResult, vpcResult] = await Promise.allSettled([
    analyzeFirewallRules(projectId),
    analyzeVPCs(projectId),
  ]);

  // Extract firewall analysis results
  let firewallFindings: GCPFirewallFinding[] = [];
  let exposedResources: GCPExposedResource[] = [];
  let totalFirewallRules = 0;

  if (firewallResult.status === 'fulfilled') {
    firewallFindings = firewallResult.value.findings;
    exposedResources = firewallResult.value.exposedResources;
    totalFirewallRules = firewallResult.value.totalRules;
  } else {
    errors.push(`Firewall analysis failed: ${firewallResult.reason?.message || String(firewallResult.reason)}`);
  }

  // Extract VPC analysis results
  let vpcAnalysis: GCPVPCAnalysis[] = [];
  if (vpcResult.status === 'fulfilled') {
    vpcAnalysis = vpcResult.value;
  } else {
    errors.push(`VPC analysis failed: ${vpcResult.reason?.message || String(vpcResult.reason)}`);
  }

  // Calculate severity counts across both firewall findings and exposed resources
  const allSeverities = [
    ...firewallFindings.map(f => f.severity),
    ...exposedResources.map(r => r.severity),
  ];

  const criticalCount = allSeverities.filter(s => s === 'CRITICAL').length;
  const highCount = allSeverities.filter(s => s === 'HIGH').length;
  const mediumCount = allSeverities.filter(s => s === 'MEDIUM').length;
  const lowCount = allSeverities.filter(s => s === 'LOW').length;

  return {
    id: crypto.randomUUID(),
    projectId,
    firewallFindings,
    exposedResources,
    vpcAnalysis,
    totalNetworks: vpcAnalysis.length,
    totalFirewallRules,
    criticalCount,
    highCount,
    mediumCount,
    lowCount,
    analyzedAt: new Date().toISOString(),
    duration: Date.now() - startTime,
    errors,
  };
}

export { GCPNetworkAnalysisResult } from './types';

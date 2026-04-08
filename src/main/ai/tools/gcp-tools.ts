// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import type { AIToolDefinition } from '../../../shared/types/chat';
import { getExpandedCostRecommendations } from '../../gcp/cost/recommender-expanded';
import { getStoppedVMs } from '../../gcp/cost/stopped-vm-analysis';
import { runGCPBestPracticesScan } from '../../gcp/security/best-practices';
import { runGCPIAMAnalysis } from '../../gcp/iam-analysis';
import { runGCPNetworkAnalysis } from '../../gcp/network-analysis';
import { runGCPComplianceAssessment } from '../../gcp/security/compliance';
import { runGCPLabelCompliance } from '../../gcp/label-governance';

export const gcpToolDefinitions: AIToolDefinition[] = [
  {
    name: 'gcp_list_instances',
    description: 'List Compute Engine VM instances for the current GCP project.',
    inputSchema: {
      type: 'object',
      properties: {
        zone: { type: 'string', description: 'Filter by zone (e.g. us-central1-a). Omit for all zones.' },
        status: { type: 'string', enum: ['RUNNING', 'STOPPED', 'TERMINATED'], description: 'Filter by status' },
      },
    },
  },
  {
    name: 'gcp_get_recommendations',
    description: 'Get VM machine type sizing recommendations from the GCP Recommender API. For comprehensive cost recommendations across 13+ categories, use gcp_cost_recommendations instead.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: { type: 'string', description: 'GCP project ID' },
      },
    },
  },
  {
    name: 'gcp_cost_recommendations',
    description: 'Get comprehensive cost optimization recommendations across 13+ recommender types (VM sizing, idle resources, committed use discounts, unattached disks, etc.) for all zones/regions. This may take 30-60 seconds.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: { type: 'string', description: 'GCP project ID' },
      },
    },
  },
  {
    name: 'gcp_stopped_vms',
    description: 'Find stopped/suspended VMs and estimate wasted costs from attached disks and reserved IPs.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: { type: 'string', description: 'GCP project ID' },
      },
    },
  },
  {
    name: 'gcp_security_scan',
    description: 'Run a GCP security best practices scan checking public buckets, overly permissive firewall rules, service account keys, Cloud SQL security, and KMS configuration. This may take 30-60 seconds.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: { type: 'string', description: 'GCP project ID' },
      },
    },
  },
  {
    name: 'gcp_iam_analysis',
    description: 'Run GCP IAM analysis: find unused service accounts, overly permissive bindings, service account key issues, and cross-project bindings. This may take 30-60 seconds.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: { type: 'string', description: 'GCP project ID' },
      },
    },
  },
  {
    name: 'gcp_network_analysis',
    description: 'Run GCP network security analysis: analyze firewall rules, find exposed resources (VMs, Cloud SQL, GKE), and assess VPC configurations. This may take 30-60 seconds.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: { type: 'string', description: 'GCP project ID' },
      },
    },
  },
  {
    name: 'gcp_compliance_scan',
    description: 'Run CIS GCP Foundation Benchmark v2.0 compliance assessment. Evaluates 60+ controls across IAM, networking, storage, Cloud SQL, and more. This may take 30-60 seconds.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: { type: 'string', description: 'GCP project ID' },
      },
    },
  },
  {
    name: 'gcp_label_compliance',
    description: 'Check GCP resource label compliance against required labels. Scans Compute instances, GCS buckets, Cloud SQL, and GKE clusters.',
    inputSchema: {
      type: 'object',
      properties: {
        project_id: { type: 'string', description: 'GCP project ID' },
        required_labels: {
          type: 'array',
          items: { type: 'string' },
          description: 'Required label keys to check (e.g. ["env", "team", "cost-center"])',
        },
      },
      required: ['required_labels'],
    },
  },
];

export async function executeGcpTool(
  name: string,
  args: Record<string, unknown>,
  projectId?: string
): Promise<string> {
  const targetProject = (args.project_id as string) || projectId;
  if (!targetProject) {
    return JSON.stringify({ error: 'No GCP project selected. Please select a GCP project first.' });
  }

  switch (name) {
    case 'gcp_list_instances': {
      try {
        const { InstancesClient } = await import('@google-cloud/compute');
        const client = new InstancesClient();
        const zone = args.zone as string | undefined;

        if (zone) {
          const [instances] = await client.list({ project: targetProject, zone });
          const filtered = args.status
            ? (instances || []).filter(i => i.status === args.status)
            : instances || [];
          return JSON.stringify({
            count: filtered.length,
            instances: filtered.slice(0, 30).map(i => ({
              name: i.name,
              zone: i.zone,
              machineType: i.machineType?.split('/').pop(),
              status: i.status,
            })),
          });
        }

        // All zones - use aggregatedList
        const aggIterator = client.aggregatedListAsync({ project: targetProject });
        const allInstances: Array<{ name: string; zone: string; machineType: string; status: string }> = [];
        for await (const [zone, scopedList] of aggIterator) {
          for (const instance of scopedList.instances || []) {
            if (args.status && instance.status !== args.status) continue;
            allInstances.push({
              name: instance.name || '',
              zone: zone.replace('zones/', ''),
              machineType: (instance.machineType || '').split('/').pop() || '',
              status: instance.status || '',
            });
          }
          if (allInstances.length >= 50) break;
        }
        return JSON.stringify({ count: allInstances.length, instances: allInstances.slice(0, 30) });
      } catch (err: any) {
        return JSON.stringify({ error: `Failed to list GCP instances: ${err.message}` });
      }
    }

    case 'gcp_get_recommendations': {
      try {
        const { RecommenderClient } = await import('@google-cloud/recommender');
        const client = new RecommenderClient();
        const [recs] = await client.listRecommendations({
          parent: `projects/${targetProject}/locations/-/recommenders/google.compute.instance.MachineTypeRecommender`,
        });
        return JSON.stringify({
          count: recs.length,
          recommendations: recs.slice(0, 20).map(r => ({
            name: r.name,
            description: r.description,
            priority: r.priority,
            primaryImpact: r.primaryImpact,
            state: r.stateInfo?.state,
          })),
        });
      } catch (err: any) {
        return JSON.stringify({ error: `Failed to get recommendations: ${err.message}` });
      }
    }

    case 'gcp_cost_recommendations': {
      try {
        const result = await getExpandedCostRecommendations(targetProject);
        const sorted = (result.recommendations || [])
          .sort((a: any, b: any) => (b.estimatedSavings || 0) - (a.estimatedSavings || 0))
          .slice(0, 20);
        return JSON.stringify({
          totalPotentialSavings: result.totalPotentialSavings,
          currency: result.currency,
          byCategory: result.byCategory,
          total: result.recommendations?.length || 0,
          returned: sorted.length,
          recommendations: sorted,
          errors: result.errors?.length ? result.errors : undefined,
        });
      } catch (err: any) {
        return JSON.stringify({ error: `GCP cost recommendations failed: ${err.message}` });
      }
    }

    case 'gcp_stopped_vms': {
      try {
        const result = await getStoppedVMs(targetProject);
        const sorted = (result.vms || [])
          .sort((a: any, b: any) => (b.estimatedMonthlyCost || 0) - (a.estimatedMonthlyCost || 0))
          .slice(0, 20);
        return JSON.stringify({
          totalEstimatedMonthlyCost: result.totalEstimatedMonthlyCost,
          currency: result.currency,
          total: result.vms?.length || 0,
          returned: sorted.length,
          vms: sorted,
        });
      } catch (err: any) {
        return JSON.stringify({ error: `Stopped VMs analysis failed: ${err.message}` });
      }
    }

    case 'gcp_security_scan': {
      try {
        const result = await runGCPBestPracticesScan(targetProject);
        const findings = (result.findings || [])
          .sort((a: any, b: any) => {
            const sev: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3, INFORMATIONAL: 4 };
            return (sev[a.severity] ?? 5) - (sev[b.severity] ?? 5);
          })
          .slice(0, 30)
          .map((f: any) => ({
            title: f.title,
            severity: f.severity,
            service: f.service,
            description: f.description,
            recommendation: f.recommendation,
          }));
        return JSON.stringify({
          summary: result.summary,
          total: result.findings?.length || 0,
          returned: findings.length,
          findings,
        });
      } catch (err: any) {
        return JSON.stringify({ error: `GCP security scan failed: ${err.message}` });
      }
    }

    case 'gcp_iam_analysis': {
      try {
        const result = await runGCPIAMAnalysis(targetProject);
        return JSON.stringify({
          unusedServiceAccounts: result.unusedServiceAccounts.length,
          overlyPermissiveBindings: result.overlyPermissiveBindings.length,
          serviceAccountKeyIssues: result.serviceAccountKeyIssues.length,
          crossProjectBindings: result.crossProjectBindings.length,
          topIssues: [
            ...result.overlyPermissiveBindings.slice(0, 5).map(b => ({
              type: 'overly_permissive', member: b.member, role: b.role, reason: b.reason,
            })),
            ...result.serviceAccountKeyIssues.filter(k => k.severity === 'HIGH').slice(0, 5).map(k => ({
              type: 'key_issue', email: k.serviceAccountEmail, issue: k.issue,
            })),
            ...result.unusedServiceAccounts.slice(0, 5).map(sa => ({
              type: 'unused_sa', email: sa.email, daysSinceActivity: sa.daysSinceLastActivity,
            })),
          ],
          errors: result.errors.length ? result.errors : undefined,
        });
      } catch (err: unknown) {
        return JSON.stringify({ error: `GCP IAM analysis failed: ${err instanceof Error ? err.message : String(err)}` });
      }
    }

    case 'gcp_network_analysis': {
      try {
        const result = await runGCPNetworkAnalysis(targetProject);
        return JSON.stringify({
          totalNetworks: result.totalNetworks,
          totalFirewallRules: result.totalFirewallRules,
          criticalCount: result.criticalCount,
          highCount: result.highCount,
          mediumCount: result.mediumCount,
          lowCount: result.lowCount,
          firewallFindings: result.firewallFindings.slice(0, 10).map(f => ({
            rule: f.ruleName, severity: f.severity, issue: f.issue,
          })),
          exposedResources: result.exposedResources.slice(0, 10).map(r => ({
            name: r.name, type: r.resourceType, externalIp: r.externalIp, severity: r.severity,
          })),
          errors: result.errors.length ? result.errors : undefined,
        });
      } catch (err: unknown) {
        return JSON.stringify({ error: `GCP network analysis failed: ${err instanceof Error ? err.message : String(err)}` });
      }
    }

    case 'gcp_compliance_scan': {
      try {
        const result = await runGCPComplianceAssessment(targetProject);
        return JSON.stringify({
          framework: result.framework.name,
          version: result.framework.version,
          overallScore: result.overallScore,
          totalControls: result.totalControls,
          passedControls: result.passedControls,
          failedControls: result.failedControls,
          notCheckedControls: result.notCheckedControls,
          sections: result.sections.map(s => ({
            section: s.section,
            passed: s.passedControls,
            failed: s.failedControls,
            notChecked: s.notCheckedControls,
          })),
        });
      } catch (err: unknown) {
        return JSON.stringify({ error: `GCP compliance scan failed: ${err instanceof Error ? err.message : String(err)}` });
      }
    }

    case 'gcp_label_compliance': {
      try {
        const requiredLabels = args.required_labels as string[];
        if (!requiredLabels || requiredLabels.length === 0) {
          return JSON.stringify({ error: 'required_labels must be a non-empty array of label keys' });
        }
        const result = await runGCPLabelCompliance(targetProject, { requiredLabels });
        return JSON.stringify({
          totalResources: result.totalResources,
          overallCompliancePercent: result.overallCompliancePercent,
          fullyCompliant: result.fullyCompliantResources,
          nonCompliant: result.unlabeledResources.length,
          byService: result.byService,
          byLabelKey: result.byLabelKey,
          topNonCompliant: result.unlabeledResources.slice(0, 10).map(r => ({
            name: r.name, service: r.service, missingLabels: r.missingLabels,
          })),
        });
      } catch (err: unknown) {
        return JSON.stringify({ error: `GCP label compliance failed: ${err instanceof Error ? err.message : String(err)}` });
      }
    }

    default:
      return JSON.stringify({ error: `Unknown GCP tool: ${name}` });
  }
}

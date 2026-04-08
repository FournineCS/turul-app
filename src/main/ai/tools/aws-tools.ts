// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import type { AIToolDefinition } from '../../../shared/types/chat';
import { getClientFactory } from '../../aws/client-factory';
import { DescribeInstancesCommand } from '@aws-sdk/client-ec2';
import { GetCostAndUsageCommand, type Granularity } from '@aws-sdk/client-cost-explorer';
import { getDetailedCostAnalysis, getCostOptimizations } from '../../aws/discovery/cost-explorer';
import { runBestPracticesScan } from '../../aws/security/best-practices';
import { runIAMAnalysis } from '../../aws/iam-analysis';

export const awsToolDefinitions: AIToolDefinition[] = [
  {
    name: 'aws_describe_instances',
    description: 'Describe EC2 instances with optional filters. Returns instance details including state, type, tags, and network info.',
    inputSchema: {
      type: 'object',
      properties: {
        region: { type: 'string', description: 'AWS region (e.g. us-west-2)' },
        instance_ids: {
          type: 'array',
          items: { type: 'string' },
          description: 'Specific instance IDs to describe',
        },
        filters: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              Name: { type: 'string' },
              Values: { type: 'array', items: { type: 'string' } },
            },
          },
          description: 'EC2 filters (e.g. [{Name: "instance-state-name", Values: ["running"]}])',
        },
      },
    },
  },
  {
    name: 'aws_get_cost_data',
    description: 'Query AWS Cost Explorer for cost and usage data grouped by service. IMPORTANT: AWS Cost Explorer only supports the last 12 months of data. Always use recent dates (within last 30 days by default). Use MONTHLY granularity for ranges over 30 days.',
    inputSchema: {
      type: 'object',
      properties: {
        start_date: { type: 'string', description: 'Start date (YYYY-MM-DD). Must be within the last 12 months. Default to 30 days ago.' },
        end_date: { type: 'string', description: 'End date (YYYY-MM-DD). Default to today.' },
        granularity: { type: 'string', enum: ['DAILY', 'MONTHLY'], description: 'DAILY for ranges up to 30 days, MONTHLY for longer ranges' },
        region: { type: 'string', description: 'AWS region for the Cost Explorer client' },
      },
      required: ['start_date', 'end_date'],
    },
  },
  {
    name: 'aws_get_cost_analysis',
    description: 'Get detailed AWS cost analysis with period-over-period comparison, broken down by service and region. Includes cost trends and percentage changes. This may take 10-30 seconds.',
    inputSchema: {
      type: 'object',
      properties: {
        start_date: { type: 'string', description: 'Start date (YYYY-MM-DD). Must be within the last 12 months. Default to 30 days ago.' },
        end_date: { type: 'string', description: 'End date (YYYY-MM-DD). Default to today.' },
        granularity: { type: 'string', enum: ['DAILY', 'MONTHLY'], description: 'DAILY for ranges up to 30 days, MONTHLY for longer ranges. Default DAILY.' },
      },
      required: ['start_date', 'end_date'],
    },
  },
  {
    name: 'aws_get_cost_optimizations',
    description: 'Get AWS cost optimization recommendations including Savings Plans, Reserved Instances, anomaly detection, and potential savings. This may take 10-30 seconds.',
    inputSchema: {
      type: 'object',
      properties: {
        days: { type: 'number', description: 'Number of days to analyze (default 30)' },
      },
    },
  },
  {
    name: 'aws_security_scan',
    description: 'Run a security best practices scan across EC2, S3, IAM, RDS, CloudTrail, VPC, and KMS. Returns findings with severity, description, and remediation recommendations. This may take 30-60 seconds.',
    inputSchema: {
      type: 'object',
      properties: {
        region: { type: 'string', description: 'AWS region to scan (default us-east-1)' },
      },
    },
  },
  {
    name: 'aws_iam_analysis',
    description: 'Analyze IAM security posture: unused roles, overly permissive policies, cross-account trust relationships, and password policy compliance. This may take 30-60 seconds.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];


export async function executeAwsTool(
  name: string,
  args: Record<string, unknown>,
  profileName?: string,
  defaultRegion?: string
): Promise<string> {
  if (!profileName) {
    return JSON.stringify({ error: 'No AWS profile selected. Please select an AWS profile first.' });
  }

  const region = (args.region as string) || defaultRegion || 'us-west-2';

  switch (name) {
    case 'aws_describe_instances': {
      try {
        const ec2 = getClientFactory().getEC2Client({ profile: profileName, region });
        const params: Record<string, unknown> = {};
        if (args.instance_ids) params.InstanceIds = args.instance_ids;
        if (args.filters) params.Filters = args.filters;
        const response = await ec2.send(new DescribeInstancesCommand(params as any));
        const instances = (response.Reservations || []).flatMap(r => r.Instances || []);
        return JSON.stringify({
          count: instances.length,
          instances: instances.slice(0, 30).map(i => ({
            instanceId: i.InstanceId,
            instanceType: i.InstanceType,
            state: i.State?.Name,
            platform: i.PlatformDetails,
            launchTime: i.LaunchTime?.toISOString(),
            privateIp: i.PrivateIpAddress,
            publicIp: i.PublicIpAddress,
            vpcId: i.VpcId,
            subnetId: i.SubnetId,
            tags: (i.Tags || []).reduce((acc: Record<string, string>, t) => {
              if (t.Key && t.Value) acc[t.Key] = t.Value;
              return acc;
            }, {}),
          })),
        });
      } catch (err: any) {
        return JSON.stringify({ error: `Failed to describe instances: ${err.message}` });
      }
    }

    case 'aws_get_cost_data': {
      try {
        const ce = getClientFactory().getCostExplorerClient({ profile: profileName, region: 'us-east-1' });
        const response = await ce.send(new GetCostAndUsageCommand({
          TimePeriod: {
            Start: args.start_date as string,
            End: args.end_date as string,
          },
          Granularity: ((args.granularity as string) || 'DAILY') as Granularity,
          Metrics: ['UnblendedCost'],
          GroupBy: [{ Type: 'DIMENSION', Key: 'SERVICE' }],
        }));
        return JSON.stringify({
          resultsByTime: (response.ResultsByTime || []).map(r => ({
            start: r.TimePeriod?.Start,
            end: r.TimePeriod?.End,
            groups: (r.Groups || []).map(g => ({
              service: g.Keys?.[0],
              amount: g.Metrics?.UnblendedCost?.Amount,
              unit: g.Metrics?.UnblendedCost?.Unit,
            })),
          })),
        });
      } catch (err: any) {
        return JSON.stringify({ error: `Failed to get cost data: ${err.message}` });
      }
    }

    case 'aws_get_cost_analysis': {
      const startDate = args.start_date as string;
      const endDate = args.end_date as string;
      const granularity = (args.granularity as string) || 'DAILY';
      try {
        const result = await getDetailedCostAnalysis(profileName, startDate, endDate, granularity as any);
        return JSON.stringify({
          totalCost: result.totalCost,
          previousPeriodTotalCost: result.previousPeriodTotalCost,
          percentChange: result.percentChange,
          currency: result.currency,
          startDate: result.startDate,
          endDate: result.endDate,
          byService: (result.byService || []).slice(0, 15),
          byRegion: (result.byRegion || []).slice(0, 10),
          trend: (result.trend || []).slice(0, 31),
        });
      } catch (err: any) {
        return JSON.stringify({ error: `Cost analysis failed: ${err.message}` });
      }
    }

    case 'aws_get_cost_optimizations': {
      const days = (args.days as number) || 30;
      try {
        const result = await getCostOptimizations(profileName, days, region);
        const sorted = (result.recommendations || [])
          .sort((a: any, b: any) => (b.estimatedSavings || 0) - (a.estimatedSavings || 0))
          .slice(0, 20);
        return JSON.stringify({
          totalPotentialSavings: result.totalPotentialSavings,
          currency: result.currency,
          total: result.recommendations?.length || 0,
          returned: sorted.length,
          recommendations: sorted,
        });
      } catch (err: any) {
        return JSON.stringify({ error: `Cost optimizations failed: ${err.message}` });
      }
    }

    case 'aws_security_scan': {
      const scanRegion = (args.region as string) || region;
      try {
        const result = await runBestPracticesScan(profileName, scanRegion);
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
        return JSON.stringify({ error: `Security scan failed: ${err.message}` });
      }
    }

    case 'aws_iam_analysis': {
      try {
        const result = await runIAMAnalysis(profileName);
        return JSON.stringify({
          analyzedAt: result.analyzedAt,
          unusedRoles: {
            total: result.unusedRoles?.length || 0,
            items: (result.unusedRoles || []).slice(0, 20),
          },
          overlyPermissivePolicies: {
            total: result.overlyPermissivePolicies?.length || 0,
            items: (result.overlyPermissivePolicies || []).slice(0, 20),
          },
          crossAccountTrusts: result.crossAccountTrusts || [],
          passwordPolicy: result.passwordPolicy,
          errors: result.errors,
        });
      } catch (err: any) {
        return JSON.stringify({ error: `IAM analysis failed: ${err.message}` });
      }
    }

    default:
      return JSON.stringify({ error: `Unknown AWS tool: ${name}` });
  }
}

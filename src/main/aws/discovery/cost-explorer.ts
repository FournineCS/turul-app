// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  GetCostAndUsageCommand,
  type GetCostAndUsageCommandOutput,
} from '@aws-sdk/client-cost-explorer';
import { getClientFactory } from '../client-factory';
import type {
  ServiceType,
  CostGranularity,
  CostAnalysisResult,
  CostTrendDataPoint,
  DetailedServiceCost,
  RegionCost,
  CostOptimizationResult,
  CostOptimizationRecommendation,
} from '../../../shared/types';

export interface ServiceCost {
  service: string;
  cost: number;
  currency: string;
  hasUsage: boolean;
  serviceType?: ServiceType;
}

export interface CostDiscoveryResult {
  services: ServiceCost[];
  activeServices: ServiceType[];
  totalCost: number;
  currency: string;
  startDate: string;
  endDate: string;
}

// Map AWS service names from Cost Explorer to our ServiceType
const SERVICE_NAME_MAP: Record<string, ServiceType> = {
  // Compute
  'Amazon Elastic Compute Cloud - Compute': 'ec2',
  'EC2 - Other': 'ec2',
  'Amazon Virtual Private Cloud': 'vpc',
  'AWS Lambda': 'lambda',
  'Amazon Elastic Container Service': 'ecs',
  'Amazon Elastic Kubernetes Service': 'eks',
  'Amazon EC2 Auto Scaling': 'autoscaling',
  'AWS Elastic Beanstalk': 'elasticbeanstalk',
  'AWS App Runner': 'apprunner',
  'AWS Batch': 'batch',
  // Storage
  'Amazon Simple Storage Service': 's3',
  'Amazon Elastic File System': 'efs',
  'Amazon Elastic Container Registry': 'ecr',
  'Amazon ECR Public': 'ecr',
  'AWS Backup': 'backup',
  'Amazon FSx': 'fsx',
  'AWS Storage Gateway': 'storagegateway',
  // Database
  'Amazon Relational Database Service': 'rds',
  'Amazon DynamoDB': 'dynamodb',
  'Amazon ElastiCache': 'elasticache',
  'Amazon Redshift': 'redshift',
  'Amazon OpenSearch Service': 'opensearch',
  'Amazon Neptune': 'neptune',
  'Amazon DocumentDB (with MongoDB compatibility)': 'documentdb',
  'Amazon MemoryDB': 'memorydb',
  'Amazon Timestream': 'timestream',
  'Amazon Keyspaces (for Apache Cassandra)': 'keyspaces',
  // Networking
  'Elastic Load Balancing': 'alb',
  'Amazon CloudFront': 'cloudfront',
  'Amazon Route 53': 'route53',
  'AWS WAF': 'wafv2',
  'AWS Transit Gateway': 'transitgateway',
  'AWS Global Accelerator': 'globalaccelerator',
  'AWS Direct Connect': 'directconnect',
  'AWS Network Firewall': 'networkfirewall',
  'Amazon VPC Lattice': 'vpclattice',
  'AWS Verified Access': 'verifiedaccess',
  // Integration
  'Amazon Simple Notification Service': 'sns',
  'Amazon Simple Queue Service': 'sqs',
  'AWS Step Functions': 'stepfunctions',
  'Amazon EventBridge': 'eventbridge',
  'Amazon API Gateway': 'apigateway',
  'AWS AppSync': 'appsync',
  'Amazon Simple Email Service': 'ses',
  'Amazon MQ': 'mq',
  'Amazon AppFlow': 'appflow',
  // Migration
  'AWS Database Migration Service': 'dms',
  'AWS DataSync': 'datasync',
  'AWS Elastic Disaster Recovery': 'drs',
  // Management
  'AWS CloudFormation': 'cloudformation',
  'Amazon CloudWatch': 'cloudwatch',
  'AmazonCloudWatch': 'cloudwatch',
  'AWS CloudTrail': 'cloudtrail',
  'AWS Config': 'config',
  'AWS Systems Manager': 'ssm',
  // Governance
  'AWS Resource Access Manager': 'ram',
  'AWS Organizations': 'organizations',
  'AWS Service Catalog': 'servicecatalog',
  'AWS License Manager': 'licensemanager',
  // Analytics
  'AWS Glue': 'glue',
  'Amazon Athena': 'athena',
  'Amazon Kinesis': 'kinesis',
  'Amazon Kinesis Data Firehose': 'firehose',
  'Amazon Kinesis Firehose': 'firehose',
  'Amazon Managed Streaming for Apache Kafka': 'msk',
  'Amazon EMR': 'emr',
  'AWS Lake Formation': 'lakeformation',
  'Amazon Managed Service for Apache Flink': 'flink',
  'Amazon Kinesis Analytics': 'flink',
  'Amazon QuickSight': 'quicksight',
  'Amazon CloudSearch': 'cloudsearch',
  'Amazon Kinesis Video Streams': 'kinesisvideo',
  // Security
  'AWS Secrets Manager': 'secretsmanager',
  'AWS Key Management Service': 'kms',
  'AWS Identity and Access Management': 'iam',
  'Amazon GuardDuty': 'guardduty',
  'IAM Access Analyzer': 'accessanalyzer',
  'Amazon Inspector': 'inspector',
  'AWS Certificate Manager': 'acm',
  'Amazon Macie': 'macie',
  'AWS Firewall Manager': 'fms',
  'AWS Shield': 'shield',
  'AWS CloudHSM': 'cloudhsm',
  'AWS Directory Service': 'directoryservice',
  'Amazon Detective': 'detective',
  'AWS Audit Manager': 'auditmanager',
  // Identity
  'Amazon Cognito': 'cognito',
  // Developer Tools
  'AWS CodePipeline': 'codepipeline',
  'AWS CodeBuild': 'codebuild',
  'AWS CodeDeploy': 'codedeploy',
  'AWS CodeArtifact': 'codeartifact',
  'AWS X-Ray': 'xray',
  'AWS Fault Injection Simulator': 'fis',
  'EC2 Image Builder': 'imagebuilder',
  // ML & AI
  'Amazon SageMaker': 'sagemaker',
  'Amazon Bedrock': 'bedrock',
  'Amazon Comprehend': 'comprehend',
  'Amazon Rekognition': 'rekognition',
  'Amazon Textract': 'textract',
  'Amazon Transcribe': 'transcribe',
  'Amazon Lex': 'lex',
  'Amazon Kendra': 'kendra',
  'Amazon Forecast': 'forecast',
  'Amazon Personalize': 'personalize',
  'Amazon Fraud Detector': 'frauddetector',
  'Amazon HealthLake': 'healthlake',
  // Data Pipeline
  'Amazon Managed Workflows for Apache Airflow': 'mwaa',
  'AWS Transfer Family': 'transfer',
  // Frontend & Mobile
  'AWS Amplify': 'amplify',
  'Amazon Location Service': 'location',
  'Amazon Lightsail': 'lightsail',
  'Amazon Pinpoint': 'pinpoint',
  // Business Apps
  'Amazon Connect': 'connect',
  // Media
  'Amazon Interactive Video Service': 'ivs',
  'AWS Elemental MediaConvert': 'mediaconvert',
  'AWS Elemental MediaLive': 'medialive',
  'Amazon Elastic Transcoder': 'elastictranscoder',
  // IoT
  'AWS IoT': 'iot',
  'AWS IoT Core': 'iot',
  // End User Computing
  'Amazon WorkSpaces': 'workspaces',
  'Amazon WorkSpaces Web': 'workspaces',
};

/**
 * Discover active AWS services based on Cost Explorer data.
 * This helps identify which services have actual usage and should be scanned.
 */
export async function discoverActiveServicesByCost(
  profile: string,
  days: number = 30
): Promise<CostDiscoveryResult> {
  const client = getClientFactory().getCostExplorerClient({
    profile,
    region: 'us-east-1', // Cost Explorer only works in us-east-1
  });

  // Calculate date range
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const formatDate = (date: Date): string => {
    return date.toISOString().split('T')[0];
  };

  try {
    const response: GetCostAndUsageCommandOutput = await client.send(
      new GetCostAndUsageCommand({
        TimePeriod: {
          Start: formatDate(startDate),
          End: formatDate(endDate),
        },
        Granularity: 'MONTHLY',
        Metrics: ['UnblendedCost'],
        GroupBy: [
          {
            Type: 'DIMENSION',
            Key: 'SERVICE',
          },
        ],
        // Filter out credits and refunds to show actual usage costs
        Filter: {
          Not: {
            Dimensions: {
              Key: 'RECORD_TYPE',
              Values: ['Credit', 'Refund'],
            },
          },
        },
      })
    );

    const services: ServiceCost[] = [];
    const activeServices = new Set<ServiceType>();
    let totalCost = 0;
    let currency = 'USD';

    if (response.ResultsByTime) {
      for (const result of response.ResultsByTime) {
        if (result.Groups) {
          for (const group of result.Groups) {
            const serviceName = group.Keys?.[0] || 'Unknown';
            const amount = parseFloat(
              group.Metrics?.UnblendedCost?.Amount || '0'
            );
            currency = group.Metrics?.UnblendedCost?.Unit || 'USD';

            // Map to ServiceType if applicable
            const serviceType = SERVICE_NAME_MAP[serviceName];

            // Find existing service or create new entry
            const existingIndex = services.findIndex(
              (s) => s.service === serviceName
            );
            if (existingIndex >= 0) {
              services[existingIndex].cost += amount;
            } else {
              services.push({
                service: serviceName,
                cost: amount,
                currency,
                hasUsage: amount > 0,
                serviceType,
              });
            }

            totalCost += amount;

            if (serviceType && amount > 0) {
              activeServices.add(serviceType);
            }
          }
        }
      }
    }

    // Sort by cost descending
    services.sort((a, b) => b.cost - a.cost);

    return {
      services,
      activeServices: Array.from(activeServices),
      totalCost,
      currency,
      startDate: formatDate(startDate),
      endDate: formatDate(endDate),
    };
  } catch (error) {
    // If Cost Explorer access is denied or not available, return empty result
    console.warn('Cost Explorer discovery failed:', error);
    return {
      services: [],
      activeServices: [],
      totalCost: 0,
      currency: 'USD',
      startDate: formatDate(startDate),
      endDate: formatDate(endDate),
    };
  }
}

/**
 * Get suggested services to scan based on cost data.
 * Returns services that have actual usage (cost > 0) in the specified period.
 */
export async function getSuggestedServicesToScan(
  profile: string,
  days: number = 30
): Promise<ServiceType[]> {
  const result = await discoverActiveServicesByCost(profile, days);
  return result.activeServices;
}

/**
 * Check if a specific service has usage based on cost data.
 */
export async function hasServiceUsage(
  profile: string,
  service: ServiceType,
  days: number = 30
): Promise<boolean> {
  const result = await discoverActiveServicesByCost(profile, days);
  return result.activeServices.includes(service);
}

/**
 * Format a date as YYYY-MM-DD for Cost Explorer API.
 */
function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Calculate date range for cost analysis.
 */
function calculateDateRange(days: number): { startDate: string; endDate: string; previousStartDate: string; previousEndDate: string } {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const previousEndDate = new Date(startDate);
  previousEndDate.setDate(previousEndDate.getDate() - 1);
  const previousStartDate = new Date(previousEndDate);
  previousStartDate.setDate(previousStartDate.getDate() - days);

  return {
    startDate: formatDate(startDate),
    endDate: formatDate(endDate),
    previousStartDate: formatDate(previousStartDate),
    previousEndDate: formatDate(previousEndDate),
  };
}

/**
 * Get detailed cost analysis including service breakdown, region breakdown, and trend.
 */
export async function getDetailedCostAnalysis(
  profile: string,
  startDateStr: string,
  endDateStr: string,
  granularity: CostGranularity = 'DAILY'
): Promise<CostAnalysisResult> {
  const client = getClientFactory().getCostExplorerClient({
    profile,
    region: 'us-east-1',
  });

  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);
  const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

  // Calculate previous period dates
  const previousEndDate = new Date(startDate);
  previousEndDate.setDate(previousEndDate.getDate() - 1);
  const previousStartDate = new Date(previousEndDate);
  previousStartDate.setDate(previousStartDate.getDate() - daysDiff);

  try {
    // Fetch current period costs by service
    const serviceResponse = await client.send(
      new GetCostAndUsageCommand({
        TimePeriod: { Start: startDateStr, End: endDateStr },
        Granularity: granularity,
        Metrics: ['UnblendedCost'],
        GroupBy: [{ Type: 'DIMENSION', Key: 'SERVICE' }],
        Filter: {
          Not: {
            Dimensions: {
              Key: 'RECORD_TYPE',
              Values: ['Credit', 'Refund'],
            },
          },
        },
      })
    );

    // Fetch previous period costs by service for comparison
    const previousServiceResponse = await client.send(
      new GetCostAndUsageCommand({
        TimePeriod: { Start: formatDate(previousStartDate), End: formatDate(previousEndDate) },
        Granularity: 'MONTHLY',
        Metrics: ['UnblendedCost'],
        GroupBy: [{ Type: 'DIMENSION', Key: 'SERVICE' }],
        Filter: {
          Not: {
            Dimensions: {
              Key: 'RECORD_TYPE',
              Values: ['Credit', 'Refund'],
            },
          },
        },
      })
    );

    // Fetch costs by region
    const regionResponse = await client.send(
      new GetCostAndUsageCommand({
        TimePeriod: { Start: startDateStr, End: endDateStr },
        Granularity: 'MONTHLY',
        Metrics: ['UnblendedCost'],
        GroupBy: [{ Type: 'DIMENSION', Key: 'REGION' }],
        Filter: {
          Not: {
            Dimensions: {
              Key: 'RECORD_TYPE',
              Values: ['Credit', 'Refund'],
            },
          },
        },
      })
    );

    // Process current period service costs and build trend
    const serviceCostsMap = new Map<string, number>();
    const trendMap = new Map<string, number>();
    const serviceTrendMap = new Map<string, Map<string, number>>();
    let totalCost = 0;
    let currency = 'USD';

    if (serviceResponse.ResultsByTime) {
      for (const result of serviceResponse.ResultsByTime) {
        const date = result.TimePeriod?.Start || '';
        let periodTotal = 0;

        if (result.Groups) {
          for (const group of result.Groups) {
            const serviceName = group.Keys?.[0] || 'Unknown';
            const amount = parseFloat(group.Metrics?.UnblendedCost?.Amount || '0');
            currency = group.Metrics?.UnblendedCost?.Unit || 'USD';

            serviceCostsMap.set(serviceName, (serviceCostsMap.get(serviceName) || 0) + amount);
            periodTotal += amount;
            totalCost += amount;

            // Track per-service daily costs for trend analysis
            if (!serviceTrendMap.has(serviceName)) {
              serviceTrendMap.set(serviceName, new Map());
            }
            const svcDayMap = serviceTrendMap.get(serviceName)!;
            svcDayMap.set(date, (svcDayMap.get(date) || 0) + amount);
          }
        }

        trendMap.set(date, (trendMap.get(date) || 0) + periodTotal);
      }
    }

    // Process previous period service costs
    const previousServiceCostsMap = new Map<string, number>();
    let previousPeriodTotalCost = 0;

    if (previousServiceResponse.ResultsByTime) {
      for (const result of previousServiceResponse.ResultsByTime) {
        if (result.Groups) {
          for (const group of result.Groups) {
            const serviceName = group.Keys?.[0] || 'Unknown';
            const amount = parseFloat(group.Metrics?.UnblendedCost?.Amount || '0');
            previousServiceCostsMap.set(serviceName, (previousServiceCostsMap.get(serviceName) || 0) + amount);
            previousPeriodTotalCost += amount;
          }
        }
      }
    }

    // Build service breakdown with comparison
    const byService: DetailedServiceCost[] = Array.from(serviceCostsMap.entries())
      .map(([service, cost]) => {
        const previousCost = previousServiceCostsMap.get(service) || 0;
        const percentChange = previousCost > 0 ? ((cost - previousCost) / previousCost) * 100 : cost > 0 ? 100 : 0;
        return {
          service,
          cost,
          previousPeriodCost: previousCost,
          percentChange,
          currency,
        };
      })
      .sort((a, b) => b.cost - a.cost);

    // Build trend data
    const trend: CostTrendDataPoint[] = Array.from(trendMap.entries())
      .map(([date, cost]) => ({ date, cost, currency }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Process region costs
    const byRegion: RegionCost[] = [];
    if (regionResponse.ResultsByTime) {
      const regionCostsMap = new Map<string, number>();
      for (const result of regionResponse.ResultsByTime) {
        if (result.Groups) {
          for (const group of result.Groups) {
            const region = group.Keys?.[0] || 'Unknown';
            const amount = parseFloat(group.Metrics?.UnblendedCost?.Amount || '0');
            regionCostsMap.set(region, (regionCostsMap.get(region) || 0) + amount);
          }
        }
      }

      for (const [region, cost] of regionCostsMap.entries()) {
        if (cost > 0) {
          byRegion.push({ region, cost, currency });
        }
      }
      byRegion.sort((a, b) => b.cost - a.cost);
    }

    const percentChange = previousPeriodTotalCost > 0
      ? ((totalCost - previousPeriodTotalCost) / previousPeriodTotalCost) * 100
      : totalCost > 0 ? 100 : 0;

    // Build per-service trend arrays from the per-service daily map
    const serviceTrends: Record<string, CostTrendDataPoint[]> = {};
    for (const [svcName, dayMap] of serviceTrendMap.entries()) {
      serviceTrends[svcName] = Array.from(dayMap.entries())
        .map(([date, cost]) => ({ date, cost, currency }))
        .sort((a, b) => a.date.localeCompare(b.date));
    }

    return {
      totalCost,
      previousPeriodTotalCost,
      percentChange,
      currency,
      startDate: startDateStr,
      endDate: endDateStr,
      trend,
      serviceTrends,
      byService,
      byRegion,
    };
  } catch (error) {
    console.warn('Detailed cost analysis failed:', error);
    return {
      totalCost: 0,
      previousPeriodTotalCost: 0,
      percentChange: 0,
      currency: 'USD',
      startDate: startDateStr,
      endDate: endDateStr,
      trend: [],
      serviceTrends: {},
      byService: [],
      byRegion: [],
    };
  }
}

/**
 * Get cost trend data for the specified number of days.
 */
export async function getCostTrend(
  profile: string,
  days: number = 30,
  granularity: CostGranularity = 'DAILY'
): Promise<CostTrendDataPoint[]> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const result = await getDetailedCostAnalysis(
    profile,
    formatDate(startDate),
    formatDate(endDate),
    granularity
  );

  return result.trend;
}

/**
 * Services eligible for service-specific Reserved Instances.
 */
const RI_ELIGIBLE_SERVICES = [
  'Amazon Relational Database Service',
  'Amazon ElastiCache',
  'Amazon Redshift',
  'Amazon OpenSearch Service',
];

/**
 * Services eligible for Compute Savings Plans.
 */
const SAVINGS_PLAN_ELIGIBLE_SERVICES = [
  'Amazon Elastic Compute Cloud - Compute',
  'AWS Lambda',
  'AWS Fargate',
  'Amazon SageMaker',
];

/**
 * Calculate the coefficient of variation from daily cost trend data for a service.
 * Lower CV = more stable spend = better candidate for commitments.
 */
function calculateCV(trendData: CostTrendDataPoint[]): number {
  if (trendData.length < 3) return 1; // not enough data, assume volatile
  const costs = trendData.map((t) => t.cost);
  const mean = costs.reduce((a, b) => a + b, 0) / costs.length;
  if (mean === 0) return 0;
  const variance = costs.reduce((sum, c) => sum + Math.pow(c - mean, 2), 0) / costs.length;
  return Math.sqrt(variance) / mean;
}

/**
 * Detect an upward trend via simple linear regression slope on daily costs.
 * Returns the average daily cost increase.
 */
function calculateDailySlope(trendData: CostTrendDataPoint[]): number {
  const n = trendData.length;
  if (n < 5) return 0;
  const costs = trendData.map((t) => t.cost);
  const xMean = (n - 1) / 2;
  const yMean = costs.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (costs[i] - yMean);
    den += (i - xMean) * (i - xMean);
  }
  return den === 0 ? 0 : num / den;
}

import { runResourceCostChecks } from './cost-resource-checks';

/**
 * Generate cost optimization recommendations based on cost patterns and resource-level checks.
 */
export async function getCostOptimizations(
  profile: string,
  days: number = 30,
  region?: string
): Promise<CostOptimizationResult> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const analysis = await getDetailedCostAnalysis(
    profile,
    formatDate(startDate),
    formatDate(endDate),
    'DAILY'
  );

  const recommendations: CostOptimizationRecommendation[] = [];
  let totalPotentialSavings = 0;

  // Total eligible spend for Savings Plan coverage check
  let totalEligibleSpend = 0;

  for (const service of analysis.byService) {
    const monthlyCost = service.cost * (30 / days);
    const serviceSlug = service.service.replace(/\s+/g, '-').toLowerCase();

    // --- Savings Plans recommendations (Compute services) ---
    if (SAVINGS_PLAN_ELIGIBLE_SERVICES.includes(service.service) && monthlyCost > 25) {
      totalEligibleSpend += monthlyCost;
      const serviceTrend = analysis.serviceTrends[service.service] || [];
      const cv = calculateCV(serviceTrend);
      const savingsRate = cv < 0.3 ? 0.30 : cv < 0.5 ? 0.20 : 0.15;
      const estimatedSavings = monthlyCost * savingsRate;

      if (estimatedSavings >= 25) {
        const stability = cv < 0.3 ? 'stable' : cv < 0.5 ? 'moderately stable' : 'variable';
        recommendations.push({
          id: `sp-${serviceSlug}`,
          type: 'savings_plan',
          severity: estimatedSavings > 500 ? 'high' : estimatedSavings > 100 ? 'medium' : 'low',
          service: service.service,
          description: `${service.service} spend is ${formatCurrency(monthlyCost)}/mo (${stability}). A Compute Savings Plan could save ~${(savingsRate * 100).toFixed(0)}% (${formatCurrency(estimatedSavings)}/mo).${cv > 0.5 ? ' Consider an On-Demand Savings Plan for flexible coverage.' : ''}`,
          estimatedMonthlySavings: estimatedSavings,
          currency: service.currency,
          actionRequired: cv < 0.3
            ? 'Purchase a 1-year or 3-year Compute Savings Plan for this stable workload.'
            : 'Evaluate a Compute Savings Plan; start with a conservative commitment matching baseline usage.',
          category: 'Compute',
        });
        totalPotentialSavings += estimatedSavings;
      }
    }

    // --- Reserved Instance recommendations (database/cache services) ---
    if (RI_ELIGIBLE_SERVICES.includes(service.service) && monthlyCost > 25) {
      totalEligibleSpend += monthlyCost;
      const serviceTrend = analysis.serviceTrends[service.service] || [];
      const cv = calculateCV(serviceTrend);
      const savingsRate = cv < 0.3 ? 0.35 : 0.25;
      const estimatedSavings = monthlyCost * savingsRate;

      if (estimatedSavings >= 25) {
        const stability = cv < 0.3 ? 'stable' : 'variable';
        recommendations.push({
          id: `ri-${serviceSlug}`,
          type: 'reserved_instance',
          severity: estimatedSavings > 500 ? 'high' : estimatedSavings > 100 ? 'medium' : 'low',
          service: service.service,
          description: `${service.service} spend is ${formatCurrency(monthlyCost)}/mo (${stability}). Reserved Instances could save ~${(savingsRate * 100).toFixed(0)}% (${formatCurrency(estimatedSavings)}/mo).`,
          estimatedMonthlySavings: estimatedSavings,
          currency: service.currency,
          actionRequired: 'Evaluate Reserved Instance purchases matching your instance types and usage patterns.',
          category: 'Database',
        });
        totalPotentialSavings += estimatedSavings;
      }
    }

    // --- Cost anomaly detection ---
    // Spike: > 50% increase from previous period with meaningful spend
    if (service.percentChange > 50 && service.previousPeriodCost > 10) {
      const costIncrease = service.cost - service.previousPeriodCost;
      const monthlyCostIncrease = costIncrease * (30 / days);
      if (monthlyCostIncrease >= 5) {
        recommendations.push({
          id: `anomaly-spike-${serviceSlug}`,
          type: 'cost_anomaly',
          severity: monthlyCostIncrease > 200 ? 'high' : monthlyCostIncrease > 50 ? 'medium' : 'low',
          service: service.service,
          description: `${service.service} cost increased ${service.percentChange.toFixed(0)}% vs previous period: ${formatCurrency(service.previousPeriodCost)} → ${formatCurrency(service.cost)} (+${formatCurrency(costIncrease)}).`,
          estimatedMonthlySavings: monthlyCostIncrease * 0.3,
          currency: service.currency,
          actionRequired: 'Investigate the cost increase — check for new resources, configuration changes, or unexpected traffic.',
          category: 'Cost Management',
        });
        totalPotentialSavings += monthlyCostIncrease * 0.3;
      }
    }

    // Gradual upward trend detection via daily slope
    const serviceTrendForSlope = analysis.serviceTrends[service.service] || [];
    if (monthlyCost > 50 && serviceTrendForSlope.length >= 7) {
      const slope = calculateDailySlope(serviceTrendForSlope);
      const projectedMonthlyIncrease = slope * 30;
      // Flag if projected monthly increase is > 20% of current monthly cost
      if (projectedMonthlyIncrease > monthlyCost * 0.2 && projectedMonthlyIncrease > 10) {
        recommendations.push({
          id: `anomaly-trend-${serviceSlug}`,
          type: 'cost_anomaly',
          severity: projectedMonthlyIncrease > 100 ? 'high' : 'medium',
          service: service.service,
          description: `${service.service} shows a rising cost trend — costs are increasing ~${formatCurrency(slope)}/day, projecting +${formatCurrency(projectedMonthlyIncrease)}/mo if unchecked.`,
          estimatedMonthlySavings: projectedMonthlyIncrease * 0.5,
          currency: service.currency,
          actionRequired: 'Review usage trends and identify drivers of increasing costs.',
          category: 'Cost Management',
        });
        totalPotentialSavings += projectedMonthlyIncrease * 0.5;
      }
    }
  }

  // --- Savings Plans coverage recommendation for overall spend ---
  const totalMonthlyCost = analysis.byService.reduce(
    (sum, s) => sum + s.cost * (30 / days),
    0
  );
  if (totalMonthlyCost > 500 && totalEligibleSpend > 200) {
    // Only add if we haven't already recommended individual SP/RI for most spend
    const alreadyRecommended = recommendations
      .filter((r) => r.type === 'savings_plan' || r.type === 'reserved_instance')
      .reduce((sum, r) => sum + r.estimatedMonthlySavings, 0);

    if (alreadyRecommended < totalEligibleSpend * 0.1) {
      const savingsEstimate = totalEligibleSpend * 0.15;
      recommendations.push({
        id: 'sp-overall-coverage',
        type: 'savings_plan',
        severity: savingsEstimate > 200 ? 'high' : 'medium',
        service: 'AWS Account (Overall)',
        description: `Total eligible spend is ${formatCurrency(totalEligibleSpend)}/mo with no commitment discounts. A Savings Plan could save ~15% (${formatCurrency(savingsEstimate)}/mo).`,
        estimatedMonthlySavings: savingsEstimate,
        currency: analysis.currency,
        actionRequired: 'Use AWS Cost Explorer Savings Plans recommendations to size an appropriate commitment.',
        category: 'Cost Management',
      });
      totalPotentialSavings += savingsEstimate;
    }
  }

  // --- Resource-level checks ---
  if (region) {
    try {
      const resourceRecs = await runResourceCostChecks(profile, region);
      for (const rec of resourceRecs) {
        if (rec.estimatedMonthlySavings >= 1) {
          recommendations.push(rec);
          totalPotentialSavings += rec.estimatedMonthlySavings;
        }
      }
    } catch (err) {
      console.warn('Resource cost checks failed:', err);
    }
  }

  // Filter out any recommendation below $1/mo minimum threshold
  const filtered = recommendations.filter((r) => r.estimatedMonthlySavings >= 1);

  // Sort by potential savings (highest first)
  filtered.sort((a, b) => b.estimatedMonthlySavings - a.estimatedMonthlySavings);

  const filteredSavings = filtered.reduce((sum, r) => sum + r.estimatedMonthlySavings, 0);

  return {
    recommendations: filtered,
    totalPotentialSavings: filteredSavings,
    currency: analysis.currency,
  };
}

/**
 * Format currency for display in recommendations.
 */
function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

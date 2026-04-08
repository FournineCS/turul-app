// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { DescribeInstancesCommand } from '@aws-sdk/client-ec2';
import { DescribeDBInstancesCommand } from '@aws-sdk/client-rds';
import { DescribeCacheClustersCommand } from '@aws-sdk/client-elasticache';
import { getClientFactory } from '../../client-factory';
import type { WABPFinding } from '../../../../shared/types';
import { PERFORMANCE_CHECKS, type WABPCheckResult } from './types';

// Previous-generation EC2 instance type prefixes
const PREV_GEN_EC2_PREFIXES = [
  't1.', 't2.', 'm1.', 'm2.', 'm3.', 'm4.',
  'c1.', 'c3.', 'c4.', 'r3.', 'r4.',
  'i2.', 'i3.', 'd2.', 'g2.', 'p2.',
];

// Previous-generation RDS instance class prefixes
const PREV_GEN_RDS_PREFIXES = [
  'db.t2.', 'db.m3.', 'db.m4.', 'db.r3.', 'db.r4.',
];

// Minimum recommended ElastiCache engine versions
const MIN_REDIS_VERSION = '7.0';
const MIN_MEMCACHED_VERSION = '1.6';

/**
 * WA-PERF-001: Check EC2 instance types
 */
async function checkEC2InstanceTypes(
  profile: string,
  region: string
): Promise<WABPFinding[]> {
  const client = getClientFactory().getEC2Client({ profile, region });
  const findings: WABPFinding[] = [];
  const checkDef = PERFORMANCE_CHECKS.find((c) => c.id === 'WA-PERF-001')!;

  try {
    let nextToken: string | undefined;
    do {
      const response = await client.send(
        new DescribeInstancesCommand({
          Filters: [{ Name: 'instance-state-name', Values: ['running'] }],
          NextToken: nextToken,
          MaxResults: 100,
        })
      );

      for (const reservation of response.Reservations || []) {
        for (const instance of reservation.Instances || []) {
          const instanceType = instance.InstanceType || '';
          const isPrevGen = PREV_GEN_EC2_PREFIXES.some((prefix) =>
            instanceType.startsWith(prefix)
          );

          if (isPrevGen) {
            const name = instance.Tags?.find((t) => t.Key === 'Name')?.Value || instance.InstanceId;
            findings.push({
              checkId: checkDef.id,
              title: checkDef.title,
              description: `EC2 instance "${name}" (${instance.InstanceId}) uses previous-gen instance type "${instanceType}".`,
              pillar: 'performance',
              severity: checkDef.severity,
              status: 'FAIL',
              service: checkDef.service,
              resourceId: instance.InstanceId,
              resourceArn: `arn:aws:ec2:${region}::instance/${instance.InstanceId}`,
              region,
              remediationRecommendation: checkDef.remediationRecommendation,
              remediationUrl: checkDef.remediationUrl,
            });
          }
        }
      }
      nextToken = response.NextToken;
    } while (nextToken);
  } catch (error) {
    throw error;
  }

  return findings;
}

/**
 * WA-PERF-002: Check RDS instance classes
 */
async function checkRDSInstanceClasses(
  profile: string,
  region: string
): Promise<WABPFinding[]> {
  const client = getClientFactory().getRDSClient({ profile, region });
  const findings: WABPFinding[] = [];
  const checkDef = PERFORMANCE_CHECKS.find((c) => c.id === 'WA-PERF-002')!;

  try {
    let marker: string | undefined;
    do {
      const response = await client.send(
        new DescribeDBInstancesCommand({ Marker: marker, MaxRecords: 100 })
      );
      for (const db of response.DBInstances || []) {
        const instanceClass = db.DBInstanceClass || '';
        const isPrevGen = PREV_GEN_RDS_PREFIXES.some((prefix) =>
          instanceClass.startsWith(prefix)
        );

        if (isPrevGen) {
          findings.push({
            checkId: checkDef.id,
            title: checkDef.title,
            description: `RDS instance "${db.DBInstanceIdentifier}" uses previous-gen instance class "${instanceClass}".`,
            pillar: 'performance',
            severity: checkDef.severity,
            status: 'FAIL',
            service: checkDef.service,
            resourceId: db.DBInstanceIdentifier,
            resourceArn: db.DBInstanceArn,
            region,
            remediationRecommendation: checkDef.remediationRecommendation,
            remediationUrl: checkDef.remediationUrl,
          });
        }
      }
      marker = response.Marker;
    } while (marker);
  } catch (error) {
    throw error;
  }

  return findings;
}

/**
 * Compare version strings (e.g., "7.0" > "6.2")
 */
function isVersionLessThan(version: string, minVersion: string): boolean {
  const vParts = version.split('.').map(Number);
  const mParts = minVersion.split('.').map(Number);

  for (let i = 0; i < Math.max(vParts.length, mParts.length); i++) {
    const v = vParts[i] || 0;
    const m = mParts[i] || 0;
    if (v < m) return true;
    if (v > m) return false;
  }
  return false;
}

/**
 * WA-PERF-003: Check ElastiCache engine versions
 */
async function checkElastiCacheVersions(
  profile: string,
  region: string
): Promise<WABPFinding[]> {
  const client = getClientFactory().getElastiCacheClient({ profile, region });
  const findings: WABPFinding[] = [];
  const checkDef = PERFORMANCE_CHECKS.find((c) => c.id === 'WA-PERF-003')!;

  try {
    let marker: string | undefined;
    do {
      const response = await client.send(
        new DescribeCacheClustersCommand({ Marker: marker, MaxRecords: 100 })
      );
      for (const cluster of response.CacheClusters || []) {
        const engine = cluster.Engine || '';
        const version = cluster.EngineVersion || '';
        const minVersion = engine === 'redis' ? MIN_REDIS_VERSION : MIN_MEMCACHED_VERSION;

        if (version && isVersionLessThan(version, minVersion)) {
          findings.push({
            checkId: checkDef.id,
            title: checkDef.title,
            description: `ElastiCache cluster "${cluster.CacheClusterId}" is running ${engine} ${version} (recommended: ${minVersion}+).`,
            pillar: 'performance',
            severity: checkDef.severity,
            status: 'FAIL',
            service: checkDef.service,
            resourceId: cluster.CacheClusterId,
            resourceArn: cluster.ARN,
            region,
            remediationRecommendation: checkDef.remediationRecommendation,
            remediationUrl: checkDef.remediationUrl,
          });
        }
      }
      marker = response.Marker;
    } while (marker);
  } catch (error) {
    throw error;
  }

  return findings;
}

/**
 * Run all Performance Efficiency checks
 */
export async function runPerformanceChecks(
  profile: string,
  region: string
): Promise<WABPCheckResult> {
  const findings: WABPFinding[] = [];
  const errors: string[] = [];
  let checksRun = 0;
  let checksWithFindings = 0;

  const checks = [
    { name: 'EC2 Instance Types', runner: checkEC2InstanceTypes },
    { name: 'RDS Instance Classes', runner: checkRDSInstanceClasses },
    { name: 'ElastiCache Versions', runner: checkElastiCacheVersions },
  ];

  for (const { name, runner } of checks) {
    try {
      checksRun++;
      const result = await runner(profile, region);
      if (result.length > 0) {
        checksWithFindings++;
        findings.push(...result);
      }
    } catch (error) {
      errors.push(`${name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return { findings, errors, checksRun, checksWithFindings };
}

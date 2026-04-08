// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { DescribeDBInstancesCommand, type DBInstance } from '@aws-sdk/client-rds';
import { getClientFactory } from '../../client-factory';
import type { SecurityFinding } from '../../../../shared/types';
import { RDS_CHECKS, type CheckResult } from './types';

/**
 * Check RDS instances for encryption
 */
function checkRDSEncryption(
  instances: DBInstance[],
  region: string
): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  const checkDef = RDS_CHECKS.find((c) => c.id === 'BP-RDS-001');

  if (!checkDef) return findings;

  for (const instance of instances) {
    if (!instance.StorageEncrypted) {
      findings.push({
        id: `BP-RDS-001-${instance.DBInstanceIdentifier}`,
        title: checkDef.title,
        description: `${checkDef.description} RDS instance "${instance.DBInstanceIdentifier}" (${instance.Engine}) does not have encryption at rest enabled.`,
        severity: checkDef.severity,
        status: 'ACTIVE',
        source: 'BEST_PRACTICES',
        region,
        resourceType: 'AwsRdsDbInstance',
        resourceId: instance.DBInstanceIdentifier,
        resourceArn: instance.DBInstanceArn,
        remediationRecommendation: checkDef.remediationRecommendation,
        remediationUrl: checkDef.remediationUrl,
        firstObservedAt: new Date().toISOString(),
        lastObservedAt: new Date().toISOString(),
        generatorId: checkDef.id,
        productName: 'Best Practices Scanner',
      });
    }
  }

  return findings;
}

/**
 * Check RDS instances for public accessibility
 */
function checkRDSPublicAccess(
  instances: DBInstance[],
  region: string
): SecurityFinding[] {
  const findings: SecurityFinding[] = [];
  const checkDef = RDS_CHECKS.find((c) => c.id === 'BP-RDS-002');

  if (!checkDef) return findings;

  for (const instance of instances) {
    if (instance.PubliclyAccessible) {
      findings.push({
        id: `BP-RDS-002-${instance.DBInstanceIdentifier}`,
        title: checkDef.title,
        description: `${checkDef.description} RDS instance "${instance.DBInstanceIdentifier}" (${instance.Engine}) is publicly accessible.`,
        severity: checkDef.severity,
        status: 'ACTIVE',
        source: 'BEST_PRACTICES',
        region,
        resourceType: 'AwsRdsDbInstance',
        resourceId: instance.DBInstanceIdentifier,
        resourceArn: instance.DBInstanceArn,
        remediationRecommendation: checkDef.remediationRecommendation,
        remediationUrl: checkDef.remediationUrl,
        firstObservedAt: new Date().toISOString(),
        lastObservedAt: new Date().toISOString(),
        generatorId: checkDef.id,
        productName: 'Best Practices Scanner',
      });
    }
  }

  return findings;
}

/**
 * Run all RDS security checks
 */
export async function runRDSChecks(
  profile: string,
  region: string
): Promise<CheckResult> {
  const findings: SecurityFinding[] = [];
  const errors: string[] = [];
  let checksRun = 0;
  let checksWithFindings = 0;

  try {
    const client = getClientFactory().getRDSClient({ profile, region });
    const instances: DBInstance[] = [];
    let marker: string | undefined;

    // Fetch all RDS instances
    do {
      const response = await client.send(
        new DescribeDBInstancesCommand({
          Marker: marker,
          MaxRecords: 100,
        })
      );

      instances.push(...(response.DBInstances || []));
      marker = response.Marker;
    } while (marker);

    // Check encryption
    checksRun++;
    const encryptionFindings = checkRDSEncryption(instances, region);
    if (encryptionFindings.length > 0) {
      checksWithFindings++;
      findings.push(...encryptionFindings);
    }

    // Check public access
    checksRun++;
    const publicAccessFindings = checkRDSPublicAccess(instances, region);
    if (publicAccessFindings.length > 0) {
      checksWithFindings++;
      findings.push(...publicAccessFindings);
    }
  } catch (error) {
    errors.push(`RDS checks: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }

  return {
    findings,
    errors,
    checksRun,
    checksWithFindings,
  };
}

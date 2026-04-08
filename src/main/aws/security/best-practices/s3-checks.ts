// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  ListBucketsCommand,
  GetBucketEncryptionCommand,
  GetBucketVersioningCommand,
  GetPublicAccessBlockCommand,
  GetBucketPolicyStatusCommand,
  type Bucket,
} from '@aws-sdk/client-s3';
import { getClientFactory } from '../../client-factory';
import type { SecurityFinding } from '../../../../shared/types';
import { S3_CHECKS, type CheckResult } from './types';

interface BucketSecurityStatus {
  bucket: Bucket;
  hasEncryption: boolean;
  hasVersioning: boolean;
  hasPublicAccessBlock: boolean;
  isPublicByPolicy: boolean;
  encryptionError?: string;
  versioningError?: string;
  publicAccessError?: string;
  policyStatusError?: string;
}

/**
 * Check encryption status for a bucket
 */
async function checkBucketEncryption(
  profile: string,
  region: string,
  bucketName: string
): Promise<{ hasEncryption: boolean; error?: string }> {
  const client = getClientFactory().getS3Client({ profile, region });

  try {
    await client.send(new GetBucketEncryptionCommand({ Bucket: bucketName }));
    return { hasEncryption: true };
  } catch (error) {
    // ServerSideEncryptionConfigurationNotFoundError means no encryption
    if (
      error instanceof Error &&
      error.name === 'ServerSideEncryptionConfigurationNotFoundError'
    ) {
      return { hasEncryption: false };
    }
    // Access denied or other errors - we can't determine, so assume compliant
    return {
      hasEncryption: true,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check versioning status for a bucket
 */
async function checkBucketVersioning(
  profile: string,
  region: string,
  bucketName: string
): Promise<{ hasVersioning: boolean; error?: string }> {
  const client = getClientFactory().getS3Client({ profile, region });

  try {
    const response = await client.send(new GetBucketVersioningCommand({ Bucket: bucketName }));
    return { hasVersioning: response.Status === 'Enabled' };
  } catch (error) {
    return {
      hasVersioning: true, // Assume compliant if we can't check
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check public access block for a bucket
 */
async function checkBucketPublicAccessBlock(
  profile: string,
  region: string,
  bucketName: string
): Promise<{ hasPublicAccessBlock: boolean; error?: string }> {
  const client = getClientFactory().getS3Client({ profile, region });

  try {
    const response = await client.send(
      new GetPublicAccessBlockCommand({ Bucket: bucketName })
    );

    const config = response.PublicAccessBlockConfiguration;
    // All four settings should be true for full block
    const fullyBlocked =
      config?.BlockPublicAcls === true &&
      config?.IgnorePublicAcls === true &&
      config?.BlockPublicPolicy === true &&
      config?.RestrictPublicBuckets === true;

    return { hasPublicAccessBlock: fullyBlocked };
  } catch (error) {
    // NoSuchPublicAccessBlockConfiguration means no block is set
    if (error instanceof Error && error.name === 'NoSuchPublicAccessBlockConfiguration') {
      return { hasPublicAccessBlock: false };
    }
    return {
      hasPublicAccessBlock: true, // Assume compliant if we can't check
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Check if bucket policy allows public access
 */
async function checkBucketPolicyStatus(
  profile: string,
  region: string,
  bucketName: string
): Promise<{ isPublicByPolicy: boolean; error?: string }> {
  const client = getClientFactory().getS3Client({ profile, region });

  try {
    const response = await client.send(
      new GetBucketPolicyStatusCommand({ Bucket: bucketName })
    );
    return { isPublicByPolicy: response.PolicyStatus?.IsPublic === true };
  } catch (error) {
    // NoSuchBucketPolicy means no policy, so not public
    if (error instanceof Error && error.name === 'NoSuchBucketPolicy') {
      return { isPublicByPolicy: false };
    }
    return {
      isPublicByPolicy: false, // Assume not public if we can't check
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get security status for all buckets
 */
async function getBucketSecurityStatuses(
  profile: string,
  region: string
): Promise<BucketSecurityStatus[]> {
  const client = getClientFactory().getS3Client({ profile, region });
  const statuses: BucketSecurityStatus[] = [];

  try {
    const response = await client.send(new ListBucketsCommand({}));

    for (const bucket of response.Buckets || []) {
      if (!bucket.Name) continue;

      const [encryption, versioning, publicAccess, policyStatus] = await Promise.all([
        checkBucketEncryption(profile, region, bucket.Name),
        checkBucketVersioning(profile, region, bucket.Name),
        checkBucketPublicAccessBlock(profile, region, bucket.Name),
        checkBucketPolicyStatus(profile, region, bucket.Name),
      ]);

      statuses.push({
        bucket,
        hasEncryption: encryption.hasEncryption,
        hasVersioning: versioning.hasVersioning,
        hasPublicAccessBlock: publicAccess.hasPublicAccessBlock,
        isPublicByPolicy: policyStatus.isPublicByPolicy,
        encryptionError: encryption.error,
        versioningError: versioning.error,
        publicAccessError: publicAccess.error,
        policyStatusError: policyStatus.error,
      });
    }
  } catch (error) {
    console.error('Failed to list S3 buckets:', error);
    throw error;
  }

  return statuses;
}

/**
 * Create findings from bucket security statuses
 */
function createS3Findings(
  statuses: BucketSecurityStatus[],
  region: string
): SecurityFinding[] {
  const findings: SecurityFinding[] = [];

  for (const status of statuses) {
    const bucketName = status.bucket.Name || 'unknown';

    // Check encryption (BP-S3-001)
    if (!status.hasEncryption && !status.encryptionError) {
      const checkDef = S3_CHECKS.find((c) => c.id === 'BP-S3-001');
      if (checkDef) {
        findings.push({
          id: `BP-S3-001-${bucketName}`,
          title: checkDef.title,
          description: `${checkDef.description} Bucket "${bucketName}" does not have default encryption enabled.`,
          severity: checkDef.severity,
          status: 'ACTIVE',
          source: 'BEST_PRACTICES',
          region,
          resourceType: 'AwsS3Bucket',
          resourceId: bucketName,
          resourceArn: `arn:aws:s3:::${bucketName}`,
          remediationRecommendation: checkDef.remediationRecommendation,
          remediationUrl: checkDef.remediationUrl,
          firstObservedAt: new Date().toISOString(),
          lastObservedAt: new Date().toISOString(),
          generatorId: checkDef.id,
          productName: 'Best Practices Scanner',
        });
      }
    }

    // Check public access (BP-S3-002)
    if (
      (!status.hasPublicAccessBlock || status.isPublicByPolicy) &&
      !status.publicAccessError &&
      !status.policyStatusError
    ) {
      const checkDef = S3_CHECKS.find((c) => c.id === 'BP-S3-002');
      if (checkDef) {
        const publicReason = status.isPublicByPolicy
          ? 'has a bucket policy allowing public access'
          : 'does not have S3 Block Public Access fully enabled';

        findings.push({
          id: `BP-S3-002-${bucketName}`,
          title: checkDef.title,
          description: `${checkDef.description} Bucket "${bucketName}" ${publicReason}.`,
          severity: checkDef.severity,
          status: 'ACTIVE',
          source: 'BEST_PRACTICES',
          region,
          resourceType: 'AwsS3Bucket',
          resourceId: bucketName,
          resourceArn: `arn:aws:s3:::${bucketName}`,
          remediationRecommendation: checkDef.remediationRecommendation,
          remediationUrl: checkDef.remediationUrl,
          firstObservedAt: new Date().toISOString(),
          lastObservedAt: new Date().toISOString(),
          generatorId: checkDef.id,
          productName: 'Best Practices Scanner',
        });
      }
    }

    // Check versioning (BP-S3-003)
    if (!status.hasVersioning && !status.versioningError) {
      const checkDef = S3_CHECKS.find((c) => c.id === 'BP-S3-003');
      if (checkDef) {
        findings.push({
          id: `BP-S3-003-${bucketName}`,
          title: checkDef.title,
          description: `${checkDef.description} Bucket "${bucketName}" does not have versioning enabled.`,
          severity: checkDef.severity,
          status: 'ACTIVE',
          source: 'BEST_PRACTICES',
          region,
          resourceType: 'AwsS3Bucket',
          resourceId: bucketName,
          resourceArn: `arn:aws:s3:::${bucketName}`,
          remediationRecommendation: checkDef.remediationRecommendation,
          remediationUrl: checkDef.remediationUrl,
          firstObservedAt: new Date().toISOString(),
          lastObservedAt: new Date().toISOString(),
          generatorId: checkDef.id,
          productName: 'Best Practices Scanner',
        });
      }
    }
  }

  return findings;
}

/**
 * Run all S3 security checks
 */
export async function runS3Checks(
  profile: string,
  region: string
): Promise<CheckResult> {
  const errors: string[] = [];
  let checksRun = 0;
  let checksWithFindings = 0;

  try {
    checksRun = 3; // Encryption, Public Access, Versioning
    const statuses = await getBucketSecurityStatuses(profile, region);
    const findings = createS3Findings(statuses, region);

    // Count unique check types that have findings
    const checkTypes = new Set(findings.map((f) => f.generatorId));
    checksWithFindings = checkTypes.size;

    // Collect any errors from individual bucket checks
    for (const status of statuses) {
      if (status.encryptionError) {
        errors.push(`Bucket ${status.bucket.Name} encryption: ${status.encryptionError}`);
      }
      if (status.versioningError) {
        errors.push(`Bucket ${status.bucket.Name} versioning: ${status.versioningError}`);
      }
      if (status.publicAccessError) {
        errors.push(`Bucket ${status.bucket.Name} public access: ${status.publicAccessError}`);
      }
    }

    return {
      findings,
      errors,
      checksRun,
      checksWithFindings,
    };
  } catch (error) {
    errors.push(`S3 checks: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return {
      findings: [],
      errors,
      checksRun,
      checksWithFindings,
    };
  }
}

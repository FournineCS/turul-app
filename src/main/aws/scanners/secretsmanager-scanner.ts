// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  ListSecretsCommand,
  DescribeSecretCommand,
  type SecretListEntry,
} from '@aws-sdk/client-secrets-manager';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class SecretsManagerScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'secretsmanager', 'secretsmanager');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getSecretsManagerClient({
      profile: this.config.profile,
      region: this.config.region,
    });

    try {
      let nextToken: string | undefined;

      do {
        const response = await this.withRateLimit(() =>
          client.send(new ListSecretsCommand({ NextToken: nextToken }))
        );

        if (response.SecretList) {
          for (const secret of response.SecretList) {
            try {
              // Get detailed secret info
              const detailResponse = await this.withRateLimit(() =>
                client.send(
                  new DescribeSecretCommand({ SecretId: secret.ARN })
                )
              );

              resources.push(this.mapSecretDetail(detailResponse));
            } catch {
              // Fall back to list info
              resources.push(this.mapSecret(secret));
            }
          }
        }

        nextToken = response.NextToken;
      } while (nextToken);
    } catch (error) {
      errors.push(this.createError('ListSecrets', error));
    }

    return { resources, errors };
  }

  private mapSecret(secret: SecretListEntry): Resource {
    const tags = this.parseTags(secret.Tags);

    return this.createResource(
      secret.ARN || '',
      'secret',
      secret.Name || '',
      {
        name: secret.Name,
        arn: secret.ARN,
        description: secret.Description,
        kmsKeyId: secret.KmsKeyId,
        rotationEnabled: secret.RotationEnabled,
        rotationLambdaARN: secret.RotationLambdaARN,
        rotationRules: secret.RotationRules
          ? {
              automaticallyAfterDays: secret.RotationRules.AutomaticallyAfterDays,
              duration: secret.RotationRules.Duration,
              scheduleExpression: secret.RotationRules.ScheduleExpression,
            }
          : undefined,
        lastRotatedDate: secret.LastRotatedDate?.toISOString(),
        lastChangedDate: secret.LastChangedDate?.toISOString(),
        lastAccessedDate: secret.LastAccessedDate?.toISOString(),
        deletedDate: secret.DeletedDate?.toISOString(),
        owningService: secret.OwningService,
        createdDate: secret.CreatedDate?.toISOString(),
        primaryRegion: secret.PrimaryRegion,
        secretVersionsToStages: secret.SecretVersionsToStages,
      },
      tags,
      secret.CreatedDate?.toISOString()
    );
  }

  private mapSecretDetail(secret: {
    ARN?: string;
    Name?: string;
    Description?: string;
    KmsKeyId?: string;
    RotationEnabled?: boolean;
    RotationLambdaARN?: string;
    RotationRules?: {
      AutomaticallyAfterDays?: number;
      Duration?: string;
      ScheduleExpression?: string;
    };
    LastRotatedDate?: Date;
    LastChangedDate?: Date;
    LastAccessedDate?: Date;
    DeletedDate?: Date;
    NextRotationDate?: Date;
    Tags?: { Key?: string; Value?: string }[];
    VersionIdsToStages?: Record<string, string[]>;
    OwningService?: string;
    CreatedDate?: Date;
    PrimaryRegion?: string;
    ReplicationStatus?: Array<{
      Region?: string;
      KmsKeyId?: string;
      Status?: string;
      StatusMessage?: string;
      LastAccessedDate?: Date;
    }>;
  }): Resource {
    const tags = this.parseTags(secret.Tags);

    return this.createResource(
      secret.ARN || '',
      'secret',
      secret.Name || '',
      {
        name: secret.Name,
        arn: secret.ARN,
        description: secret.Description,
        kmsKeyId: secret.KmsKeyId,
        rotationEnabled: secret.RotationEnabled,
        rotationLambdaARN: secret.RotationLambdaARN,
        rotationRules: secret.RotationRules
          ? {
              automaticallyAfterDays: secret.RotationRules.AutomaticallyAfterDays,
              duration: secret.RotationRules.Duration,
              scheduleExpression: secret.RotationRules.ScheduleExpression,
            }
          : undefined,
        lastRotatedDate: secret.LastRotatedDate?.toISOString(),
        lastChangedDate: secret.LastChangedDate?.toISOString(),
        lastAccessedDate: secret.LastAccessedDate?.toISOString(),
        deletedDate: secret.DeletedDate?.toISOString(),
        nextRotationDate: secret.NextRotationDate?.toISOString(),
        owningService: secret.OwningService,
        createdDate: secret.CreatedDate?.toISOString(),
        primaryRegion: secret.PrimaryRegion,
        versionIdsToStages: secret.VersionIdsToStages,
        replicationStatus: secret.ReplicationStatus?.map((r) => ({
          region: r.Region,
          kmsKeyId: r.KmsKeyId,
          status: r.Status,
          statusMessage: r.StatusMessage,
          lastAccessedDate: r.LastAccessedDate?.toISOString(),
        })),
      },
      tags,
      secret.CreatedDate?.toISOString()
    );
  }
}

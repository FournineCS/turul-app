// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  ListUserPoolsCommand,
  DescribeUserPoolCommand,
} from '@aws-sdk/client-cognito-identity-provider';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class CognitoScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'cognito', 'cognito');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getCognitoClient({ profile: this.config.profile, region: this.config.region });

    try {
      let nextToken: string | undefined;
      do {
        const response = await this.withRateLimit(() => client.send(new ListUserPoolsCommand({ MaxResults: 60, NextToken: nextToken })));
        if (response.UserPools) {
          for (const pool of response.UserPools) {
            if (!pool.Id) continue;

            let details: any = {};
            let tags: Record<string, string> = {};
            try {
              const descResp = await this.withRateLimit(() => client.send(new DescribeUserPoolCommand({ UserPoolId: pool.Id })));
              const up = descResp.UserPool;
              if (up) {
                tags = up.UserPoolTags || {};
                details = {
                  status: up.Status,
                  mfaConfiguration: up.MfaConfiguration,
                  estimatedNumberOfUsers: up.EstimatedNumberOfUsers,
                  emailConfiguration: up.EmailConfiguration ? {
                    sourceArn: up.EmailConfiguration.SourceArn,
                    emailSendingAccount: up.EmailConfiguration.EmailSendingAccount,
                  } : undefined,
                  autoVerifiedAttributes: up.AutoVerifiedAttributes,
                  usernameAttributes: up.UsernameAttributes,
                  deletionProtection: up.DeletionProtection,
                  domain: up.Domain,
                  schemaAttributes: up.SchemaAttributes?.map(s => s.Name),
                };
              }
            } catch { /* ignore */ }

            const arn = `arn:aws:cognito-idp:${this.config.region}::userpool/${pool.Id}`;
            resources.push(this.createResource(arn, 'user-pool', pool.Name || pool.Id, {
              userPoolId: pool.Id,
              userPoolName: pool.Name,
              ...details,
            }, tags, pool.CreationDate?.toISOString()));
          }
        }
        nextToken = response.NextToken;
      } while (nextToken);
    } catch (error) { errors.push(this.createError('ListUserPools', error)); }

    return { resources, errors };
  }
}

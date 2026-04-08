// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  ListGraphqlApisCommand,
  ListTagsForResourceCommand,
} from '@aws-sdk/client-appsync';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class AppSyncScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'appsync', 'appsync');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getAppSyncClient({ profile: this.config.profile, region: this.config.region });

    try {
      let nextToken: string | undefined;
      do {
        const response = await this.withRateLimit(() => client.send(new ListGraphqlApisCommand({ nextToken })));
        if (response.graphqlApis) {
          for (const api of response.graphqlApis) {
            if (!api.arn) continue;

            let tags: Record<string, string> = {};
            try {
              const tagsResp = await this.withRateLimit(() => client.send(new ListTagsForResourceCommand({ resourceArn: api.arn })));
              tags = tagsResp.tags || {};
            } catch { /* ignore */ }

            resources.push(this.createResource(api.arn, 'graphql-api', api.name || '', {
              apiId: api.apiId,
              apiName: api.name,
              apiType: api.apiType,
              authenticationType: api.authenticationType,
              uris: api.uris,
              xrayEnabled: api.xrayEnabled,
              wafWebAclArn: api.wafWebAclArn,
              logConfig: api.logConfig ? {
                fieldLogLevel: api.logConfig.fieldLogLevel,
                cloudWatchLogsRoleArn: api.logConfig.cloudWatchLogsRoleArn,
              } : undefined,
              additionalAuthenticationProviders: api.additionalAuthenticationProviders?.map(p => ({
                authenticationType: p.authenticationType,
              })),
              visibility: api.visibility,
              owner: api.owner,
              ownerContact: api.ownerContact,
            }, tags));
          }
        }
        nextToken = response.nextToken;
      } while (nextToken);
    } catch (error) { errors.push(this.createError('ListGraphqlApis', error)); }

    return { resources, errors };
  }
}

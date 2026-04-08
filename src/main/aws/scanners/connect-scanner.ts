// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { ListInstancesCommand, ListTagsForResourceCommand } from '@aws-sdk/client-connect';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class ConnectScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'connect', 'connect');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];

    const client = getClientFactory().getConnectClient({
      profile: this.config.profile,
      region: this.config.region,
    });

    try {
      let nextToken: string | undefined;

      do {
        try {
          const command = new ListInstancesCommand({ NextToken: nextToken });
          const response = await this.withRateLimit(() => client.send(command));

          for (const instance of response.InstanceSummaryList || []) {
            try {
              let tags: Record<string, string> = {};

              if (instance.Arn) {
                try {
                  const tagsCommand = new ListTagsForResourceCommand({
                    resourceArn: instance.Arn,
                  });
                  const tagsResponse = await this.withRateLimit(() => client.send(tagsCommand));
                  tags = tagsResponse.tags || {};
                } catch (tagErr) {
                  errors.push(
                    this.createError(`GetTags:${instance.Id}`, tagErr)
                  );
                }
              }

              resources.push(this.createResource(
                instance.Arn || instance.Id || '',
                'instance',
                instance.InstanceAlias || instance.Id || '',
                {
                  instanceId: instance.Id,
                  instanceAlias: instance.InstanceAlias,
                  identityManagementType: instance.IdentityManagementType,
                  instanceStatus: instance.InstanceStatus,
                  createdTime: instance.CreatedTime,
                  serviceRole: instance.ServiceRole,
                  inboundCallsEnabled: instance.InboundCallsEnabled,
                  outboundCallsEnabled: instance.OutboundCallsEnabled,
                },
                tags,
              ));
            } catch (instanceErr) {
              errors.push(
                this.createError(`ProcessInstance:${instance.Id}`, instanceErr)
              );
            }
          }

          nextToken = response.NextToken;
        } catch (pageErr) {
          errors.push(
            this.createError('ListInstances', pageErr)
          );
          break;
        }
      } while (nextToken);
    } catch (err) {
      errors.push(
        this.createError('ConnectScan', err)
      );
    }

    return { resources, errors };
  }
}

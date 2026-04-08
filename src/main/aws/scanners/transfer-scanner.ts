// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  ListServersCommand,
  DescribeServerCommand,
  ListTagsForResourceCommand,
} from '@aws-sdk/client-transfer';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class TransferScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'transfer', 'transfer');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getTransferClient({ profile: this.config.profile, region: this.config.region });

    try {
      let nextToken: string | undefined;
      do {
        const response = await this.withRateLimit(() => client.send(new ListServersCommand({ NextToken: nextToken })));
        if (response.Servers) {
          for (const server of response.Servers) {
            if (!server.Arn) continue;

            let details: any = {};
            try {
              const descResp = await this.withRateLimit(() => client.send(new DescribeServerCommand({ ServerId: server.ServerId })));
              const s = descResp.Server;
              if (s) {
                details = {
                  protocols: s.Protocols,
                  endpointType: s.EndpointType,
                  endpointDetails: s.EndpointDetails ? {
                    vpcEndpointId: s.EndpointDetails.VpcEndpointId,
                    vpcId: s.EndpointDetails.VpcId,
                    subnetIds: s.EndpointDetails.SubnetIds,
                    securityGroupIds: s.EndpointDetails.SecurityGroupIds,
                  } : undefined,
                  identityProviderType: s.IdentityProviderType,
                  loggingRole: s.LoggingRole,
                  securityPolicyName: s.SecurityPolicyName,
                  domain: s.Domain,
                  userCount: s.UserCount,
                  certificate: s.Certificate,
                };
              }
            } catch { /* ignore */ }

            let tags: Record<string, string> = {};
            try {
              const tagsResp = await this.withRateLimit(() => client.send(new ListTagsForResourceCommand({ Arn: server.Arn })));
              if (tagsResp.Tags) {
                for (const tag of tagsResp.Tags) {
                  if (tag.Key) tags[tag.Key] = tag.Value || '';
                }
              }
            } catch { /* ignore */ }

            resources.push(this.createResource(server.Arn, 'transfer-server', server.ServerId || '', {
              serverId: server.ServerId,
              state: server.State,
              ...details,
            }, tags));
          }
        }
        nextToken = response.NextToken;
      } while (nextToken);
    } catch (error) { errors.push(this.createError('ListServers', error)); }

    return { resources, errors };
  }
}

// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  DescribeVerifiedAccessInstancesCommand,
  DescribeVerifiedAccessEndpointsCommand,
  DescribeVerifiedAccessGroupsCommand,
} from '@aws-sdk/client-ec2';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class VerifiedAccessScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'verifiedaccess', 'ec2');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];

    const client = getClientFactory().getEC2Client({
      profile: this.config.profile,
      region: this.config.region,
    });

    // Scan Verified Access Instances
    try {
      let nextToken: string | undefined;
      do {
        const command = new DescribeVerifiedAccessInstancesCommand({
          NextToken: nextToken,
          MaxResults: 200,
        });
        const response = await this.withRateLimit(() => client.send(command));
        for (const instance of response.VerifiedAccessInstances ?? []) {
          const id = instance.VerifiedAccessInstanceId ?? '';
          const arn = `arn:aws:ec2:${this.config.region}:verified-access-instance/${id}`;
          const tags: Record<string, string> = {};
          for (const tag of instance.Tags ?? []) {
            if (tag.Key != null) {
              tags[tag.Key] = tag.Value ?? '';
            }
          }
          const name = tags['Name'] ?? id;
          resources.push(this.createResource(
            arn,
            'verified-access-instance',
            name,
            {
              verifiedAccessInstanceId: instance.VerifiedAccessInstanceId,
              description: instance.Description,
              creationTime: instance.CreationTime,
              lastUpdatedTime: instance.LastUpdatedTime,
            },
            tags,
          ));
        }
        nextToken = response.NextToken;
      } while (nextToken);
    } catch (err) {
      errors.push(this.createError('DescribeVerifiedAccessInstances', err));
    }

    // Scan Verified Access Endpoints
    try {
      let nextToken: string | undefined;
      do {
        const command = new DescribeVerifiedAccessEndpointsCommand({
          NextToken: nextToken,
          MaxResults: 200,
        });
        const response = await this.withRateLimit(() => client.send(command));
        for (const endpoint of response.VerifiedAccessEndpoints ?? []) {
          const id = endpoint.VerifiedAccessEndpointId ?? '';
          const arn = `arn:aws:ec2:${this.config.region}:verified-access-endpoint/${id}`;
          const tags: Record<string, string> = {};
          for (const tag of endpoint.Tags ?? []) {
            if (tag.Key != null) {
              tags[tag.Key] = tag.Value ?? '';
            }
          }
          const name = tags['Name'] ?? id;
          resources.push(this.createResource(
            arn,
            'verified-access-endpoint',
            name,
            {
              verifiedAccessEndpointId: endpoint.VerifiedAccessEndpointId,
              verifiedAccessGroupId: endpoint.VerifiedAccessGroupId,
              endpointType: endpoint.EndpointType,
              endpointDomain: endpoint.EndpointDomain,
              applicationDomain: endpoint.ApplicationDomain,
              status: endpoint.Status,
            },
            tags,
          ));
        }
        nextToken = response.NextToken;
      } while (nextToken);
    } catch (err) {
      errors.push(this.createError('DescribeVerifiedAccessEndpoints', err));
    }

    // Scan Verified Access Groups
    try {
      let nextToken: string | undefined;
      do {
        const command = new DescribeVerifiedAccessGroupsCommand({
          NextToken: nextToken,
          MaxResults: 200,
        });
        const response = await this.withRateLimit(() => client.send(command));
        for (const group of response.VerifiedAccessGroups ?? []) {
          const id = group.VerifiedAccessGroupId ?? '';
          const arn = `arn:aws:ec2:${this.config.region}:verified-access-group/${id}`;
          const tags: Record<string, string> = {};
          for (const tag of group.Tags ?? []) {
            if (tag.Key != null) {
              tags[tag.Key] = tag.Value ?? '';
            }
          }
          const name = tags['Name'] ?? id;
          resources.push(this.createResource(
            arn,
            'verified-access-group',
            name,
            {
              verifiedAccessGroupId: group.VerifiedAccessGroupId,
              verifiedAccessInstanceId: group.VerifiedAccessInstanceId,
              description: group.Description,
              creationTime: group.CreationTime,
            },
            tags,
          ));
        }
        nextToken = response.NextToken;
      } while (nextToken);
    } catch (err) {
      errors.push(this.createError('DescribeVerifiedAccessGroups', err));
    }

    return { resources, errors };
  }
}

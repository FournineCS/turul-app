// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  ListGraphsCommand,
  ListMembersCommand,
  ListTagsForResourceCommand,
} from '@aws-sdk/client-detective';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class DetectiveScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'detective', 'detective');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getDetectiveClient({
      profile: this.config.profile,
      region: this.config.region,
    });

    try {
      let nextToken: string | undefined;

      do {
        const response = await this.withRateLimit(() =>
          client.send(new ListGraphsCommand({ NextToken: nextToken }))
        );

        if (response.GraphList) {
          for (const graph of response.GraphList) {
            if (!graph.Arn) continue;

            const graphArn = graph.Arn;
            const graphName = graphArn.split('/').pop() || graphArn;

            // List members for this graph
            let members: { accountId?: string; status?: string; invitedTime?: Date; updatedTime?: Date }[] = [];
            try {
              let memberNextToken: string | undefined;

              do {
                const membersResponse = await this.withRateLimit(() =>
                  client.send(new ListMembersCommand({
                    GraphArn: graphArn,
                    NextToken: memberNextToken,
                  }))
                );

                if (membersResponse.MemberDetails) {
                  for (const member of membersResponse.MemberDetails) {
                    members.push({
                      accountId: member.AccountId,
                      status: member.Status,
                      invitedTime: member.InvitedTime,
                      updatedTime: member.UpdatedTime,
                    });
                  }
                }

                memberNextToken = membersResponse.NextToken;
              } while (memberNextToken);
            } catch (error) {
              errors.push(this.createError(`ListMembers:${graphArn}`, error));
            }

            // Get tags for this graph
            let tags: Record<string, string> = {};
            try {
              const tagsResponse = await this.withRateLimit(() =>
                client.send(new ListTagsForResourceCommand({
                  ResourceArn: graphArn,
                }))
              );

              tags = (tagsResponse.Tags as Record<string, string>) || {};
            } catch (error) {
              errors.push(this.createError(`ListTagsForResource:${graphArn}`, error));
            }

            resources.push(this.createResource(
              graphArn,
              'graph',
              graphName,
              {
                graphArn,
                createdTime: graph.CreatedTime?.toISOString(),
                memberCount: members.length,
                members,
              },
              tags,
              graph.CreatedTime?.toISOString()
            ));
          }
        }

        nextToken = response.NextToken;
      } while (nextToken);
    } catch (error) {
      errors.push(this.createError('ListGraphs', error));
    }

    return { resources, errors };
  }
}

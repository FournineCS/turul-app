// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  ListEventBusesCommand,
  ListRulesCommand,
  DescribeRuleCommand,
  ListTargetsByRuleCommand,
  ListTagsForResourceCommand,
  type EventBus,
  type Rule,
  type Target,
  type ListEventBusesCommandOutput,
  type ListRulesCommandOutput,
  type DescribeRuleCommandOutput,
  type ListTargetsByRuleCommandOutput,
  type ListTagsForResourceCommandOutput,
} from '@aws-sdk/client-eventbridge';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class EventBridgeScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'eventbridge', 'eventbridge');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getEventBridgeClient({
      profile: this.config.profile,
      region: this.config.region,
    });

    // Scan event buses
    try {
      let nextToken: string | undefined;

      do {
        const response: ListEventBusesCommandOutput = await this.withRateLimit(() =>
          client.send(new ListEventBusesCommand({ NextToken: nextToken }))
        );

        if (response.EventBuses) {
          for (const eventBus of response.EventBuses) {
            // Get tags
            let tags: Record<string, string> = {};
            if (eventBus.Arn) {
              try {
                const tagsResponse: ListTagsForResourceCommandOutput = await this.withRateLimit(() =>
                  client.send(
                    new ListTagsForResourceCommand({ ResourceARN: eventBus.Arn })
                  )
                );
                if (tagsResponse.Tags) {
                  for (const tag of tagsResponse.Tags) {
                    if (tag.Key) {
                      tags[tag.Key] = tag.Value || '';
                    }
                  }
                }
              } catch {
                // Ignore tag errors
              }
            }

            resources.push(this.mapEventBus(eventBus, tags));

            // Get rules for this event bus
            const rules = await this.getRulesForBus(client, eventBus.Name!);
            resources.push(...rules);
          }
        }

        nextToken = response.NextToken;
      } while (nextToken);
    } catch (error) {
      errors.push(this.createError('ListEventBuses', error));
    }

    return { resources, errors };
  }

  private async getRulesForBus(
    client: ReturnType<typeof getClientFactory.prototype.getEventBridgeClient>,
    eventBusName: string
  ): Promise<Resource[]> {
    const resources: Resource[] = [];

    try {
      let nextToken: string | undefined;

      do {
        const response: ListRulesCommandOutput = await this.withRateLimit(() =>
          client.send(
            new ListRulesCommand({
              EventBusName: eventBusName,
              NextToken: nextToken,
            })
          )
        );

        if (response.Rules) {
          for (const rule of response.Rules) {
            // Get rule details
            try {
              const detailResponse: DescribeRuleCommandOutput = await this.withRateLimit(() =>
                client.send(
                  new DescribeRuleCommand({
                    Name: rule.Name,
                    EventBusName: eventBusName,
                  })
                )
              );

              // Get targets for this rule
              const targets = await this.getTargetsForRule(
                client,
                rule.Name!,
                eventBusName
              );

              // Get tags
              let tags: Record<string, string> = {};
              if (rule.Arn) {
                try {
                  const tagsResponse: ListTagsForResourceCommandOutput = await this.withRateLimit(() =>
                    client.send(
                      new ListTagsForResourceCommand({ ResourceARN: rule.Arn })
                    )
                  );
                  if (tagsResponse.Tags) {
                    for (const tag of tagsResponse.Tags) {
                      if (tag.Key) {
                        tags[tag.Key] = tag.Value || '';
                      }
                    }
                  }
                } catch {
                  // Ignore tag errors
                }
              }

              resources.push(
                this.mapRule(detailResponse, eventBusName, targets, tags)
              );
            } catch {
              // Fall back to list info
              resources.push(this.mapRuleSummary(rule, eventBusName));
            }
          }
        }

        nextToken = response.NextToken;
      } while (nextToken);
    } catch {
      // Ignore errors getting rules
    }

    return resources;
  }

  private async getTargetsForRule(
    client: ReturnType<typeof getClientFactory.prototype.getEventBridgeClient>,
    ruleName: string,
    eventBusName: string
  ): Promise<Target[]> {
    const targets: Target[] = [];

    try {
      let nextToken: string | undefined;

      do {
        const response: ListTargetsByRuleCommandOutput = await this.withRateLimit(() =>
          client.send(
            new ListTargetsByRuleCommand({
              Rule: ruleName,
              EventBusName: eventBusName,
              NextToken: nextToken,
            })
          )
        );

        if (response.Targets) {
          targets.push(...response.Targets);
        }

        nextToken = response.NextToken;
      } while (nextToken);
    } catch {
      // Ignore errors getting targets
    }

    return targets;
  }

  private mapEventBus(eventBus: EventBus, tags: Record<string, string>): Resource {
    return this.createResource(
      eventBus.Arn || '',
      'event-bus',
      eventBus.Name || '',
      {
        name: eventBus.Name,
        arn: eventBus.Arn,
        policy: eventBus.Policy,
      },
      tags
    );
  }

  private mapRule(
    rule: DescribeRuleCommandOutput,
    eventBusName: string,
    targets: Target[],
    tags: Record<string, string>
  ): Resource {
    return this.createResource(
      rule.Arn || '',
      'rule',
      rule.Name || '',
      {
        name: rule.Name,
        arn: rule.Arn,
        eventBusName,
        eventPattern: rule.EventPattern ? JSON.parse(rule.EventPattern) : undefined,
        state: rule.State,
        description: rule.Description,
        scheduleExpression: rule.ScheduleExpression,
        roleArn: rule.RoleArn,
        managedBy: rule.ManagedBy,
        createdBy: rule.CreatedBy,
        targets: targets.map((t) => ({
          id: t.Id,
          arn: t.Arn,
          roleArn: t.RoleArn,
          input: t.Input,
          inputPath: t.InputPath,
          inputTransformer: t.InputTransformer
            ? {
                inputPathsMap: t.InputTransformer.InputPathsMap,
                inputTemplate: t.InputTransformer.InputTemplate,
              }
            : undefined,
          sqsParameters: t.SqsParameters,
          httpParameters: t.HttpParameters
            ? {
                pathParameterValues: t.HttpParameters.PathParameterValues,
                headerParameters: t.HttpParameters.HeaderParameters,
                queryStringParameters: t.HttpParameters.QueryStringParameters,
              }
            : undefined,
          ecsParameters: t.EcsParameters
            ? {
                taskDefinitionArn: t.EcsParameters.TaskDefinitionArn,
                taskCount: t.EcsParameters.TaskCount,
                launchType: t.EcsParameters.LaunchType,
                platformVersion: t.EcsParameters.PlatformVersion,
                group: t.EcsParameters.Group,
              }
            : undefined,
          retryPolicy: t.RetryPolicy
            ? {
                maximumRetryAttempts: t.RetryPolicy.MaximumRetryAttempts,
                maximumEventAgeInSeconds: t.RetryPolicy.MaximumEventAgeInSeconds,
              }
            : undefined,
          deadLetterConfig: t.DeadLetterConfig?.Arn,
        })),
      },
      tags
    );
  }

  private mapRuleSummary(rule: Rule, eventBusName: string): Resource {
    return this.createResource(
      rule.Arn || '',
      'rule',
      rule.Name || '',
      {
        name: rule.Name,
        arn: rule.Arn,
        eventBusName,
        eventPattern: rule.EventPattern ? JSON.parse(rule.EventPattern) : undefined,
        state: rule.State,
        description: rule.Description,
        scheduleExpression: rule.ScheduleExpression,
        roleArn: rule.RoleArn,
        managedBy: rule.ManagedBy,
      },
      {}
    );
  }
}

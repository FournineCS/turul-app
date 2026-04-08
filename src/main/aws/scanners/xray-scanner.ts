// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  GetGroupsCommand,
  GetSamplingRulesCommand,
  ListTagsForResourceCommand,
} from '@aws-sdk/client-xray';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class XRayScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'xray', 'xray');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];

    const [groupsResult, samplingRulesResult] = await Promise.allSettled([
      this.scanGroups(),
      this.scanSamplingRules(),
    ]);

    if (groupsResult.status === 'fulfilled') {
      resources.push(...groupsResult.value.resources);
      errors.push(...groupsResult.value.errors);
    } else {
      errors.push(this.createError('GetGroups', groupsResult.reason));
    }

    if (samplingRulesResult.status === 'fulfilled') {
      resources.push(...samplingRulesResult.value.resources);
      errors.push(...samplingRulesResult.value.errors);
    } else {
      errors.push(this.createError('GetSamplingRules', samplingRulesResult.reason));
    }

    return { resources, errors };
  }

  private async scanGroups(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getXRayClient({
      profile: this.config.profile,
      region: this.config.region,
    });

    try {
      let nextToken: string | undefined;

      do {
        const response = await this.withRateLimit(() =>
          client.send(new GetGroupsCommand({ NextToken: nextToken }))
        );

        if (response.Groups) {
          for (const group of response.Groups) {
            if (!group.GroupARN) continue;

            let tags: Record<string, string> = {};
            try {
              const tagsResp = await this.withRateLimit(() =>
                client.send(new ListTagsForResourceCommand({
                  ResourceARN: group.GroupARN,
                }))
              );
              if (tagsResp.Tags) {
                for (const tag of tagsResp.Tags) {
                  if (tag.Key) tags[tag.Key] = tag.Value || '';
                }
              }
            } catch {
              // Ignore tag errors
            }

            resources.push(this.createResource(
              group.GroupARN,
              'group',
              group.GroupName || '',
              {
                groupName: group.GroupName,
                filterExpression: group.FilterExpression,
                insightsEnabled: group.InsightsConfiguration?.InsightsEnabled,
              },
              tags
            ));
          }
        }

        nextToken = response.NextToken;
      } while (nextToken);
    } catch (error) {
      errors.push(this.createError('GetGroups', error));
    }

    return { resources, errors };
  }

  private async scanSamplingRules(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getXRayClient({
      profile: this.config.profile,
      region: this.config.region,
    });

    try {
      let nextToken: string | undefined;

      do {
        const response = await this.withRateLimit(() =>
          client.send(new GetSamplingRulesCommand({ NextToken: nextToken }))
        );

        if (response.SamplingRuleRecords) {
          for (const record of response.SamplingRuleRecords) {
            const rule = record.SamplingRule;
            if (!rule?.RuleARN) continue;

            let tags: Record<string, string> = {};
            try {
              const tagsResp = await this.withRateLimit(() =>
                client.send(new ListTagsForResourceCommand({
                  ResourceARN: rule.RuleARN,
                }))
              );
              if (tagsResp.Tags) {
                for (const tag of tagsResp.Tags) {
                  if (tag.Key) tags[tag.Key] = tag.Value || '';
                }
              }
            } catch {
              // Ignore tag errors
            }

            resources.push(this.createResource(
              rule.RuleARN,
              'sampling-rule',
              rule.RuleName || '',
              {
                ruleName: rule.RuleName,
                priority: rule.Priority,
                reservoirSize: rule.ReservoirSize,
                fixedRate: rule.FixedRate,
                host: rule.Host,
                serviceName: rule.ServiceName,
                serviceType: rule.ServiceType,
                httpMethod: rule.HTTPMethod,
                urlPath: rule.URLPath,
                resourceARN: rule.ResourceARN,
                version: rule.Version,
                createdAt: record.CreatedAt?.toISOString(),
                modifiedAt: record.ModifiedAt?.toISOString(),
              },
              tags,
              record.CreatedAt?.toISOString()
            ));
          }
        }

        nextToken = response.NextToken;
      } while (nextToken);
    } catch (error) {
      errors.push(this.createError('GetSamplingRules', error));
    }

    return { resources, errors };
  }
}

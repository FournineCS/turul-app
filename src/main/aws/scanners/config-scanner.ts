// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  DescribeConfigRulesCommand,
  DescribeConfigurationRecordersCommand,
  DescribeConfigurationRecorderStatusCommand,
} from '@aws-sdk/client-config-service';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class ConfigScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'config', 'config');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];

    const [rulesResult, recordersResult] = await Promise.allSettled([
      this.scanConfigRules(),
      this.scanConfigRecorders(),
    ]);

    if (rulesResult.status === 'fulfilled') { resources.push(...rulesResult.value.resources); errors.push(...rulesResult.value.errors); }
    else errors.push(this.createError('DescribeConfigRules', rulesResult.reason));
    if (recordersResult.status === 'fulfilled') { resources.push(...recordersResult.value.resources); errors.push(...recordersResult.value.errors); }
    else errors.push(this.createError('DescribeConfigurationRecorders', recordersResult.reason));

    return { resources, errors };
  }

  private async scanConfigRules(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getConfigServiceClient({ profile: this.config.profile, region: this.config.region });

    try {
      let nextToken: string | undefined;
      do {
        const response = await this.withRateLimit(() => client.send(new DescribeConfigRulesCommand({ NextToken: nextToken })));
        if (response.ConfigRules) {
          for (const rule of response.ConfigRules) {
            if (!rule.ConfigRuleArn) continue;
            resources.push(this.createResource(rule.ConfigRuleArn, 'config-rule', rule.ConfigRuleName || '', {
              configRuleName: rule.ConfigRuleName,
              configRuleId: rule.ConfigRuleId,
              description: rule.Description,
              state: rule.ConfigRuleState,
              source: rule.Source ? {
                owner: rule.Source.Owner,
                sourceIdentifier: rule.Source.SourceIdentifier,
              } : undefined,
              inputParameters: rule.InputParameters,
              maximumExecutionFrequency: rule.MaximumExecutionFrequency,
              scope: rule.Scope ? {
                complianceResourceTypes: rule.Scope.ComplianceResourceTypes,
              } : undefined,
            }, {}));
          }
        }
        nextToken = response.NextToken;
      } while (nextToken);
    } catch (error) { errors.push(this.createError('DescribeConfigRules', error)); }
    return { resources, errors };
  }

  private async scanConfigRecorders(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getConfigServiceClient({ profile: this.config.profile, region: this.config.region });

    try {
      const response = await this.withRateLimit(() => client.send(new DescribeConfigurationRecordersCommand({})));

      let statuses: any[] = [];
      try {
        const statusResp = await this.withRateLimit(() => client.send(new DescribeConfigurationRecorderStatusCommand({})));
        statuses = statusResp.ConfigurationRecordersStatus || [];
      } catch { /* ignore */ }

      if (response.ConfigurationRecorders) {
        for (const recorder of response.ConfigurationRecorders) {
          if (!recorder.name) continue;
          const arn = `arn:aws:config:${this.config.region}::config-recorder/${recorder.name}`;
          const status = statuses.find(s => s.name === recorder.name);

          resources.push(this.createResource(arn, 'config-recorder', recorder.name, {
            recorderName: recorder.name,
            roleARN: recorder.roleARN,
            allSupported: recorder.recordingGroup?.allSupported,
            includeGlobalResourceTypes: recorder.recordingGroup?.includeGlobalResourceTypes,
            resourceTypes: recorder.recordingGroup?.resourceTypes,
            recording: status?.recording,
            lastStatus: status?.lastStatus,
            lastStartTime: status?.lastStartTime?.toISOString(),
            lastStopTime: status?.lastStopTime?.toISOString(),
          }, {}));
        }
      }
    } catch (error) { errors.push(this.createError('DescribeConfigurationRecorders', error)); }
    return { resources, errors };
  }
}

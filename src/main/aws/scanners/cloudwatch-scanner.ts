// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  DescribeAlarmsCommand,
  ListTagsForResourceCommand as CWListTagsForResourceCommand,
  type MetricAlarm,
  type CompositeAlarm,
} from '@aws-sdk/client-cloudwatch';
import {
  DescribeLogGroupsCommand,
  ListTagsForResourceCommand as CWLListTagsForResourceCommand,
  type LogGroup,
} from '@aws-sdk/client-cloudwatch-logs';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class CloudWatchScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'cloudwatch', 'cloudwatch');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];

    // Scan alarms
    try {
      const alarms = await this.scanAlarms();
      resources.push(...alarms);
    } catch (error) {
      errors.push(this.createError('DescribeAlarms', error));
    }

    // Scan log groups
    try {
      const logGroups = await this.scanLogGroups();
      resources.push(...logGroups);
    } catch (error) {
      errors.push(this.createError('DescribeLogGroups', error));
    }

    return { resources, errors };
  }

  private async scanAlarms(): Promise<Resource[]> {
    const resources: Resource[] = [];
    const client = getClientFactory().getCloudWatchClient({
      profile: this.config.profile,
      region: this.config.region,
    });

    let nextToken: string | undefined;

    do {
      const response = await this.withRateLimit(() =>
        client.send(new DescribeAlarmsCommand({ NextToken: nextToken }))
      );

      // Process metric alarms
      if (response.MetricAlarms) {
        for (const alarm of response.MetricAlarms) {
          // Get tags
          let tags: Record<string, string> = {};
          if (alarm.AlarmArn) {
            try {
              const tagsResponse = await this.withRateLimit(() =>
                client.send(
                  new CWListTagsForResourceCommand({ ResourceARN: alarm.AlarmArn })
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

          resources.push(this.mapMetricAlarm(alarm, tags));
        }
      }

      // Process composite alarms
      if (response.CompositeAlarms) {
        for (const alarm of response.CompositeAlarms) {
          // Get tags
          let tags: Record<string, string> = {};
          if (alarm.AlarmArn) {
            try {
              const tagsResponse = await this.withRateLimit(() =>
                client.send(
                  new CWListTagsForResourceCommand({ ResourceARN: alarm.AlarmArn })
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

          resources.push(this.mapCompositeAlarm(alarm, tags));
        }
      }

      nextToken = response.NextToken;
    } while (nextToken);

    return resources;
  }

  private async scanLogGroups(): Promise<Resource[]> {
    const resources: Resource[] = [];
    const client = getClientFactory().getCloudWatchLogsClient({
      profile: this.config.profile,
      region: this.config.region,
    });

    let nextToken: string | undefined;

    do {
      const response = await this.withRateLimit(() =>
        client.send(new DescribeLogGroupsCommand({ nextToken }))
      );

      if (response.logGroups) {
        for (const logGroup of response.logGroups) {
          // Get tags
          let tags: Record<string, string> = {};
          if (logGroup.arn) {
            try {
              const tagsResponse = await this.withRateLimit(() =>
                client.send(
                  new CWLListTagsForResourceCommand({ resourceArn: logGroup.arn })
                )
              );
              tags = tagsResponse.tags || {};
            } catch {
              // Ignore tag errors
            }
          }

          resources.push(this.mapLogGroup(logGroup, tags));
        }
      }

      nextToken = response.nextToken;
    } while (nextToken);

    return resources;
  }

  private mapMetricAlarm(
    alarm: MetricAlarm,
    tags: Record<string, string>
  ): Resource {
    return this.createResource(
      alarm.AlarmArn || '',
      'metric-alarm',
      alarm.AlarmName || '',
      {
        alarmName: alarm.AlarmName,
        alarmArn: alarm.AlarmArn,
        alarmDescription: alarm.AlarmDescription,
        alarmConfigurationUpdatedTimestamp:
          alarm.AlarmConfigurationUpdatedTimestamp?.toISOString(),
        actionsEnabled: alarm.ActionsEnabled,
        okActions: alarm.OKActions,
        alarmActions: alarm.AlarmActions,
        insufficientDataActions: alarm.InsufficientDataActions,
        stateValue: alarm.StateValue,
        stateReason: alarm.StateReason,
        stateReasonData: alarm.StateReasonData,
        stateUpdatedTimestamp: alarm.StateUpdatedTimestamp?.toISOString(),
        stateTransitionedTimestamp: alarm.StateTransitionedTimestamp?.toISOString(),
        metricName: alarm.MetricName,
        namespace: alarm.Namespace,
        statistic: alarm.Statistic,
        extendedStatistic: alarm.ExtendedStatistic,
        dimensions: alarm.Dimensions?.map((d) => ({
          name: d.Name,
          value: d.Value,
        })),
        period: alarm.Period,
        unit: alarm.Unit,
        evaluationPeriods: alarm.EvaluationPeriods,
        datapointsToAlarm: alarm.DatapointsToAlarm,
        threshold: alarm.Threshold,
        comparisonOperator: alarm.ComparisonOperator,
        treatMissingData: alarm.TreatMissingData,
        evaluateLowSampleCountPercentile: alarm.EvaluateLowSampleCountPercentile,
        metrics: alarm.Metrics?.map((m) => ({
          id: m.Id,
          metricStat: m.MetricStat
            ? {
                metric: m.MetricStat.Metric
                  ? {
                      namespace: m.MetricStat.Metric.Namespace,
                      metricName: m.MetricStat.Metric.MetricName,
                      dimensions: m.MetricStat.Metric.Dimensions?.map((d) => ({
                        name: d.Name,
                        value: d.Value,
                      })),
                    }
                  : undefined,
                period: m.MetricStat.Period,
                stat: m.MetricStat.Stat,
                unit: m.MetricStat.Unit,
              }
            : undefined,
          expression: m.Expression,
          label: m.Label,
          returnData: m.ReturnData,
          period: m.Period,
        })),
        thresholdMetricId: alarm.ThresholdMetricId,
      },
      tags,
      alarm.AlarmConfigurationUpdatedTimestamp?.toISOString()
    );
  }

  private mapCompositeAlarm(
    alarm: CompositeAlarm,
    tags: Record<string, string>
  ): Resource {
    return this.createResource(
      alarm.AlarmArn || '',
      'composite-alarm',
      alarm.AlarmName || '',
      {
        alarmName: alarm.AlarmName,
        alarmArn: alarm.AlarmArn,
        alarmDescription: alarm.AlarmDescription,
        alarmConfigurationUpdatedTimestamp:
          alarm.AlarmConfigurationUpdatedTimestamp?.toISOString(),
        actionsEnabled: alarm.ActionsEnabled,
        okActions: alarm.OKActions,
        alarmActions: alarm.AlarmActions,
        insufficientDataActions: alarm.InsufficientDataActions,
        stateValue: alarm.StateValue,
        stateReason: alarm.StateReason,
        stateReasonData: alarm.StateReasonData,
        stateUpdatedTimestamp: alarm.StateUpdatedTimestamp?.toISOString(),
        stateTransitionedTimestamp: alarm.StateTransitionedTimestamp?.toISOString(),
        alarmRule: alarm.AlarmRule,
        actionsSuppressedBy: alarm.ActionsSuppressedBy,
        actionsSuppressedReason: alarm.ActionsSuppressedReason,
        actionsSuppressor: alarm.ActionsSuppressor,
        actionsSuppressorExtensionPeriod: alarm.ActionsSuppressorExtensionPeriod,
        actionsSuppressorWaitPeriod: alarm.ActionsSuppressorWaitPeriod,
      },
      tags,
      alarm.AlarmConfigurationUpdatedTimestamp?.toISOString()
    );
  }

  private mapLogGroup(
    logGroup: LogGroup,
    tags: Record<string, string>
  ): Resource {
    return this.createResource(
      logGroup.arn || '',
      'log-group',
      logGroup.logGroupName || '',
      {
        logGroupName: logGroup.logGroupName,
        arn: logGroup.arn,
        creationTime: logGroup.creationTime
          ? new Date(logGroup.creationTime).toISOString()
          : undefined,
        retentionInDays: logGroup.retentionInDays,
        metricFilterCount: logGroup.metricFilterCount,
        storedBytes: logGroup.storedBytes,
        kmsKeyId: logGroup.kmsKeyId,
        dataProtectionStatus: logGroup.dataProtectionStatus,
        inheritedProperties: logGroup.inheritedProperties,
        logGroupClass: logGroup.logGroupClass,
        logGroupArn: logGroup.logGroupArn,
      },
      tags,
      logGroup.creationTime
        ? new Date(logGroup.creationTime).toISOString()
        : undefined
    );
  }
}

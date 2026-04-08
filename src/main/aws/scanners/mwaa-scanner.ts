// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  ListEnvironmentsCommand,
  GetEnvironmentCommand,
  type Environment,
} from '@aws-sdk/client-mwaa';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class MWAAScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'mwaa', 'mwaa');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getMWAAClient({
      profile: this.config.profile,
      region: this.config.region,
    });

    try {
      let nextToken: string | undefined;

      do {
        const response = await this.withRateLimit(() =>
          client.send(new ListEnvironmentsCommand({ NextToken: nextToken }))
        );

        if (response.Environments) {
          for (const environmentName of response.Environments) {
            try {
              const detailResponse = await this.withRateLimit(() =>
                client.send(new GetEnvironmentCommand({ Name: environmentName }))
              );

              if (detailResponse.Environment) {
                resources.push(this.mapEnvironment(detailResponse.Environment));
              }
            } catch (error) {
              errors.push(
                this.createError(`GetEnvironment:${environmentName}`, error)
              );
            }
          }
        }

        nextToken = response.NextToken;
      } while (nextToken);
    } catch (error) {
      errors.push(this.createError('ListEnvironments', error));
    }

    return { resources, errors };
  }

  private mapEnvironment(env: Environment): Resource {
    const tags = env.Tags || {};

    return this.createResource(
      env.Arn || '',
      'environment',
      env.Name || '',
      {
        name: env.Name,
        arn: env.Arn,
        status: env.Status,
        airflowVersion: env.AirflowVersion,
        environmentClass: env.EnvironmentClass,
        executionRoleArn: env.ExecutionRoleArn,
        serviceRoleArn: env.ServiceRoleArn,
        kmsKey: env.KmsKey,
        sourceBucketArn: env.SourceBucketArn,
        dagS3Path: env.DagS3Path,
        pluginsS3Path: env.PluginsS3Path,
        pluginsS3ObjectVersion: env.PluginsS3ObjectVersion,
        requirementsS3Path: env.RequirementsS3Path,
        requirementsS3ObjectVersion: env.RequirementsS3ObjectVersion,
        startupScriptS3Path: env.StartupScriptS3Path,
        startupScriptS3ObjectVersion: env.StartupScriptS3ObjectVersion,
        webserverUrl: env.WebserverUrl,
        webserverAccessMode: env.WebserverAccessMode,
        weeklyMaintenanceWindowStart: env.WeeklyMaintenanceWindowStart,
        schedulers: env.Schedulers,
        minWorkers: env.MinWorkers,
        maxWorkers: env.MaxWorkers,
        networkConfiguration: env.NetworkConfiguration
          ? {
              subnetIds: env.NetworkConfiguration.SubnetIds,
              securityGroupIds: env.NetworkConfiguration.SecurityGroupIds,
            }
          : undefined,
        loggingConfiguration: env.LoggingConfiguration
          ? {
              dagProcessingLogs: env.LoggingConfiguration.DagProcessingLogs
                ? {
                    enabled: env.LoggingConfiguration.DagProcessingLogs.Enabled,
                    logLevel: env.LoggingConfiguration.DagProcessingLogs.LogLevel,
                    cloudWatchLogGroupArn:
                      env.LoggingConfiguration.DagProcessingLogs.CloudWatchLogGroupArn,
                  }
                : undefined,
              schedulerLogs: env.LoggingConfiguration.SchedulerLogs
                ? {
                    enabled: env.LoggingConfiguration.SchedulerLogs.Enabled,
                    logLevel: env.LoggingConfiguration.SchedulerLogs.LogLevel,
                    cloudWatchLogGroupArn:
                      env.LoggingConfiguration.SchedulerLogs.CloudWatchLogGroupArn,
                  }
                : undefined,
              webserverLogs: env.LoggingConfiguration.WebserverLogs
                ? {
                    enabled: env.LoggingConfiguration.WebserverLogs.Enabled,
                    logLevel: env.LoggingConfiguration.WebserverLogs.LogLevel,
                    cloudWatchLogGroupArn:
                      env.LoggingConfiguration.WebserverLogs.CloudWatchLogGroupArn,
                  }
                : undefined,
              workerLogs: env.LoggingConfiguration.WorkerLogs
                ? {
                    enabled: env.LoggingConfiguration.WorkerLogs.Enabled,
                    logLevel: env.LoggingConfiguration.WorkerLogs.LogLevel,
                    cloudWatchLogGroupArn:
                      env.LoggingConfiguration.WorkerLogs.CloudWatchLogGroupArn,
                  }
                : undefined,
              taskLogs: env.LoggingConfiguration.TaskLogs
                ? {
                    enabled: env.LoggingConfiguration.TaskLogs.Enabled,
                    logLevel: env.LoggingConfiguration.TaskLogs.LogLevel,
                    cloudWatchLogGroupArn:
                      env.LoggingConfiguration.TaskLogs.CloudWatchLogGroupArn,
                  }
                : undefined,
            }
          : undefined,
        lastUpdate: env.LastUpdate
          ? {
              status: env.LastUpdate.Status,
              createdAt: env.LastUpdate.CreatedAt?.toISOString(),
              error: env.LastUpdate.Error
                ? {
                    errorCode: env.LastUpdate.Error.ErrorCode,
                    errorMessage: env.LastUpdate.Error.ErrorMessage,
                  }
                : undefined,
              source: env.LastUpdate.Source,
            }
          : undefined,
        createdAt: env.CreatedAt?.toISOString(),
      },
      tags as Record<string, string>,
      env.CreatedAt?.toISOString()
    );
  }
}

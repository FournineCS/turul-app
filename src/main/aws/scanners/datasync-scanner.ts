// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  ListTasksCommand,
  DescribeTaskCommand,
  ListLocationsCommand,
  ListAgentsCommand,
  ListTagsForResourceCommand,
} from '@aws-sdk/client-datasync';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class DataSyncScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'datasync', 'datasync');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];

    const [tasksResult, locationsResult, agentsResult] = await Promise.allSettled([
      this.scanTasks(),
      this.scanLocations(),
      this.scanAgents(),
    ]);

    if (tasksResult.status === 'fulfilled') { resources.push(...tasksResult.value.resources); errors.push(...tasksResult.value.errors); }
    else errors.push(this.createError('ListTasks', tasksResult.reason));
    if (locationsResult.status === 'fulfilled') { resources.push(...locationsResult.value.resources); errors.push(...locationsResult.value.errors); }
    else errors.push(this.createError('ListLocations', locationsResult.reason));
    if (agentsResult.status === 'fulfilled') { resources.push(...agentsResult.value.resources); errors.push(...agentsResult.value.errors); }
    else errors.push(this.createError('ListAgents', agentsResult.reason));

    return { resources, errors };
  }

  private async scanTasks(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getDataSyncClient({ profile: this.config.profile, region: this.config.region });

    try {
      let nextToken: string | undefined;
      do {
        const response = await this.withRateLimit(() => client.send(new ListTasksCommand({ NextToken: nextToken })));
        if (response.Tasks) {
          for (const task of response.Tasks) {
            if (!task.TaskArn) continue;

            let details: any = {};
            try {
              const descResp = await this.withRateLimit(() => client.send(new DescribeTaskCommand({ TaskArn: task.TaskArn })));
              details = {
                name: descResp.Name,
                status: descResp.Status,
                sourceLocationArn: descResp.SourceLocationArn,
                destinationLocationArn: descResp.DestinationLocationArn,
                cloudWatchLogGroupArn: descResp.CloudWatchLogGroupArn,
                options: descResp.Options ? {
                  verifyMode: descResp.Options.VerifyMode,
                  overwriteMode: descResp.Options.OverwriteMode,
                  atime: descResp.Options.Atime,
                  mtime: descResp.Options.Mtime,
                  preserveDeletedFiles: descResp.Options.PreserveDeletedFiles,
                  preserveDevices: descResp.Options.PreserveDevices,
                  logLevel: descResp.Options.LogLevel,
                  transferMode: descResp.Options.TransferMode,
                } : undefined,
                errorCode: descResp.ErrorCode,
                errorDetail: descResp.ErrorDetail,
              };
            } catch { /* ignore */ }

            let tags: Record<string, string> = {};
            try {
              const tagsResp = await this.withRateLimit(() => client.send(new ListTagsForResourceCommand({ ResourceArn: task.TaskArn })));
              if (tagsResp.Tags) {
                for (const tag of tagsResp.Tags) {
                  if (tag.Key) tags[tag.Key] = tag.Value || '';
                }
              }
            } catch { /* ignore */ }

            resources.push(this.createResource(task.TaskArn, 'datasync-task', details.name || task.Name || '', {
              taskArn: task.TaskArn,
              status: details.status || task.Status,
              sourceLocationArn: details.sourceLocationArn,
              destinationLocationArn: details.destinationLocationArn,
              ...details,
            }, tags));
          }
        }
        nextToken = response.NextToken;
      } while (nextToken);
    } catch (error) { errors.push(this.createError('ListTasks', error)); }
    return { resources, errors };
  }

  private async scanLocations(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getDataSyncClient({ profile: this.config.profile, region: this.config.region });

    try {
      let nextToken: string | undefined;
      do {
        const response = await this.withRateLimit(() => client.send(new ListLocationsCommand({ NextToken: nextToken })));
        if (response.Locations) {
          for (const location of response.Locations) {
            if (!location.LocationArn) continue;

            let tags: Record<string, string> = {};
            try {
              const tagsResp = await this.withRateLimit(() => client.send(new ListTagsForResourceCommand({ ResourceArn: location.LocationArn })));
              if (tagsResp.Tags) {
                for (const tag of tagsResp.Tags) {
                  if (tag.Key) tags[tag.Key] = tag.Value || '';
                }
              }
            } catch { /* ignore */ }

            resources.push(this.createResource(location.LocationArn, 'datasync-location', location.LocationUri || '', {
              locationArn: location.LocationArn,
              locationUri: location.LocationUri,
            }, tags));
          }
        }
        nextToken = response.NextToken;
      } while (nextToken);
    } catch (error) { errors.push(this.createError('ListLocations', error)); }
    return { resources, errors };
  }

  private async scanAgents(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getDataSyncClient({ profile: this.config.profile, region: this.config.region });

    try {
      let nextToken: string | undefined;
      do {
        const response = await this.withRateLimit(() => client.send(new ListAgentsCommand({ NextToken: nextToken })));
        if (response.Agents) {
          for (const agent of response.Agents) {
            if (!agent.AgentArn) continue;

            let tags: Record<string, string> = {};
            try {
              const tagsResp = await this.withRateLimit(() => client.send(new ListTagsForResourceCommand({ ResourceArn: agent.AgentArn })));
              if (tagsResp.Tags) {
                for (const tag of tagsResp.Tags) {
                  if (tag.Key) tags[tag.Key] = tag.Value || '';
                }
              }
            } catch { /* ignore */ }

            resources.push(this.createResource(agent.AgentArn, 'datasync-agent', agent.Name || '', {
              agentArn: agent.AgentArn,
              name: agent.Name,
              status: agent.Status,
            }, tags));
          }
        }
        nextToken = response.NextToken;
      } while (nextToken);
    } catch (error) { errors.push(this.createError('ListAgents', error)); }
    return { resources, errors };
  }
}

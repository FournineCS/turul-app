// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  ListApplicationsCommand,
  GetApplicationCommand,
  ListDeploymentGroupsCommand,
  GetDeploymentGroupCommand,
  ListTagsForResourceCommand,
} from '@aws-sdk/client-codedeploy';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class CodeDeployScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'codedeploy', 'codedeploy');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getCodeDeployClient({ profile: this.config.profile, region: this.config.region });

    try {
      let nextToken: string | undefined;
      do {
        const response = await this.withRateLimit(() => client.send(new ListApplicationsCommand({ nextToken })));
        if (response.applications) {
          for (const applicationName of response.applications) {
            if (!applicationName) continue;

            let details: Record<string, unknown> = {};
            let applicationArn = '';
            try {
              const appResp = await this.withRateLimit(() => client.send(new GetApplicationCommand({ applicationName })));
              const app = appResp.application;
              if (app) {
                applicationArn = `arn:aws:codedeploy:${this.config.region}:${app.applicationId ? '' : ''}:application:${applicationName}`;
                details = {
                  applicationName: app.applicationName,
                  applicationId: app.applicationId,
                  computePlatform: app.computePlatform,
                  linkedToGitHub: app.linkedToGitHub,
                  createTime: app.createTime?.toISOString(),
                };
              }
            } catch { /* ignore */ }

            // List deployment groups for this application
            const deploymentGroups: Record<string, unknown>[] = [];
            try {
              let dgNextToken: string | undefined;
              do {
                const dgListResp = await this.withRateLimit(() => client.send(new ListDeploymentGroupsCommand({
                  applicationName,
                  nextToken: dgNextToken,
                })));
                if (dgListResp.deploymentGroups) {
                  for (const deploymentGroupName of dgListResp.deploymentGroups) {
                    if (!deploymentGroupName) continue;
                    try {
                      const dgResp = await this.withRateLimit(() => client.send(new GetDeploymentGroupCommand({
                        applicationName,
                        deploymentGroupName,
                      })));
                      const dg = dgResp.deploymentGroupInfo;
                      if (dg) {
                        deploymentGroups.push({
                          deploymentGroupName: dg.deploymentGroupName,
                          deploymentGroupId: dg.deploymentGroupId,
                          serviceRoleArn: dg.serviceRoleArn,
                          deploymentStyle: dg.deploymentStyle ? {
                            deploymentType: dg.deploymentStyle.deploymentType,
                            deploymentOption: dg.deploymentStyle.deploymentOption,
                          } : undefined,
                          computePlatform: dg.computePlatform,
                          deploymentConfigName: dg.deploymentConfigName,
                        });
                      }
                    } catch { /* ignore */ }
                  }
                }
                dgNextToken = dgListResp.nextToken;
              } while (dgNextToken);
            } catch { /* ignore */ }

            details.deploymentGroups = deploymentGroups;
            details.deploymentGroupCount = deploymentGroups.length;

            // Construct ARN if not already set
            if (!applicationArn) {
              applicationArn = `arn:aws:codedeploy:${this.config.region}::application:${applicationName}`;
            }

            // Fetch tags
            let tags: Record<string, string> = {};
            try {
              const tagsResp = await this.withRateLimit(() => client.send(new ListTagsForResourceCommand({ ResourceArn: applicationArn })));
              if (tagsResp.Tags) {
                for (const tag of tagsResp.Tags) {
                  if (tag.Key) tags[tag.Key] = tag.Value || '';
                }
              }
            } catch { /* ignore */ }

            resources.push(this.createResource(
              applicationArn,
              'application',
              applicationName,
              details,
              tags,
              details.createTime as string | undefined,
            ));
          }
        }
        nextToken = response.nextToken;
      } while (nextToken);
    } catch (error) { errors.push(this.createError('ListApplications', error)); }

    return { resources, errors };
  }
}

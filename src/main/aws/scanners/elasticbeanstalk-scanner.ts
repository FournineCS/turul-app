// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  DescribeApplicationsCommand,
  DescribeEnvironmentsCommand,
  ListTagsForResourceCommand,
} from '@aws-sdk/client-elastic-beanstalk';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class ElasticBeanstalkScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'elasticbeanstalk', 'elasticbeanstalk');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getElasticBeanstalkClient({
      profile: this.config.profile,
      region: this.config.region,
    });

    // Scan applications
    try {
      const appsResponse = await this.withRateLimit(() =>
        client.send(new DescribeApplicationsCommand({}))
      );

      if (appsResponse.Applications) {
        for (const app of appsResponse.Applications) {
          resources.push(
            this.createResource(
              app.ApplicationArn || app.ApplicationName || '',
              'application',
              app.ApplicationName || '',
              {
                applicationName: app.ApplicationName,
                description: app.Description,
                dateCreated: app.DateCreated?.toISOString(),
                versions: app.Versions,
              },
              {},
              app.DateCreated?.toISOString()
            )
          );
        }
      }
    } catch (error) {
      errors.push(this.createError('DescribeApplications', error));
    }

    // Scan environments (with NextToken pagination)
    try {
      let nextToken: string | undefined;

      do {
        const envsResponse = await this.withRateLimit(() =>
          client.send(new DescribeEnvironmentsCommand({ NextToken: nextToken }))
        );

        if (envsResponse.Environments) {
          for (const env of envsResponse.Environments) {
            if (!env.EnvironmentArn) continue;

            // Get tags for this environment
            let tags: Record<string, string> = {};
            try {
              const tagsResponse = await this.withRateLimit(() =>
                client.send(
                  new ListTagsForResourceCommand({ ResourceArn: env.EnvironmentArn })
                )
              );
              if (tagsResponse.ResourceTags) {
                tags = this.parseTags(tagsResponse.ResourceTags);
              }
            } catch {
              /* ignore tag fetch errors */
            }

            resources.push(
              this.createResource(
                env.EnvironmentArn,
                'environment',
                env.EnvironmentName || '',
                {
                  environmentName: env.EnvironmentName,
                  environmentId: env.EnvironmentId,
                  applicationName: env.ApplicationName,
                  versionLabel: env.VersionLabel,
                  status: env.Status,
                  health: env.Health,
                  healthStatus: env.HealthStatus,
                  solutionStackName: env.SolutionStackName,
                  platformArn: env.PlatformArn,
                  tier: env.Tier
                    ? {
                        name: env.Tier.Name,
                        type: env.Tier.Type,
                        version: env.Tier.Version,
                      }
                    : undefined,
                  cname: env.CNAME,
                  endpointURL: env.EndpointURL,
                  dateCreated: env.DateCreated?.toISOString(),
                  dateUpdated: env.DateUpdated?.toISOString(),
                },
                tags,
                env.DateCreated?.toISOString()
              )
            );
          }
        }

        nextToken = envsResponse.NextToken;
      } while (nextToken);
    } catch (error) {
      errors.push(this.createError('DescribeEnvironments', error));
    }

    return { resources, errors };
  }
}

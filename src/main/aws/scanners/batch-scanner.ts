// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  DescribeComputeEnvironmentsCommand,
  DescribeJobQueuesCommand,
  DescribeJobDefinitionsCommand,
  ListTagsForResourceCommand,
} from '@aws-sdk/client-batch';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class BatchScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'batch', 'batch');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getBatchClient({
      profile: this.config.profile,
      region: this.config.region,
    });

    // Scan compute environments
    try {
      let nextToken: string | undefined;

      do {
        const response = await this.withRateLimit(() =>
          client.send(new DescribeComputeEnvironmentsCommand({ nextToken }))
        );

        if (response.computeEnvironments) {
          for (const env of response.computeEnvironments) {
            const arn = env.computeEnvironmentArn || '';

            // Get tags
            let tags: Record<string, string> = {};
            try {
              const tagsResponse = await this.withRateLimit(() =>
                client.send(new ListTagsForResourceCommand({ resourceArn: arn }))
              );
              tags = tagsResponse.tags || {};
            } catch {
              // Ignore tag errors
            }

            resources.push(
              this.createResource(
                arn,
                'compute-environment',
                env.computeEnvironmentName || '',
                {
                  computeEnvironmentName: env.computeEnvironmentName,
                  computeEnvironmentArn: env.computeEnvironmentArn,
                  type: env.type,
                  state: env.state,
                  status: env.status,
                  statusReason: env.statusReason,
                  serviceRole: env.serviceRole,
                  computeResources: env.computeResources
                    ? {
                        type: env.computeResources.type,
                        minvCpus: env.computeResources.minvCpus,
                        maxvCpus: env.computeResources.maxvCpus,
                        desiredvCpus: env.computeResources.desiredvCpus,
                        instanceTypes: env.computeResources.instanceTypes,
                        subnets: env.computeResources.subnets,
                        securityGroupIds: env.computeResources.securityGroupIds,
                        instanceRole: env.computeResources.instanceRole,
                        allocationStrategy: env.computeResources.allocationStrategy,
                      }
                    : undefined,
                  containerOrchestrationType: env.containerOrchestrationType,
                  ecsClusterArn: env.ecsClusterArn,
                },
                tags
              )
            );
          }
        }

        nextToken = response.nextToken;
      } while (nextToken);
    } catch (error) {
      errors.push(this.createError('DescribeComputeEnvironments', error));
    }

    // Scan job queues
    try {
      let nextToken: string | undefined;

      do {
        const response = await this.withRateLimit(() =>
          client.send(new DescribeJobQueuesCommand({ nextToken }))
        );

        if (response.jobQueues) {
          for (const queue of response.jobQueues) {
            const arn = queue.jobQueueArn || '';

            // Get tags
            let tags: Record<string, string> = {};
            try {
              const tagsResponse = await this.withRateLimit(() =>
                client.send(new ListTagsForResourceCommand({ resourceArn: arn }))
              );
              tags = tagsResponse.tags || {};
            } catch {
              // Ignore tag errors
            }

            resources.push(
              this.createResource(
                arn,
                'job-queue',
                queue.jobQueueName || '',
                {
                  jobQueueName: queue.jobQueueName,
                  jobQueueArn: queue.jobQueueArn,
                  state: queue.state,
                  status: queue.status,
                  statusReason: queue.statusReason,
                  priority: queue.priority,
                  schedulingPolicyArn: queue.schedulingPolicyArn,
                  computeEnvironmentOrder: queue.computeEnvironmentOrder?.map((ce) => ({
                    order: ce.order,
                    computeEnvironment: ce.computeEnvironment,
                  })),
                },
                tags
              )
            );
          }
        }

        nextToken = response.nextToken;
      } while (nextToken);
    } catch (error) {
      errors.push(this.createError('DescribeJobQueues', error));
    }

    // Scan job definitions (active only)
    try {
      let nextToken: string | undefined;

      do {
        const response = await this.withRateLimit(() =>
          client.send(new DescribeJobDefinitionsCommand({ status: 'ACTIVE', nextToken }))
        );

        if (response.jobDefinitions) {
          for (const jobDef of response.jobDefinitions) {
            const arn = jobDef.jobDefinitionArn || '';

            // Get tags
            let tags: Record<string, string> = {};
            try {
              const tagsResponse = await this.withRateLimit(() =>
                client.send(new ListTagsForResourceCommand({ resourceArn: arn }))
              );
              tags = tagsResponse.tags || {};
            } catch {
              // Ignore tag errors
            }

            resources.push(
              this.createResource(
                arn,
                'job-definition',
                jobDef.jobDefinitionName || '',
                {
                  jobDefinitionName: jobDef.jobDefinitionName,
                  jobDefinitionArn: jobDef.jobDefinitionArn,
                  revision: jobDef.revision,
                  type: jobDef.type,
                  status: jobDef.status,
                  schedulingPriority: jobDef.schedulingPriority,
                  containerProperties: jobDef.containerProperties
                    ? {
                        image: jobDef.containerProperties.image,
                        vcpus: jobDef.containerProperties.vcpus,
                        memory: jobDef.containerProperties.memory,
                        command: jobDef.containerProperties.command,
                        jobRoleArn: jobDef.containerProperties.jobRoleArn,
                        executionRoleArn: jobDef.containerProperties.executionRoleArn,
                        resourceRequirements: jobDef.containerProperties.resourceRequirements,
                        environment: jobDef.containerProperties.environment?.map((e) => ({
                          name: e.name,
                          value: e.value,
                        })),
                      }
                    : undefined,
                  nodeProperties: jobDef.nodeProperties
                    ? {
                        numNodes: jobDef.nodeProperties.numNodes,
                        mainNode: jobDef.nodeProperties.mainNode,
                      }
                    : undefined,
                  retryStrategy: jobDef.retryStrategy
                    ? {
                        attempts: jobDef.retryStrategy.attempts,
                      }
                    : undefined,
                  timeout: jobDef.timeout
                    ? {
                        attemptDurationSeconds: jobDef.timeout.attemptDurationSeconds,
                      }
                    : undefined,
                  platformCapabilities: jobDef.platformCapabilities,
                  propagateTags: jobDef.propagateTags,
                },
                tags
              )
            );
          }
        }

        nextToken = response.nextToken;
      } while (nextToken);
    } catch (error) {
      errors.push(this.createError('DescribeJobDefinitions', error));
    }

    return { resources, errors };
  }
}

// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  ListStacksCommand,
  DescribeStacksCommand,
  ListStackResourcesCommand,
  StackStatus,
  type StackSummary,
  type Stack,
  type StackResourceSummary,
  type ListStacksCommandOutput,
  type DescribeStacksCommandOutput,
  type ListStackResourcesCommandOutput,
} from '@aws-sdk/client-cloudformation';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

// Stack statuses that indicate the stack exists and should be scanned
const ACTIVE_STACK_STATUSES: StackStatus[] = [
  StackStatus.CREATE_COMPLETE,
  StackStatus.UPDATE_COMPLETE,
  StackStatus.UPDATE_ROLLBACK_COMPLETE,
  StackStatus.ROLLBACK_COMPLETE,
  StackStatus.CREATE_IN_PROGRESS,
  StackStatus.UPDATE_IN_PROGRESS,
  StackStatus.IMPORT_COMPLETE,
  StackStatus.IMPORT_IN_PROGRESS,
];

export class CloudFormationScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'cloudformation', 'cloudformation');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getCloudFormationClient({
      profile: this.config.profile,
      region: this.config.region,
    });

    try {
      let nextToken: string | undefined;

      do {
        const response: ListStacksCommandOutput = await this.withRateLimit(() =>
          client.send(
            new ListStacksCommand({
              NextToken: nextToken,
              StackStatusFilter: ACTIVE_STACK_STATUSES,
            })
          )
        );

        if (response.StackSummaries) {
          for (const stackSummary of response.StackSummaries) {
            // Get detailed stack info
            try {
              const detailResponse: DescribeStacksCommandOutput = await this.withRateLimit(() =>
                client.send(
                  new DescribeStacksCommand({
                    StackName: stackSummary.StackId,
                  })
                )
              );

              const stack = detailResponse.Stacks?.[0];
              if (stack) {
                resources.push(this.mapStack(stack));

                // Get stack resources
                const stackResources = await this.getStackResources(
                  client,
                  stackSummary.StackName!
                );
                for (const stackResource of stackResources) {
                  resources.push(
                    this.mapStackResource(stackResource, stack.StackId!)
                  );
                }
              }
            } catch {
              // Fall back to summary info
              resources.push(this.mapStackSummary(stackSummary));
            }
          }
        }

        nextToken = response.NextToken;
      } while (nextToken);
    } catch (error) {
      errors.push(this.createError('ListStacks', error));
    }

    return { resources, errors };
  }

  private async getStackResources(
    client: ReturnType<typeof getClientFactory.prototype.getCloudFormationClient>,
    stackName: string
  ): Promise<StackResourceSummary[]> {
    const resources: StackResourceSummary[] = [];

    try {
      let nextToken: string | undefined;

      do {
        const response: ListStackResourcesCommandOutput = await this.withRateLimit(() =>
          client.send(
            new ListStackResourcesCommand({
              StackName: stackName,
              NextToken: nextToken,
            })
          )
        );

        if (response.StackResourceSummaries) {
          resources.push(...response.StackResourceSummaries);
        }

        nextToken = response.NextToken;
      } while (nextToken);
    } catch {
      // Ignore errors getting stack resources
    }

    return resources;
  }

  private mapStack(stack: Stack): Resource {
    const tags = this.parseTags(stack.Tags);

    return this.createResource(
      stack.StackId || '',
      'stack',
      stack.StackName || '',
      {
        stackName: stack.StackName,
        stackId: stack.StackId,
        stackStatus: stack.StackStatus,
        stackStatusReason: stack.StackStatusReason,
        description: stack.Description,
        creationTime: stack.CreationTime?.toISOString(),
        lastUpdatedTime: stack.LastUpdatedTime?.toISOString(),
        deletionTime: stack.DeletionTime?.toISOString(),
        roleArn: stack.RoleARN,
        enableTerminationProtection: stack.EnableTerminationProtection,
        parentId: stack.ParentId,
        rootId: stack.RootId,
        driftStatus: stack.DriftInformation?.StackDriftStatus,
        capabilities: stack.Capabilities,
        outputs: stack.Outputs?.map((o) => ({
          key: o.OutputKey,
          value: o.OutputValue,
          description: o.Description,
          exportName: o.ExportName,
        })),
        parameters: stack.Parameters?.map((p) => ({
          key: p.ParameterKey,
          value: p.ParameterValue,
        })),
      },
      tags,
      stack.CreationTime?.toISOString()
    );
  }

  private mapStackSummary(summary: StackSummary): Resource {
    return this.createResource(
      summary.StackId || '',
      'stack',
      summary.StackName || '',
      {
        stackName: summary.StackName,
        stackId: summary.StackId,
        stackStatus: summary.StackStatus,
        stackStatusReason: summary.StackStatusReason,
        creationTime: summary.CreationTime?.toISOString(),
        lastUpdatedTime: summary.LastUpdatedTime?.toISOString(),
        deletionTime: summary.DeletionTime?.toISOString(),
        parentId: summary.ParentId,
        rootId: summary.RootId,
        driftStatus: summary.DriftInformation?.StackDriftStatus,
      },
      {},
      summary.CreationTime?.toISOString()
    );
  }

  private mapStackResource(
    resource: StackResourceSummary,
    stackId: string
  ): Resource {
    const resourceArn = resource.PhysicalResourceId ||
      `arn:aws:cloudformation:${this.config.region}:stack-resource:${resource.LogicalResourceId}`;

    return this.createResource(
      resourceArn,
      'stack-resource',
      resource.LogicalResourceId || '',
      {
        logicalResourceId: resource.LogicalResourceId,
        physicalResourceId: resource.PhysicalResourceId,
        resourceType: resource.ResourceType,
        resourceStatus: resource.ResourceStatus,
        resourceStatusReason: resource.ResourceStatusReason,
        lastUpdatedTimestamp: resource.LastUpdatedTimestamp?.toISOString(),
        driftStatus: resource.DriftInformation?.StackResourceDriftStatus,
        stackId,
      },
      {},
      resource.LastUpdatedTimestamp?.toISOString()
    );
  }
}

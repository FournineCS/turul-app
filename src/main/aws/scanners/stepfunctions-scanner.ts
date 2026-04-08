// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  ListStateMachinesCommand,
  DescribeStateMachineCommand,
  ListTagsForResourceCommand,
  type StateMachineListItem,
} from '@aws-sdk/client-sfn';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class StepFunctionsScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'stepfunctions', 'stepfunctions');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getSFNClient({
      profile: this.config.profile,
      region: this.config.region,
    });

    try {
      let nextToken: string | undefined;

      do {
        const response = await this.withRateLimit(() =>
          client.send(new ListStateMachinesCommand({ nextToken }))
        );

        if (response.stateMachines) {
          for (const stateMachine of response.stateMachines) {
            try {
              const detailResponse = await this.withRateLimit(() =>
                client.send(
                  new DescribeStateMachineCommand({
                    stateMachineArn: stateMachine.stateMachineArn,
                  })
                )
              );

              // Get tags
              let tags: Record<string, string> = {};
              try {
                const tagsResponse = await this.withRateLimit(() =>
                  client.send(
                    new ListTagsForResourceCommand({
                      resourceArn: stateMachine.stateMachineArn,
                    })
                  )
                );
                if (tagsResponse.tags) {
                  for (const tag of tagsResponse.tags) {
                    if (tag.key) {
                      tags[tag.key] = tag.value || '';
                    }
                  }
                }
              } catch {
                // Ignore tag errors
              }

              resources.push(
                this.mapStateMachine(
                  stateMachine,
                  detailResponse.definition,
                  detailResponse.roleArn,
                  detailResponse.type,
                  detailResponse.loggingConfiguration,
                  detailResponse.tracingConfiguration,
                  detailResponse.status,
                  detailResponse.description,
                  detailResponse.revisionId,
                  tags
                )
              );
            } catch (error) {
              // Fall back to summary info
              resources.push(this.mapStateMachineSummary(stateMachine));
            }
          }
        }

        nextToken = response.nextToken;
      } while (nextToken);
    } catch (error) {
      errors.push(this.createError('ListStateMachines', error));
    }

    return { resources, errors };
  }

  private mapStateMachine(
    stateMachine: StateMachineListItem,
    definition: string | undefined,
    roleArn: string | undefined,
    type: string | undefined,
    loggingConfiguration: unknown,
    tracingConfiguration: unknown,
    status: string | undefined,
    description: string | undefined,
    revisionId: string | undefined,
    tags: Record<string, string>
  ): Resource {
    // Parse definition to extract Lambda function ARNs
    let lambdaFunctions: string[] = [];
    if (definition) {
      try {
        const parsed = JSON.parse(definition);
        lambdaFunctions = this.extractLambdaArns(parsed);
      } catch {
        // Ignore parse errors
      }
    }

    return this.createResource(
      stateMachine.stateMachineArn || '',
      'state-machine',
      stateMachine.name || '',
      {
        name: stateMachine.name,
        stateMachineArn: stateMachine.stateMachineArn,
        type,
        status,
        description,
        roleArn,
        creationDate: stateMachine.creationDate?.toISOString(),
        revisionId,
        loggingConfiguration,
        tracingConfiguration,
        lambdaFunctions,
        definitionSize: definition?.length,
      },
      tags,
      stateMachine.creationDate?.toISOString()
    );
  }

  private mapStateMachineSummary(stateMachine: StateMachineListItem): Resource {
    return this.createResource(
      stateMachine.stateMachineArn || '',
      'state-machine',
      stateMachine.name || '',
      {
        name: stateMachine.name,
        stateMachineArn: stateMachine.stateMachineArn,
        type: stateMachine.type,
        creationDate: stateMachine.creationDate?.toISOString(),
      },
      {},
      stateMachine.creationDate?.toISOString()
    );
  }

  private extractLambdaArns(definition: unknown): string[] {
    const arns: string[] = [];
    const seen = new Set<string>();

    const extract = (obj: unknown): void => {
      if (!obj || typeof obj !== 'object') return;

      if (Array.isArray(obj)) {
        for (const item of obj) {
          extract(item);
        }
        return;
      }

      const record = obj as Record<string, unknown>;

      // Check for Lambda function ARN in various locations
      if (record.Resource && typeof record.Resource === 'string') {
        const resource = record.Resource;
        if (resource.includes(':lambda:') && resource.includes(':function:')) {
          if (!seen.has(resource)) {
            seen.add(resource);
            arns.push(resource);
          }
        }
      }

      if (record.FunctionName && typeof record.FunctionName === 'string') {
        const fn = record.FunctionName;
        if (fn.startsWith('arn:aws:lambda:') && !seen.has(fn)) {
          seen.add(fn);
          arns.push(fn);
        }
      }

      // Recurse into nested objects
      for (const value of Object.values(record)) {
        extract(value);
      }
    };

    extract(definition);
    return arns;
  }
}

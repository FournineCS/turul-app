// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  ListFunctionsCommand,
  GetFunctionCommand,
  type FunctionConfiguration,
} from '@aws-sdk/client-lambda';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class LambdaScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'lambda', 'lambda');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getLambdaClient({
      profile: this.config.profile,
      region: this.config.region,
    });

    try {
      let marker: string | undefined;

      do {
        const response = await this.withRateLimit(() =>
          client.send(new ListFunctionsCommand({ Marker: marker }))
        );

        if (response.Functions) {
          for (const func of response.Functions) {
            // Get detailed function info including tags
            try {
              const detailResponse = await this.withRateLimit(() =>
                client.send(new GetFunctionCommand({ FunctionName: func.FunctionName }))
              );

              resources.push(
                this.mapFunction(func, detailResponse.Tags || {})
              );
            } catch (detailError) {
              // Fall back to basic info without tags
              resources.push(this.mapFunction(func, {}));
            }
          }
        }

        marker = response.NextMarker;
      } while (marker);
    } catch (error) {
      errors.push(this.createError('ListFunctions', error));
    }

    return { resources, errors };
  }

  private mapFunction(
    func: FunctionConfiguration,
    tags: Record<string, string>
  ): Resource {
    return this.createResource(
      func.FunctionArn || '',
      'function',
      func.FunctionName || '',
      {
        functionName: func.FunctionName,
        runtime: func.Runtime,
        handler: func.Handler,
        codeSize: func.CodeSize,
        memorySize: func.MemorySize,
        timeout: func.Timeout,
        lastModified: func.LastModified,
        description: func.Description,
        role: func.Role,
        version: func.Version,
        state: func.State,
        stateReason: func.StateReason,
        stateReasonCode: func.StateReasonCode,
        packageType: func.PackageType,
        architectures: func.Architectures,
        vpcConfig: func.VpcConfig
          ? {
              vpcId: func.VpcConfig.VpcId,
              subnetIds: func.VpcConfig.SubnetIds,
              securityGroupIds: func.VpcConfig.SecurityGroupIds,
            }
          : undefined,
        environment: func.Environment?.Variables,
        deadLetterConfig: func.DeadLetterConfig?.TargetArn,
        tracingConfig: func.TracingConfig?.Mode,
        layers: func.Layers?.map((layer) => layer.Arn),
      },
      tags,
      func.LastModified
    );
  }
}

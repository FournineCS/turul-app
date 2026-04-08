// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  DescribeParametersCommand,
} from '@aws-sdk/client-ssm';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class SSMScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'ssm', 'ssm');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getSSMClient({ profile: this.config.profile, region: this.config.region });

    try {
      let nextToken: string | undefined;
      do {
        const response = await this.withRateLimit(() => client.send(new DescribeParametersCommand({ NextToken: nextToken })));
        if (response.Parameters) {
          for (const param of response.Parameters) {
            if (!param.Name) continue;
            const arn = `arn:aws:ssm:${this.config.region}::parameter${param.Name.startsWith('/') ? '' : '/'}${param.Name}`;

            resources.push(this.createResource(arn, 'parameter', param.Name, {
              parameterName: param.Name,
              type: param.Type,
              keyId: param.KeyId,
              version: param.Version,
              tier: param.Tier,
              dataType: param.DataType,
              description: param.Description,
            }, {}, param.LastModifiedDate?.toISOString()));
          }
        }
        nextToken = response.NextToken;
      } while (nextToken);
    } catch (error) { errors.push(this.createError('DescribeParameters', error)); }

    return { resources, errors };
  }
}

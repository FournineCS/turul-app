// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { DescribeDomainsCommand } from '@aws-sdk/client-cloudsearch';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class CloudSearchScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'cloudsearch', 'cloudsearch');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];

    try {
      const client = getClientFactory().getCloudSearchClient({
        profile: this.config.profile,
        region: this.config.region,
      });

      const describeResponse = await this.withRateLimit(() => client.send(new DescribeDomainsCommand({})));
      const domains = describeResponse.DomainStatusList ?? [];

      for (const domain of domains) {
        try {
          const resource = this.createResource(
            domain.ARN ?? domain.DomainId ?? domain.DomainName ?? '',
            'domain',
            domain.DomainName ?? '',
            {
              domainId: domain.DomainId,
              domainName: domain.DomainName,
              arn: domain.ARN,
              created: domain.Created,
              deleted: domain.Deleted,
              processing: domain.Processing,
              searchInstanceType: domain.SearchInstanceType,
              searchInstanceCount: domain.SearchInstanceCount,
              searchPartitionCount: domain.SearchPartitionCount,
              docService: domain.DocService
                ? {
                    endpoint: domain.DocService.Endpoint,
                  }
                : undefined,
              searchService: domain.SearchService
                ? {
                    endpoint: domain.SearchService.Endpoint,
                  }
                : undefined,
            },
          );

          resources.push(resource);
        } catch (domainError) {
          errors.push(
            this.createError(`ProcessDomain:${domain.DomainName}`, domainError)
          );
        }
      }
    } catch (error) {
      errors.push(this.createError('DescribeDomains', error));
    }

    return { resources, errors };
  }
}

// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  ListServicesCommand,
  ListTargetGroupsCommand,
  ListTagsForResourceCommand,
} from '@aws-sdk/client-vpc-lattice';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class VPCLatticeScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'vpclattice', 'vpclattice');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getVPCLatticeClient({
      profile: this.config.profile,
      region: this.config.region,
    });

    // Scan VPC Lattice Services
    try {
      let nextToken: string | undefined;
      do {
        const response = await this.withRateLimit(() => client.send(
          new ListServicesCommand({ nextToken, maxResults: 100 })
        ));

        for (const svc of response.items ?? []) {
          const arn = svc.arn!;
          let tags: Record<string, string> = {};

          try {
            const tagsResponse = await this.withRateLimit(() => client.send(
              new ListTagsForResourceCommand({ resourceArn: arn })
            ));
            tags = tagsResponse.tags ?? {};
          } catch (tagErr) {
            // ignore tag errors per-resource
          }

          resources.push(this.createResource(
            arn,
            'service',
            svc.name || svc.id || arn,
            {
              id: svc.id,
              name: svc.name,
              status: svc.status,
              dnsEntry: svc.dnsEntry
                ? {
                    domainName: (svc.dnsEntry as any).domainName,
                    hostedZoneId: (svc.dnsEntry as any).hostedZoneId,
                  }
                : undefined,
              createdAt: svc.createdAt,
              lastUpdatedAt: svc.lastUpdatedAt,
            },
            tags,
          ));
        }

        nextToken = response.nextToken;
      } while (nextToken);
    } catch (err) {
      errors.push(this.createError('ListServices', err));
    }

    // Scan VPC Lattice Target Groups
    try {
      let nextToken: string | undefined;
      do {
        const response = await this.withRateLimit(() => client.send(
          new ListTargetGroupsCommand({ nextToken, maxResults: 100 })
        ));

        for (const tg of response.items ?? []) {
          const arn = tg.arn!;
          let tags: Record<string, string> = {};

          try {
            const tagsResponse = await this.withRateLimit(() => client.send(
              new ListTagsForResourceCommand({ resourceArn: arn })
            ));
            tags = tagsResponse.tags ?? {};
          } catch (tagErr) {
            // ignore tag errors per-resource
          }

          resources.push(this.createResource(
            arn,
            'target-group',
            tg.name || tg.id || arn,
            {
              id: tg.id,
              name: tg.name,
              type: tg.type,
              status: tg.status,
              protocol: tg.protocol,
              port: tg.port,
              vpcIdentifier: tg.vpcIdentifier,
              createdAt: tg.createdAt,
              lastUpdatedAt: tg.lastUpdatedAt,
            },
            tags,
          ));
        }

        nextToken = response.nextToken;
      } while (nextToken);
    } catch (err) {
      errors.push(this.createError('ListTargetGroups', err));
    }

    return { resources, errors };
  }
}

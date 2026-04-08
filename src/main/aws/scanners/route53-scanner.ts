// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  ListHostedZonesCommand,
  ListResourceRecordSetsCommand,
  ListTagsForResourceCommand,
} from '@aws-sdk/client-route-53';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class Route53Scanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'route53', 'route53');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getRoute53Client({
      profile: this.config.profile,
      region: this.config.region,
    });

    try {
      let marker: string | undefined;

      do {
        const response = await this.withRateLimit(() =>
          client.send(new ListHostedZonesCommand({ Marker: marker }))
        );

        if (response.HostedZones) {
          for (const zone of response.HostedZones) {
            if (!zone.Id) continue;
            const zoneId = zone.Id.replace('/hostedzone/', '');
            const arn = `arn:aws:route53:::hostedzone/${zoneId}`;

            let tags: Record<string, string> = {};
            try {
              const tagsResponse = await this.withRateLimit(() =>
                client.send(new ListTagsForResourceCommand({
                  ResourceType: 'hostedzone',
                  ResourceId: zoneId,
                }))
              );
              if (tagsResponse.ResourceTagSet?.Tags) {
                for (const tag of tagsResponse.ResourceTagSet.Tags) {
                  if (tag.Key) tags[tag.Key] = tag.Value || '';
                }
              }
            } catch {
              // Ignore tag errors
            }

            // Get record count
            let recordCount = 0;
            let recordSets: any[] = [];
            try {
              const recordsResponse = await this.withRateLimit(() =>
                client.send(new ListResourceRecordSetsCommand({
                  HostedZoneId: zoneId,
                  MaxItems: 100,
                }))
              );
              recordSets = (recordsResponse.ResourceRecordSets || []).map(rs => ({
                name: rs.Name,
                type: rs.Type,
                ttl: rs.TTL,
                aliasTarget: rs.AliasTarget ? {
                  dnsName: rs.AliasTarget.DNSName,
                  hostedZoneId: rs.AliasTarget.HostedZoneId,
                  evaluateTargetHealth: rs.AliasTarget.EvaluateTargetHealth,
                } : undefined,
                recordCount: rs.ResourceRecords?.length || 0,
              }));
              recordCount = recordSets.length;
            } catch {
              // Ignore record errors
            }

            resources.push(this.createResource(
              arn,
              'hosted-zone',
              zone.Name || zoneId,
              {
                hostedZoneId: zoneId,
                name: zone.Name,
                callerReference: zone.CallerReference,
                comment: zone.Config?.Comment,
                privateZone: zone.Config?.PrivateZone,
                resourceRecordSetCount: zone.ResourceRecordSetCount,
                recordCount,
                recordSets,
              },
              tags
            ));
          }
        }

        marker = response.IsTruncated ? response.NextMarker : undefined;
      } while (marker);
    } catch (error) {
      errors.push(this.createError('ListHostedZones', error));
    }

    return { resources, errors };
  }
}

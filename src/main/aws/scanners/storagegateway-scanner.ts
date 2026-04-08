// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  ListGatewaysCommand,
  DescribeGatewayInformationCommand,
  ListTagsForResourceCommand,
} from '@aws-sdk/client-storage-gateway';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class StorageGatewayScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'storagegateway', 'storagegateway');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getStorageGatewayClient({
      profile: this.config.profile,
      region: this.config.region,
    });

    try {
      let marker: string | undefined;

      do {
        const response = await this.withRateLimit(() =>
          client.send(new ListGatewaysCommand({ Marker: marker }))
        );

        if (response.Gateways) {
          for (const gateway of response.Gateways) {
            if (!gateway.GatewayARN) continue;

            let details: Record<string, unknown> = {};
            try {
              const descResp = await this.withRateLimit(() =>
                client.send(new DescribeGatewayInformationCommand({ GatewayARN: gateway.GatewayARN }))
              );
              details = {
                gatewayName: descResp.GatewayName,
                gatewayType: descResp.GatewayType,
                gatewayOperationalState: descResp.GatewayState,
                ec2InstanceId: descResp.Ec2InstanceId,
                ec2InstanceRegion: descResp.Ec2InstanceRegion,
                gatewayTimezone: descResp.GatewayTimezone,
                softwareVersion: descResp.SoftwareVersion,
              };
            } catch { /* ignore */ }

            let tags: Record<string, string> = {};
            try {
              const tagsResp = await this.withRateLimit(() =>
                client.send(new ListTagsForResourceCommand({ ResourceARN: gateway.GatewayARN }))
              );
              if (tagsResp.Tags) {
                for (const tag of tagsResp.Tags) {
                  if (tag.Key) tags[tag.Key] = tag.Value || '';
                }
              }
            } catch { /* ignore */ }

            resources.push(this.createResource(
              gateway.GatewayARN,
              'gateway',
              gateway.GatewayName || this.getNameFromTags(tags) || gateway.GatewayId || '',
              {
                gatewayId: gateway.GatewayId,
                gatewayOperationalState: gateway.GatewayOperationalState,
                gatewayType: gateway.GatewayType,
                ...details,
              },
              tags
            ));
          }
        }

        marker = response.Marker;
      } while (marker);
    } catch (error) {
      errors.push(this.createError('ListGateways', error));
    }

    return { resources, errors };
  }
}

// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  DescribeTransitGatewaysCommand,
  DescribeTransitGatewayAttachmentsCommand,
} from '@aws-sdk/client-ec2';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class TransitGatewayScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'transitgateway', 'transitgateway');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getEC2Client({ profile: this.config.profile, region: this.config.region });

    // Collect attachments keyed by transit gateway ID for enrichment
    const attachmentsByTgw: Record<string, any[]> = {};
    try {
      let nextToken: string | undefined;
      do {
        const response = await this.withRateLimit(() =>
          client.send(new DescribeTransitGatewayAttachmentsCommand({ NextToken: nextToken }))
        );
        if (response.TransitGatewayAttachments) {
          for (const attachment of response.TransitGatewayAttachments) {
            const tgwId = attachment.TransitGatewayId;
            if (!tgwId) continue;
            if (!attachmentsByTgw[tgwId]) attachmentsByTgw[tgwId] = [];
            attachmentsByTgw[tgwId].push({
              attachmentId: attachment.TransitGatewayAttachmentId,
              resourceType: attachment.ResourceType,
              resourceId: attachment.ResourceId,
              resourceOwnerId: attachment.ResourceOwnerId,
              state: attachment.State,
              association: attachment.Association
                ? {
                    transitGatewayRouteTableId: attachment.Association.TransitGatewayRouteTableId,
                    state: attachment.Association.State,
                  }
                : undefined,
            });
          }
        }
        nextToken = response.NextToken;
      } while (nextToken);
    } catch (error) {
      errors.push(this.createError('DescribeTransitGatewayAttachments', error));
    }

    // Scan transit gateways
    try {
      let nextToken: string | undefined;
      do {
        const response = await this.withRateLimit(() =>
          client.send(new DescribeTransitGatewaysCommand({ NextToken: nextToken }))
        );
        if (response.TransitGateways) {
          for (const tgw of response.TransitGateways) {
            if (!tgw.TransitGatewayId) continue;

            const tags = this.parseTags(tgw.Tags);
            const name = this.getNameFromTags(tags) || tgw.TransitGatewayId;
            const attachments = attachmentsByTgw[tgw.TransitGatewayId] || [];

            resources.push(
              this.createResource(
                tgw.TransitGatewayArn || tgw.TransitGatewayId,
                'transit-gateway',
                name,
                {
                  transitGatewayId: tgw.TransitGatewayId,
                  state: tgw.State,
                  ownerId: tgw.OwnerId,
                  description: tgw.Description,
                  options: tgw.Options
                    ? {
                        amazonSideAsn: tgw.Options.AmazonSideAsn,
                        autoAcceptSharedAttachments: tgw.Options.AutoAcceptSharedAttachments,
                        defaultRouteTableAssociation: tgw.Options.DefaultRouteTableAssociation,
                        defaultRouteTablePropagation: tgw.Options.DefaultRouteTablePropagation,
                        dnsSupport: tgw.Options.DnsSupport,
                        vpnEcmpSupport: tgw.Options.VpnEcmpSupport,
                        multicastSupport: tgw.Options.MulticastSupport,
                        associationDefaultRouteTableId: tgw.Options.AssociationDefaultRouteTableId,
                        propagationDefaultRouteTableId: tgw.Options.PropagationDefaultRouteTableId,
                      }
                    : undefined,
                  attachmentCount: attachments.length,
                  attachments,
                },
                tags,
                tgw.CreationTime?.toISOString()
              )
            );
          }
        }
        nextToken = response.NextToken;
      } while (nextToken);
    } catch (error) {
      errors.push(this.createError('DescribeTransitGateways', error));
    }

    return { resources, errors };
  }
}

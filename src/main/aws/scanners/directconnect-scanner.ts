// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  DescribeConnectionsCommand,
  DescribeVirtualInterfacesCommand,
  DescribeTagsCommand,
} from '@aws-sdk/client-direct-connect';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class DirectConnectScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'directconnect', 'directconnect');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getDirectConnectClient({ profile: this.config.profile, region: this.config.region });

    // Scan connections
    try {
      const response = await this.withRateLimit(() => client.send(new DescribeConnectionsCommand({})));
      if (response.connections) {
        // Batch fetch tags for all connections
        const connectionArns = response.connections
          .map(c => c.connectionId ? `arn:aws:directconnect:${this.config.region}:*:dxcon/${c.connectionId}` : undefined)
          .filter((arn): arn is string => !!arn);

        let tagsByArn: Record<string, Record<string, string>> = {};
        if (connectionArns.length > 0) {
          try {
            const tagsResp = await this.withRateLimit(() => client.send(new DescribeTagsCommand({ resourceArns: connectionArns })));
            if (tagsResp.resourceTags) {
              for (const rt of tagsResp.resourceTags) {
                if (rt.resourceArn && rt.tags) {
                  const tags: Record<string, string> = {};
                  for (const tag of rt.tags) {
                    if (tag.key) tags[tag.key] = tag.value || '';
                  }
                  tagsByArn[rt.resourceArn] = tags;
                }
              }
            }
          } catch { /* ignore tag fetch errors */ }
        }

        for (const connection of response.connections) {
          if (!connection.connectionId) continue;

          const arn = `arn:aws:directconnect:${this.config.region}:${connection.ownerAccount || '*'}:dxcon/${connection.connectionId}`;

          // Try to find tags by matching the connection ARN
          let tags: Record<string, string> = {};
          for (const [tagArn, tagMap] of Object.entries(tagsByArn)) {
            if (tagArn.includes(connection.connectionId)) {
              tags = tagMap;
              break;
            }
          }

          resources.push(this.createResource(
            arn,
            'connection',
            connection.connectionName || connection.connectionId,
            {
              connectionId: connection.connectionId,
              connectionName: connection.connectionName,
              connectionState: connection.connectionState,
              bandwidth: connection.bandwidth,
              location: connection.location,
              vlan: connection.vlan,
              partnerName: connection.partnerName,
              ownerAccount: connection.ownerAccount,
              region: connection.region,
              lagId: connection.lagId,
              hasLogicalRedundancy: connection.hasLogicalRedundancy,
              providerName: connection.providerName,
              macSecCapable: connection.macSecCapable,
              encryptionMode: connection.encryptionMode,
            },
            tags,
          ));
        }
      }
    } catch (error) { errors.push(this.createError('DescribeConnections', error)); }

    // Scan virtual interfaces
    try {
      const response = await this.withRateLimit(() => client.send(new DescribeVirtualInterfacesCommand({})));
      if (response.virtualInterfaces) {
        for (const vif of response.virtualInterfaces) {
          if (!vif.virtualInterfaceId) continue;

          const arn = `arn:aws:directconnect:${this.config.region}:${vif.ownerAccount || '*'}:dxvif/${vif.virtualInterfaceId}`;

          let tags: Record<string, string> = {};
          if (vif.tags) {
            for (const tag of vif.tags) {
              if (tag.key) tags[tag.key] = tag.value || '';
            }
          }

          resources.push(this.createResource(
            arn,
            'virtual-interface',
            vif.virtualInterfaceName || vif.virtualInterfaceId,
            {
              virtualInterfaceId: vif.virtualInterfaceId,
              virtualInterfaceName: vif.virtualInterfaceName,
              virtualInterfaceType: vif.virtualInterfaceType,
              virtualInterfaceState: vif.virtualInterfaceState,
              connectionId: vif.connectionId,
              vlan: vif.vlan,
              asn: vif.asn,
              amazonSideAsn: vif.amazonSideAsn,
              authKey: vif.authKey,
              amazonAddress: vif.amazonAddress,
              customerAddress: vif.customerAddress,
              addressFamily: vif.addressFamily,
              virtualGatewayId: vif.virtualGatewayId,
              directConnectGatewayId: vif.directConnectGatewayId,
              ownerAccount: vif.ownerAccount,
              region: vif.region,
              location: vif.location,
              mtu: vif.mtu,
              jumboFrameCapable: vif.jumboFrameCapable,
              siteLinkEnabled: vif.siteLinkEnabled,
              bgpPeers: vif.bgpPeers?.map(peer => ({
                bgpPeerId: peer.bgpPeerId,
                asn: peer.asn,
                authKey: peer.authKey,
                addressFamily: peer.addressFamily,
                amazonAddress: peer.amazonAddress,
                customerAddress: peer.customerAddress,
                bgpPeerState: peer.bgpPeerState,
                bgpStatus: peer.bgpStatus,
                awsDeviceV2: peer.awsDeviceV2,
                awsLogicalDeviceId: peer.awsLogicalDeviceId,
              })),
              routeFilterPrefixes: vif.routeFilterPrefixes?.map(p => p.cidr),
            },
            tags,
          ));
        }
      }
    } catch (error) { errors.push(this.createError('DescribeVirtualInterfaces', error)); }

    return { resources, errors };
  }
}

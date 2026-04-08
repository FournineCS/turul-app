// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  ListAcceleratorsCommand,
  ListListenersCommand,
  ListEndpointGroupsCommand,
  ListTagsForResourceCommand,
} from '@aws-sdk/client-global-accelerator';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class GlobalAcceleratorScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'globalaccelerator', 'globalaccelerator');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    // Global Accelerator is a global service; always use us-west-2
    const client = getClientFactory().getGlobalAcceleratorClient({ profile: this.config.profile, region: 'us-west-2' });

    try {
      let nextToken: string | undefined;
      do {
        const response = await this.withRateLimit(() => client.send(new ListAcceleratorsCommand({ NextToken: nextToken })));
        if (response.Accelerators) {
          for (const accelerator of response.Accelerators) {
            if (!accelerator.AcceleratorArn) continue;

            // Fetch listeners for this accelerator
            let listeners: any[] = [];
            try {
              let listenerToken: string | undefined;
              do {
                const listenerResp = await this.withRateLimit(() =>
                  client.send(new ListListenersCommand({
                    AcceleratorArn: accelerator.AcceleratorArn,
                    NextToken: listenerToken,
                  }))
                );
                if (listenerResp.Listeners) {
                  for (const listener of listenerResp.Listeners) {
                    // Fetch endpoint groups for each listener
                    let endpointGroups: any[] = [];
                    try {
                      let egToken: string | undefined;
                      do {
                        const egResp = await this.withRateLimit(() =>
                          client.send(new ListEndpointGroupsCommand({
                            ListenerArn: listener.ListenerArn,
                            NextToken: egToken,
                          }))
                        );
                        if (egResp.EndpointGroups) {
                          for (const eg of egResp.EndpointGroups) {
                            endpointGroups.push({
                              endpointGroupArn: eg.EndpointGroupArn,
                              endpointGroupRegion: eg.EndpointGroupRegion,
                              healthCheckPath: eg.HealthCheckPath,
                              healthCheckPort: eg.HealthCheckPort,
                              healthCheckProtocol: eg.HealthCheckProtocol,
                              healthCheckIntervalSeconds: eg.HealthCheckIntervalSeconds,
                              thresholdCount: eg.ThresholdCount,
                              trafficDialPercentage: eg.TrafficDialPercentage,
                              endpointDescriptions: eg.EndpointDescriptions?.map((ed) => ({
                                endpointId: ed.EndpointId,
                                weight: ed.Weight,
                                healthState: ed.HealthState,
                                healthReason: ed.HealthReason,
                                clientIPPreservationEnabled: ed.ClientIPPreservationEnabled,
                              })),
                            });
                          }
                        }
                        egToken = egResp.NextToken;
                      } while (egToken);
                    } catch { /* ignore */ }

                    listeners.push({
                      listenerArn: listener.ListenerArn,
                      protocol: listener.Protocol,
                      clientAffinity: listener.ClientAffinity,
                      portRanges: listener.PortRanges?.map((pr) => ({
                        fromPort: pr.FromPort,
                        toPort: pr.ToPort,
                      })),
                      endpointGroups,
                    });
                  }
                }
                listenerToken = listenerResp.NextToken;
              } while (listenerToken);
            } catch { /* ignore */ }

            // Fetch tags
            let tags: Record<string, string> = {};
            try {
              const tagsResp = await this.withRateLimit(() =>
                client.send(new ListTagsForResourceCommand({ ResourceArn: accelerator.AcceleratorArn }))
              );
              if (tagsResp.Tags) {
                for (const tag of tagsResp.Tags) {
                  if (tag.Key) tags[tag.Key] = tag.Value || '';
                }
              }
            } catch { /* ignore */ }

            const ipAddresses = accelerator.IpSets?.flatMap((ipSet) => ipSet.IpAddresses || []) || [];

            resources.push(this.createResource(
              accelerator.AcceleratorArn,
              'accelerator',
              accelerator.Name || '',
              {
                acceleratorName: accelerator.Name,
                status: accelerator.Status,
                enabled: accelerator.Enabled,
                dnsName: accelerator.DnsName,
                ipAddressType: accelerator.IpAddressType,
                ipAddresses,
                ipSets: accelerator.IpSets?.map((ipSet) => ({
                  ipFamily: ipSet.IpFamily,
                  ipAddresses: ipSet.IpAddresses,
                })),
                dualStackDnsName: accelerator.DualStackDnsName,
                listeners,
              },
              tags,
              accelerator.CreatedTime?.toISOString(),
            ));
          }
        }
        nextToken = response.NextToken;
      } while (nextToken);
    } catch (error) { errors.push(this.createError('ListAccelerators', error)); }

    return { resources, errors };
  }
}

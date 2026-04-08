// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  DescribeLoadBalancersCommand,
  DescribeTargetGroupsCommand,
  DescribeListenersCommand,
  DescribeTagsCommand,
  type LoadBalancer,
  type TargetGroup,
} from '@aws-sdk/client-elastic-load-balancing-v2';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class ALBScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'alb', 'elb');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];

    // Scan load balancers and target groups in parallel
    const [lbResult, tgResult] = await Promise.allSettled([
      this.scanLoadBalancers(),
      this.scanTargetGroups(),
    ]);

    if (lbResult.status === 'fulfilled') {
      resources.push(...lbResult.value.resources);
      errors.push(...lbResult.value.errors);
    } else {
      errors.push(this.createError('DescribeLoadBalancers', lbResult.reason));
    }

    if (tgResult.status === 'fulfilled') {
      resources.push(...tgResult.value.resources);
      errors.push(...tgResult.value.errors);
    } else {
      errors.push(this.createError('DescribeTargetGroups', tgResult.reason));
    }

    return { resources, errors };
  }

  private async scanLoadBalancers(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getELBv2Client({
      profile: this.config.profile,
      region: this.config.region,
    });

    try {
      let marker: string | undefined;

      do {
        const response = await this.withRateLimit(() =>
          client.send(new DescribeLoadBalancersCommand({ Marker: marker }))
        );

        if (response.LoadBalancers) {
          // Get tags for all load balancers
          const arns = response.LoadBalancers
            .map((lb) => lb.LoadBalancerArn)
            .filter((arn): arn is string => !!arn);

          const tags = arns.length > 0 ? await this.getResourceTags(arns) : {};

          for (const lb of response.LoadBalancers) {
            // Get listeners for this load balancer
            let listeners: unknown[] = [];
            try {
              const listenersResponse = await this.withRateLimit(() =>
                client.send(
                  new DescribeListenersCommand({
                    LoadBalancerArn: lb.LoadBalancerArn,
                  })
                )
              );
              listeners =
                listenersResponse.Listeners?.map((l) => ({
                  listenerArn: l.ListenerArn,
                  port: l.Port,
                  protocol: l.Protocol,
                  defaultActions: l.DefaultActions?.map((a) => ({
                    type: a.Type,
                    targetGroupArn: a.TargetGroupArn,
                  })),
                })) || [];
            } catch {
              // Ignore listener errors
            }

            resources.push(
              this.mapLoadBalancer(lb, tags[lb.LoadBalancerArn || ''] || {}, listeners)
            );
          }
        }

        marker = response.NextMarker;
      } while (marker);
    } catch (error) {
      errors.push(this.createError('DescribeLoadBalancers', error));
    }

    return { resources, errors };
  }

  private async scanTargetGroups(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getELBv2Client({
      profile: this.config.profile,
      region: this.config.region,
    });

    try {
      let marker: string | undefined;

      do {
        const response = await this.withRateLimit(() =>
          client.send(new DescribeTargetGroupsCommand({ Marker: marker }))
        );

        if (response.TargetGroups) {
          // Get tags for all target groups
          const arns = response.TargetGroups
            .map((tg) => tg.TargetGroupArn)
            .filter((arn): arn is string => !!arn);

          const tags = arns.length > 0 ? await this.getResourceTags(arns) : {};

          for (const tg of response.TargetGroups) {
            resources.push(
              this.mapTargetGroup(tg, tags[tg.TargetGroupArn || ''] || {})
            );
          }
        }

        marker = response.NextMarker;
      } while (marker);
    } catch (error) {
      errors.push(this.createError('DescribeTargetGroups', error));
    }

    return { resources, errors };
  }

  private async getResourceTags(arns: string[]): Promise<Record<string, Record<string, string>>> {
    const client = getClientFactory().getELBv2Client({
      profile: this.config.profile,
      region: this.config.region,
    });

    const result: Record<string, Record<string, string>> = {};

    try {
      // DescribeTags can handle up to 20 ARNs at once
      for (let i = 0; i < arns.length; i += 20) {
        const batch = arns.slice(i, i + 20);
        const response = await this.withRateLimit(() =>
          client.send(new DescribeTagsCommand({ ResourceArns: batch }))
        );

        if (response.TagDescriptions) {
          for (const desc of response.TagDescriptions) {
            if (desc.ResourceArn && desc.Tags) {
              result[desc.ResourceArn] = this.parseTags(desc.Tags);
            }
          }
        }
      }
    } catch {
      // Ignore tag errors
    }

    return result;
  }

  private mapLoadBalancer(
    lb: LoadBalancer,
    tags: Record<string, string>,
    listeners: unknown[]
  ): Resource {
    return this.createResource(
      lb.LoadBalancerArn || '',
      'load-balancer',
      lb.LoadBalancerName || '',
      {
        loadBalancerName: lb.LoadBalancerName,
        loadBalancerArn: lb.LoadBalancerArn,
        dnsName: lb.DNSName,
        canonicalHostedZoneId: lb.CanonicalHostedZoneId,
        scheme: lb.Scheme,
        type: lb.Type,
        state: lb.State?.Code,
        vpcId: lb.VpcId,
        availabilityZones: lb.AvailabilityZones?.map((az) => ({
          zoneName: az.ZoneName,
          subnetId: az.SubnetId,
          loadBalancerAddresses: az.LoadBalancerAddresses,
        })),
        securityGroups: lb.SecurityGroups,
        ipAddressType: lb.IpAddressType,
        listeners,
      },
      tags,
      lb.CreatedTime?.toISOString()
    );
  }

  private mapTargetGroup(tg: TargetGroup, tags: Record<string, string>): Resource {
    return this.createResource(
      tg.TargetGroupArn || '',
      'target-group',
      tg.TargetGroupName || '',
      {
        targetGroupName: tg.TargetGroupName,
        targetGroupArn: tg.TargetGroupArn,
        protocol: tg.Protocol,
        port: tg.Port,
        vpcId: tg.VpcId,
        healthCheckProtocol: tg.HealthCheckProtocol,
        healthCheckPort: tg.HealthCheckPort,
        healthCheckPath: tg.HealthCheckPath,
        healthCheckIntervalSeconds: tg.HealthCheckIntervalSeconds,
        healthCheckTimeoutSeconds: tg.HealthCheckTimeoutSeconds,
        healthyThresholdCount: tg.HealthyThresholdCount,
        unhealthyThresholdCount: tg.UnhealthyThresholdCount,
        targetType: tg.TargetType,
        loadBalancerArns: tg.LoadBalancerArns,
        ipAddressType: tg.IpAddressType,
      },
      tags
    );
  }
}

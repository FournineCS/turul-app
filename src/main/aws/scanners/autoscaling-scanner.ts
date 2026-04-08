// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  DescribeAutoScalingGroupsCommand,
  DescribePoliciesCommand,
} from '@aws-sdk/client-auto-scaling';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class AutoScalingScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'autoscaling', 'autoscaling');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getAutoScalingClient({
      profile: this.config.profile,
      region: this.config.region,
    });

    try {
      let nextToken: string | undefined;

      do {
        const response = await this.withRateLimit(() =>
          client.send(new DescribeAutoScalingGroupsCommand({ NextToken: nextToken }))
        );

        if (response.AutoScalingGroups) {
          for (const asg of response.AutoScalingGroups) {
            if (!asg.AutoScalingGroupARN) continue;

            const tags: Record<string, string> = {};
            if (asg.Tags) {
              for (const tag of asg.Tags) {
                if (tag.Key) tags[tag.Key] = tag.Value || '';
              }
            }

            // Get scaling policies
            let policies: {
              policyName?: string;
              policyType?: string;
              scalingAdjustment?: number;
              adjustmentType?: string;
            }[] = [];
            try {
              const policiesResp = await this.withRateLimit(() =>
                client.send(new DescribePoliciesCommand({ AutoScalingGroupName: asg.AutoScalingGroupName }))
              );
              policies = (policiesResp.ScalingPolicies || []).map(p => ({
                policyName: p.PolicyName,
                policyType: p.PolicyType,
                scalingAdjustment: p.ScalingAdjustment,
                adjustmentType: p.AdjustmentType,
              }));
            } catch {
              // Ignore scaling policy errors
            }

            resources.push(this.createResource(
              asg.AutoScalingGroupARN,
              'auto-scaling-group',
              this.getNameFromTags(tags) || asg.AutoScalingGroupName || '',
              {
                autoScalingGroupName: asg.AutoScalingGroupName,
                launchConfigurationName: asg.LaunchConfigurationName,
                launchTemplate: asg.LaunchTemplate ? {
                  id: asg.LaunchTemplate.LaunchTemplateId,
                  name: asg.LaunchTemplate.LaunchTemplateName,
                  version: asg.LaunchTemplate.Version,
                } : undefined,
                minSize: asg.MinSize,
                maxSize: asg.MaxSize,
                desiredCapacity: asg.DesiredCapacity,
                defaultCooldown: asg.DefaultCooldown,
                availabilityZones: asg.AvailabilityZones,
                healthCheckType: asg.HealthCheckType,
                healthCheckGracePeriod: asg.HealthCheckGracePeriod,
                instanceCount: asg.Instances?.length || 0,
                instances: asg.Instances?.map(i => ({
                  instanceId: i.InstanceId,
                  lifecycleState: i.LifecycleState,
                  healthStatus: i.HealthStatus,
                })),
                targetGroupARNs: asg.TargetGroupARNs,
                loadBalancerNames: asg.LoadBalancerNames,
                scalingPolicies: policies,
              },
              tags,
              asg.CreatedTime?.toISOString()
            ));
          }
        }

        nextToken = response.NextToken;
      } while (nextToken);
    } catch (error) {
      errors.push(this.createError('DescribeAutoScalingGroups', error));
    }

    return { resources, errors };
  }
}

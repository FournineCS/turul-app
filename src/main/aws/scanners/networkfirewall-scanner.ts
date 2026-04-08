// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  ListFirewallsCommand,
  DescribeFirewallCommand,
  ListFirewallPoliciesCommand,
  ListRuleGroupsCommand,
  ListTagsForResourceCommand,
} from '@aws-sdk/client-network-firewall';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class NetworkFirewallScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'networkfirewall', 'networkfirewall');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];

    const [firewallsResult, policiesResult, ruleGroupsResult] = await Promise.allSettled([
      this.scanFirewalls(),
      this.scanFirewallPolicies(),
      this.scanRuleGroups(),
    ]);

    if (firewallsResult.status === 'fulfilled') { resources.push(...firewallsResult.value.resources); errors.push(...firewallsResult.value.errors); }
    else errors.push(this.createError('ListFirewalls', firewallsResult.reason));
    if (policiesResult.status === 'fulfilled') { resources.push(...policiesResult.value.resources); errors.push(...policiesResult.value.errors); }
    else errors.push(this.createError('ListFirewallPolicies', policiesResult.reason));
    if (ruleGroupsResult.status === 'fulfilled') { resources.push(...ruleGroupsResult.value.resources); errors.push(...ruleGroupsResult.value.errors); }
    else errors.push(this.createError('ListRuleGroups', ruleGroupsResult.reason));

    return { resources, errors };
  }

  private async scanFirewalls(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getNetworkFirewallClient({ profile: this.config.profile, region: this.config.region });

    try {
      let nextToken: string | undefined;
      do {
        const response = await this.withRateLimit(() => client.send(new ListFirewallsCommand({ NextToken: nextToken })));
        if (response.Firewalls) {
          for (const firewall of response.Firewalls) {
            if (!firewall.FirewallArn) continue;

            let details: any = {};
            try {
              const descResp = await this.withRateLimit(() => client.send(new DescribeFirewallCommand({ FirewallArn: firewall.FirewallArn })));
              const fw = descResp.Firewall;
              const status = descResp.FirewallStatus;
              if (fw) {
                details = {
                  firewallName: fw.FirewallName,
                  firewallPolicyArn: fw.FirewallPolicyArn,
                  vpcId: fw.VpcId,
                  subnetMappings: fw.SubnetMappings?.map(s => ({
                    subnetId: s.SubnetId,
                    ipAddressType: s.IPAddressType,
                  })),
                  deleteProtection: fw.DeleteProtection,
                  subnetChangeProtection: fw.SubnetChangeProtection,
                  firewallPolicyChangeProtection: fw.FirewallPolicyChangeProtection,
                  description: fw.Description,
                  encryptionConfiguration: fw.EncryptionConfiguration ? {
                    type: fw.EncryptionConfiguration.Type,
                    keyId: fw.EncryptionConfiguration.KeyId,
                  } : undefined,
                };
              }
              if (status) {
                details.status = status.Status;
                details.configurationSyncStateSummary = status.ConfigurationSyncStateSummary;
              }
            } catch { /* ignore */ }

            let tags: Record<string, string> = {};
            try {
              const tagsResp = await this.withRateLimit(() => client.send(new ListTagsForResourceCommand({ ResourceArn: firewall.FirewallArn })));
              if (tagsResp.Tags) {
                for (const tag of tagsResp.Tags) {
                  if (tag.Key) tags[tag.Key] = tag.Value || '';
                }
              }
            } catch { /* ignore */ }

            resources.push(this.createResource(firewall.FirewallArn, 'firewall', firewall.FirewallName || '', {
              firewallName: firewall.FirewallName,
              ...details,
            }, tags));
          }
        }
        nextToken = response.NextToken;
      } while (nextToken);
    } catch (error) { errors.push(this.createError('ListFirewalls', error)); }
    return { resources, errors };
  }

  private async scanFirewallPolicies(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getNetworkFirewallClient({ profile: this.config.profile, region: this.config.region });

    try {
      let nextToken: string | undefined;
      do {
        const response = await this.withRateLimit(() => client.send(new ListFirewallPoliciesCommand({ NextToken: nextToken })));
        if (response.FirewallPolicies) {
          for (const policy of response.FirewallPolicies) {
            if (!policy.Arn) continue;

            let tags: Record<string, string> = {};
            try {
              const tagsResp = await this.withRateLimit(() => client.send(new ListTagsForResourceCommand({ ResourceArn: policy.Arn })));
              if (tagsResp.Tags) {
                for (const tag of tagsResp.Tags) {
                  if (tag.Key) tags[tag.Key] = tag.Value || '';
                }
              }
            } catch { /* ignore */ }

            resources.push(this.createResource(policy.Arn, 'firewall-policy', policy.Name || '', {
              policyName: policy.Name,
              policyArn: policy.Arn,
            }, tags));
          }
        }
        nextToken = response.NextToken;
      } while (nextToken);
    } catch (error) { errors.push(this.createError('ListFirewallPolicies', error)); }
    return { resources, errors };
  }

  private async scanRuleGroups(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getNetworkFirewallClient({ profile: this.config.profile, region: this.config.region });

    try {
      let nextToken: string | undefined;
      do {
        const response = await this.withRateLimit(() => client.send(new ListRuleGroupsCommand({ NextToken: nextToken })));
        if (response.RuleGroups) {
          for (const ruleGroup of response.RuleGroups) {
            if (!ruleGroup.Arn) continue;

            let tags: Record<string, string> = {};
            try {
              const tagsResp = await this.withRateLimit(() => client.send(new ListTagsForResourceCommand({ ResourceArn: ruleGroup.Arn })));
              if (tagsResp.Tags) {
                for (const tag of tagsResp.Tags) {
                  if (tag.Key) tags[tag.Key] = tag.Value || '';
                }
              }
            } catch { /* ignore */ }

            resources.push(this.createResource(ruleGroup.Arn, 'rule-group', ruleGroup.Name || '', {
              ruleGroupName: ruleGroup.Name,
              ruleGroupArn: ruleGroup.Arn,
            }, tags));
          }
        }
        nextToken = response.NextToken;
      } while (nextToken);
    } catch (error) { errors.push(this.createError('ListRuleGroups', error)); }
    return { resources, errors };
  }
}

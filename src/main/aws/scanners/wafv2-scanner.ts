// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  ListWebACLsCommand,
  GetWebACLCommand,
  ListTagsForResourceCommand,
} from '@aws-sdk/client-wafv2';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class WAFV2Scanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'wafv2', 'wafv2');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];

    // Scan REGIONAL scope
    const regionalResult = await this.scanScope('REGIONAL');
    resources.push(...regionalResult.resources);
    errors.push(...regionalResult.errors);

    return { resources, errors };
  }

  private async scanScope(scope: 'REGIONAL' | 'CLOUDFRONT'): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getWAFV2Client({ profile: this.config.profile, region: this.config.region });

    try {
      let nextMarker: string | undefined;
      do {
        const response = await this.withRateLimit(() => client.send(new ListWebACLsCommand({ Scope: scope, NextMarker: nextMarker })));
        if (response.WebACLs) {
          for (const acl of response.WebACLs) {
            if (!acl.ARN) continue;

            let details: any = {};
            try {
              const aclResp = await this.withRateLimit(() => client.send(new GetWebACLCommand({ Name: acl.Name, Scope: scope, Id: acl.Id })));
              const webAcl = aclResp.WebACL;
              if (webAcl) {
                details = {
                  defaultAction: webAcl.DefaultAction?.Allow ? 'ALLOW' : 'BLOCK',
                  rules: webAcl.Rules?.map(r => ({
                    name: r.Name,
                    priority: r.Priority,
                    action: r.Action?.Allow ? 'ALLOW' : r.Action?.Block ? 'BLOCK' : r.Action?.Count ? 'COUNT' : 'OVERRIDE',
                  })),
                  ruleCount: webAcl.Rules?.length || 0,
                  capacity: webAcl.Capacity,
                  managedByFirewallManager: webAcl.ManagedByFirewallManager,
                };
              }
            } catch { /* ignore */ }

            let tags: Record<string, string> = {};
            try {
              const tagsResp = await this.withRateLimit(() => client.send(new ListTagsForResourceCommand({ ResourceARN: acl.ARN })));
              if (tagsResp.TagInfoForResource?.TagList) {
                for (const tag of tagsResp.TagInfoForResource.TagList) {
                  if (tag.Key) tags[tag.Key] = tag.Value || '';
                }
              }
            } catch { /* ignore */ }

            resources.push(this.createResource(acl.ARN, 'web-acl', acl.Name || '', {
              webAclId: acl.Id,
              webAclName: acl.Name,
              scope,
              lockToken: acl.LockToken,
              ...details,
            }, tags));
          }
        }
        nextMarker = response.NextMarker;
      } while (nextMarker);
    } catch (error) { errors.push(this.createError(`ListWebACLs:${scope}`, error)); }

    return { resources, errors };
  }
}

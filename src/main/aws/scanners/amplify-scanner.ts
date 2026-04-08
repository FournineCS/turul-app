// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { ListAppsCommand, ListBranchesCommand, ListDomainAssociationsCommand, ListTagsForResourceCommand } from '@aws-sdk/client-amplify';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class AmplifyScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'amplify', 'amplify');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getAmplifyClient({ profile: this.config.profile, region: this.config.region });

    try {
      let nextToken: string | undefined;
      do {
        const response = await this.withRateLimit(() => client.send(new ListAppsCommand({ nextToken, maxResults: 50 })));
        if (response.apps) {
          for (const app of response.apps) {
            if (!app.appArn) continue;

            let branches: any[] = [];
            try {
              const brResp = await this.withRateLimit(() => client.send(new ListBranchesCommand({ appId: app.appId!, maxResults: 50 })));
              branches = (brResp.branches || []).map(b => ({
                branchName: b.branchName, stage: b.stage, displayName: b.displayName,
                enableAutoBuild: b.enableAutoBuild, framework: b.framework,
              }));
            } catch { /* ignore */ }

            let domains: any[] = [];
            try {
              const domResp = await this.withRateLimit(() => client.send(new ListDomainAssociationsCommand({ appId: app.appId!, maxResults: 50 })));
              domains = (domResp.domainAssociations || []).map(d => ({
                domainName: d.domainName, domainStatus: d.domainStatus, enableAutoSubDomain: d.enableAutoSubDomain,
              }));
            } catch { /* ignore */ }

            const tags = app.tags || {};

            resources.push(this.createResource(app.appArn, 'app', app.name || app.appId || '', {
              appName: app.name,
              appId: app.appId,
              platform: app.platform,
              repository: app.repository,
              defaultDomain: app.defaultDomain,
              enableBranchAutoBuild: app.enableBranchAutoBuild,
              iamServiceRoleArn: app.iamServiceRoleArn,
              productionBranch: app.productionBranch ? { branchName: app.productionBranch.branchName, status: app.productionBranch.status } : undefined,
              branches,
              customDomains: domains,
            }, tags, app.createTime?.toISOString()));
          }
        }
        nextToken = response.nextToken;
      } while (nextToken);
    } catch (error) { errors.push(this.createError('ListApps', error)); }

    return { resources, errors };
  }
}

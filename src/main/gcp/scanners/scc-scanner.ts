// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GCPBaseScanner, GCPScannerConfig, GCPScanResult } from './base-scanner';
import { getGCPClientFactory } from '../client-factory';

export class SecurityCommandCenterScanner extends GCPBaseScanner {
  constructor(config: GCPScannerConfig) {
    super(config, 'security-command-center', 'Security Command Center');
  }

  async scan(): Promise<GCPScanResult> {
    const resources: GCPScanResult['resources'] = [];
    const errors: GCPScanResult['errors'] = [];
    const factory = getGCPClientFactory(this.config.projectId);
    const client = await factory.getSecurityCenterClient();
    const { resolveSccParent } = await import('../security/scc-client');

    try {
      // Resolve the right parent (org if discoverable, else project) and apply
      // a project-scoped resource filter when querying org-wide.
      const parentInfo = await resolveSccParent(this.config.projectId);
      const filter = parentInfo.resourceFilter
        ? `state="ACTIVE" AND ${parentInfo.resourceFilter}`
        : 'state="ACTIVE"';
      const iterable = client.listFindingsAsync({
        parent: parentInfo.parent,
        filter,
      });

      let count = 0;
      const maxFindings = 1000;

      for await (const findingResult of iterable) {
        if (count >= maxFindings) break;
        count++;

        const finding = findingResult.finding;
        if (!finding) continue;

        const name = finding.name || '';
        const shortName = name.split('/').pop() || name;
        const category = (finding.category as string) || 'unknown';

        resources.push(this.createResource(
          name,
          'finding',
          `${category}:${shortName}`,
          'global',
          {
            name: finding.name,
            category: finding.category,
            severity: finding.severity,
            state: finding.state,
            resourceName: finding.resourceName,
            sourceProperties: finding.sourceProperties,
            createTime: finding.createTime,
            eventTime: finding.eventTime,
            findingClass: finding.findingClass,
          },
          {},
          finding.createTime
            ? this.parseTimestamp(
                typeof finding.createTime === 'object' && finding.createTime !== null && 'seconds' in finding.createTime
                  ? new Date(Number((finding.createTime as { seconds: number | string }).seconds) * 1000).toISOString()
                  : String(finding.createTime)
              )
            : undefined,
        ));
      }
    } catch (error) {
      if (!this.isApiNotEnabled(error)) {
        errors.push(this.createError('listFindings', error));
      }
    }

    return { resources, errors };
  }
}

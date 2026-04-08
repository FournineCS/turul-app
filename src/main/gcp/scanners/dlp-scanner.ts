// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GCPBaseScanner, GCPScannerConfig, GCPScanResult } from './base-scanner';
import { getGCPClientFactory } from '../client-factory';

export class DLPScanner extends GCPBaseScanner {
  constructor(config: GCPScannerConfig) {
    super(config, 'cloud-dlp', 'Cloud DLP');
  }

  async scan(): Promise<GCPScanResult> {
    const resources: GCPScanResult['resources'] = [];
    const errors: GCPScanResult['errors'] = [];
    const factory = getGCPClientFactory(this.config.projectId);
    const client = factory.getDlpClient();

    try {
      const iterable = client.listInspectTemplatesAsync({
        parent: `projects/${this.config.projectId}`,
      });

      for await (const template of iterable) {
        const name = template.name || '';
        // Template name format: projects/{project}/inspectTemplates/{template}
        const shortName = name.split('/').pop() || name;

        resources.push(this.createResource(
          name,
          'inspect-template',
          template.displayName || shortName,
          'global',
          {
            name: template.name,
            displayName: template.displayName,
            description: template.description,
            createTime: template.createTime,
            updateTime: template.updateTime,
            inspectConfig: template.inspectConfig,
          },
          {},
          template.createTime
            ? this.parseTimestamp(
                typeof template.createTime === 'object' && template.createTime !== null && 'seconds' in template.createTime
                  ? new Date(Number((template.createTime as { seconds: number | string }).seconds) * 1000).toISOString()
                  : String(template.createTime)
              )
            : undefined,
        ));
      }
    } catch (error) {
      if (!this.isApiNotEnabled(error)) {
        errors.push(this.createError('listInspectTemplates', error));
      }
    }

    return { resources, errors };
  }
}

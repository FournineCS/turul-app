// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GCPBaseScanner, GCPScannerConfig, GCPScanResult } from './base-scanner';
import { getGCPClientFactory } from '../client-factory';

export class CloudBuildScanner extends GCPBaseScanner {
  constructor(config: GCPScannerConfig) {
    super(config, 'cloud-build', 'Cloud Build');
  }

  async scan(): Promise<GCPScanResult> {
    const resources: GCPScanResult['resources'] = [];
    const errors: GCPScanResult['errors'] = [];
    const factory = getGCPClientFactory(this.config.projectId);
    const client = factory.getCloudBuildClient();

    try {
      const iterable = client.listBuildTriggersAsync({
        projectId: this.config.projectId,
      });

      for await (const trigger of iterable) {
        const id = trigger.id || '';
        const name = trigger.name || id;

        resources.push(this.createResource(
          `projects/${this.config.projectId}/triggers/${id}`,
          'build-trigger',
          name,
          'global',
          {
            id: trigger.id,
            name: trigger.name,
            description: trigger.description,
            filename: trigger.filename,
            triggerTemplate: trigger.triggerTemplate,
            github: trigger.github,
            createTime: trigger.createTime,
            disabled: trigger.disabled,
            substitutions: trigger.substitutions,
            tags: trigger.tags,
          },
          {},
          trigger.createTime
            ? this.parseTimestamp(
                typeof trigger.createTime === 'object' && trigger.createTime !== null && 'seconds' in trigger.createTime
                  ? new Date(Number((trigger.createTime as { seconds: number | string }).seconds) * 1000).toISOString()
                  : String(trigger.createTime)
              )
            : undefined,
        ));
      }
    } catch (error) {
      if (!this.isApiNotEnabled(error)) {
        errors.push(this.createError('listBuildTriggers', error));
      }
    }

    return { resources, errors };
  }
}

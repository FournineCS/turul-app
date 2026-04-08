// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GCPBaseScanner, GCPScannerConfig, GCPScanResult } from './base-scanner';
import { getGCPClientFactory } from '../client-factory';

export class AssetInventoryScanner extends GCPBaseScanner {
  constructor(config: GCPScannerConfig) {
    super(config, 'cloud-asset-inventory', 'Cloud Asset Inventory');
  }

  async scan(): Promise<GCPScanResult> {
    const resources: GCPScanResult['resources'] = [];
    const errors: GCPScanResult['errors'] = [];
    const factory = getGCPClientFactory(this.config.projectId);
    const client = factory.getAssetClient();

    try {
      const request = {
        scope: `projects/${this.config.projectId}`,
        assetTypes: ['*'],
        pageSize: 500,
      };

      const iterable = client.searchAllResourcesAsync(request);

      let count = 0;
      const maxResources = 1000;

      for await (const asset of iterable) {
        if (count >= maxResources) break;
        count++;

        const name = asset.name || '';
        const displayName = (asset.displayName as string) || name.split('/').pop() || name;
        const location = (asset.location as string) || 'global';

        resources.push(this.createResource(
          name,
          'asset',
          displayName,
          location,
          {
            name: asset.name,
            assetType: asset.assetType,
            project: asset.project,
            displayName: asset.displayName,
            location: asset.location,
            labels: asset.labels,
            networkTags: asset.networkTags,
            createTime: asset.createTime,
            updateTime: asset.updateTime,
            state: asset.state,
          },
          this.parseLabels(asset.labels as Record<string, string>),
          asset.createTime
            ? this.parseTimestamp(
                typeof asset.createTime === 'object' && asset.createTime !== null && 'seconds' in asset.createTime
                  ? new Date(Number((asset.createTime as { seconds: number | string }).seconds) * 1000).toISOString()
                  : String(asset.createTime)
              )
            : undefined,
        ));
      }
    } catch (error) {
      if (!this.isApiNotEnabled(error)) {
        errors.push(this.createError('searchAllResources', error));
      }
    }

    return { resources, errors };
  }
}

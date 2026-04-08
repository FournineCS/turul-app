// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GCPBaseScanner, GCPScannerConfig, GCPScanResult } from './base-scanner';
import { getGCPClientFactory } from '../client-factory';

export class ArtifactRegistryScanner extends GCPBaseScanner {
  constructor(config: GCPScannerConfig) {
    super(config, 'artifact-registry', 'Artifact Registry');
  }

  async scan(): Promise<GCPScanResult> {
    const resources: GCPScanResult['resources'] = [];
    const errors: GCPScanResult['errors'] = [];
    const factory = getGCPClientFactory(this.config.projectId);
    const client = factory.getArtifactRegistryClient();

    try {
      const iterable = client.listRepositoriesAsync({
        parent: `projects/${this.config.projectId}/locations/-`,
      });

      for await (const repo of iterable) {
        const name = repo.name || '';
        // Repository name format: projects/{project}/locations/{location}/repositories/{repository}
        const locationMatch = name.match(/\/locations\/([^/]+)/);
        const region = locationMatch ? locationMatch[1] : 'global';
        const shortName = name.split('/').pop() || name;

        resources.push(this.createResource(
          name,
          'repository',
          shortName,
          region,
          {
            name: repo.name,
            format: repo.format,
            description: repo.description,
            labels: repo.labels,
            sizeBytes: repo.sizeBytes,
            createTime: repo.createTime,
            updateTime: repo.updateTime,
            mode: repo.mode,
          },
          this.parseLabels(repo.labels as Record<string, string>),
          repo.createTime
            ? this.parseTimestamp(
                typeof repo.createTime === 'object' && repo.createTime !== null && 'seconds' in repo.createTime
                  ? new Date(Number((repo.createTime as { seconds: number | string }).seconds) * 1000).toISOString()
                  : String(repo.createTime)
              )
            : undefined,
        ));
      }
    } catch (error) {
      if (!this.isApiNotEnabled(error)) {
        errors.push(this.createError('listRepositories', error));
      }
    }

    return { resources, errors };
  }
}

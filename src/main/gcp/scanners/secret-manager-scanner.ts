// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GCPBaseScanner, GCPScannerConfig, GCPScanResult } from './base-scanner';
import { getGCPClientFactory } from '../client-factory';

export class SecretManagerScanner extends GCPBaseScanner {
  constructor(config: GCPScannerConfig) {
    super(config, 'secret-manager', 'Secret Manager');
  }

  async scan(): Promise<GCPScanResult> {
    const resources: GCPScanResult['resources'] = [];
    const errors: GCPScanResult['errors'] = [];
    const factory = getGCPClientFactory(this.config.projectId);
    const client = factory.getSecretManagerClient();

    try {
      const iterable = client.listSecretsAsync({
        parent: `projects/${this.config.projectId}`,
      });

      for await (const secret of iterable) {
        const name = secret.name || '';
        // Secret name format: projects/{project}/secrets/{secret}
        const shortName = name.split('/').pop() || name;

        // Extract replication locations if available
        let region = 'global';
        if (secret.replication?.userManaged?.replicas && secret.replication.userManaged.replicas.length > 0) {
          region = secret.replication.userManaged.replicas[0].location || 'global';
        }

        resources.push(this.createResource(
          name,
          'secret',
          shortName,
          region,
          {
            name: secret.name,
            createTime: secret.createTime,
            replication: secret.replication,
            labels: secret.labels,
            expireTime: secret.expireTime,
            rotation: secret.rotation,
            versionAliases: secret.versionAliases,
          },
          this.parseLabels(secret.labels as Record<string, string>),
          secret.createTime
            ? this.parseTimestamp(
                typeof secret.createTime === 'object' && secret.createTime !== null && 'seconds' in secret.createTime
                  ? new Date(Number((secret.createTime as { seconds: number | string }).seconds) * 1000).toISOString()
                  : String(secret.createTime)
              )
            : undefined,
        ));
      }
    } catch (error) {
      if (!this.isApiNotEnabled(error)) {
        errors.push(this.createError('listSecrets', error));
      }
    }

    return { resources, errors };
  }
}

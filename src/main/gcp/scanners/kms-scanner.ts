// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GCPBaseScanner, GCPScannerConfig, GCPScanResult } from './base-scanner';
import { getGCPClientFactory } from '../client-factory';

export class KMSScanner extends GCPBaseScanner {
  constructor(config: GCPScannerConfig) {
    super(config, 'gcp-kms', 'Cloud KMS');
  }

  async scan(): Promise<GCPScanResult> {
    const resources: GCPScanResult['resources'] = [];
    const errors: GCPScanResult['errors'] = [];
    const factory = getGCPClientFactory(this.config.projectId);
    const client = factory.getKMSClient();

    try {
      // List all key rings across all locations
      const keyRingIterable = client.listKeyRingsAsync({
        parent: `projects/${this.config.projectId}/locations/-`,
      });

      for await (const keyRing of keyRingIterable) {
        const keyRingName = keyRing.name || '';
        // Key ring name format: projects/{project}/locations/{location}/keyRings/{keyRing}
        const locationMatch = keyRingName.match(/\/locations\/([^/]+)/);
        const region = locationMatch ? locationMatch[1] : 'global';
        const shortName = keyRingName.split('/').pop() || keyRingName;

        resources.push(this.createResource(
          keyRingName,
          'key-ring',
          shortName,
          region,
          {
            name: keyRing.name,
            createTime: keyRing.createTime,
          },
          {},
          keyRing.createTime
            ? this.parseTimestamp(
                typeof keyRing.createTime === 'object' && keyRing.createTime !== null && 'seconds' in keyRing.createTime
                  ? new Date(Number((keyRing.createTime as { seconds: number | string }).seconds) * 1000).toISOString()
                  : String(keyRing.createTime)
              )
            : undefined,
        ));

        // List crypto keys in each key ring
        try {
          const cryptoKeyIterable = client.listCryptoKeysAsync({
            parent: keyRingName,
          });

          for await (const key of cryptoKeyIterable) {
            const keyName = key.name || '';
            const keyShortName = keyName.split('/').pop() || keyName;

            resources.push(this.createResource(
              keyName,
              'crypto-key',
              keyShortName,
              region,
              {
                name: key.name,
                purpose: key.purpose,
                primary: key.primary ? {
                  state: key.primary.state,
                  algorithm: key.primary.algorithm,
                } : undefined,
                versionTemplate: key.versionTemplate,
                rotationPeriod: key.rotationPeriod,
                nextRotationTime: key.nextRotationTime,
                createTime: key.createTime,
                labels: key.labels,
              },
              this.parseLabels(key.labels as Record<string, string>),
              key.createTime
                ? this.parseTimestamp(
                    typeof key.createTime === 'object' && key.createTime !== null && 'seconds' in key.createTime
                      ? new Date(Number((key.createTime as { seconds: number | string }).seconds) * 1000).toISOString()
                      : String(key.createTime)
                  )
                : undefined,
            ));
          }
        } catch (keyError) {
          if (!this.isApiNotEnabled(keyError)) {
            errors.push(this.createError(`listCryptoKeys:${shortName}`, keyError));
          }
        }
      }
    } catch (error) {
      if (!this.isApiNotEnabled(error)) {
        errors.push(this.createError('listKeyRings', error));
      }
    }

    return { resources, errors };
  }
}

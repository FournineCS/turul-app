// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  ListKeysCommand,
  DescribeKeyCommand,
  ListAliasesCommand,
  ListResourceTagsCommand,
  type KeyMetadata,
  type AliasListEntry,
} from '@aws-sdk/client-kms';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class KMSScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'kms', 'kms');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getKMSClient({
      profile: this.config.profile,
      region: this.config.region,
    });

    // Get all aliases first to map them to keys
    const aliasMap = new Map<string, AliasListEntry[]>();
    try {
      let marker: string | undefined;

      do {
        const response = await this.withRateLimit(() =>
          client.send(new ListAliasesCommand({ Marker: marker }))
        );

        if (response.Aliases) {
          for (const alias of response.Aliases) {
            if (alias.TargetKeyId) {
              const existing = aliasMap.get(alias.TargetKeyId) || [];
              existing.push(alias);
              aliasMap.set(alias.TargetKeyId, existing);
            }
          }
        }

        marker = response.NextMarker;
      } while (marker);
    } catch (error) {
      errors.push(this.createError('ListAliases', error));
    }

    // Scan keys
    try {
      let marker: string | undefined;

      do {
        const response = await this.withRateLimit(() =>
          client.send(new ListKeysCommand({ Marker: marker }))
        );

        if (response.Keys) {
          for (const key of response.Keys) {
            try {
              // Get key details
              const detailResponse = await this.withRateLimit(() =>
                client.send(new DescribeKeyCommand({ KeyId: key.KeyId }))
              );

              if (detailResponse.KeyMetadata) {
                // Get tags
                let tags: Record<string, string> = {};
                try {
                  const tagsResponse = await this.withRateLimit(() =>
                    client.send(
                      new ListResourceTagsCommand({ KeyId: key.KeyId })
                    )
                  );
                  if (tagsResponse.Tags) {
                    for (const tag of tagsResponse.Tags) {
                      if (tag.TagKey) {
                        tags[tag.TagKey] = tag.TagValue || '';
                      }
                    }
                  }
                } catch {
                  // Ignore tag errors
                }

                const aliases = aliasMap.get(key.KeyId!) || [];
                resources.push(
                  this.mapKey(detailResponse.KeyMetadata, aliases, tags)
                );
              }
            } catch (error) {
              errors.push(this.createError(`DescribeKey:${key.KeyId}`, error));
            }
          }
        }

        marker = response.NextMarker;
      } while (marker);
    } catch (error) {
      errors.push(this.createError('ListKeys', error));
    }

    return { resources, errors };
  }

  private mapKey(
    key: KeyMetadata,
    aliases: AliasListEntry[],
    tags: Record<string, string>
  ): Resource {
    const primaryAlias = aliases.find((a) => !a.AliasName?.startsWith('alias/aws/'));
    const name = primaryAlias?.AliasName?.replace('alias/', '') || key.KeyId || '';

    return this.createResource(
      key.Arn || '',
      'key',
      name,
      {
        keyId: key.KeyId,
        arn: key.Arn,
        description: key.Description,
        keyState: key.KeyState,
        keyUsage: key.KeyUsage,
        keySpec: key.KeySpec,
        origin: key.Origin,
        customKeyStoreId: key.CustomKeyStoreId,
        cloudHsmClusterId: key.CloudHsmClusterId,
        expirationModel: key.ExpirationModel,
        keyManager: key.KeyManager,
        multiRegion: key.MultiRegion,
        multiRegionConfiguration: key.MultiRegionConfiguration
          ? {
              multiRegionKeyType: key.MultiRegionConfiguration.MultiRegionKeyType,
              primaryKey: key.MultiRegionConfiguration.PrimaryKey
                ? {
                    arn: key.MultiRegionConfiguration.PrimaryKey.Arn,
                    region: key.MultiRegionConfiguration.PrimaryKey.Region,
                  }
                : undefined,
              replicaKeys: key.MultiRegionConfiguration.ReplicaKeys?.map((r) => ({
                arn: r.Arn,
                region: r.Region,
              })),
            }
          : undefined,
        pendingDeletionWindowInDays: key.PendingDeletionWindowInDays,
        macAlgorithms: key.MacAlgorithms,
        xksKeyConfiguration: key.XksKeyConfiguration
          ? {
              id: key.XksKeyConfiguration.Id,
            }
          : undefined,
        creationDate: key.CreationDate?.toISOString(),
        deletionDate: key.DeletionDate?.toISOString(),
        validTo: key.ValidTo?.toISOString(),
        enabled: key.Enabled,
        encryptionAlgorithms: key.EncryptionAlgorithms,
        signingAlgorithms: key.SigningAlgorithms,
        aliases: aliases.map((a) => ({
          aliasName: a.AliasName,
          aliasArn: a.AliasArn,
          creationDate: a.CreationDate?.toISOString(),
          lastUpdatedDate: a.LastUpdatedDate?.toISOString(),
        })),
      },
      tags,
      key.CreationDate?.toISOString()
    );
  }
}

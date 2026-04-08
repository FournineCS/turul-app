// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  ListKeyspacesCommand,
  ListTablesCommand,
  GetTableCommand,
  ListTagsForResourceCommand,
} from '@aws-sdk/client-keyspaces';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class KeyspacesScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'keyspaces', 'keyspaces');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getKeyspacesClient({ profile: this.config.profile, region: this.config.region });

    try {
      let nextToken: string | undefined;
      do {
        const response = await this.withRateLimit(() => client.send(new ListKeyspacesCommand({ nextToken })));
        if (response.keyspaces) {
          for (const keyspace of response.keyspaces) {
            if (!keyspace.keyspaceName || !keyspace.resourceArn) continue;

            try {
              await this.scanTablesForKeyspace(client, keyspace.keyspaceName, keyspace.resourceArn, resources, errors);
            } catch (error) {
              errors.push(this.createError(`ListTables:${keyspace.keyspaceName}`, error));
            }
          }
        }
        nextToken = response.nextToken;
      } while (nextToken);
    } catch (error) {
      errors.push(this.createError('ListKeyspaces', error));
    }

    return { resources, errors };
  }

  private async scanTablesForKeyspace(
    client: ReturnType<ReturnType<typeof getClientFactory>['getKeyspacesClient']>,
    keyspaceName: string,
    keyspaceArn: string,
    resources: Resource[],
    errors: ScanResult['errors']
  ): Promise<void> {
    let nextToken: string | undefined;
    do {
      const response = await this.withRateLimit(() => client.send(new ListTablesCommand({ keyspaceName, nextToken })));
      if (response.tables) {
        for (const table of response.tables) {
          if (!table.tableName || !table.resourceArn) continue;

          let details: Record<string, unknown> = {
            keyspaceName,
            tableName: table.tableName,
          };
          let createdAt: string | undefined;

          try {
            const tableResp = await this.withRateLimit(() => client.send(new GetTableCommand({ keyspaceName, tableName: table.tableName })));
            if (tableResp) {
              details = {
                ...details,
                status: tableResp.status,
                capacityMode: tableResp.capacitySpecification?.throughputMode,
                readCapacityUnits: tableResp.capacitySpecification?.readCapacityUnits,
                writeCapacityUnits: tableResp.capacitySpecification?.writeCapacityUnits,
                encryptionType: tableResp.encryptionSpecification?.type,
                kmsKeyIdentifier: tableResp.encryptionSpecification?.kmsKeyIdentifier,
                pointInTimeRecoveryEnabled: tableResp.pointInTimeRecovery?.status,
                ttlStatus: tableResp.ttl?.status,
                defaultTimeToLive: tableResp.defaultTimeToLive,
                schemaDefinition: tableResp.schemaDefinition,
                comment: tableResp.comment?.message,
              };
              createdAt = tableResp.creationTimestamp?.toISOString();
            }
          } catch { /* ignore */ }

          let tags: Record<string, string> = {};
          try {
            const tagsResp = await this.withRateLimit(() => client.send(new ListTagsForResourceCommand({ resourceArn: table.resourceArn })));
            if (tagsResp.tags) {
              for (const tag of tagsResp.tags) {
                if (tag.key) tags[tag.key] = tag.value || '';
              }
            }
          } catch { /* ignore */ }

          resources.push(this.createResource(
            table.resourceArn,
            'table',
            `${keyspaceName}.${table.tableName}`,
            details,
            tags,
            createdAt
          ));
        }
      }
      nextToken = response.nextToken;
    } while (nextToken);
  }
}

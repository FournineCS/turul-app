// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GCPBaseScanner, GCPScannerConfig, GCPScanResult } from './base-scanner';
import { getGCPClientFactory } from '../client-factory';

export class BigQueryScanner extends GCPBaseScanner {
  constructor(config: GCPScannerConfig) {
    super(config, 'bigquery', 'BigQuery');
  }

  async scan(): Promise<GCPScanResult> {
    const resources: GCPScanResult['resources'] = [];
    const errors: GCPScanResult['errors'] = [];
    const factory = getGCPClientFactory(this.config.projectId);
    const client = factory.getBigQueryClient();

    try {
      const [datasets] = await client.getDatasets();

      for (const dataset of datasets) {
        const metadata = dataset.metadata;
        const datasetId = metadata.datasetReference?.datasetId || dataset.id || '';
        const location = (metadata.location || 'US').toLowerCase();

        resources.push(this.createResource(
          `projects/${this.config.projectId}/datasets/${datasetId}`,
          'dataset',
          datasetId,
          location,
          {
            id: datasetId,
            location: metadata.location,
            defaultTableExpirationMs: metadata.defaultTableExpirationMs,
            labels: metadata.labels,
            createdAt: metadata.creationTime,
          },
          this.parseLabels(metadata.labels as Record<string, string>),
          this.parseTimestamp(metadata.creationTime ? new Date(Number(metadata.creationTime)).toISOString() : undefined),
        ));

        // List tables for each dataset
        try {
          const [tables] = await dataset.getTables();

          for (const table of tables) {
            const tableMeta = table.metadata;
            const tableId = tableMeta.tableReference?.tableId || table.id || '';

            resources.push(this.createResource(
              `projects/${this.config.projectId}/datasets/${datasetId}/tables/${tableId}`,
              'table',
              `${datasetId}.${tableId}`,
              location,
              {
                id: tableId,
                datasetId,
                type: tableMeta.type,
                numRows: tableMeta.numRows,
                numBytes: tableMeta.numBytes,
                schemaFieldsCount: tableMeta.schema?.fields?.length || 0,
                createdAt: tableMeta.creationTime,
              },
              this.parseLabels(tableMeta.labels as Record<string, string>),
              this.parseTimestamp(tableMeta.creationTime ? new Date(Number(tableMeta.creationTime)).toISOString() : undefined),
            ));
          }
        } catch (tableError) {
          if (!this.isApiNotEnabled(tableError)) {
            errors.push(this.createError(`getTables:${datasetId}`, tableError));
          }
        }
      }
    } catch (error) {
      if (!this.isApiNotEnabled(error)) {
        errors.push(this.createError('getDatasets', error));
      }
    }

    return { resources, errors };
  }
}

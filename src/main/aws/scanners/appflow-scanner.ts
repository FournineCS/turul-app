// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  ListFlowsCommand,
  DescribeFlowCommand,
  ListConnectorsCommand,
  ListTagsForResourceCommand,
} from '@aws-sdk/client-appflow';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class AppFlowScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'appflow', 'appflow');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getAppFlowClient({ profile: this.config.profile, region: this.config.region });

    // Scan flows
    try {
      let nextToken: string | undefined;
      do {
        const response = await this.withRateLimit(() => client.send(new ListFlowsCommand({ nextToken })));
        if (response.flows) {
          for (const flow of response.flows) {
            if (!flow.flowArn) continue;

            let details: any = {};
            try {
              const descResp = await this.withRateLimit(() => client.send(new DescribeFlowCommand({ flowName: flow.flowName })));
              details = {
                sourceFlowConfig: descResp.sourceFlowConfig ? {
                  connectorType: descResp.sourceFlowConfig.connectorType,
                  connectorProfileName: descResp.sourceFlowConfig.connectorProfileName,
                  apiVersion: descResp.sourceFlowConfig.apiVersion,
                } : undefined,
                destinationFlowConfigList: descResp.destinationFlowConfigList?.map(d => ({
                  connectorType: d.connectorType,
                  connectorProfileName: d.connectorProfileName,
                  apiVersion: d.apiVersion,
                })),
                triggerConfig: descResp.triggerConfig ? {
                  triggerType: descResp.triggerConfig.triggerType,
                  triggerProperties: descResp.triggerConfig.triggerProperties?.Scheduled ? {
                    scheduleExpression: descResp.triggerConfig.triggerProperties.Scheduled.scheduleExpression,
                    dataPullMode: descResp.triggerConfig.triggerProperties.Scheduled.dataPullMode,
                    timezone: descResp.triggerConfig.triggerProperties.Scheduled.timezone,
                  } : undefined,
                } : undefined,
                kmsArn: descResp.kmsArn,
                flowStatusMessage: descResp.flowStatusMessage,
                metadataCatalogConfig: descResp.metadataCatalogConfig ? {
                  glueDataCatalog: descResp.metadataCatalogConfig.glueDataCatalog ? {
                    roleArn: descResp.metadataCatalogConfig.glueDataCatalog.roleArn,
                    databaseName: descResp.metadataCatalogConfig.glueDataCatalog.databaseName,
                    tablePrefix: descResp.metadataCatalogConfig.glueDataCatalog.tablePrefix,
                  } : undefined,
                } : undefined,
                schemaVersion: descResp.schemaVersion,
              };
            } catch { /* ignore */ }

            let tags: Record<string, string> = {};
            try {
              const tagsResp = await this.withRateLimit(() => client.send(new ListTagsForResourceCommand({ resourceArn: flow.flowArn })));
              tags = tagsResp.tags || {};
            } catch { /* ignore */ }

            resources.push(this.createResource(flow.flowArn, 'flow', flow.flowName || '', {
              flowName: flow.flowName,
              flowStatus: flow.flowStatus,
              triggerType: flow.triggerType,
              sourceConnectorType: flow.sourceConnectorType,
              sourceConnectorLabel: flow.sourceConnectorLabel,
              destinationConnectorType: flow.destinationConnectorType,
              destinationConnectorLabel: flow.destinationConnectorLabel,
              description: flow.description,
              lastRunExecutionDetails: flow.lastRunExecutionDetails ? {
                mostRecentExecutionMessage: flow.lastRunExecutionDetails.mostRecentExecutionMessage,
                mostRecentExecutionTime: flow.lastRunExecutionDetails.mostRecentExecutionTime?.toISOString(),
                mostRecentExecutionStatus: flow.lastRunExecutionDetails.mostRecentExecutionStatus,
              } : undefined,
              createdBy: flow.createdBy,
              lastUpdatedBy: flow.lastUpdatedBy,
              lastUpdatedAt: flow.lastUpdatedAt?.toISOString(),
              ...details,
            }, tags, flow.createdAt?.toISOString()));
          }
        }
        nextToken = response.nextToken;
      } while (nextToken);
    } catch (error) { errors.push(this.createError('ListFlows', error)); }

    // Scan custom connectors
    try {
      let nextToken: string | undefined;
      do {
        const response = await this.withRateLimit(() => client.send(new ListConnectorsCommand({ nextToken })));
        if (response.connectors) {
          for (const connector of response.connectors) {
            const connectorId = connector.connectorName || connector.connectorLabel || 'unknown';

            resources.push(this.createResource(connectorId, 'connector', connector.connectorName || connector.connectorLabel || '', {
              connectorName: connector.connectorName,
              connectorLabel: connector.connectorLabel,
              connectorDescription: connector.connectorDescription,
              connectorOwner: connector.connectorOwner,
              connectorVersion: connector.connectorVersion,
              connectorType: connector.connectorType,
              applicationType: connector.applicationType,
              connectorProvisioningType: connector.connectorProvisioningType,
              connectorModes: connector.connectorModes,
              supportedDataTransferTypes: connector.supportedDataTransferTypes,
              registeredAt: connector.registeredAt?.toISOString(),
              registeredBy: connector.registeredBy,
            }));
          }
        }
        nextToken = response.nextToken;
      } while (nextToken);
    } catch (error) { errors.push(this.createError('ListConnectors', error)); }

    return { resources, errors };
  }
}

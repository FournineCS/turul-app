// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GCPBaseScanner, GCPScannerConfig, GCPScanResult } from './base-scanner';
import { getGCPClientFactory } from '../client-factory';

export class DialogflowScanner extends GCPBaseScanner {
  constructor(config: GCPScannerConfig) {
    super(config, 'dialogflow', 'Dialogflow');
  }

  async scan(): Promise<GCPScanResult> {
    const resources: GCPScanResult['resources'] = [];
    const errors: GCPScanResult['errors'] = [];
    const factory = getGCPClientFactory(this.config.projectId);

    try {
      const client = factory.getDialogflowClient();
      const parent = `projects/${this.config.projectId}`;
      const [agent] = await client.getAgent({ parent });

      if (agent) {
        const displayName = agent.displayName || 'default-agent';

        resources.push(this.createResource(
          `${parent}/agent`,
          'agent',
          displayName,
          'global',
          {
            displayName: agent.displayName,
            defaultLanguageCode: agent.defaultLanguageCode,
            timeZone: agent.timeZone,
            description: agent.description,
            avatarUri: agent.avatarUri,
            enableLogging: agent.enableLogging,
            tier: agent.tier,
          },
          {},
        ));
      }
    } catch (error) {
      if (!this.isApiNotEnabled(error)) {
        errors.push(this.createError('getAgent', error));
      }
    }

    return { resources, errors };
  }
}

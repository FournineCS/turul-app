// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GCPBaseScanner, GCPScannerConfig, GCPScanResult } from './base-scanner';
import { google } from 'googleapis';

export class WorkflowsScanner extends GCPBaseScanner {
  constructor(config: GCPScannerConfig) {
    super(config, 'cloud-workflows', 'Cloud Workflows');
  }

  async scan(): Promise<GCPScanResult> {
    const resources: GCPScanResult['resources'] = [];
    const errors: GCPScanResult['errors'] = [];

    try {
      const auth = new google.auth.GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      });
      const workflows = google.workflows({ version: 'v1', auth });

      const response = await workflows.projects.locations.workflows.list({
        parent: `projects/${this.config.projectId}/locations/-`,
      });

      const workflowsList = response.data.workflows || [];

      for (const workflow of workflowsList) {
        const fullName = workflow.name || '';
        // Workflow name format: projects/{project}/locations/{location}/workflows/{workflow}
        const nameParts = fullName.split('/');
        const workflowName = nameParts.length >= 6 ? nameParts[5] : fullName;
        const location = nameParts.length >= 4 ? nameParts[3] : 'global';
        const region = this.extractRegionFromZone(location);

        resources.push(this.createResource(
          fullName,
          'workflow',
          workflowName,
          region,
          {
            name: workflowName,
            description: workflow.description,
            state: workflow.state,
            revisionId: workflow.revisionId,
            createTime: workflow.createTime,
            updateTime: workflow.updateTime,
            serviceAccount: workflow.serviceAccount,
            labels: workflow.labels,
          },
          this.parseLabels(workflow.labels as Record<string, string>),
          this.parseTimestamp(workflow.createTime as string),
        ));
      }
    } catch (error) {
      if (!this.isApiNotEnabled(error)) {
        errors.push(this.createError('listWorkflows', error));
      }
    }

    return { resources, errors };
  }
}

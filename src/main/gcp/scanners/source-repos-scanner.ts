// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GCPBaseScanner, GCPScannerConfig, GCPScanResult } from './base-scanner';
import { google } from 'googleapis';

export class SourceReposScanner extends GCPBaseScanner {
  constructor(config: GCPScannerConfig) {
    super(config, 'cloud-source-repos', 'Cloud Source Repositories');
  }

  async scan(): Promise<GCPScanResult> {
    const resources: GCPScanResult['resources'] = [];
    const errors: GCPScanResult['errors'] = [];

    try {
      const auth = new google.auth.GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      });
      const sourcerepo = google.sourcerepo({ version: 'v1', auth });

      const response = await sourcerepo.projects.repos.list({
        name: `projects/${this.config.projectId}`,
      });

      const repos = response.data.repos || [];

      for (const repo of repos) {
        const name = repo.name || '';
        // Repo name format: projects/{project}/repos/{repo}
        const shortName = name.split('/').pop() || name;

        resources.push(this.createResource(
          name,
          'source-repo',
          shortName,
          'global',
          {
            name: repo.name,
            size: repo.size,
            url: repo.url,
            mirrorConfig: repo.mirrorConfig,
          },
          {},
        ));
      }
    } catch (error) {
      if (!this.isApiNotEnabled(error)) {
        errors.push(this.createError('listRepos', error));
      }
    }

    return { resources, errors };
  }
}

// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { DescribeWorkspacesCommand, DescribeWorkspaceDirectoriesCommand } from '@aws-sdk/client-workspaces';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class WorkSpacesScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'workspaces', 'workspaces');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];

    const client = getClientFactory().getWorkSpacesClient({ profile: this.config.profile, region: this.config.region });

    // Scan Workspaces
    try {
      let nextToken: string | undefined;
      do {
        const command = new DescribeWorkspacesCommand({ NextToken: nextToken });
        const response = await this.withRateLimit(() => client.send(command));

        for (const ws of response.Workspaces || []) {
          const arn = `arn:aws:workspaces:${this.config.region}:workspace/${ws.WorkspaceId}`;
          const name = ws.UserName || ws.WorkspaceId || '';

          resources.push(this.createResource(
            arn,
            'workspace',
            name,
            {
              workspaceId: ws.WorkspaceId,
              userName: ws.UserName,
              directoryId: ws.DirectoryId,
              bundleId: ws.BundleId,
              state: ws.State,
              ipAddress: ws.IpAddress,
              computerName: ws.ComputerName,
              rootVolumeEncryptionEnabled: ws.RootVolumeEncryptionEnabled,
              userVolumeEncryptionEnabled: ws.UserVolumeEncryptionEnabled,
            },
          ));
        }

        nextToken = response.NextToken;
      } while (nextToken);
    } catch (err) {
      errors.push(this.createError('DescribeWorkspaces', err));
    }

    // Scan Workspace Directories
    try {
      let nextToken: string | undefined;
      do {
        const command = new DescribeWorkspaceDirectoriesCommand({ NextToken: nextToken });
        const response = await this.withRateLimit(() => client.send(command));

        for (const dir of response.Directories || []) {
          const arn = `arn:aws:workspaces:${this.config.region}:directory/${dir.DirectoryId}`;
          const name = dir.DirectoryName || dir.DirectoryId || '';

          resources.push(this.createResource(
            arn,
            'directory',
            name,
            {
              directoryId: dir.DirectoryId,
              directoryName: dir.DirectoryName,
              directoryType: dir.DirectoryType,
              state: dir.State,
              registrationCode: dir.RegistrationCode,
              alias: dir.Alias,
            },
          ));
        }

        nextToken = response.NextToken;
      } while (nextToken);
    } catch (err) {
      errors.push(this.createError('DescribeWorkspaceDirectories', err));
    }

    return { resources, errors };
  }
}

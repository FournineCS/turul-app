// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  DescribeFileSystemsCommand,
  DescribeMountTargetsCommand,
} from '@aws-sdk/client-efs';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class EFSScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'efs', 'efs');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getEFSClient({
      profile: this.config.profile,
      region: this.config.region,
    });

    try {
      let marker: string | undefined;

      do {
        const response = await this.withRateLimit(() =>
          client.send(new DescribeFileSystemsCommand({ Marker: marker }))
        );

        if (response.FileSystems) {
          for (const fs of response.FileSystems) {
            if (!fs.FileSystemArn) continue;

            const tags: Record<string, string> = {};
            if (fs.Tags) {
              for (const tag of fs.Tags) {
                if (tag.Key) tags[tag.Key] = tag.Value || '';
              }
            }

            // Get mount targets
            let mountTargets: any[] = [];
            try {
              const mtResponse = await this.withRateLimit(() =>
                client.send(new DescribeMountTargetsCommand({ FileSystemId: fs.FileSystemId }))
              );
              mountTargets = (mtResponse.MountTargets || []).map(mt => ({
                mountTargetId: mt.MountTargetId,
                fileSystemId: mt.FileSystemId,
                subnetId: mt.SubnetId,
                ipAddress: mt.IpAddress,
                lifeCycleState: mt.LifeCycleState,
                availabilityZoneName: mt.AvailabilityZoneName,
              }));
            } catch {
              // Ignore mount target errors
            }

            resources.push(this.createResource(
              fs.FileSystemArn,
              'file-system',
              this.getNameFromTags(tags) || fs.FileSystemId || '',
              {
                fileSystemId: fs.FileSystemId,
                lifeCycleState: fs.LifeCycleState,
                numberOfMountTargets: fs.NumberOfMountTargets,
                sizeInBytes: fs.SizeInBytes?.Value,
                performanceMode: fs.PerformanceMode,
                encrypted: fs.Encrypted,
                kmsKeyId: fs.KmsKeyId,
                throughputMode: fs.ThroughputMode,
                provisionedThroughputInMibps: fs.ProvisionedThroughputInMibps,
                availabilityZoneName: fs.AvailabilityZoneName,
                mountTargets,
              },
              tags,
              fs.CreationTime?.toISOString()
            ));
          }
        }

        marker = response.NextMarker;
      } while (marker);
    } catch (error) {
      errors.push(this.createError('DescribeFileSystems', error));
    }

    return { resources, errors };
  }
}

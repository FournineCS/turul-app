// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  DescribeSourceServersCommand,
  DescribeRecoveryInstancesCommand,
  ListTagsForResourceCommand,
} from '@aws-sdk/client-drs';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class DRSScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'drs', 'drs');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getDRSClient({
      profile: this.config.profile,
      region: this.config.region,
    });

    // Scan source servers
    try {
      let nextToken: string | undefined;

      do {
        const response = await this.withRateLimit(() =>
          client.send(new DescribeSourceServersCommand({
            filters: {},
            nextToken,
          }))
        );

        if (response.items) {
          for (const server of response.items) {
            if (!server.sourceServerID || !server.arn) continue;

            let tags: Record<string, string> = {};
            try {
              const tagsResp = await this.withRateLimit(() =>
                client.send(new ListTagsForResourceCommand({ resourceArn: server.arn }))
              );
              if (tagsResp.tags) {
                tags = tagsResp.tags as Record<string, string>;
              }
            } catch { /* ignore tag fetch errors */ }

            const name = server.sourceProperties?.identificationHints?.hostname
              || server.sourceServerID;

            resources.push(this.createResource(
              server.arn,
              'source-server',
              name,
              {
                sourceServerID: server.sourceServerID,
                lifeCycleLastSeenByService: server.lifeCycle?.lastSeenByServiceDateTime,
                lifeCycleAddedToService: server.lifeCycle?.addedToServiceDateTime,
                lifeCycleElapsedReplicationDuration: server.lifeCycle?.elapsedReplicationDuration,
                lifeCycleLastLaunch: server.lifeCycle?.lastLaunch ? {
                  status: server.lifeCycle.lastLaunch.status,
                  initiated: server.lifeCycle.lastLaunch.initiated ? {
                    apiCallDateTime: server.lifeCycle.lastLaunch.initiated.apiCallDateTime,
                    jobID: server.lifeCycle.lastLaunch.initiated.jobID,
                    type: server.lifeCycle.lastLaunch.initiated.type,
                  } : undefined,
                } : undefined,
                dataReplicationInfo: server.dataReplicationInfo ? {
                  dataReplicationState: server.dataReplicationInfo.dataReplicationState,
                  lagDuration: server.dataReplicationInfo.lagDuration,
                  etaDateTime: server.dataReplicationInfo.etaDateTime,
                  replicatedDisks: server.dataReplicationInfo.replicatedDisks?.map(d => ({
                    deviceName: d.deviceName,
                    totalStorageBytes: d.totalStorageBytes,
                    replicatedStorageBytes: d.replicatedStorageBytes,
                    backloggedStorageBytes: d.backloggedStorageBytes,
                  })),
                } : undefined,
                sourceProperties: server.sourceProperties ? {
                  hostname: server.sourceProperties.identificationHints?.hostname,
                  fqdn: server.sourceProperties.identificationHints?.fqdn,
                  os: server.sourceProperties.os ? {
                    fullString: server.sourceProperties.os.fullString,
                  } : undefined,
                  cpus: server.sourceProperties.cpus?.map(c => ({
                    cores: c.cores,
                    modelName: c.modelName,
                  })),
                  ramBytes: server.sourceProperties.ramBytes,
                  disks: server.sourceProperties.disks?.map(d => ({
                    deviceName: d.deviceName,
                    bytes: d.bytes,
                  })),
                  networkInterfaces: server.sourceProperties.networkInterfaces?.map(n => ({
                    macAddress: n.macAddress,
                    ips: n.ips,
                    isPrimary: n.isPrimary,
                  })),
                } : undefined,
                replicationDirection: server.replicationDirection,
                reversedDirectionSourceServerArn: server.reversedDirectionSourceServerArn,
              },
              tags,
            ));
          }
        }

        nextToken = response.nextToken;
      } while (nextToken);
    } catch (error: unknown) {
      if (this.isUninitializedAccountException(error)) {
        // DRS not initialized in this account/region - return empty results
        return { resources, errors };
      }
      errors.push(this.createError('DescribeSourceServers', error));
    }

    // Scan recovery instances
    try {
      let nextToken: string | undefined;

      do {
        const response = await this.withRateLimit(() =>
          client.send(new DescribeRecoveryInstancesCommand({
            filters: {},
            nextToken,
          }))
        );

        if (response.items) {
          for (const instance of response.items) {
            if (!instance.recoveryInstanceID || !instance.arn) continue;

            let tags: Record<string, string> = {};
            try {
              const tagsResp = await this.withRateLimit(() =>
                client.send(new ListTagsForResourceCommand({ resourceArn: instance.arn }))
              );
              if (tagsResp.tags) {
                tags = tagsResp.tags as Record<string, string>;
              }
            } catch { /* ignore tag fetch errors */ }

            resources.push(this.createResource(
              instance.arn,
              'recovery-instance',
              instance.recoveryInstanceID,
              {
                recoveryInstanceID: instance.recoveryInstanceID,
                sourceServerID: instance.sourceServerID,
                ec2InstanceID: instance.ec2InstanceID,
                ec2InstanceState: instance.ec2InstanceState,
                isDrill: instance.isDrill,
                pointInTimeSnapshotDateTime: instance.pointInTimeSnapshotDateTime,
                recoveryInstanceProperties: instance.recoveryInstanceProperties ? {
                  lastUpdatedDateTime: instance.recoveryInstanceProperties.lastUpdatedDateTime,
                  os: instance.recoveryInstanceProperties.os ? {
                    fullString: instance.recoveryInstanceProperties.os.fullString,
                  } : undefined,
                  cpus: instance.recoveryInstanceProperties.cpus?.map(c => ({
                    cores: c.cores,
                    modelName: c.modelName,
                  })),
                  ramBytes: instance.recoveryInstanceProperties.ramBytes,
                  disks: instance.recoveryInstanceProperties.disks?.map(d => ({
                    bytes: d.bytes,
                    ebsVolumeID: d.ebsVolumeID,
                    internalDeviceName: d.internalDeviceName,
                  })),
                } : undefined,
                dataReplicationInfo: instance.dataReplicationInfo ? {
                  dataReplicationState: instance.dataReplicationInfo.dataReplicationState,
                  lagDuration: instance.dataReplicationInfo.lagDuration,
                  etaDateTime: instance.dataReplicationInfo.etaDateTime,
                } : undefined,
                failback: instance.failback ? {
                  state: instance.failback.state,
                  agentLastSeenByServiceDateTime: instance.failback.agentLastSeenByServiceDateTime,
                  failbackInitiationTime: instance.failback.failbackInitiationTime,
                  failbackToOriginalServer: instance.failback.failbackToOriginalServer,
                } : undefined,
              },
              tags,
            ));
          }
        }

        nextToken = response.nextToken;
      } while (nextToken);
    } catch (error: unknown) {
      if (!this.isUninitializedAccountException(error)) {
        errors.push(this.createError('DescribeRecoveryInstances', error));
      }
    }

    return { resources, errors };
  }

  private isUninitializedAccountException(error: unknown): boolean {
    if (error instanceof Error) {
      return error.name === 'UninitializedAccountException'
        || error.message.includes('UninitializedAccountException');
    }
    return false;
  }
}

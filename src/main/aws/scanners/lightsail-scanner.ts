// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GetInstancesCommand, GetRelationalDatabasesCommand, GetLoadBalancersCommand, GetDisksCommand } from '@aws-sdk/client-lightsail';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class LightsailScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'lightsail', 'lightsail');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getLightsailClient({ profile: this.config.profile, region: this.config.region });

    // Instances
    try {
      let pageToken: string | undefined;
      do {
        const response = await this.withRateLimit(() => client.send(new GetInstancesCommand({ pageToken })));
        if (response.instances) {
          for (const inst of response.instances) {
            if (!inst.arn) continue;
            const tags: Record<string, string> = {};
            if (inst.tags) { for (const t of inst.tags) { if (t.key) tags[t.key] = t.value || ''; } }
            resources.push(this.createResource(inst.arn, 'instance', inst.name || '', {
              name: inst.name, state: inst.state?.name, bundleId: inst.bundleId,
              blueprintId: inst.blueprintId, blueprintName: inst.blueprintName,
              publicIpAddress: inst.publicIpAddress, privateIpAddress: inst.privateIpAddress,
              isStaticIp: inst.isStaticIp, ipv6Addresses: inst.ipv6Addresses,
              hardware: inst.hardware ? { cpuCount: inst.hardware.cpuCount, ramSizeInGb: inst.hardware.ramSizeInGb } : undefined,
            }, tags, inst.createdAt?.toISOString()));
          }
        }
        pageToken = response.nextPageToken;
      } while (pageToken);
    } catch (error) { errors.push(this.createError('GetInstances', error)); }

    // Relational Databases
    try {
      let pageToken: string | undefined;
      do {
        const response = await this.withRateLimit(() => client.send(new GetRelationalDatabasesCommand({ pageToken })));
        if (response.relationalDatabases) {
          for (const db of response.relationalDatabases) {
            if (!db.arn) continue;
            const tags: Record<string, string> = {};
            if (db.tags) { for (const t of db.tags) { if (t.key) tags[t.key] = t.value || ''; } }
            resources.push(this.createResource(db.arn, 'relational-database', db.name || '', {
              name: db.name, engine: db.engine, engineVersion: db.engineVersion,
              masterEndpoint: db.masterEndpoint ? { address: db.masterEndpoint.address, port: db.masterEndpoint.port } : undefined,
              state: db.state, relationalDatabaseBundleId: db.relationalDatabaseBundleId,
              masterDatabaseName: db.masterDatabaseName, masterUsername: db.masterUsername,
              backupRetentionEnabled: db.backupRetentionEnabled,
            }, tags, db.createdAt?.toISOString()));
          }
        }
        pageToken = response.nextPageToken;
      } while (pageToken);
    } catch (error) { errors.push(this.createError('GetRelationalDatabases', error)); }

    // Load Balancers
    try {
      let pageToken: string | undefined;
      do {
        const response = await this.withRateLimit(() => client.send(new GetLoadBalancersCommand({ pageToken })));
        if (response.loadBalancers) {
          for (const lb of response.loadBalancers) {
            if (!lb.arn) continue;
            const tags: Record<string, string> = {};
            if (lb.tags) { for (const t of lb.tags) { if (t.key) tags[t.key] = t.value || ''; } }
            resources.push(this.createResource(lb.arn, 'load-balancer', lb.name || '', {
              name: lb.name, dnsName: lb.dnsName, state: lb.state, protocol: lb.protocol,
              instancePort: lb.instancePort, healthCheckPath: lb.healthCheckPath,
              instanceHealthSummary: lb.instanceHealthSummary?.map(h => ({ instanceName: h.instanceName, instanceHealth: h.instanceHealth })),
            }, tags, lb.createdAt?.toISOString()));
          }
        }
        pageToken = response.nextPageToken;
      } while (pageToken);
    } catch (error) { errors.push(this.createError('GetLoadBalancers', error)); }

    return { resources, errors };
  }
}

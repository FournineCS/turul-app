// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GCPBaseScanner, GCPScannerConfig, GCPScanResult } from './base-scanner';
import { getGCPClientFactory } from '../client-factory';

export class MonitoringScanner extends GCPBaseScanner {
  constructor(config: GCPScannerConfig) {
    super(config, 'cloud-monitoring', 'Cloud Monitoring');
  }

  async scan(): Promise<GCPScanResult> {
    const resources: GCPScanResult['resources'] = [];
    const errors: GCPScanResult['errors'] = [];
    const factory = getGCPClientFactory(this.config.projectId);

    // Scan alert policies
    try {
      const alertClient = factory.getAlertPolicyClient();
      const iterable = alertClient.listAlertPoliciesAsync({
        name: `projects/${this.config.projectId}`,
      });

      for await (const policy of iterable) {
        const name = policy.name || '';
        const nameParts = name.split('/');
        const policyId = nameParts.length >= 4 ? nameParts[3] : name;

        resources.push(this.createResource(
          name,
          'alert-policy',
          policy.displayName || policyId,
          'global',
          {
            name: policy.displayName,
            conditions: policy.conditions?.map(c => ({
              displayName: c.displayName,
              name: c.name,
              conditionThreshold: c.conditionThreshold ? {
                filter: c.conditionThreshold.filter,
                comparison: c.conditionThreshold.comparison,
                thresholdValue: c.conditionThreshold.thresholdValue,
                duration: c.conditionThreshold.duration,
              } : undefined,
              conditionAbsent: c.conditionAbsent ? {
                filter: c.conditionAbsent.filter,
                duration: c.conditionAbsent.duration,
              } : undefined,
            })),
            combiner: policy.combiner,
            enabled: policy.enabled?.value ?? policy.enabled,
            notificationChannels: policy.notificationChannels,
            creationRecord: policy.creationRecord ? {
              mutateTime: policy.creationRecord.mutateTime ? new Date(Number(policy.creationRecord.mutateTime.seconds) * 1000).toISOString() : undefined,
              mutatedBy: policy.creationRecord.mutatedBy,
            } : undefined,
            documentation: policy.documentation ? {
              content: policy.documentation.content,
              mimeType: policy.documentation.mimeType,
            } : undefined,
          },
          this.parseLabels(policy.userLabels as Record<string, string>),
          this.parseTimestamp(policy.creationRecord?.mutateTime ? new Date(Number(policy.creationRecord.mutateTime.seconds) * 1000).toISOString() : undefined),
        ));
      }
    } catch (error) {
      if (!this.isApiNotEnabled(error)) {
        errors.push(this.createError('listAlertPolicies', error));
      }
    }

    // Scan uptime checks
    try {
      const uptimeClient = factory.getUptimeCheckClient();
      const iterable = uptimeClient.listUptimeCheckConfigsAsync({
        parent: `projects/${this.config.projectId}`,
      });

      for await (const check of iterable) {
        const name = check.name || '';
        const nameParts = name.split('/');
        const checkId = nameParts.length >= 4 ? nameParts[3] : name;

        resources.push(this.createResource(
          name,
          'uptime-check',
          check.displayName || checkId,
          'global',
          {
            name: check.displayName,
            monitoredResource: check.monitoredResource ? {
              type: check.monitoredResource.type,
              labels: check.monitoredResource.labels,
            } : undefined,
            httpCheck: check.httpCheck ? {
              path: check.httpCheck.path,
              port: check.httpCheck.port,
              useSsl: check.httpCheck.useSsl,
              requestMethod: check.httpCheck.requestMethod,
            } : undefined,
            tcpCheck: check.tcpCheck ? {
              port: check.tcpCheck.port,
            } : undefined,
            period: check.period ? {
              seconds: check.period.seconds,
            } : undefined,
            timeout: check.timeout ? {
              seconds: check.timeout.seconds,
            } : undefined,
            selectedRegions: check.selectedRegions,
          },
          {},
        ));
      }
    } catch (error) {
      if (!this.isApiNotEnabled(error)) {
        errors.push(this.createError('listUptimeCheckConfigs', error));
      }
    }

    return { resources, errors };
  }
}

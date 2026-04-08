// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  ListDetectorsCommand,
  GetDetectorCommand,
} from '@aws-sdk/client-guardduty';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class GuardDutyScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'guardduty', 'guardduty');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getGuardDutyClient({
      profile: this.config.profile,
      region: this.config.region,
    });

    try {
      let nextToken: string | undefined;

      do {
        const response = await this.withRateLimit(() =>
          client.send(new ListDetectorsCommand({ NextToken: nextToken }))
        );

        if (response.DetectorIds) {
          for (const detectorId of response.DetectorIds) {
            try {
              const detectorResp = await this.withRateLimit(() =>
                client.send(new GetDetectorCommand({ DetectorId: detectorId }))
              );

              const arn = `arn:aws:guardduty:${this.config.region}::detector/${detectorId}`;
              const tags: Record<string, string> = detectorResp.Tags || {};

              resources.push(this.createResource(
                arn,
                'detector',
                detectorId,
                {
                  detectorId,
                  status: detectorResp.Status,
                  findingPublishingFrequency: detectorResp.FindingPublishingFrequency,
                  serviceRole: detectorResp.ServiceRole,
                  dataSources: {
                    cloudTrail: detectorResp.DataSources?.CloudTrail?.Status,
                    dnsLogs: detectorResp.DataSources?.DNSLogs?.Status,
                    flowLogs: detectorResp.DataSources?.FlowLogs?.Status,
                    s3Logs: detectorResp.DataSources?.S3Logs?.Status,
                    kubernetes: detectorResp.DataSources?.Kubernetes?.AuditLogs?.Status,
                    malwareProtection: detectorResp.DataSources?.MalwareProtection?.ScanEc2InstanceWithFindings?.EbsVolumes?.Status,
                  },
                },
                tags,
                detectorResp.CreatedAt
              ));
            } catch (error) {
              errors.push(this.createError(`GetDetector:${detectorId}`, error));
            }
          }
        }

        nextToken = response.NextToken;
      } while (nextToken);
    } catch (error) {
      errors.push(this.createError('ListDetectors', error));
    }

    return { resources, errors };
  }
}

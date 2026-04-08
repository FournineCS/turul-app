// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  ListCertificatesCommand,
  DescribeCertificateCommand,
  ListTagsForCertificateCommand,
} from '@aws-sdk/client-acm';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class ACMScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'acm', 'acm');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getACMClient({ profile: this.config.profile, region: this.config.region });

    try {
      let nextToken: string | undefined;
      do {
        const response = await this.withRateLimit(() => client.send(new ListCertificatesCommand({ NextToken: nextToken })));
        if (response.CertificateSummaryList) {
          for (const cert of response.CertificateSummaryList) {
            if (!cert.CertificateArn) continue;

            let details: any = {};
            try {
              const descResp = await this.withRateLimit(() => client.send(new DescribeCertificateCommand({ CertificateArn: cert.CertificateArn })));
              const c = descResp.Certificate;
              if (c) {
                details = {
                  domainName: c.DomainName,
                  subjectAlternativeNames: c.SubjectAlternativeNames,
                  issuer: c.Issuer,
                  status: c.Status,
                  type: c.Type,
                  keyAlgorithm: c.KeyAlgorithm,
                  inUseBy: c.InUseBy,
                  renewalEligibility: c.RenewalEligibility,
                  notBefore: c.NotBefore?.toISOString(),
                  notAfter: c.NotAfter?.toISOString(),
                  serial: c.Serial,
                };
              }
            } catch { /* ignore */ }

            let tags: Record<string, string> = {};
            try {
              const tagsResp = await this.withRateLimit(() => client.send(new ListTagsForCertificateCommand({ CertificateArn: cert.CertificateArn })));
              if (tagsResp.Tags) {
                for (const tag of tagsResp.Tags) {
                  if (tag.Key) tags[tag.Key] = tag.Value || '';
                }
              }
            } catch { /* ignore */ }

            resources.push(this.createResource(cert.CertificateArn, 'certificate', cert.DomainName || '', {
              ...details,
              certificateArn: cert.CertificateArn,
            }, tags));
          }
        }
        nextToken = response.NextToken;
      } while (nextToken);
    } catch (error) { errors.push(this.createError('ListCertificates', error)); }

    return { resources, errors };
  }
}

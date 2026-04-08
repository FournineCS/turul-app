// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GCPBaseScanner, GCPScannerConfig, GCPScanResult } from './base-scanner';
import { getGCPClientFactory } from '../client-factory';

export class SslCertsScanner extends GCPBaseScanner {
  constructor(config: GCPScannerConfig) {
    super(config, 'gclb', 'SSL Certificates');
  }

  async scan(): Promise<GCPScanResult> {
    const resources: GCPScanResult['resources'] = [];
    const errors: GCPScanResult['errors'] = [];
    const factory = getGCPClientFactory(this.config.projectId);
    const client = factory.getSslCertificatesClient();

    try {
      const listRequest = { project: this.config.projectId };
      const iterable = client.listAsync(listRequest);

      for await (const cert of iterable) {
        resources.push(this.createResource(
          cert.selfLink || `projects/${this.config.projectId}/global/sslCertificates/${cert.name}`,
          'ssl-certificate',
          cert.name || '',
          'global',
          {
            name: cert.name,
            type: cert.type,
            subjectAlternativeNames: cert.subjectAlternativeNames,
            expireTime: cert.expireTime,
            managed: cert.managed,
            selfManaged: cert.selfManaged,
          },
          this.parseLabels({}),
          this.parseTimestamp(cert.creationTimestamp as string),
        ));
      }
    } catch (error) {
      if (!this.isApiNotEnabled(error)) {
        errors.push(this.createError('list', error));
      }
    }

    return { resources, errors };
  }
}

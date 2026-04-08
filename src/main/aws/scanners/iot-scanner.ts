// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  ListThingsCommand,
  ListPoliciesCommand,
  ListCertificatesCommand,
} from '@aws-sdk/client-iot';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class IoTScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'iot', 'iot');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];

    const client = getClientFactory().getIoTClient({
      profile: this.config.profile,
      region: this.config.region,
    });

    // Scan things
    try {
      let nextToken: string | undefined;
      do {
        const command = new ListThingsCommand({
          nextToken,
          maxResults: 250,
        });
        const response = await this.withRateLimit(() => client.send(command));
        const things = response.things ?? [];

        for (const thing of things) {
          resources.push(this.createResource(
            thing.thingArn ?? thing.thingName ?? '',
            'thing',
            thing.thingName ?? '',
            {
              thingName: thing.thingName,
              thingTypeName: thing.thingTypeName,
              version: thing.version,
              attributes: thing.attributes,
            },
          ));
        }

        nextToken = response.nextToken;
      } while (nextToken);
    } catch (err) {
      errors.push(this.createError('ListThings', err));
    }

    // Scan policies
    try {
      let marker: string | undefined;
      do {
        const command = new ListPoliciesCommand({
          marker,
          pageSize: 250,
        });
        const response = await this.withRateLimit(() => client.send(command));
        const policies = response.policies ?? [];

        for (const policy of policies) {
          resources.push(this.createResource(
            policy.policyArn ?? policy.policyName ?? '',
            'policy',
            policy.policyName ?? '',
            {
              policyName: policy.policyName,
            },
          ));
        }

        marker = response.nextMarker;
      } while (marker);
    } catch (err) {
      errors.push(this.createError('ListPolicies', err));
    }

    // Scan certificates
    try {
      let marker: string | undefined;
      do {
        const command = new ListCertificatesCommand({
          marker,
          pageSize: 250,
        });
        const response = await this.withRateLimit(() => client.send(command));
        const certificates = response.certificates ?? [];

        for (const cert of certificates) {
          resources.push(this.createResource(
            cert.certificateArn ?? cert.certificateId ?? '',
            'certificate',
            cert.certificateId ?? '',
            {
              certificateId: cert.certificateId,
              status: cert.status,
              creationDate: cert.creationDate,
            },
          ));
        }

        marker = response.nextMarker;
      } while (marker);
    } catch (err) {
      errors.push(this.createError('ListCertificates', err));
    }

    return { resources, errors };
  }
}

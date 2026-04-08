// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  ListEmailIdentitiesCommand,
  GetEmailIdentityCommand,
} from '@aws-sdk/client-sesv2';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class SESScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'ses', 'ses');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getSESv2Client({ profile: this.config.profile, region: this.config.region });

    try {
      let nextToken: string | undefined;
      do {
        const response = await this.withRateLimit(() => client.send(new ListEmailIdentitiesCommand({ NextToken: nextToken })));
        if (response.EmailIdentities) {
          for (const identity of response.EmailIdentities) {
            if (!identity.IdentityName) continue;

            let details: any = {};
            let tags: Record<string, string> = {};
            try {
              const idResp = await this.withRateLimit(() => client.send(new GetEmailIdentityCommand({ EmailIdentity: identity.IdentityName })));
              details = {
                identityType: idResp.IdentityType,
                verifiedForSendingStatus: idResp.VerifiedForSendingStatus,
                dkimAttributes: idResp.DkimAttributes ? {
                  signingEnabled: idResp.DkimAttributes.SigningEnabled,
                  status: idResp.DkimAttributes.Status,
                  signingAttributesOrigin: idResp.DkimAttributes.SigningAttributesOrigin,
                } : undefined,
                mailFromAttributes: idResp.MailFromAttributes ? {
                  mailFromDomain: idResp.MailFromAttributes.MailFromDomain,
                  mailFromDomainStatus: idResp.MailFromAttributes.MailFromDomainStatus,
                } : undefined,
                feedbackForwardingStatus: idResp.FeedbackForwardingStatus,
                configurationSetName: idResp.ConfigurationSetName,
              };
              tags = idResp.Tags?.reduce((acc: Record<string, string>, t) => { if (t.Key) acc[t.Key] = t.Value || ''; return acc; }, {}) || {};
            } catch { /* ignore */ }

            const arn = `arn:aws:ses:${this.config.region}::identity/${identity.IdentityName}`;
            resources.push(this.createResource(arn, 'email-identity', identity.IdentityName, {
              identityName: identity.IdentityName,
              identityType: identity.IdentityType,
              sendingEnabled: identity.SendingEnabled,
              ...details,
            }, tags));
          }
        }
        nextToken = response.NextToken;
      } while (nextToken);
    } catch (error) { errors.push(this.createError('ListEmailIdentities', error)); }

    return { resources, errors };
  }
}

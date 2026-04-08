// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GCPBaseScanner, GCPScannerConfig, GCPScanResult } from './base-scanner';
import { getGCPClientFactory } from '../client-factory';

export class BillingScanner extends GCPBaseScanner {
  constructor(config: GCPScannerConfig) {
    super(config, 'cloud-billing', 'Cloud Billing');
  }

  async scan(): Promise<GCPScanResult> {
    const resources: GCPScanResult['resources'] = [];
    const errors: GCPScanResult['errors'] = [];
    const factory = getGCPClientFactory(this.config.projectId);
    const client = factory.getBillingClient();

    try {
      const [billingAccounts] = await client.listBillingAccounts({});

      for (const account of billingAccounts) {
        const name = account.name || '';
        const nameParts = name.split('/');
        const accountId = nameParts.length >= 2 ? nameParts[1] : name;
        const displayName = account.displayName || accountId;

        resources.push(this.createResource(
          name,
          'billing-account',
          displayName,
          'global',
          {
            name: account.name,
            displayName: account.displayName,
            open: account.open,
            masterBillingAccount: account.masterBillingAccount,
          },
          {},
        ));
      }
    } catch (error) {
      if (!this.isApiNotEnabled(error)) {
        errors.push(this.createError('listBillingAccounts', error));
      }
    }

    return { resources, errors };
  }
}

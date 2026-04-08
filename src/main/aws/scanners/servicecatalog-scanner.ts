// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  ListPortfoliosCommand,
  SearchProductsCommand,
} from '@aws-sdk/client-service-catalog';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class ServiceCatalogScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'servicecatalog', 'servicecatalog');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];

    const [portfoliosResult, productsResult] = await Promise.allSettled([
      this.scanPortfolios(),
      this.scanProducts(),
    ]);

    if (portfoliosResult.status === 'fulfilled') { resources.push(...portfoliosResult.value.resources); errors.push(...portfoliosResult.value.errors); }
    else errors.push(this.createError('ListPortfolios', portfoliosResult.reason));
    if (productsResult.status === 'fulfilled') { resources.push(...productsResult.value.resources); errors.push(...productsResult.value.errors); }
    else errors.push(this.createError('SearchProducts', productsResult.reason));

    return { resources, errors };
  }

  private async scanPortfolios(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getServiceCatalogClient({ profile: this.config.profile, region: this.config.region });

    try {
      let pageToken: string | undefined;
      do {
        const response = await this.withRateLimit(() => client.send(new ListPortfoliosCommand({ PageToken: pageToken })));
        if (response.PortfolioDetails) {
          for (const portfolio of response.PortfolioDetails) {
            if (!portfolio.ARN) continue;

            resources.push(this.createResource(portfolio.ARN, 'portfolio', portfolio.DisplayName || '', {
              portfolioId: portfolio.Id,
              displayName: portfolio.DisplayName,
              providerName: portfolio.ProviderName,
              description: portfolio.Description,
            }, {}, portfolio.CreatedTime?.toISOString()));
          }
        }
        pageToken = response.NextPageToken;
      } while (pageToken);
    } catch (error) { errors.push(this.createError('ListPortfolios', error)); }
    return { resources, errors };
  }

  private async scanProducts(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getServiceCatalogClient({ profile: this.config.profile, region: this.config.region });

    try {
      let nextPageToken: string | undefined;
      do {
        const response = await this.withRateLimit(() => client.send(new SearchProductsCommand({ PageToken: nextPageToken })));
        if (response.ProductViewSummaries) {
          for (const product of response.ProductViewSummaries) {
            if (!product.ProductId) continue;

            const productArn = `arn:aws:catalog:${this.config.region}:${product.Owner || ''}:product/${product.ProductId}`;

            resources.push(this.createResource(productArn, 'product', product.Name || '', {
              productId: product.ProductId,
              name: product.Name,
              type: product.Type,
              owner: product.Owner,
              shortDescription: product.ShortDescription,
              distributor: product.Distributor,
              hasDefaultPath: product.HasDefaultPath,
              supportEmail: product.SupportEmail,
              supportDescription: product.SupportDescription,
              supportUrl: product.SupportUrl,
            }, {}));
          }
        }
        nextPageToken = response.NextPageToken;
      } while (nextPageToken);
    } catch (error) { errors.push(this.createError('SearchProducts', error)); }
    return { resources, errors };
  }
}

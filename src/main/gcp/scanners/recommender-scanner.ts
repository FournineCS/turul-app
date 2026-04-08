// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GCPBaseScanner, GCPScannerConfig, GCPScanResult } from './base-scanner';
import { getGCPClientFactory } from '../client-factory';

const RECOMMENDER_TYPES = [
  'google.compute.instance.MachineTypeRecommender',
  'google.compute.instance.IdleResourceRecommender',
  'google.compute.disk.IdleResourceRecommender',
  'google.compute.address.IdleResourceRecommender',
  'google.iam.policy.Recommender',
  'google.cloudsql.instance.IdleRecommender',
  'google.cloudsql.instance.OverprovisionedRecommender',
];

const RECOMMENDER_LOCATIONS = [
  'us-central1',
  'us-east1',
  'us-west1',
  'europe-west1',
  'asia-east1',
];

export class RecommenderScanner extends GCPBaseScanner {
  constructor(config: GCPScannerConfig) {
    super(config, 'recommender', 'Recommender');
  }

  async scan(): Promise<GCPScanResult> {
    const resources: GCPScanResult['resources'] = [];
    const errors: GCPScanResult['errors'] = [];
    const factory = getGCPClientFactory(this.config.projectId);
    const client = factory.getRecommenderClient();

    for (const recommenderType of RECOMMENDER_TYPES) {
      for (const location of RECOMMENDER_LOCATIONS) {
        try {
          const parent = `projects/${this.config.projectId}/locations/${location}/recommenders/${recommenderType}`;
          const [recommendations] = await client.listRecommendations({ parent });

          for (const rec of recommendations) {
            const name = rec.name || '';
            const nameParts = name.split('/');
            const recId = nameParts.length >= 8 ? nameParts[7] : name;

            resources.push(this.createResource(
              name,
              'recommendation',
              rec.description || recId,
              location,
              {
                name: rec.name,
                description: rec.description,
                recommenderSubtype: rec.recommenderSubtype,
                primaryImpact: rec.primaryImpact ? {
                  category: rec.primaryImpact.category,
                  costProjection: rec.primaryImpact.costProjection ? {
                    cost: rec.primaryImpact.costProjection.cost ? {
                      currencyCode: rec.primaryImpact.costProjection.cost.currencyCode,
                      units: rec.primaryImpact.costProjection.cost.units,
                      nanos: rec.primaryImpact.costProjection.cost.nanos,
                    } : undefined,
                    duration: rec.primaryImpact.costProjection.duration,
                  } : undefined,
                } : undefined,
                priority: rec.priority,
                stateInfo: rec.stateInfo ? {
                  state: rec.stateInfo.state,
                } : undefined,
                lastRefreshTime: rec.lastRefreshTime ? new Date(Number(rec.lastRefreshTime.seconds) * 1000).toISOString() : undefined,
                content: rec.content ? {
                  operationGroups: rec.content.operationGroups?.map(og => ({
                    operations: og.operations?.map(op => ({
                      action: op.action,
                      resourceType: op.resourceType,
                      resource: op.resource,
                      path: op.path,
                    })),
                  })),
                } : undefined,
              },
              {},
              this.parseTimestamp(rec.lastRefreshTime ? new Date(Number(rec.lastRefreshTime.seconds) * 1000).toISOString() : undefined),
            ));
          }
        } catch (error) {
          // Only log errors that are not API-not-enabled or not-found for the recommender type/location combo
          if (!this.isApiNotEnabled(error)) {
            const message = error instanceof Error ? error.message : String(error);
            // Skip NOT_FOUND errors for specific recommender/location combos as not all are available everywhere
            if (!message.includes('NOT_FOUND') && !message.includes('not found')) {
              errors.push(this.createError(`listRecommendations:${recommenderType}:${location}`, error));
            }
          }
        }
      }
    }

    return { resources, errors };
  }
}

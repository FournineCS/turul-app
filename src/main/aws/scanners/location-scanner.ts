// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { ListMapsCommand, ListTrackersCommand, ListGeofenceCollectionsCommand, ListTagsForResourceCommand } from '@aws-sdk/client-location';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class LocationScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'location', 'location');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getLocationClient({ profile: this.config.profile, region: this.config.region });

    // Maps
    try {
      let nextToken: string | undefined;
      do {
        const response = await this.withRateLimit(() => client.send(new ListMapsCommand({ NextToken: nextToken, MaxResults: 100 })));
        if (response.Entries) {
          for (const map of response.Entries) {
            if (!map.MapName) continue;
            const arn = `arn:aws:geo:${this.config.region}:map/${map.MapName}`;
            resources.push(this.createResource(arn, 'map', map.MapName, {
              mapName: map.MapName, description: map.Description, dataSource: map.DataSource, pricingPlan: map.PricingPlan,
            }, {}, map.CreateTime?.toISOString()));
          }
        }
        nextToken = response.NextToken;
      } while (nextToken);
    } catch (error) { errors.push(this.createError('ListMaps', error)); }

    // Trackers
    try {
      let nextToken: string | undefined;
      do {
        const response = await this.withRateLimit(() => client.send(new ListTrackersCommand({ NextToken: nextToken, MaxResults: 100 })));
        if (response.Entries) {
          for (const tracker of response.Entries) {
            if (!tracker.TrackerName) continue;
            const arn = `arn:aws:geo:${this.config.region}:tracker/${tracker.TrackerName}`;
            resources.push(this.createResource(arn, 'tracker', tracker.TrackerName, {
              trackerName: tracker.TrackerName, description: tracker.Description, pricingPlan: tracker.PricingPlan,
            }, {}, tracker.CreateTime?.toISOString()));
          }
        }
        nextToken = response.NextToken;
      } while (nextToken);
    } catch (error) { errors.push(this.createError('ListTrackers', error)); }

    // Geofence Collections
    try {
      let nextToken: string | undefined;
      do {
        const response = await this.withRateLimit(() => client.send(new ListGeofenceCollectionsCommand({ NextToken: nextToken, MaxResults: 100 })));
        if (response.Entries) {
          for (const coll of response.Entries) {
            if (!coll.CollectionName) continue;
            const arn = `arn:aws:geo:${this.config.region}:geofence-collection/${coll.CollectionName}`;
            resources.push(this.createResource(arn, 'geofence-collection', coll.CollectionName, {
              collectionName: coll.CollectionName, description: coll.Description, pricingPlan: coll.PricingPlan,
            }, {}, coll.CreateTime?.toISOString()));
          }
        }
        nextToken = response.NextToken;
      } while (nextToken);
    } catch (error) { errors.push(this.createError('ListGeofenceCollections', error)); }

    return { resources, errors };
  }
}

// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  ListCollectionsCommand,
  DescribeCollectionCommand,
  DescribeProjectsCommand,
  ListTagsForResourceCommand,
} from '@aws-sdk/client-rekognition';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class RekognitionScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'rekognition', 'rekognition');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getRekognitionClient({ profile: this.config.profile, region: this.config.region });

    // Scan collections
    try {
      let nextToken: string | undefined;
      do {
        const response = await this.withRateLimit(() => client.send(new ListCollectionsCommand({ NextToken: nextToken })));
        if (response.CollectionIds) {
          for (const collectionId of response.CollectionIds) {
            if (!collectionId) continue;

            const collectionArn = `arn:aws:rekognition:${this.config.region}::collection/${collectionId}`;
            let details: Record<string, unknown> = {};
            let tags: Record<string, string> = {};

            try {
              const descResp = await this.withRateLimit(() => client.send(new DescribeCollectionCommand({ CollectionId: collectionId })));
              details = {
                faceCount: descResp.FaceCount,
                faceModelVersion: descResp.FaceModelVersion,
                collectionARN: descResp.CollectionARN,
                userCount: descResp.UserCount,
              };
            } catch { /* ignore */ }

            try {
              const tagsResp = await this.withRateLimit(() => client.send(new ListTagsForResourceCommand({ ResourceArn: (details.collectionARN as string) || collectionArn })));
              if (tagsResp.Tags) {
                for (const [key, value] of Object.entries(tagsResp.Tags)) {
                  tags[key] = value || '';
                }
              }
            } catch { /* ignore */ }

            resources.push(this.createResource(
              (details.collectionARN as string) || collectionArn,
              'collection',
              collectionId,
              {
                collectionId,
                faceCount: details.faceCount,
                faceModelVersion: details.faceModelVersion,
                userCount: details.userCount,
              },
              tags,
              undefined,
            ));
          }
        }
        nextToken = response.NextToken;
      } while (nextToken);
    } catch (error) { errors.push(this.createError('ListCollections', error)); }

    // Scan projects
    try {
      let nextToken: string | undefined;
      do {
        const response = await this.withRateLimit(() => client.send(new DescribeProjectsCommand({ NextToken: nextToken })));
        if (response.ProjectDescriptions) {
          for (const project of response.ProjectDescriptions) {
            if (!project.ProjectArn) continue;

            let tags: Record<string, string> = {};
            try {
              const tagsResp = await this.withRateLimit(() => client.send(new ListTagsForResourceCommand({ ResourceArn: project.ProjectArn })));
              if (tagsResp.Tags) {
                for (const [key, value] of Object.entries(tagsResp.Tags)) {
                  tags[key] = value || '';
                }
              }
            } catch { /* ignore */ }

            const projectName = project.ProjectArn.split('/').pop() || project.ProjectArn;
            resources.push(this.createResource(
              project.ProjectArn,
              'project',
              projectName,
              {
                projectName,
                projectArn: project.ProjectArn,
                status: project.Status,
                creationTimestamp: project.CreationTimestamp?.toISOString(),
              },
              tags,
              project.CreationTimestamp?.toISOString(),
            ));
          }
        }
        nextToken = response.NextToken;
      } while (nextToken);
    } catch (error) { errors.push(this.createError('DescribeProjects', error)); }

    return { resources, errors };
  }
}

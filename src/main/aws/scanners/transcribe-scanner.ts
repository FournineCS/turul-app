// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { ListVocabulariesCommand, ListLanguageModelsCommand, ListTagsForResourceCommand } from '@aws-sdk/client-transcribe';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class TranscribeScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'transcribe', 'transcribe');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getTranscribeClient({ profile: this.config.profile, region: this.config.region });

    // Scan vocabularies
    try {
      let nextToken: string | undefined;
      do {
        const response = await this.withRateLimit(() => client.send(new ListVocabulariesCommand({ NextToken: nextToken, MaxResults: 100 })));
        if (response.Vocabularies) {
          for (const vocab of response.Vocabularies) {
            if (!vocab.VocabularyName) continue;
            const arn = `arn:aws:transcribe:${this.config.region}:vocabulary/${vocab.VocabularyName}`;

            let tags: Record<string, string> = {};
            try {
              const tagsResp = await this.withRateLimit(() => client.send(new ListTagsForResourceCommand({ ResourceArn: arn })));
              if (tagsResp.Tags) { for (const t of tagsResp.Tags) { if (t.Key) tags[t.Key] = t.Value || ''; } }
            } catch { /* ignore */ }

            resources.push(this.createResource(arn, 'vocabulary', vocab.VocabularyName, {
              vocabularyName: vocab.VocabularyName,
              languageCode: vocab.LanguageCode,
              vocabularyState: vocab.VocabularyState,
              lastModifiedTime: vocab.LastModifiedTime?.toISOString(),
            }, tags, vocab.LastModifiedTime?.toISOString()));
          }
        }
        nextToken = response.NextToken;
      } while (nextToken);
    } catch (error) { errors.push(this.createError('ListVocabularies', error)); }

    // Scan language models
    try {
      let nextToken: string | undefined;
      do {
        const response = await this.withRateLimit(() => client.send(new ListLanguageModelsCommand({ NextToken: nextToken, MaxResults: 100 })));
        if (response.Models) {
          for (const model of response.Models) {
            if (!model.ModelName) continue;
            const arn = `arn:aws:transcribe:${this.config.region}:language-model/${model.ModelName}`;

            resources.push(this.createResource(arn, 'language-model', model.ModelName, {
              modelName: model.ModelName,
              languageCode: model.LanguageCode,
              modelStatus: model.ModelStatus,
              baseModelName: model.BaseModelName,
              createTime: model.CreateTime?.toISOString(),
              lastModifiedTime: model.LastModifiedTime?.toISOString(),
            }, {}, model.CreateTime?.toISOString()));
          }
        }
        nextToken = response.NextToken;
      } while (nextToken);
    } catch (error) { errors.push(this.createError('ListLanguageModels', error)); }

    return { resources, errors };
  }
}

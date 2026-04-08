// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GCPBaseScanner, GCPScannerConfig, GCPScanResult } from './base-scanner';
import { getGCPClientFactory } from '../client-factory';

export class TranslationScanner extends GCPBaseScanner {
  constructor(config: GCPScannerConfig) {
    super(config, 'translation-ai', 'Translation');
  }

  async scan(): Promise<GCPScanResult> {
    const resources: GCPScanResult['resources'] = [];
    const errors: GCPScanResult['errors'] = [];
    const factory = getGCPClientFactory(this.config.projectId);
    const client = factory.getTranslateClient();

    try {
      const parent = `projects/${this.config.projectId}/locations/us-central1`;
      const iterable = client.listGlossariesAsync({ parent });

      for await (const glossary of iterable) {
        const name = glossary.name || '';
        const nameParts = name.split('/');
        const glossaryId = nameParts.length >= 6 ? nameParts[5] : name;
        const location = nameParts.length >= 4 ? nameParts[3] : 'us-central1';

        resources.push(this.createResource(
          name,
          'glossary',
          glossaryId,
          location,
          {
            name: glossary.name,
            languagePair: glossary.languagePair ? {
              sourceLanguageCode: glossary.languagePair.sourceLanguageCode,
              targetLanguageCode: glossary.languagePair.targetLanguageCode,
            } : undefined,
            languageCodesSet: glossary.languageCodesSet ? {
              languageCodes: glossary.languageCodesSet.languageCodes,
            } : undefined,
            entryCount: glossary.entryCount,
            submitTime: glossary.submitTime ? new Date(Number(glossary.submitTime.seconds) * 1000).toISOString() : undefined,
            endTime: glossary.endTime ? new Date(Number(glossary.endTime.seconds) * 1000).toISOString() : undefined,
          },
          {},
          this.parseTimestamp(glossary.submitTime ? new Date(Number(glossary.submitTime.seconds) * 1000).toISOString() : undefined),
        ));
      }
    } catch (error) {
      if (!this.isApiNotEnabled(error)) {
        errors.push(this.createError('listGlossaries', error));
      }
    }

    return { resources, errors };
  }
}

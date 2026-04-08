// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { ListBotsCommand, ListBotAliasesCommand, ListTagsForResourceCommand } from '@aws-sdk/client-lex-models-v2';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class LexScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'lex', 'lex');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getLexV2Client({ profile: this.config.profile, region: this.config.region });

    try {
      let nextToken: string | undefined;
      do {
        const response = await this.withRateLimit(() => client.send(new ListBotsCommand({ nextToken, maxResults: 50 })));
        if (response.botSummaries) {
          for (const bot of response.botSummaries) {
            if (!bot.botId) continue;
            const arn = `arn:aws:lex:${this.config.region}:bot/${bot.botId}`;

            // Get aliases
            let aliases: any[] = [];
            try {
              const aliasResp = await this.withRateLimit(() => client.send(new ListBotAliasesCommand({ botId: bot.botId!, maxResults: 50 })));
              aliases = (aliasResp.botAliasSummaries || []).map(a => ({
                aliasId: a.botAliasId, aliasName: a.botAliasName, aliasStatus: a.botAliasStatus, botVersion: a.botVersion,
              }));
            } catch { /* ignore */ }

            let tags: Record<string, string> = {};
            try {
              const tagsResp = await this.withRateLimit(() => client.send(new ListTagsForResourceCommand({ resourceARN: arn })));
              if (tagsResp.tags) { for (const [k, v] of Object.entries(tagsResp.tags)) { tags[k] = v || ''; } }
            } catch { /* ignore */ }

            resources.push(this.createResource(arn, 'bot', bot.botName || bot.botId, {
              botName: bot.botName,
              botId: bot.botId,
              botStatus: bot.botStatus,
              botType: bot.botType,
              description: bot.description,
              latestBotVersion: bot.latestBotVersion,
              lastUpdatedDateTime: bot.lastUpdatedDateTime?.toISOString(),
              aliases,
            }, tags));
          }
        }
        nextToken = response.nextToken;
      } while (nextToken);
    } catch (error) { errors.push(this.createError('ListBots', error)); }

    return { resources, errors };
  }
}

// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  ListPipelinesCommand,
  GetPipelineCommand,
  ListTagsForResourceCommand,
} from '@aws-sdk/client-codepipeline';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class CodePipelineScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'codepipeline', 'codepipeline');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getCodePipelineClient({ profile: this.config.profile, region: this.config.region });

    try {
      let nextToken: string | undefined;
      do {
        const response = await this.withRateLimit(() => client.send(new ListPipelinesCommand({ nextToken })));
        if (response.pipelines) {
          for (const pipeline of response.pipelines) {
            if (!pipeline.name) continue;

            let details: any = {};
            let pipelineArn = '';
            try {
              const pipelineResp = await this.withRateLimit(() => client.send(new GetPipelineCommand({ name: pipeline.name })));
              const p = pipelineResp.pipeline;
              pipelineArn = pipelineResp.metadata?.pipelineArn || `arn:aws:codepipeline:${this.config.region}::${pipeline.name}`;
              if (p) {
                details = {
                  roleArn: p.roleArn,
                  stages: p.stages?.map(s => ({
                    name: s.name,
                    actions: s.actions?.map(a => ({
                      name: a.name,
                      actionTypeId: a.actionTypeId ? {
                        category: a.actionTypeId.category,
                        owner: a.actionTypeId.owner,
                        provider: a.actionTypeId.provider,
                      } : undefined,
                    })),
                  })),
                  stageCount: p.stages?.length || 0,
                  artifactStore: p.artifactStore ? { type: p.artifactStore.type, location: p.artifactStore.location } : undefined,
                };
              }
            } catch { /* ignore */ }

            if (!pipelineArn) pipelineArn = `arn:aws:codepipeline:${this.config.region}::${pipeline.name}`;

            let tags: Record<string, string> = {};
            try {
              const tagsResp = await this.withRateLimit(() => client.send(new ListTagsForResourceCommand({ resourceArn: pipelineArn })));
              if (tagsResp.tags) {
                for (const tag of tagsResp.tags) {
                  if (tag.key) tags[tag.key] = tag.value || '';
                }
              }
            } catch { /* ignore */ }

            resources.push(this.createResource(pipelineArn, 'pipeline', pipeline.name, {
              pipelineName: pipeline.name,
              version: pipeline.version,
              pipelineType: pipeline.pipelineType,
              ...details,
            }, tags, pipeline.created?.toISOString()));
          }
        }
        nextToken = response.nextToken;
      } while (nextToken);
    } catch (error) { errors.push(this.createError('ListPipelines', error)); }

    return { resources, errors };
  }
}

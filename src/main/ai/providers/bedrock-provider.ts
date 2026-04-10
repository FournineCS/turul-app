// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  BedrockRuntimeClient,
  ConverseStreamCommand,
  type ContentBlock,
  type Message,
  type Tool,
  type ToolConfiguration,
} from '@aws-sdk/client-bedrock-runtime';
import { ClientFactory } from '../../aws/client-factory';
import type { AIProvider } from '../ai-provider';
import type { AIStreamChunk, AIChatRequest, AIProviderType } from '../../../shared/types/chat';

const DEFAULT_MODEL = 'amazon.nova-pro-v1:0';

export class BedrockProvider implements AIProvider {
  id: AIProviderType = 'bedrock';
  name = 'AWS Bedrock';

  private profileName?: string;
  private region: string;
  private modelId: string;
  private accessKeyId?: string;
  private secretAccessKey?: string;

  constructor(opts: {
    profileName?: string;
    region?: string;
    modelId?: string;
    accessKeyId?: string;
    secretAccessKey?: string;
  }) {
    this.profileName = opts.profileName;
    this.region = opts.region || 'us-east-1';
    this.modelId = opts.modelId || DEFAULT_MODEL;
    this.accessKeyId = opts.accessKeyId;
    this.secretAccessKey = opts.secretAccessKey;
  }

  async validateConfig(): Promise<{ valid: boolean; error?: string }> {
    try {
      const client = this.getClient();
      await client.send(new ConverseStreamCommand({
        modelId: this.modelId,
        messages: [{ role: 'user', content: [{ text: 'hi' }] }],
        inferenceConfig: { maxTokens: 1 },
      }));
      return { valid: true };
    } catch (err: any) {
      return { valid: false, error: err.message };
    }
  }

  async *sendMessage(request: AIChatRequest): AsyncGenerator<AIStreamChunk> {
    const client = this.getClient();

    // Convert messages to Bedrock format
    const messages: Message[] = request.messages.map(msg => ({
      role: msg.role as 'user' | 'assistant',
      content: typeof msg.content === 'string'
        ? [{ text: msg.content }]
        : this.convertContentBlocks(msg.content),
    }));

    // Convert tools to Bedrock format
    let toolConfig: ToolConfiguration | undefined;
    if (request.tools && request.tools.length > 0) {
      const tools: Tool[] = request.tools.map(t => ({
        toolSpec: {
          name: t.name,
          description: t.description,
          inputSchema: { json: t.inputSchema as any },
        },
      }));
      toolConfig = { tools };
    }

    const command = new ConverseStreamCommand({
      modelId: this.modelId,
      messages,
      system: [{ text: request.systemPrompt }],
      toolConfig,
      inferenceConfig: { maxTokens: 8192 },
    });

    const response = await client.send(command);

    if (!response.stream) {
      yield { type: 'error', error: 'No stream returned from Bedrock' };
      return;
    }

    let currentToolUse: { id: string; name: string; inputJson: string } | null = null;

    for await (const event of response.stream) {
      if (event.contentBlockStart?.start?.toolUse) {
        const tu = event.contentBlockStart.start.toolUse;
        currentToolUse = { id: tu.toolUseId || '', name: tu.name || '', inputJson: '' };
      }

      if (event.contentBlockDelta?.delta) {
        const delta = event.contentBlockDelta.delta;
        if (delta.text) {
          yield { type: 'text', text: delta.text };
        }
        if (delta.toolUse?.input) {
          if (currentToolUse) {
            currentToolUse.inputJson += delta.toolUse.input;
          }
        }
      }

      if (event.contentBlockStop && currentToolUse) {
        let input: Record<string, unknown> = {};
        try {
          input = JSON.parse(currentToolUse.inputJson);
        } catch (parseErr) {
          console.warn('[bedrock] Failed to parse tool input JSON:', currentToolUse.inputJson.slice(0, 200), parseErr);
        }
        yield {
          type: 'tool_use',
          toolUse: { id: currentToolUse.id, name: currentToolUse.name, input },
        };
        currentToolUse = null;
      }

      if (event.messageStop) {
        const reason = event.messageStop.stopReason;
        if (reason === 'end_turn' || reason === 'max_tokens' || reason === 'tool_use') {
          yield { type: 'done' };
        }
      }
    }
  }

  private convertContentBlocks(blocks: Array<{ type: string; [key: string]: unknown }>): ContentBlock[] {
    return blocks.map(block => {
      if (block.type === 'text') return { text: block.text as string };
      if (block.type === 'tool_use') {
        return {
          toolUse: {
            toolUseId: block.id as string,
            name: block.name as string,
            input: block.input as any,
          },
        };
      }
      if (block.type === 'tool_result') {
        return {
          toolResult: {
            toolUseId: block.tool_use_id as string,
            content: [{ text: block.content as string }],
          },
        };
      }
      return { text: JSON.stringify(block) };
    });
  }

  private getClient(): BedrockRuntimeClient {
    // Direct API keys take priority
    if (this.accessKeyId && this.secretAccessKey) {
      return new BedrockRuntimeClient({
        region: this.region,
        credentials: {
          accessKeyId: this.accessKeyId,
          secretAccessKey: this.secretAccessKey,
        },
      });
    }

    // Fall back to AWS profile credentials
    if (this.profileName) {
      const factory = new ClientFactory();
      return factory.getBedrockRuntimeClient({ profile: this.profileName, region: this.region });
    }

    // Last resort: default credential chain
    return new BedrockRuntimeClient({ region: this.region });
  }
}

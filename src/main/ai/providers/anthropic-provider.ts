// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import Anthropic from '@anthropic-ai/sdk';
import type { AIProvider } from '../ai-provider';
import type { AIStreamChunk, AIChatRequest, AIProviderType } from '../../../shared/types/chat';

const DEFAULT_MODEL = 'claude-sonnet-4-20250514';

export class AnthropicProvider implements AIProvider {
  id: AIProviderType = 'anthropic';
  name = 'Anthropic (Claude)';

  private apiKey: string;
  private modelId: string;

  constructor(opts: { apiKey: string; modelId?: string }) {
    this.apiKey = opts.apiKey;
    this.modelId = opts.modelId || DEFAULT_MODEL;
  }

  async validateConfig(): Promise<{ valid: boolean; error?: string }> {
    try {
      const client = new Anthropic({ apiKey: this.apiKey });
      await client.messages.create({
        model: this.modelId,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }],
      });
      return { valid: true };
    } catch (err: any) {
      return { valid: false, error: err.message };
    }
  }

  async *sendMessage(request: AIChatRequest): AsyncGenerator<AIStreamChunk> {
    const client = new Anthropic({ apiKey: this.apiKey });

    // Convert messages — Anthropic format is nearly identical to our internal format
    const messages: Anthropic.MessageParam[] = request.messages.map(msg => ({
      role: msg.role,
      content: typeof msg.content === 'string'
        ? msg.content
        : this.convertContentBlocks(msg.content),
    }));

    // Convert tools
    const tools: Anthropic.Tool[] | undefined = request.tools?.map(t => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema as Anthropic.Tool['input_schema'],
    }));

    const stream = client.messages.stream({
      model: this.modelId,
      max_tokens: 8192,
      system: request.systemPrompt,
      messages,
      tools,
    });

    let currentToolUse: { id: string; name: string } | null = null;
    let toolInputJson = '';

    try {
      for await (const event of stream) {
        if (event.type === 'content_block_start') {
          if (event.content_block.type === 'tool_use') {
            currentToolUse = {
              id: event.content_block.id,
              name: event.content_block.name,
            };
            toolInputJson = '';
          }
        }

        if (event.type === 'content_block_delta') {
          if (event.delta.type === 'text_delta') {
            yield { type: 'text', text: event.delta.text };
          } else if (event.delta.type === 'input_json_delta') {
            toolInputJson += event.delta.partial_json;
          }
        }

        if (event.type === 'content_block_stop' && currentToolUse) {
          let input: Record<string, unknown> = {};
          try {
            input = JSON.parse(toolInputJson);
          } catch {
            // Empty or invalid JSON — use empty object
          }
          yield {
            type: 'tool_use',
            toolUse: { id: currentToolUse.id, name: currentToolUse.name, input },
          };
          currentToolUse = null;
          toolInputJson = '';
        }

        if (event.type === 'message_stop') {
          yield { type: 'done' };
        }
      }
    } catch (err: any) {
      yield { type: 'error', error: `Anthropic API error: ${err.message}` };
    }
  }

  private convertContentBlocks(
    blocks: Array<{ type: string; [key: string]: unknown }>
  ): Anthropic.ContentBlockParam[] {
    return blocks.map(block => {
      if (block.type === 'text') {
        return { type: 'text' as const, text: block.text as string };
      }
      if (block.type === 'tool_use') {
        return {
          type: 'tool_use' as const,
          id: block.id as string,
          name: block.name as string,
          input: block.input as Record<string, unknown>,
        };
      }
      if (block.type === 'tool_result') {
        return {
          type: 'tool_result' as const,
          tool_use_id: block.tool_use_id as string,
          content: block.content as string,
        };
      }
      return { type: 'text' as const, text: JSON.stringify(block) };
    });
  }
}

// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import OpenAI from 'openai';
import type { AIProvider } from '../ai-provider';
import type { AIStreamChunk, AIChatRequest, AIProviderType } from '../../../shared/types/chat';

const DEFAULT_MODEL = 'gpt-4o';

export class OpenAIProvider implements AIProvider {
  id: AIProviderType = 'openai';
  name = 'OpenAI';

  private apiKey: string;
  private orgId?: string;
  private modelId: string;

  constructor(opts: { apiKey: string; orgId?: string; modelId?: string }) {
    this.apiKey = opts.apiKey;
    this.orgId = opts.orgId;
    this.modelId = opts.modelId || DEFAULT_MODEL;
  }

  async validateConfig(): Promise<{ valid: boolean; error?: string }> {
    try {
      const client = this.getClient();
      await client.chat.completions.create({
        model: this.modelId,
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 1,
      });
      return { valid: true };
    } catch (err: any) {
      return { valid: false, error: err.message };
    }
  }

  async *sendMessage(request: AIChatRequest): AsyncGenerator<AIStreamChunk> {
    const client = this.getClient();

    // Convert messages to OpenAI format
    const messages: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: request.systemPrompt },
      ...this.convertMessages(request.messages),
    ];

    // Convert tools to OpenAI format
    const tools: OpenAI.ChatCompletionTool[] | undefined = request.tools?.map(t => ({
      type: 'function' as const,
      function: {
        name: t.name,
        description: t.description,
        parameters: t.inputSchema,
      },
    }));

    try {
      const stream = await client.chat.completions.create({
        model: this.modelId,
        messages,
        tools: tools && tools.length > 0 ? tools : undefined,
        max_tokens: 8192,
        stream: true,
      });

      // Track tool call accumulation across deltas
      const toolCalls = new Map<number, { id: string; name: string; argsJson: string }>();

      for await (const chunk of stream) {
        const delta = chunk.choices[0]?.delta;
        if (!delta) continue;

        // Text content
        if (delta.content) {
          yield { type: 'text', text: delta.content };
        }

        // Tool calls — OpenAI streams these as deltas with index
        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const existing = toolCalls.get(tc.index);
            if (tc.id) {
              // New tool call starting
              toolCalls.set(tc.index, {
                id: tc.id,
                name: tc.function?.name || '',
                argsJson: tc.function?.arguments || '',
              });
            } else if (existing) {
              // Continuing to accumulate arguments
              if (tc.function?.name) existing.name = tc.function.name;
              if (tc.function?.arguments) existing.argsJson += tc.function.arguments;
            }
          }
        }

        // Check for finish
        const finishReason = chunk.choices[0]?.finish_reason;
        if (finishReason === 'tool_calls') {
          // Emit all accumulated tool calls
          for (const [, tc] of toolCalls) {
            let input: Record<string, unknown> = {};
            try {
              input = JSON.parse(tc.argsJson);
            } catch {
              // Invalid JSON — use empty
            }
            yield {
              type: 'tool_use',
              toolUse: { id: tc.id, name: tc.name, input },
            };
          }
          toolCalls.clear();
          yield { type: 'done' };
        } else if (finishReason === 'stop' || finishReason === 'length') {
          yield { type: 'done' };
        }
      }
    } catch (err: any) {
      yield { type: 'error', error: `OpenAI API error: ${err.message}` };
    }
  }

  private convertMessages(
    messages: Array<{ role: 'user' | 'assistant'; content: string | Array<{ type: string; [key: string]: unknown }> }>
  ): OpenAI.ChatCompletionMessageParam[] {
    const result: OpenAI.ChatCompletionMessageParam[] = [];

    for (const msg of messages) {
      if (typeof msg.content === 'string') {
        result.push({ role: msg.role, content: msg.content });
        continue;
      }

      // Handle content block arrays (tool_use / tool_result)
      if (msg.role === 'assistant') {
        // Collect text and tool_use blocks
        let textContent = '';
        const toolCalls: OpenAI.ChatCompletionMessageToolCall[] = [];

        for (const block of msg.content) {
          if (block.type === 'text') {
            textContent += block.text as string;
          } else if (block.type === 'tool_use') {
            toolCalls.push({
              id: block.id as string,
              type: 'function',
              function: {
                name: block.name as string,
                arguments: JSON.stringify(block.input),
              },
            });
          }
        }

        const assistantMsg: OpenAI.ChatCompletionAssistantMessageParam = {
          role: 'assistant',
          content: textContent || null,
        };
        if (toolCalls.length > 0) {
          assistantMsg.tool_calls = toolCalls;
        }
        result.push(assistantMsg);
      } else if (msg.role === 'user') {
        // tool_result blocks become separate tool messages in OpenAI
        for (const block of msg.content) {
          if (block.type === 'tool_result') {
            result.push({
              role: 'tool',
              tool_call_id: block.tool_use_id as string,
              content: block.content as string,
            });
          } else if (block.type === 'text') {
            result.push({ role: 'user', content: block.text as string });
          }
        }
      }
    }

    return result;
  }

  private getClient(): OpenAI {
    return new OpenAI({
      apiKey: this.apiKey,
      organization: this.orgId || undefined,
    });
  }
}

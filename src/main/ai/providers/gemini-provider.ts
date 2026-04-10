// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GoogleGenerativeAI, type Content, type Part, type FunctionDeclaration, type Tool as GeminiTool } from '@google/generative-ai';
import type { AIProvider } from '../ai-provider';
import type { AIStreamChunk, AIChatRequest, AIProviderType } from '../../../shared/types/chat';

const DEFAULT_MODEL = 'gemini-2.5-flash';

export class GeminiProvider implements AIProvider {
  id: AIProviderType = 'gemini';
  name = 'Google Gemini';

  private apiKey: string;
  private modelId: string;

  constructor(opts: { apiKey: string; modelId?: string }) {
    this.apiKey = opts.apiKey;
    this.modelId = opts.modelId || DEFAULT_MODEL;
  }

  async validateConfig(): Promise<{ valid: boolean; error?: string }> {
    try {
      const genAI = new GoogleGenerativeAI(this.apiKey);
      const model = genAI.getGenerativeModel({ model: this.modelId });
      await model.generateContent('hi');
      return { valid: true };
    } catch (err: any) {
      return { valid: false, error: err.message };
    }
  }

  async *sendMessage(request: AIChatRequest): AsyncGenerator<AIStreamChunk> {
    const genAI = new GoogleGenerativeAI(this.apiKey);

    // Convert tools to Gemini format
    const geminiTools: GeminiTool[] | undefined = request.tools && request.tools.length > 0
      ? [{
          functionDeclarations: request.tools.map((t): FunctionDeclaration => ({
            name: t.name,
            description: t.description,
            parameters: t.inputSchema as any,
          })),
        }]
      : undefined;

    const model = genAI.getGenerativeModel({
      model: this.modelId,
      systemInstruction: request.systemPrompt,
      tools: geminiTools,
    });

    // Convert message history (excluding the last user message which goes to generateContent)
    const history = this.convertHistory(request.messages.slice(0, -1));
    const lastMessage = request.messages[request.messages.length - 1];

    const chat = model.startChat({ history });

    // Build the last user message parts
    const userParts = this.convertToParts(lastMessage.content);

    try {
      const result = await chat.sendMessageStream(userParts);

      for await (const chunk of result.stream) {
        const candidates = chunk.candidates;
        if (!candidates || candidates.length === 0) continue;

        const parts = candidates[0].content?.parts;
        if (!parts) continue;

        for (const part of parts) {
          if (part.text) {
            yield { type: 'text', text: part.text };
          }
          if (part.functionCall) {
            yield {
              type: 'tool_use',
              toolUse: {
                id: `gemini_fc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
                name: part.functionCall.name,
                input: (part.functionCall.args || {}) as Record<string, unknown>,
              },
            };
          }
        }
      }

      yield { type: 'done' };
    } catch (err: any) {
      yield { type: 'error', error: `Gemini API error: ${err.message}` };
    }
  }

  private convertHistory(
    messages: Array<{ role: 'user' | 'assistant'; content: string | Array<{ type: string; [key: string]: unknown }> }>
  ): Content[] {
    const history: Content[] = [];

    for (const msg of messages) {
      const parts = this.convertToParts(msg.content);
      // Gemini uses 'model' instead of 'assistant'
      const role = msg.role === 'assistant' ? 'model' : 'user';

      // Tool results need 'function' role in Gemini
      if (msg.role === 'user' && Array.isArray(msg.content)) {
        const hasFunctionResponse = msg.content.some(b => b.type === 'tool_result');
        if (hasFunctionResponse) {
          const functionParts: Part[] = [];
          for (const block of msg.content) {
            if (block.type === 'tool_result') {
              functionParts.push({
                functionResponse: {
                  name: (block as any).toolName || 'tool',
                  response: { result: block.content as string },
                },
              });
            }
          }
          if (functionParts.length > 0) {
            history.push({ role: 'function', parts: functionParts });
            continue;
          }
        }
      }

      history.push({ role, parts });
    }

    return history;
  }

  private convertToParts(content: string | Array<{ type: string; [key: string]: unknown }>): Part[] {
    if (typeof content === 'string') {
      return [{ text: content }];
    }

    const parts: Part[] = [];
    for (const block of content) {
      if (block.type === 'text') {
        parts.push({ text: block.text as string });
      } else if (block.type === 'tool_use') {
        parts.push({
          functionCall: {
            name: block.name as string,
            args: block.input as Record<string, string>,
          },
        });
      } else if (block.type === 'tool_result') {
        parts.push({
          functionResponse: {
            name: (block as any).toolName || 'tool',
            response: { result: block.content as string },
          },
        });
      }
    }
    return parts;
  }
}

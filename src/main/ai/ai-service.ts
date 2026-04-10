// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import crypto from 'crypto';
import type { AIProvider } from './ai-provider';
import type { AIStreamChunk, ChatContext, ChatMessage, AIProviderType } from '../../shared/types/chat';
import type { DatabaseManager } from '../database/db-manager';
import { BedrockProvider } from './providers/bedrock-provider';
import { AnthropicProvider } from './providers/anthropic-provider';
import { OpenAIProvider } from './providers/openai-provider';
import { GeminiProvider } from './providers/gemini-provider';
import { ClaudeCodeProvider } from './providers/claude-code-provider';
import { buildSystemPrompt } from './system-prompt';
import { getToolDefinitionsForProvider, executeTool } from './tools/tool-registry';

const MAX_TOOL_ROUNDS = 10;

/** Strip <thinking>...</thinking> blocks from model output */
function stripThinking(text: string): string {
  return text.replace(/<thinking>[\s\S]*?<\/thinking>\s*/g, '').trim();
}

export class AIService {
  private dbManager: DatabaseManager;
  private abortControllers = new Map<string, AbortController>();

  constructor(dbManager: DatabaseManager) {
    this.dbManager = dbManager;
  }

  async *chat(
    conversationId: string,
    userMessage: string,
    providerType: AIProviderType,
    context?: ChatContext,
    providerConfig?: Record<string, string | undefined>
  ): AsyncGenerator<AIStreamChunk> {
    const provider = this.createProvider(providerType, providerConfig, context);
    if (!provider) {
      yield { type: 'error', error: `AI provider not configured. Please configure your provider in Chat Settings (gear icon).` };
      return;
    }

    const abortController = new AbortController();
    this.abortControllers.set(conversationId, abortController);

    try {
      // Save user message
      this.dbManager.addChatMessage({
        id: crypto.randomUUID(),
        conversationId,
        role: 'user',
        content: userMessage,
      });

      // Load conversation history
      const dbMessages = this.dbManager.getChatMessages(conversationId);
      const messages = this.buildMessageHistory(dbMessages);

      const systemPrompt = buildSystemPrompt(context);

      // Claude Code handles tools internally via MCP — bypass the tool loop
      if (providerType === 'claude-code') {
        yield* this.streamClaudeCode(provider, conversationId, messages, systemPrompt, context, abortController);
        return;
      }

      const tools = getToolDefinitionsForProvider(context?.cloudProvider || 'aws');

      let currentMessages = [...messages];
      let toolRounds = 0;

      while (toolRounds < MAX_TOOL_ROUNDS) {
        if (abortController.signal.aborted) {
          yield { type: 'done' };
          return;
        }

        const pendingToolUses: Array<{ id: string; name: string; input: Record<string, unknown> }> = [];
        let assistantText = '';

        const stream = provider.sendMessage({
          messages: currentMessages,
          systemPrompt,
          tools,
          context,
        });

        for await (const chunk of stream) {
          if (abortController.signal.aborted) {
            yield { type: 'done' };
            return;
          }

          if (chunk.type === 'text') {
            assistantText += chunk.text || '';
            yield chunk;
          } else if (chunk.type === 'tool_use' && chunk.toolUse) {
            pendingToolUses.push(chunk.toolUse);
            yield chunk;
          } else if (chunk.type === 'error') {
            yield chunk;
            return;
          } else if (chunk.type === 'done') {
            // Only done if no pending tool uses
            if (pendingToolUses.length === 0) {
              // Save assistant message (strip thinking tags)
              const cleanText = stripThinking(assistantText);
              if (cleanText) {
                this.dbManager.addChatMessage({
                  id: crypto.randomUUID(),
                  conversationId,
                  role: 'assistant',
                  content: cleanText,
                });
              }
              yield { type: 'done' };
              return;
            }
          }
        }

        if (pendingToolUses.length === 0) {
          // Stream ended without tool_use or done - save and finish
          const cleanText = stripThinking(assistantText);
          if (cleanText) {
            this.dbManager.addChatMessage({
              id: crypto.randomUUID(),
              conversationId,
              role: 'assistant',
              content: cleanText,
            });
          }
          yield { type: 'done' };
          return;
        }

        // Execute tools and build next message
        // Save assistant text from this round (stripped of thinking)
        const cleanRoundText = stripThinking(assistantText);
        if (cleanRoundText) {
          this.dbManager.addChatMessage({
            id: crypto.randomUUID(),
            conversationId,
            role: 'assistant',
            content: cleanRoundText,
          });
        }

        // Build the assistant's response for the API (text + tool_use blocks)
        const assistantContent: Array<{ type: string; [key: string]: unknown }> = [];
        if (assistantText) {
          assistantContent.push({ type: 'text', text: assistantText });
        }
        for (const tu of pendingToolUses) {
          assistantContent.push({ type: 'tool_use', id: tu.id, name: tu.name, input: tu.input });
          // Save tool_use message with the Bedrock-generated tool_use_id
          this.dbManager.addChatMessage({
            id: crypto.randomUUID(),
            conversationId,
            role: 'tool_use',
            content: '',
            toolName: tu.name,
            toolInput: JSON.stringify(tu.input),
            toolUseId: tu.id,
          });
        }

        currentMessages.push({ role: 'assistant', content: assistantContent });

        // Execute tools and build tool results
        const toolResultContent: Array<{ type: string; [key: string]: unknown }> = [];
        for (const tu of pendingToolUses) {
          let result: string;
          try {
            result = await executeTool(tu.name, tu.input, this.dbManager, {
              profileName: context?.profileName,
              region: context?.region,
              projectId: context?.projectId,
            });
          } catch (err: any) {
            result = JSON.stringify({ error: err.message });
          }

          toolResultContent.push({
            type: 'tool_result',
            tool_use_id: tu.id,
            content: result,
          });

          // Save tool_result message with matching tool_use_id
          this.dbManager.addChatMessage({
            id: crypto.randomUUID(),
            conversationId,
            role: 'tool_result',
            content: result,
            toolName: tu.name,
            toolUseId: tu.id,
          });

          yield { type: 'tool_result', toolResult: { toolUseId: tu.id, content: result } };
        }

        currentMessages.push({ role: 'user', content: toolResultContent });
        toolRounds++;
        assistantText = '';
      }

      yield { type: 'error', error: 'Too many tool rounds. Please simplify your request.' };
    } finally {
      this.abortControllers.delete(conversationId);
    }
  }

  /**
   * Stream from Claude Code provider — no tool loop needed.
   * The SDK + MCP server handle tool execution internally.
   */
  private async *streamClaudeCode(
    provider: AIProvider,
    conversationId: string,
    messages: Array<{ role: 'user' | 'assistant'; content: string | Array<{ type: string; [key: string]: unknown }> }>,
    systemPrompt: string,
    context?: ChatContext,
    abortController?: AbortController
  ): AsyncGenerator<AIStreamChunk> {
    let assistantText = '';

    const stream = provider.sendMessage({
      messages,
      systemPrompt,
      context,
      // No tools — Claude Code uses MCP tools internally
    });

    for await (const chunk of stream) {
      if (abortController?.signal.aborted) {
        yield { type: 'done' };
        return;
      }

      if (chunk.type === 'text') {
        assistantText += chunk.text || '';
        yield chunk;
      } else if (chunk.type === 'tool_use') {
        // Pass through for UI visibility
        yield chunk;
      } else if (chunk.type === 'tool_result') {
        // Pass through for UI visibility
        yield chunk;
      } else if (chunk.type === 'error') {
        yield chunk;
        return;
      } else if (chunk.type === 'done') {
        const cleanText = stripThinking(assistantText);
        if (cleanText) {
          this.dbManager.addChatMessage({
            id: crypto.randomUUID(),
            conversationId,
            role: 'assistant',
            content: cleanText,
          });
        }
        yield { type: 'done' };
        return;
      }
    }

    // Stream ended without 'done' chunk
    const cleanText = stripThinking(assistantText);
    if (cleanText) {
      this.dbManager.addChatMessage({
        id: crypto.randomUUID(),
        conversationId,
        role: 'assistant',
        content: cleanText,
      });
    }
    yield { type: 'done' };
  }

  stopGeneration(conversationId: string): void {
    const controller = this.abortControllers.get(conversationId);
    if (controller) {
      controller.abort();
    }
  }

  getProviders(): Array<{ type: AIProviderType; name: string; configured: boolean }> {
    return [
      { type: 'bedrock', name: 'AWS Bedrock', configured: true },
      { type: 'anthropic', name: 'Anthropic (Claude)', configured: true },
      { type: 'openai', name: 'OpenAI', configured: true },
      { type: 'gemini', name: 'Google Gemini', configured: true },
      { type: 'claude-code', name: 'Claude Code (Local)', configured: true },
    ];
  }

  private createProvider(
    type: AIProviderType,
    config?: Record<string, string | undefined>,
    context?: ChatContext
  ): AIProvider | null {
    switch (type) {
      case 'bedrock': {
        // Support both old and new config key names
        const accessKeyId = config?.accessKeyId || config?.accessKey;
        if (!accessKeyId) return null;
        return new BedrockProvider({
          region: config?.region || 'us-east-1',
          modelId: config?.model,
          accessKeyId,
          secretAccessKey: config?.secretKey || config?.secretAccessKey,
        });
      }
      case 'anthropic': {
        if (!config?.apiKey) return null;
        return new AnthropicProvider({
          apiKey: config.apiKey,
          modelId: config.model,
        });
      }
      case 'openai': {
        if (!config?.apiKey) return null;
        return new OpenAIProvider({
          apiKey: config.apiKey,
          orgId: config.orgId,
          modelId: config.model,
        });
      }
      case 'gemini': {
        if (!config?.apiKey) return null;
        return new GeminiProvider({
          apiKey: config.apiKey,
          modelId: config.model,
        });
      }
      case 'claude-code': {
        return new ClaudeCodeProvider({
          cliPath: config?.cliPath,
          dbPath: this.dbManager.getDbPath(),
          context,
        });
      }
      default:
        return null;
    }
  }

  private buildMessageHistory(
    dbMessages: Array<{ role: string; content: string; tool_name: string | null; tool_input: string | null; tool_use_id: string | null }>
  ): Array<{ role: 'user' | 'assistant'; content: string | Array<{ type: string; [key: string]: unknown }> }> {
    const messages: Array<{ role: 'user' | 'assistant'; content: string | Array<{ type: string; [key: string]: unknown }> }> = [];

    let i = 0;
    let fallbackCounter = 0;

    while (i < dbMessages.length) {
      const msg = dbMessages[i];

      if (msg.role === 'user') {
        messages.push({ role: 'user', content: msg.content });
        i++;
      } else if (msg.role === 'assistant') {
        messages.push({ role: 'assistant', content: msg.content });
        i++;
      } else if (msg.role === 'tool_use') {
        // Collect assistant content: any preceding assistant text + tool_use blocks
        const assistantContent: Array<{ type: string; [key: string]: unknown }> = [];

        // Look back: if previous message was 'assistant', remove it and include as text
        if (messages.length > 0 && messages[messages.length - 1].role === 'assistant') {
          const prevContent = messages.pop()!.content;
          if (typeof prevContent === 'string' && prevContent) {
            assistantContent.push({ type: 'text', text: prevContent });
          }
        }

        // Collect consecutive tool_use entries using stored IDs
        while (i < dbMessages.length && dbMessages[i].role === 'tool_use') {
          const tuMsg = dbMessages[i];
          assistantContent.push({
            type: 'tool_use',
            id: tuMsg.tool_use_id || `tu_fb_${fallbackCounter++}`,
            name: tuMsg.tool_name || '',
            input: tuMsg.tool_input ? JSON.parse(tuMsg.tool_input) : {},
          });
          i++;
        }

        messages.push({ role: 'assistant', content: assistantContent });

        // Collect consecutive tool_result entries using stored IDs
        const toolResultContent: Array<{ type: string; [key: string]: unknown }> = [];
        while (i < dbMessages.length && dbMessages[i].role === 'tool_result') {
          const trMsg = dbMessages[i];
          toolResultContent.push({
            type: 'tool_result',
            tool_use_id: trMsg.tool_use_id || `tu_fb_${fallbackCounter++}`,
            content: trMsg.content,
          });
          i++;
        }

        if (toolResultContent.length > 0) {
          messages.push({ role: 'user', content: toolResultContent });
        }
      } else {
        i++;
      }
    }

    return messages;
  }
}

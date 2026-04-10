// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import os from 'os';
import path from 'path';
import { spawn } from 'child_process';
import type { AIProvider } from '../ai-provider';
import type { AIStreamChunk, AIChatRequest, AIProviderType, ChatContext } from '../../../shared/types/chat';
import { resolveClaudePath, ensureClaudeOnPath } from '../claude-resolver';

/**
 * Claude Code local provider using the Claude Agent SDK.
 *
 * Exposes Turul's tools via an MCP server, so Claude Code can call
 * get_scan_history, aws_get_cost_data, etc. — identical to other providers.
 * Uses the user's local Claude Code authentication (no API key needed).
 */
export class ClaudeCodeProvider implements AIProvider {
  id: AIProviderType = 'claude-code';
  name = 'Claude Code (Local)';

  private dbPath: string;
  private context: ChatContext | undefined;

  constructor(opts: { cliPath?: string; dbPath?: string; context?: ChatContext }) {
    this.dbPath = opts.dbPath || '';
    this.context = opts.context;
  }

  async validateConfig(): Promise<{ valid: boolean; error?: string }> {
    const cliPath = resolveClaudePath();
    return new Promise((resolve) => {
      try {
        const proc = spawn(cliPath, ['--version'], {
          timeout: 10000,
          stdio: ['ignore', 'pipe', 'pipe'],
        });

        let stdout = '';
        proc.stdout?.on('data', (data: Buffer) => { stdout += data.toString(); });

        proc.on('close', (code: number | null) => {
          if (code === 0 && stdout.trim()) {
            resolve({ valid: true });
          } else {
            resolve({ valid: false, error: `Claude CLI not found at "${cliPath}". Configure the path in Settings > CLI Tool Paths.` });
          }
        });

        proc.on('error', (err: Error) => {
          resolve({ valid: false, error: `Claude CLI not found: ${err.message}. Configure the path in Settings > CLI Tool Paths.` });
        });
      } catch (err: any) {
        resolve({ valid: false, error: err.message });
      }
    });
  }

  async *sendMessage(request: AIChatRequest): AsyncGenerator<AIStreamChunk> {
    // Ensure the claude binary's directory is in PATH before the SDK spawns it
    ensureClaudeOnPath();

    // Dynamically import the SDK (ESM module)
    let queryFn: any;
    try {
      const sdk = await import('@anthropic-ai/claude-agent-sdk');
      queryFn = sdk.query;
    } catch (err: any) {
      yield { type: 'error', error: `Failed to load Claude Agent SDK: ${err.message}` };
      return;
    }

    // Build the last user message from the conversation
    const lastMessage = request.messages[request.messages.length - 1];
    const prompt = typeof lastMessage.content === 'string'
      ? lastMessage.content
      : lastMessage.content
          .filter((b: any) => b.type === 'text')
          .map((b: any) => b.text)
          .join('\n');

    // Build MCP server path — the compiled server script
    // __dirname = dist/main/ai/providers/, so go up one level to dist/main/ai/
    const mcpServerPath = path.join(__dirname, '..', 'mcp', 'turul-mcp-server.js');
    console.log('[claude-code] MCP server path:', mcpServerPath);
    console.log('[claude-code] DB path:', this.dbPath);
    console.log('[claude-code] Context:', JSON.stringify(this.context));

    // Environment variables for the MCP server
    const mcpEnv: Record<string, string> = {};
    if (this.dbPath) mcpEnv.TURUL_DB_PATH = this.dbPath;
    if (this.context?.profileName) mcpEnv.TURUL_PROFILE = this.context.profileName;
    if (this.context?.region) mcpEnv.TURUL_REGION = this.context.region;
    if (this.context?.projectId) mcpEnv.TURUL_PROJECT_ID = this.context.projectId;
    if (this.context?.cloudProvider) mcpEnv.TURUL_CLOUD_PROVIDER = this.context.cloudProvider;

    // Resolve project root for NODE_PATH so the MCP server can find node_modules
    // __dirname = dist/main/ai/providers/ → go up 4 levels to project root
    const projectRoot = path.resolve(__dirname, '..', '..', '..', '..');
    const nodeModulesPath = path.join(projectRoot, 'node_modules');

    try {
      console.log('[claude-code] Starting SDK query with MCP server...');
      console.log('[claude-code] Project root:', projectRoot);
      console.log('[claude-code] Node modules:', nodeModulesPath);
      console.log('[claude-code] PATH includes:', process.env.PATH?.split(':').filter(p => p.includes('claude')).join(', ') || 'none');

      const stream = queryFn({
        prompt,
        options: {
          systemPrompt: request.systemPrompt,
          cwd: os.tmpdir(),
          maxTurns: 10,
          mcpServers: {
            turul: {
              command: 'node',
              args: [mcpServerPath],
              env: {
                ...process.env,
                ...mcpEnv,
                NODE_PATH: nodeModulesPath,
              },
            },
          },
          allowedTools: ['mcp__turul__*'],
          // Disable all Claude Code built-in tools — only use Turul's MCP tools
          disallowedTools: [
            'Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep',
            'WebSearch', 'WebFetch', 'ToolSearch', 'Agent',
            'NotebookEdit', 'TodoWrite', 'AskUserQuestion',
            'ListMcpResourcesTool', 'ReadMcpResourceTool',
          ],
          stderr: (data: string) => console.error('[claude-code:stderr]', data),
        },
      });

      // Check MCP server status after initialization
      try {
        const mcpStatus = await stream.mcpServerStatus();
        console.log('[claude-code] MCP server status:', JSON.stringify(mcpStatus));
      } catch (e: any) {
        console.log('[claude-code] Could not get MCP status:', e.message);
      }

      for await (const message of stream) {
        console.log('[claude-code] Message type:', message.type, message.subtype || '');
        if (message.type === 'assistant') {
          // Extract text and tool_use from assistant messages
          const content = message.message?.content;
          if (Array.isArray(content)) {
            for (const block of content) {
              if (block.type === 'text' && block.text) {
                yield { type: 'text', text: block.text };
              } else if (block.type === 'tool_use') {
                yield {
                  type: 'tool_use',
                  toolUse: {
                    id: block.id,
                    name: block.name,
                    input: block.input as Record<string, unknown>,
                  },
                };
              } else if (block.type === 'tool_result') {
                yield {
                  type: 'tool_result',
                  toolResult: {
                    toolUseId: block.tool_use_id,
                    content: typeof block.content === 'string'
                      ? block.content
                      : JSON.stringify(block.content),
                  },
                };
              }
            }
          }
        } else if (message.type === 'result') {
          // Final result
          if (message.is_error && message.result) {
            yield { type: 'error', error: message.result };
          }
          yield { type: 'done' };
        }
      }
    } catch (err: any) {
      yield { type: 'error', error: `Claude Code error: ${err.message}` };
    }
  }
}

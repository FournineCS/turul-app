// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import crypto from 'crypto';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import type { AIToolDefinition } from '../../../shared/types/chat';
import type {
  McpServerConfig,
  McpServerStatus,
  McpToolInfo,
} from '../../../shared/types/mcp';
import type { DatabaseManager } from '../../database/db-manager';

const SETTINGS_KEY = 'mcp:servers';

interface ActiveServer {
  config: McpServerConfig;
  client: Client;
  transport: StdioClientTransport;
  tools: McpToolInfo[];
  status: McpServerStatus;
}

/**
 * Manages lifecycle of external MCP server connections.
 * Connects to MCP servers as a client, discovers tools,
 * and routes tool execution requests.
 */
export class McpClientManager {
  private servers = new Map<string, ActiveServer>();
  private configs: McpServerConfig[] = [];
  private dbManager: DatabaseManager;

  constructor(dbManager: DatabaseManager) {
    this.dbManager = dbManager;
  }

  /** Load saved server configs from settings DB and connect enabled servers. */
  async loadConfigs(): Promise<void> {
    const raw = this.dbManager.getSetting(SETTINGS_KEY);
    if (raw) {
      try {
        this.configs = JSON.parse(raw) as McpServerConfig[];
      } catch {
        this.configs = [];
      }
    }

    // Auto-connect enabled servers
    for (const config of this.configs) {
      if (config.enabled) {
        // Connect in background — don't block startup
        this.connectServer(config).catch((err) => {
          console.error(`[MCP] Failed to auto-connect "${config.name}":`, err);
        });
      }
    }
  }

  /** Persist current configs to settings DB. */
  private saveConfigs(): void {
    this.dbManager.setSetting(SETTINGS_KEY, JSON.stringify(this.configs));
  }

  /** Connect to an MCP server and discover its tools. */
  async connectServer(config: McpServerConfig): Promise<McpServerStatus> {
    // If already connected, disconnect first
    if (this.servers.has(config.id)) {
      await this.disconnectServer(config.id);
    }

    const status: McpServerStatus = {
      id: config.id,
      name: config.name,
      status: 'connecting',
      toolCount: 0,
    };

    // Create a placeholder while connecting
    const placeholder: ActiveServer = {
      config,
      client: null as unknown as Client,
      transport: null as unknown as StdioClientTransport,
      tools: [],
      status,
    };
    this.servers.set(config.id, placeholder);

    try {
      const transport = new StdioClientTransport({
        command: config.command,
        args: config.args,
        env: config.env
          ? { ...process.env, ...config.env } as Record<string, string>
          : undefined,
        stderr: 'pipe',
      });

      const client = new Client({
        name: 'turul-app',
        version: '1.0.0',
      });

      // Handle transport lifecycle
      transport.onclose = () => {
        const entry = this.servers.get(config.id);
        if (entry) {
          entry.status = { ...entry.status, status: 'disconnected', error: undefined };
        }
      };

      transport.onerror = (error: Error) => {
        const entry = this.servers.get(config.id);
        if (entry) {
          entry.status = { ...entry.status, status: 'error', error: error.message };
        }
      };

      await client.connect(transport);

      // Discover tools
      const toolsResult = await client.listTools();
      const tools: McpToolInfo[] = (toolsResult.tools || []).map((tool) => ({
        serverName: config.name,
        toolName: tool.name,
        qualifiedName: `mcp__${config.name}__${tool.name}`,
        description: tool.description || '',
        inputSchema: tool.inputSchema as Record<string, unknown>,
      }));

      const connectedStatus: McpServerStatus = {
        id: config.id,
        name: config.name,
        status: 'connected',
        toolCount: tools.length,
      };

      const entry: ActiveServer = {
        config,
        client,
        transport,
        tools,
        status: connectedStatus,
      };
      this.servers.set(config.id, entry);

      return connectedStatus;
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      const errorStatus: McpServerStatus = {
        id: config.id,
        name: config.name,
        status: 'error',
        toolCount: 0,
        error: errorMsg,
      };

      this.servers.set(config.id, {
        ...placeholder,
        status: errorStatus,
      });

      return errorStatus;
    }
  }

  /** Disconnect a server and clean up its process. */
  async disconnectServer(id: string): Promise<void> {
    const entry = this.servers.get(id);
    if (!entry) return;

    try {
      if (entry.client) {
        await entry.client.close();
      }
    } catch {
      // Best-effort cleanup
    }

    try {
      if (entry.transport) {
        await entry.transport.close();
      }
    } catch {
      // Best-effort cleanup
    }

    entry.status = {
      id: entry.config.id,
      name: entry.config.name,
      status: 'disconnected',
      toolCount: 0,
    };
    entry.tools = [];
    this.servers.set(id, entry);
  }

  /** Disconnect and reconnect a server. */
  async reconnectServer(id: string): Promise<McpServerStatus> {
    const entry = this.servers.get(id);
    if (!entry) {
      const config = this.configs.find((c) => c.id === id);
      if (!config) {
        return { id, name: '', status: 'error', toolCount: 0, error: 'Server not found' };
      }
      return this.connectServer(config);
    }

    await this.disconnectServer(id);
    return this.connectServer(entry.config);
  }

  /** Get all MCP tools as AIToolDefinitions for the tool registry. */
  getToolDefinitions(): AIToolDefinition[] {
    const definitions: AIToolDefinition[] = [];
    for (const entry of this.servers.values()) {
      if (entry.status.status !== 'connected') continue;
      for (const tool of entry.tools) {
        definitions.push({
          name: tool.qualifiedName,
          description: `[MCP: ${tool.serverName}] ${tool.description}`,
          inputSchema: tool.inputSchema,
        });
      }
    }
    return definitions;
  }

  /** Execute a tool on the appropriate MCP server. */
  async executeMcpTool(
    qualifiedName: string,
    args: Record<string, unknown>,
  ): Promise<string> {
    // Parse mcp__{serverName}__{toolName}
    const match = qualifiedName.match(/^mcp__(.+?)__(.+)$/);
    if (!match) {
      return JSON.stringify({ error: `Invalid MCP tool name: ${qualifiedName}` });
    }

    const [, serverName, toolName] = match;

    // Find the server by name
    let targetEntry: ActiveServer | undefined;
    for (const entry of this.servers.values()) {
      if (entry.config.name === serverName && entry.status.status === 'connected') {
        targetEntry = entry;
        break;
      }
    }

    if (!targetEntry) {
      return JSON.stringify({ error: `MCP server "${serverName}" is not connected` });
    }

    try {
      const result = await targetEntry.client.callTool({
        name: toolName,
        arguments: args,
      });

      // Extract text content from MCP response
      const textParts: string[] = [];
      for (const content of result.content as Array<{ type: string; text?: string }>) {
        if (content.type === 'text' && content.text) {
          textParts.push(content.text);
        }
      }

      return textParts.join('\n') || JSON.stringify(result.content);
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      return JSON.stringify({ error: `MCP tool execution failed: ${errorMsg}` });
    }
  }

  /** Get status of all configured servers. */
  getStatuses(): McpServerStatus[] {
    return this.configs.map((config) => {
      const entry = this.servers.get(config.id);
      if (entry) {
        return { ...entry.status };
      }
      return {
        id: config.id,
        name: config.name,
        status: 'disconnected' as const,
        toolCount: 0,
      };
    });
  }

  /** Get tools from all connected servers. */
  getAllTools(): McpToolInfo[] {
    const tools: McpToolInfo[] = [];
    for (const entry of this.servers.values()) {
      if (entry.status.status === 'connected') {
        tools.push(...entry.tools);
      }
    }
    return tools;
  }

  /** Get tools from a specific server. */
  getServerTools(id: string): McpToolInfo[] {
    const entry = this.servers.get(id);
    if (!entry || entry.status.status !== 'connected') return [];
    return [...entry.tools];
  }

  /** Add a new MCP server config. */
  async addServer(config: Omit<McpServerConfig, 'id'>): Promise<McpServerStatus> {
    // Validate unique name
    if (this.configs.some((c) => c.name === config.name)) {
      return {
        id: '',
        name: config.name,
        status: 'error',
        toolCount: 0,
        error: `Server name "${config.name}" is already in use`,
      };
    }

    const fullConfig: McpServerConfig = {
      ...config,
      id: crypto.randomUUID(),
    };

    this.configs.push(fullConfig);
    this.saveConfigs();

    if (fullConfig.enabled) {
      return this.connectServer(fullConfig);
    }

    return {
      id: fullConfig.id,
      name: fullConfig.name,
      status: 'disconnected',
      toolCount: 0,
    };
  }

  /** Remove an MCP server and disconnect it. */
  async removeServer(id: string): Promise<void> {
    await this.disconnectServer(id);
    this.servers.delete(id);
    this.configs = this.configs.filter((c) => c.id !== id);
    this.saveConfigs();
  }

  /** Update an MCP server config. Reconnects if the server was connected. */
  async updateServer(
    id: string,
    updates: Partial<Omit<McpServerConfig, 'id'>>,
  ): Promise<McpServerStatus> {
    const idx = this.configs.findIndex((c) => c.id === id);
    if (idx === -1) {
      return { id, name: '', status: 'error', toolCount: 0, error: 'Server not found' };
    }

    // Validate name uniqueness if name is changing
    if (updates.name && updates.name !== this.configs[idx].name) {
      if (this.configs.some((c) => c.name === updates.name && c.id !== id)) {
        return {
          id,
          name: updates.name,
          status: 'error',
          toolCount: 0,
          error: `Server name "${updates.name}" is already in use`,
        };
      }
    }

    const updatedConfig: McpServerConfig = { ...this.configs[idx], ...updates };
    this.configs[idx] = updatedConfig;
    this.saveConfigs();

    const wasConnected = this.servers.get(id)?.status.status === 'connected';

    if (wasConnected || updatedConfig.enabled) {
      return this.reconnectServer(id);
    }

    if (!updatedConfig.enabled) {
      await this.disconnectServer(id);
    }

    return {
      id,
      name: updatedConfig.name,
      status: 'disconnected',
      toolCount: 0,
    };
  }

  /** Disconnect all servers. Call on app shutdown. */
  async shutdown(): Promise<void> {
    const disconnects = Array.from(this.servers.keys()).map((id) =>
      this.disconnectServer(id).catch(() => {}),
    );
    await Promise.all(disconnects);
    this.servers.clear();
  }
}

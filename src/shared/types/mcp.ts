// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

/** Configuration for an MCP server that can be connected to via stdio transport. */
export interface McpServerConfig {
  id: string;
  /** Unique name used in tool prefix: mcp__{name}__{toolName} */
  name: string;
  /** Executable command, e.g. "node", "npx", "python" */
  command: string;
  /** Command arguments, e.g. ["server.js", "--port", "3000"] */
  args: string[];
  /** Optional environment variables passed to the spawned process */
  env?: Record<string, string>;
  /** Whether this server should be auto-connected */
  enabled: boolean;
}

/** Runtime status of an MCP server connection. */
export interface McpServerStatus {
  id: string;
  name: string;
  status: 'connected' | 'disconnected' | 'error' | 'connecting';
  toolCount: number;
  error?: string;
}

/** Describes a single tool discovered from a connected MCP server. */
export interface McpToolInfo {
  serverName: string;
  toolName: string;
  /** Fully qualified name: mcp__{serverName}__{toolName} */
  qualifiedName: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

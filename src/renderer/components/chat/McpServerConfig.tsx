// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React, { useEffect, useState } from 'react';
import { useMcpStore } from '../../stores/mcpStore';
import type { McpServerStatus } from '../../../shared/types/mcp';

const STATUS_COLORS: Record<McpServerStatus['status'], string> = {
  connected: 'var(--color-success)',
  disconnected: 'var(--color-text-muted)',
  error: 'var(--color-error)',
  connecting: 'var(--color-warning)',
};

const McpServerConfig: React.FC = () => {
  const {
    servers,
    tools,
    isLoading,
    error,
    loadServers,
    loadTools,
    addServer,
    removeServer,
    connectServer,
    disconnectServer,
    reconnectServer,
  } = useMcpStore();

  const [isExpanded, setIsExpanded] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [expandedServerId, setExpandedServerId] = useState<string | null>(null);

  // Add form state
  const [formName, setFormName] = useState('');
  const [formCommand, setFormCommand] = useState('');
  const [formArgs, setFormArgs] = useState('');
  const [formEnv, setFormEnv] = useState('');
  const [formEnabled, setFormEnabled] = useState(true);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (isExpanded) {
      loadServers();
      loadTools();
    }
  }, [isExpanded, loadServers, loadTools]);

  const resetForm = () => {
    setFormName('');
    setFormCommand('');
    setFormArgs('');
    setFormEnv('');
    setFormEnabled(true);
    setFormError(null);
  };

  const handleAdd = async () => {
    if (!formName.trim() || !formCommand.trim()) {
      setFormError('Name and command are required');
      return;
    }

    if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]*$/.test(formName.trim())) {
      setFormError('Name must be alphanumeric (hyphens and underscores allowed)');
      return;
    }

    const args = formArgs.trim()
      ? formArgs.split('\n').map(a => a.trim()).filter(Boolean)
      : [];

    let env: Record<string, string> | undefined;
    if (formEnv.trim()) {
      env = {};
      for (const line of formEnv.split('\n')) {
        const eqIdx = line.indexOf('=');
        if (eqIdx > 0) {
          env[line.substring(0, eqIdx).trim()] = line.substring(eqIdx + 1).trim();
        }
      }
    }

    const result = await addServer({
      name: formName.trim(),
      command: formCommand.trim(),
      args,
      env,
      enabled: formEnabled,
    });

    if (result) {
      resetForm();
      setShowAddForm(false);
    }
  };

  const handleToggleConnection = async (server: McpServerStatus) => {
    if (server.status === 'connected' || server.status === 'connecting') {
      await disconnectServer(server.id);
    } else {
      await connectServer(server.id);
    }
  };

  const serverTools = (serverId: string) => {
    const server = servers.find(s => s.id === serverId);
    if (!server) return [];
    return tools.filter(t => t.serverName === server.name);
  };

  const connectedCount = servers.filter(s => s.status === 'connected').length;
  const totalToolCount = tools.length;

  return (
    <div className="mcp-config">
      <button
        className="mcp-config-toggle"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <span className="mcp-config-toggle-left">
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M8 1a2 2 0 0 1 2 2v1h3a1 1 0 0 1 1 1v2a1 1 0 0 1-1 1h-1v5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8H3a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3V3a2 2 0 0 1 2-2zm0 1a1 1 0 0 0-1 1v1.5a.5.5 0 0 1-.5.5H3.5v2h3a.5.5 0 0 1 .5.5V13a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1V7.5a.5.5 0 0 1 .5-.5h1V5h-3.5a.5.5 0 0 1-.5-.5V3a1 1 0 0 0-1-1z"/>
          </svg>
          MCP Servers
          {connectedCount > 0 && (
            <span className="mcp-config-badge">
              {connectedCount} connected · {totalToolCount} tools
            </span>
          )}
        </span>
        <svg
          width="12" height="12" viewBox="0 0 12 12" fill="currentColor"
          style={{ transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
        >
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none"/>
        </svg>
      </button>

      {isExpanded && (
        <div className="mcp-config-body">
          {error && (
            <div className="mcp-config-error">{error}</div>
          )}

          {isLoading && servers.length === 0 && (
            <div className="mcp-config-empty">Loading...</div>
          )}

          {!isLoading && servers.length === 0 && !showAddForm && (
            <div className="mcp-config-empty">
              No MCP servers configured. Add one to extend AI capabilities.
            </div>
          )}

          {servers.map((server) => (
            <div key={server.id} className="mcp-server-row">
              <div className="mcp-server-info">
                <div className="mcp-server-header">
                  <span
                    className="mcp-server-status-dot"
                    style={{ background: STATUS_COLORS[server.status] }}
                    title={server.status}
                  />
                  <span className="mcp-server-name">{server.name}</span>
                  {server.status === 'connected' && (
                    <span className="mcp-server-tool-count">{server.toolCount} tools</span>
                  )}
                </div>
                {server.error && (
                  <div className="mcp-server-error">{server.error}</div>
                )}
              </div>
              <div className="mcp-server-actions">
                <button
                  className="chat-header-btn"
                  onClick={() => setExpandedServerId(
                    expandedServerId === server.id ? null : server.id
                  )}
                  title="Show tools"
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M6 8a.5.5 0 0 0 .5.5h5.793l-2.147 2.146a.5.5 0 0 0 .708.708l3-3a.5.5 0 0 0 0-.708l-3-3a.5.5 0 0 0-.708.708L12.293 7.5H6.5A.5.5 0 0 0 6 8z"/>
                  </svg>
                </button>
                {server.status === 'error' && (
                  <button
                    className="chat-header-btn"
                    onClick={() => reconnectServer(server.id)}
                    title="Reconnect"
                  >
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                      <path d="M11.534 7h3.932a.25.25 0 0 1 .192.41l-1.966 2.36a.25.25 0 0 1-.384 0l-1.966-2.36a.25.25 0 0 1 .192-.41zm-11 2h3.932a.25.25 0 0 0 .192-.41L2.692 6.23a.25.25 0 0 0-.384 0L.342 8.59A.25.25 0 0 0 .534 9z"/>
                      <path d="M8 3c-1.552 0-2.94.707-3.857 1.818a.5.5 0 1 1-.771-.636A5.501 5.501 0 0 1 13.5 8a.5.5 0 0 1-1 0A4.5 4.5 0 0 0 8 3zM3.5 8a.5.5 0 0 1 1 0A4.5 4.5 0 0 0 8 12.5c1.552 0 2.94-.707 3.857-1.818a.5.5 0 1 1 .771.636A5.501 5.501 0 0 1 2.5 8z"/>
                    </svg>
                  </button>
                )}
                <button
                  className="chat-header-btn"
                  onClick={() => handleToggleConnection(server)}
                  title={server.status === 'connected' ? 'Disconnect' : 'Connect'}
                >
                  {server.status === 'connected' || server.status === 'connecting' ? (
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="var(--color-success)">
                      <circle cx="8" cy="8" r="5"/>
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 16 16" fill="var(--color-text-muted)">
                      <circle cx="8" cy="8" r="5" stroke="currentColor" strokeWidth="1" fill="none"/>
                    </svg>
                  )}
                </button>
                <button
                  className="chat-header-btn"
                  onClick={() => removeServer(server.id)}
                  title="Remove"
                >
                  <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5zm3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0V6z"/>
                    <path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1 0-2H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1zM4.118 4L4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4H4.118z"/>
                  </svg>
                </button>
              </div>

              {expandedServerId === server.id && server.status === 'connected' && (
                <div className="mcp-server-tools">
                  {serverTools(server.id).length === 0 ? (
                    <div className="mcp-config-empty">No tools discovered</div>
                  ) : (
                    serverTools(server.id).map((tool) => (
                      <div key={tool.qualifiedName} className="mcp-tool-item">
                        <span className="mcp-tool-name">{tool.toolName}</span>
                        <span className="mcp-tool-desc">{tool.description}</span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}

          {showAddForm ? (
            <div className="mcp-add-form">
              <div className="chat-settings-group">
                <label>Name</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. filesystem"
                  spellCheck={false}
                />
              </div>
              <div className="chat-settings-group">
                <label>Command</label>
                <input
                  type="text"
                  value={formCommand}
                  onChange={(e) => setFormCommand(e.target.value)}
                  placeholder="e.g. npx"
                  spellCheck={false}
                />
              </div>
              <div className="chat-settings-group">
                <label>Arguments (one per line)</label>
                <textarea
                  className="mcp-textarea"
                  value={formArgs}
                  onChange={(e) => setFormArgs(e.target.value)}
                  placeholder={"e.g.\n@modelcontextprotocol/server-filesystem\n/tmp"}
                  rows={3}
                  spellCheck={false}
                />
              </div>
              <div className="chat-settings-group">
                <label>Environment (KEY=VALUE per line)</label>
                <textarea
                  className="mcp-textarea"
                  value={formEnv}
                  onChange={(e) => setFormEnv(e.target.value)}
                  placeholder="e.g. NODE_ENV=production"
                  rows={2}
                  spellCheck={false}
                />
              </div>
              <label className="chat-settings-checkbox">
                <input
                  type="checkbox"
                  checked={formEnabled}
                  onChange={(e) => setFormEnabled(e.target.checked)}
                />
                Auto-connect on startup
              </label>
              {formError && <div className="mcp-config-error">{formError}</div>}
              <div className="mcp-add-form-actions">
                <button
                  className="btn btn-sm btn-primary"
                  onClick={handleAdd}
                >
                  Add Server
                </button>
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={() => { resetForm(); setShowAddForm(false); }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              className="mcp-add-btn"
              onClick={() => setShowAddForm(true)}
            >
              + Add MCP Server
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default McpServerConfig;

// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React, { useEffect, useRef, useState } from 'react';
import { useChatStore } from '../../stores/chatStore';
import ChatMessageComponent, { stripThinking } from './ChatMessage';
import ChatInput from './ChatInput';

const BEDROCK_MODELS = [
  { id: 'amazon.nova-pro-v1:0', label: 'Amazon Nova Pro' },
  { id: 'amazon.nova-lite-v1:0', label: 'Amazon Nova Lite' },
  { id: 'amazon.nova-micro-v1:0', label: 'Amazon Nova Micro' },
  { id: 'anthropic.claude-sonnet-4-20250514-v1:0', label: 'Claude Sonnet 4' },
  { id: 'anthropic.claude-haiku-4-5-20251001-v1:0', label: 'Claude Haiku 4.5' },
  { id: 'anthropic.claude-3-5-sonnet-20241022-v2:0', label: 'Claude 3.5 Sonnet v2' },
];

const BEDROCK_REGIONS = [
  { id: 'us-east-1', label: 'US East (N. Virginia)' },
  { id: 'us-west-2', label: 'US West (Oregon)' },
  { id: 'eu-west-1', label: 'EU (Ireland)' },
  { id: 'ap-northeast-1', label: 'Asia Pacific (Tokyo)' },
];

const ChatPanel: React.FC = () => {
  const {
    isPanelOpen,
    closePanel,
    conversations,
    activeConversationId,
    messages,
    isStreaming,
    streamingText,
    selectedProvider,
    bedrockModel,
    bedrockRegion,
    bedrockAccessKeyId,
    bedrockSecretKey,
    error,
    loadConversations,
    selectConversation,
    createConversation,
    deleteConversation,
    setProvider,
    setBedrockModel,
    setBedrockRegion,
    setBedrockApiKeys,
  } = useChatStore();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [localModel, setLocalModel] = useState(bedrockModel);
  const [localRegion, setLocalRegion] = useState(bedrockRegion);
  const [localAccessKey, setLocalAccessKey] = useState(bedrockAccessKeyId);
  const [localSecretKey, setLocalSecretKey] = useState(bedrockSecretKey);
  const [settingsSaved, setSettingsSaved] = useState(false);

  // Sync local state when persisted settings load
  useEffect(() => {
    setLocalModel(bedrockModel);
    setLocalRegion(bedrockRegion);
    setLocalAccessKey(bedrockAccessKeyId);
    setLocalSecretKey(bedrockSecretKey);
  }, [bedrockModel, bedrockRegion, bedrockAccessKeyId, bedrockSecretKey]);

  const handleSaveSettings = () => {
    setBedrockModel(localModel);
    setBedrockRegion(localRegion);
    setBedrockApiKeys(localAccessKey, localSecretKey);
    setSettingsSaved(true);
    setTimeout(() => setSettingsSaved(false), 2000);
  };

  useEffect(() => {
    if (isPanelOpen) {
      loadConversations();
    }
  }, [isPanelOpen, loadConversations]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  if (!isPanelOpen) return null;

  return (
    <div className="chat-panel">
      <div className="chat-panel-header">
        <div className="chat-panel-header-left">
          <h3 className="chat-panel-title">AI Chat</h3>
        </div>
        <div className="chat-panel-header-right">
          <button
            className={`chat-header-btn ${showSettings ? 'chat-header-btn--active' : ''}`}
            onClick={() => setShowSettings(!showSettings)}
            title="Settings"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
              <path d="M19.14,12.94c0.04-0.3,0.06-0.61,0.06-0.94c0-0.32-0.02-0.64-0.07-0.94l2.03-1.58c0.18-0.14,0.23-0.41,0.12-0.61l-1.92-3.32c-0.12-0.22-0.37-0.29-0.59-0.22l-2.39,0.96c-0.5-0.38-1.03-0.7-1.62-0.94L14.4,2.81c-0.04-0.24-0.24-0.41-0.48-0.41h-3.84c-0.24,0-0.43,0.17-0.47,0.41L9.25,5.35C8.66,5.59,8.12,5.92,7.63,6.29L5.24,5.33c-0.22-0.08-0.47,0-0.59,0.22L2.74,8.87C2.62,9.08,2.66,9.34,2.86,9.48l2.03,1.58C4.84,11.36,4.8,11.69,4.8,12s0.02,0.64,0.07,0.94l-2.03,1.58c-0.18,0.14-0.23,0.41-0.12,0.61l1.92,3.32c0.12,0.22,0.37,0.29,0.59,0.22l2.39-0.96c0.5,0.38,1.03,0.7,1.62,0.94l0.36,2.54c0.05,0.24,0.24,0.41,0.48,0.41h3.84c0.24,0,0.44-0.17,0.47-0.41l0.36-2.54c0.59-0.24,1.13-0.56,1.62-0.94l2.39,0.96c0.22,0.08,0.47,0,0.59-0.22l1.92-3.32c0.12-0.22,0.07-0.47-0.12-0.61L19.14,12.94z M12,15.6c-1.98,0-3.6-1.62-3.6-3.6s1.62-3.6,3.6-3.6s3.6,1.62,3.6,3.6S13.98,15.6,12,15.6z" />
            </svg>
          </button>
          <button
            className="chat-header-btn"
            onClick={createConversation}
            title="New Chat"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z" />
            </svg>
          </button>
          <button className="chat-header-btn" onClick={closePanel} title="Close">
            <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <div className="chat-settings">
          <div className="chat-settings-group">
            <label>Model</label>
            <select value={localModel} onChange={(e) => setLocalModel(e.target.value)}>
              {BEDROCK_MODELS.map(m => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
            </select>
          </div>
          <div className="chat-settings-group">
            <label>Region</label>
            <select value={localRegion} onChange={(e) => setLocalRegion(e.target.value)}>
              {BEDROCK_REGIONS.map(r => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>
          </div>
          <div className="chat-settings-group">
            <label>Access Key ID</label>
            <input
              type="text"
              value={localAccessKey}
              onChange={(e) => setLocalAccessKey(e.target.value)}
              placeholder="AKIA..."
              spellCheck={false}
            />
          </div>
          <div className="chat-settings-group">
            <label>Secret Access Key</label>
            <input
              type="password"
              value={localSecretKey}
              onChange={(e) => setLocalSecretKey(e.target.value)}
              placeholder="Secret key"
            />
          </div>
          <button className="chat-settings-save" onClick={handleSaveSettings}>
            {settingsSaved ? '✓ Saved' : 'Save Settings'}
          </button>
        </div>
      )}

      {/* Conversation list (collapsible) */}
      {conversations.length > 0 && !activeConversationId && !showSettings && (
        <div className="chat-conversation-list">
          {conversations.map((conv) => (
            <div
              key={conv.id}
              className="chat-conversation-item"
              onClick={() => selectConversation(conv.id)}
            >
              <span className="chat-conversation-title">{conv.title}</span>
              <button
                className="chat-conversation-delete"
                onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}
                title="Delete"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
                  <path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Back to list */}
      {activeConversationId && !showSettings && (
        <button
          className="chat-back-btn"
          onClick={() => useChatStore.setState({ activeConversationId: null, messages: [] })}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" width="16" height="16">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z" />
          </svg>
          Conversations
        </button>
      )}

      {/* Messages */}
      <div className="chat-messages">
        {messages.length === 0 && !isStreaming && (
          <div className="chat-empty">
            <svg viewBox="0 0 24 24" fill="currentColor" width="48" height="48" opacity={0.3}>
              <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" />
            </svg>
            <p>Ask me about your cloud resources, costs, or security posture.</p>
          </div>
        )}

        {messages.map((msg) => (
          <ChatMessageComponent key={msg.id} message={msg} />
        ))}

        {isStreaming && streamingText && stripThinking(streamingText) && (
          <div className="chat-message chat-message--assistant">
            <div className="chat-message-bubble chat-message-bubble--assistant chat-message-bubble--streaming">
              {stripThinking(streamingText)}
              <span className="chat-cursor" />
            </div>
          </div>
        )}

        {isStreaming && !streamingText && (
          <div className="chat-message chat-message--assistant">
            <div className="chat-message-bubble chat-message-bubble--assistant chat-message-bubble--streaming">
              <span className="chat-typing-indicator">
                <span /><span /><span />
              </span>
            </div>
          </div>
        )}

        {error && (
          <div className="chat-error">{error}</div>
        )}

        <div ref={messagesEndRef} />
      </div>

      <ChatInput compact />
    </div>
  );
};

export default ChatPanel;

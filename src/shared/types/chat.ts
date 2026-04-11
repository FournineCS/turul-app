// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

export type AIProviderType = 'bedrock' | 'anthropic' | 'openai' | 'gemini';

export interface ProviderModelDefinition {
  id: string;
  label: string;
}

export interface ProviderFieldDefinition {
  key: string;
  label: string;
  type: 'text' | 'password' | 'select';
  placeholder?: string;
  required?: boolean;
  options?: Array<{ id: string; label: string }>;
}

export interface ChatConversation {
  id: string;
  title: string;
  provider: AIProviderType;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'tool_use' | 'tool_result';
  content: string;
  toolName?: string;
  toolInput?: string;
  createdAt: string;
}

export interface AIStreamChunk {
  type: 'text' | 'tool_use' | 'tool_result' | 'error' | 'done';
  text?: string;
  toolUse?: { id: string; name: string; input: Record<string, unknown> };
  toolResult?: { toolUseId: string; content: string };
  error?: string;
}

export interface ChatContext {
  cloudProvider: 'aws' | 'gcp';
  profileName?: string;
  projectId?: string;
  latestScanId?: string;
  region?: string;
}

export interface AIChatRequest {
  messages: Array<{
    role: 'user' | 'assistant';
    content: string | Array<{ type: string; [key: string]: unknown }>;
  }>;
  systemPrompt: string;
  tools?: AIToolDefinition[];
  context?: ChatContext;
}

export interface AIToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface AIProviderConfig {
  type: AIProviderType;
  name: string;
  configured: boolean;
  models?: string[];
  defaultModel?: string;
}

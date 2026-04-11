// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import type { AIProviderType, ProviderModelDefinition, ProviderFieldDefinition } from '../types/chat';

export interface ProviderConfig {
  label: string;
  models: ProviderModelDefinition[];
  fields: ProviderFieldDefinition[];
  defaults: Record<string, string>;
}

export const PROVIDER_CONFIGS: Record<AIProviderType, ProviderConfig> = {
  bedrock: {
    label: 'AWS Bedrock',
    models: [
      { id: 'amazon.nova-pro-v1:0', label: 'Amazon Nova Pro' },
      { id: 'amazon.nova-lite-v1:0', label: 'Amazon Nova Lite' },
      { id: 'amazon.nova-micro-v1:0', label: 'Amazon Nova Micro' },
      { id: 'anthropic.claude-sonnet-4-20250514-v1:0', label: 'Claude Sonnet 4' },
      { id: 'anthropic.claude-haiku-4-5-20251001-v1:0', label: 'Claude Haiku 4.5' },
      { id: 'anthropic.claude-3-5-sonnet-20241022-v2:0', label: 'Claude 3.5 Sonnet v2' },
    ],
    fields: [
      {
        key: 'model',
        label: 'Model',
        type: 'select',
      },
      {
        key: 'region',
        label: 'Region',
        type: 'select',
        options: [
          { id: 'us-east-1', label: 'US East (N. Virginia)' },
          { id: 'us-west-2', label: 'US West (Oregon)' },
          { id: 'eu-west-1', label: 'EU (Ireland)' },
          { id: 'ap-northeast-1', label: 'Asia Pacific (Tokyo)' },
        ],
      },
      {
        key: 'accessKeyId',
        label: 'Access Key ID',
        type: 'text',
        placeholder: 'AKIA...',
        required: true,
      },
      {
        key: 'secretKey',
        label: 'Secret Access Key',
        type: 'password',
        placeholder: 'Secret key',
        required: true,
      },
    ],
    defaults: {
      model: 'amazon.nova-pro-v1:0',
      region: 'us-east-1',
    },
  },

  anthropic: {
    label: 'Anthropic (Claude)',
    models: [
      { id: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
      { id: 'claude-opus-4-20250514', label: 'Claude Opus 4' },
      { id: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5' },
    ],
    fields: [
      {
        key: 'model',
        label: 'Model',
        type: 'select',
      },
      {
        key: 'apiKey',
        label: 'API Key',
        type: 'password',
        placeholder: 'sk-ant-...',
        required: true,
      },
    ],
    defaults: {
      model: 'claude-sonnet-4-20250514',
    },
  },

  openai: {
    label: 'OpenAI',
    models: [
      { id: 'gpt-4o', label: 'GPT-4o' },
      { id: 'gpt-4o-mini', label: 'GPT-4o Mini' },
      { id: 'o3', label: 'o3' },
      { id: 'o3-mini', label: 'o3 Mini' },
      { id: 'o4-mini', label: 'o4 Mini' },
    ],
    fields: [
      {
        key: 'model',
        label: 'Model',
        type: 'select',
      },
      {
        key: 'apiKey',
        label: 'API Key',
        type: 'password',
        placeholder: 'sk-...',
        required: true,
      },
      {
        key: 'orgId',
        label: 'Organization ID (optional)',
        type: 'text',
        placeholder: 'org-...',
      },
    ],
    defaults: {
      model: 'gpt-4o',
    },
  },

  gemini: {
    label: 'Google Gemini',
    models: [
      { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
      { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
    ],
    fields: [
      {
        key: 'model',
        label: 'Model',
        type: 'select',
      },
      {
        key: 'apiKey',
        label: 'API Key',
        type: 'password',
        placeholder: 'AIza...',
        required: true,
      },
    ],
    defaults: {
      model: 'gemini-2.5-flash',
    },
  },
};

/** All provider types in display order */
export const PROVIDER_ORDER: AIProviderType[] = ['bedrock', 'anthropic', 'openai', 'gemini'];

/** Settings keys that should be encrypted at rest */
export const ENCRYPTED_PROVIDER_KEYS: Record<string, Set<string>> = {
  bedrock: new Set(['accessKeyId', 'secretKey']),
  anthropic: new Set(['apiKey']),
  openai: new Set(['apiKey', 'orgId']),
  gemini: new Set(['apiKey']),
};

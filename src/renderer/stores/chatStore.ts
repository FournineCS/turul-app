// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { create } from 'zustand';
import type { ChatConversation, ChatMessage, AIStreamChunk, AIProviderType, ChatContext } from '../../shared/types';
import { PROVIDER_CONFIGS, PROVIDER_ORDER } from '../../shared/constants/provider-configs';
import { useProfileStore } from './profileStore';
import { useProviderStore } from './providerStore';
import { useGCPProjectStore } from './gcpProjectStore';

type ProviderConfigs = Record<AIProviderType, Record<string, string>>;

function buildDefaultConfigs(): ProviderConfigs {
  const configs = {} as ProviderConfigs;
  for (const key of PROVIDER_ORDER) {
    configs[key] = { ...PROVIDER_CONFIGS[key].defaults };
  }
  return configs;
}

interface ChatState {
  conversations: ChatConversation[];
  activeConversationId: string | null;
  messages: ChatMessage[];
  isStreaming: boolean;
  streamingText: string;
  selectedProvider: AIProviderType;
  providerConfigs: ProviderConfigs;
  error: string | null;
  isPanelOpen: boolean;
  providers: Array<{ type: AIProviderType; name: string; configured: boolean }>;

  // Actions
  loadConversations: () => Promise<void>;
  selectConversation: (id: string) => Promise<void>;
  createConversation: () => Promise<string | null>;
  deleteConversation: (id: string) => Promise<void>;
  sendMessage: (content: string) => Promise<void>;
  stopGeneration: () => void;
  setProvider: (provider: AIProviderType) => void;
  setProviderConfig: (provider: AIProviderType, key: string, value: string) => void;
  saveProviderSettings: (provider: AIProviderType) => void;
  togglePanel: () => void;
  openPanel: () => void;
  closePanel: () => void;
  loadProviders: () => Promise<void>;
}

/** Load persisted chat settings for all providers on store creation */
const loadPersistedSettings = async (set: (partial: Partial<ChatState>) => void) => {
  try {
    const configs = buildDefaultConfigs();

    // Load selected provider
    const providerResult = await window.electronAPI.settings.get('chat:selectedProvider');
    const selectedProvider = (providerResult.data as AIProviderType) || 'bedrock';

    // Load per-provider settings
    for (const providerKey of PROVIDER_ORDER) {
      const providerConfig = PROVIDER_CONFIGS[providerKey];
      for (const field of providerConfig.fields) {
        const settingKey = `chat:${providerKey}:${field.key}`;
        const result = await window.electronAPI.settings.get(settingKey);
        if (result.data) {
          configs[providerKey][field.key] = result.data;
        }
      }
    }

    // Backward compatibility: migrate old bedrock keys
    if (!configs.bedrock.accessKeyId) {
      const oldAccessKey = await window.electronAPI.settings.get('chat:bedrockAccessKeyId');
      if (oldAccessKey.data) {
        configs.bedrock.accessKeyId = oldAccessKey.data;
        window.electronAPI.settings.set('chat:bedrock:accessKeyId', oldAccessKey.data).catch(() => {});
      }
    }
    if (!configs.bedrock.secretKey) {
      const oldSecretKey = await window.electronAPI.settings.get('chat:bedrockSecretKey');
      if (oldSecretKey.data) {
        configs.bedrock.secretKey = oldSecretKey.data;
        window.electronAPI.settings.set('chat:bedrock:secretKey', oldSecretKey.data).catch(() => {});
      }
    }
    if (!configs.bedrock.model || configs.bedrock.model === 'amazon.nova-pro-v1:0') {
      const oldModel = await window.electronAPI.settings.get('chat:bedrockModel');
      if (oldModel.data) {
        configs.bedrock.model = oldModel.data;
      }
    }
    if (!configs.bedrock.region || configs.bedrock.region === 'us-east-1') {
      const oldRegion = await window.electronAPI.settings.get('chat:bedrockRegion');
      if (oldRegion.data) {
        configs.bedrock.region = oldRegion.data;
      }
    }

    set({ providerConfigs: configs, selectedProvider });
  } catch {
    // Silently fail — defaults are fine
  }
};

export const useChatStore = create<ChatState>((set, get) => {
  loadPersistedSettings(set);

  return {
  conversations: [],
  activeConversationId: null,
  messages: [],
  isStreaming: false,
  streamingText: '',
  selectedProvider: 'bedrock',
  providerConfigs: buildDefaultConfigs(),
  error: null,
  isPanelOpen: false,
  providers: [],

  loadConversations: async () => {
    try {
      const result = await window.electronAPI.chat.listConversations();
      if (result.success) {
        set({ conversations: result.data || [] });
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load conversations' });
    }
  },

  selectConversation: async (id: string) => {
    try {
      const result = await window.electronAPI.chat.getConversation(id);
      if (result.success && result.data) {
        set({
          activeConversationId: id,
          messages: result.data.messages,
          error: null,
        });
      }
    } catch (err: any) {
      set({ error: err.message });
    }
  },

  createConversation: async () => {
    try {
      const { selectedProvider } = get();
      const result = await window.electronAPI.chat.createConversation('New Chat', selectedProvider);
      if (result.success && result.data) {
        set(state => ({
          conversations: [result.data!, ...state.conversations],
          activeConversationId: result.data!.id,
          messages: [],
          error: null,
        }));
        return result.data.id;
      }
      return null;
    } catch {
      return null;
    }
  },

  deleteConversation: async (id: string) => {
    try {
      await window.electronAPI.chat.deleteConversation(id);
      set(state => ({
        conversations: state.conversations.filter(c => c.id !== id),
        activeConversationId: state.activeConversationId === id ? null : state.activeConversationId,
        messages: state.activeConversationId === id ? [] : state.messages,
      }));
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to delete conversation' });
    }
  },

  sendMessage: async (content: string) => {
    const { activeConversationId, selectedProvider, providerConfigs } = get();

    let convId = activeConversationId;
    if (!convId) {
      convId = await get().createConversation();
      if (!convId) return;
    }

    const userMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      conversationId: convId,
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    };

    set(state => ({
      messages: [...state.messages, userMsg],
      isStreaming: true,
      streamingText: '',
      error: null,
    }));

    // Build cloud context for tools
    const profileName = useProfileStore.getState().selectedProfileName;
    const cloudProvider = useProviderStore.getState().selectedProvider;
    const projectId = useGCPProjectStore.getState().selectedProjectId;
    const context: ChatContext = {
      cloudProvider,
      profileName: profileName || undefined,
      projectId: projectId || undefined,
    };

    // Build provider config from current provider settings
    const currentConfig = providerConfigs[selectedProvider] || {};
    const providerConfig: Record<string, string | undefined> = {};
    for (const [k, v] of Object.entries(currentConfig)) {
      providerConfig[k] = v || undefined;
    }

    const unsubscribe = window.electronAPI.chat.onStreamChunk((chunk: AIStreamChunk) => {
      const state = get();
      if (chunk.type === 'text' && chunk.text) {
        set({ streamingText: state.streamingText + chunk.text });
      } else if (chunk.type === 'tool_use' && chunk.toolUse) {
        const currentText = get().streamingText;
        const newMessages = [...get().messages];
        if (currentText) {
          newMessages.push({
            id: `assistant-${Date.now()}`,
            conversationId: convId!,
            role: 'assistant',
            content: currentText,
            createdAt: new Date().toISOString(),
          });
        }
        const toolMsg: ChatMessage = {
          id: `tool-${Date.now()}-${chunk.toolUse.id}`,
          conversationId: convId!,
          role: 'tool_use',
          content: '',
          toolName: chunk.toolUse.name,
          toolInput: JSON.stringify(chunk.toolUse.input),
          createdAt: new Date().toISOString(),
        };
        newMessages.push(toolMsg);
        set({ messages: newMessages, streamingText: '' });
      } else if (chunk.type === 'tool_result' && chunk.toolResult) {
        const resultMsg: ChatMessage = {
          id: `result-${Date.now()}-${chunk.toolResult.toolUseId}`,
          conversationId: convId!,
          role: 'tool_result',
          content: chunk.toolResult.content,
          createdAt: new Date().toISOString(),
        };
        set(state => ({ messages: [...state.messages, resultMsg] }));
      } else if (chunk.type === 'error') {
        set({ error: chunk.error || 'Unknown error' });
      }
    });

    try {
      await window.electronAPI.chat.sendMessage(convId, content, selectedProvider, context, providerConfig);

      const finalText = get().streamingText;
      if (finalText) {
        const assistantMsg: ChatMessage = {
          id: `assistant-${Date.now()}`,
          conversationId: convId,
          role: 'assistant',
          content: finalText,
          createdAt: new Date().toISOString(),
        };
        set(state => ({ messages: [...state.messages, assistantMsg] }));
      }

      if (get().messages.filter(m => m.role === 'user').length === 1) {
        const title = content.slice(0, 60) + (content.length > 60 ? '...' : '');
        await window.electronAPI.chat.updateTitle(convId, title);
        set(state => ({
          conversations: state.conversations.map(c =>
            c.id === convId ? { ...c, title } : c
          ),
        }));
      }
    } catch (err: any) {
      set({ error: err.message });
    } finally {
      unsubscribe();
      set({ isStreaming: false, streamingText: '' });
    }
  },

  stopGeneration: () => {
    const { activeConversationId } = get();
    if (activeConversationId) {
      window.electronAPI.chat.stopGeneration(activeConversationId);
      set({ isStreaming: false });
    }
  },

  setProvider: (provider: AIProviderType) => {
    set({ selectedProvider: provider });
    window.electronAPI.settings.set('chat:selectedProvider', provider).catch(() => {});
  },

  setProviderConfig: (provider: AIProviderType, key: string, value: string) => {
    set(state => ({
      providerConfigs: {
        ...state.providerConfigs,
        [provider]: {
          ...state.providerConfigs[provider],
          [key]: value,
        },
      },
    }));
  },

  saveProviderSettings: (provider: AIProviderType) => {
    const config = get().providerConfigs[provider] || {};
    for (const [key, value] of Object.entries(config)) {
      window.electronAPI.settings.set(`chat:${provider}:${key}`, value).catch(() => {});
    }
  },

  togglePanel: () => {
    set(state => ({ isPanelOpen: !state.isPanelOpen }));
  },

  openPanel: () => {
    set({ isPanelOpen: true });
  },

  closePanel: () => {
    set({ isPanelOpen: false });
  },

  loadProviders: async () => {
    try {
      const profileName = useProfileStore.getState().selectedProfileName;
      const result = await window.electronAPI.chat.getProviders(profileName || undefined);
      if (result.success) {
        set({ providers: result.data || [] });
      }
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'Failed to load providers' });
    }
  },
};});

// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { create } from 'zustand';
import type { ChatConversation, ChatMessage, AIStreamChunk, AIProviderType, ChatContext } from '../../shared/types';
import { useProfileStore } from './profileStore';
import { useProviderStore } from './providerStore';
import { useGCPProjectStore } from './gcpProjectStore';

interface ChatState {
  conversations: ChatConversation[];
  activeConversationId: string | null;
  messages: ChatMessage[];
  isStreaming: boolean;
  streamingText: string;
  selectedProvider: AIProviderType;
  bedrockModel: string;
  bedrockRegion: string;
  bedrockAccessKeyId: string;
  bedrockSecretKey: string;
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
  setBedrockModel: (model: string) => void;
  setBedrockRegion: (region: string) => void;
  setBedrockApiKeys: (accessKeyId: string, secretKey: string) => void;
  togglePanel: () => void;
  openPanel: () => void;
  closePanel: () => void;
  loadProviders: () => Promise<void>;
}

// Load persisted chat settings on store creation
const loadPersistedSettings = async (set: (partial: Partial<ChatState>) => void) => {
  try {
    const [model, region, accessKey, secretKey] = await Promise.all([
      window.electronAPI.settings.get('chat:bedrockModel'),
      window.electronAPI.settings.get('chat:bedrockRegion'),
      window.electronAPI.settings.get('chat:bedrockAccessKeyId'),
      window.electronAPI.settings.get('chat:bedrockSecretKey'),
    ]);
    set({
      bedrockModel: model.data || 'amazon.nova-pro-v1:0',
      bedrockRegion: region.data || 'us-east-1',
      bedrockAccessKeyId: accessKey.data || '',
      bedrockSecretKey: secretKey.data || '',
    });
  } catch {}
};

export const useChatStore = create<ChatState>((set, get) => {
  // Kick off loading persisted settings
  loadPersistedSettings(set);

  return {
  conversations: [],
  activeConversationId: null,
  messages: [],
  isStreaming: false,
  streamingText: '',
  selectedProvider: 'bedrock',
  bedrockModel: 'amazon.nova-pro-v1:0',
  bedrockRegion: 'us-east-1',
  bedrockAccessKeyId: '',
  bedrockSecretKey: '',
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
    const { activeConversationId, selectedProvider } = get();

    // Create conversation if none
    let convId = activeConversationId;
    if (!convId) {
      convId = await get().createConversation();
      if (!convId) return;
    }

    // Add user message to UI immediately
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

    // Build context - cloud provider context is for tools (which resources to query)
    const profileName = useProfileStore.getState().selectedProfileName;
    const cloudProvider = useProviderStore.getState().selectedProvider;
    const projectId = useGCPProjectStore.getState().selectedProjectId;
    const context: ChatContext = {
      cloudProvider,
      profileName: profileName || undefined,
      projectId: projectId || undefined,
    };

    // AI provider config is independent - uses its own API keys
    const { bedrockModel, bedrockRegion, bedrockAccessKeyId, bedrockSecretKey } = get();
    const providerConfig = {
      region: bedrockRegion,
      model: bedrockModel,
      accessKeyId: bedrockAccessKeyId || undefined,
      secretAccessKey: bedrockSecretKey || undefined,
    };

    // Subscribe to stream chunks
    const unsubscribe = window.electronAPI.chat.onStreamChunk((chunk: AIStreamChunk) => {
      const state = get();
      if (chunk.type === 'text' && chunk.text) {
        set({ streamingText: state.streamingText + chunk.text });
      } else if (chunk.type === 'tool_use' && chunk.toolUse) {
        // Flush any accumulated streaming text as an assistant message before tool use
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

      // Add final assistant message from accumulated streaming text
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

      // Update conversation title if first message
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
  },

  setBedrockModel: (model: string) => {
    set({ bedrockModel: model });
    window.electronAPI.settings.set('chat:bedrockModel', model).catch(() => {});
  },

  setBedrockRegion: (region: string) => {
    set({ bedrockRegion: region });
    window.electronAPI.settings.set('chat:bedrockRegion', region).catch(() => {});
  },

  setBedrockApiKeys: (accessKeyId: string, secretKey: string) => {
    set({ bedrockAccessKeyId: accessKeyId, bedrockSecretKey: secretKey });
    window.electronAPI.settings.set('chat:bedrockAccessKeyId', accessKeyId).catch(() => {});
    window.electronAPI.settings.set('chat:bedrockSecretKey', secretKey).catch(() => {});
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

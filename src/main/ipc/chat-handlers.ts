// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import crypto from 'crypto';
import { ipcMain, BrowserWindow } from 'electron';
import type { IpcResponse, AIProviderType, ChatConversation, ChatMessage } from '../../shared/types';
import type { DatabaseManager } from '../database/db-manager';
import type { AuthService } from '../auth/auth-service';
import { AIService } from '../ai/ai-service';
import { requireAuth } from './ipc-utils';
import { assertString, assertObject, assertOneOf } from './validation';

export function registerChatHandlers(dbManager: DatabaseManager, authService: AuthService): void {
  const aiService = new AIService(dbManager);

  ipcMain.handle('chat:send-message', async (event, conversationId: unknown, message: unknown, providerType: unknown, context: unknown, providerConfig: unknown): Promise<IpcResponse<string>> => {
    try {
      requireAuth();
      const cId   = assertString(conversationId, 'conversationId', 1, 256);
      const msg   = assertString(message, 'message', 1, 100_000);
      const pType = assertOneOf(providerType, ['bedrock'] as const, 'providerType');
      const ctx   = assertObject(context, 'context');
      const cfg   = assertObject(providerConfig, 'providerConfig');
      let fullText = '';

      const stream = aiService.chat(
        cId,
        msg,
        pType as AIProviderType,
        ctx as any,
        cfg as any
      );

      for await (const chunk of stream) {
        // Send chunk to renderer — abort if window is gone
        const win = BrowserWindow.fromWebContents(event.sender);
        if (!win || win.isDestroyed()) {
          aiService.stopGeneration(cId);
          break;
        }
        win.webContents.send('chat:stream-chunk', chunk);

        if (chunk.type === 'text' && chunk.text) {
          fullText += chunk.text;
        }
      }

      return { success: true, data: fullText };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Chat failed' };
    }
  });

  ipcMain.handle('chat:stop-generation', async (_, conversationId: string): Promise<IpcResponse<void>> => {
    try {
      requireAuth();
      aiService.stopGeneration(conversationId);
      return { success: true, data: undefined };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to stop' };
    }
  });

  ipcMain.handle('chat:list-conversations', async (): Promise<IpcResponse<ChatConversation[]>> => {
    try {
      requireAuth();
      const rows = dbManager.listConversations();
      return {
        success: true,
        data: rows.map(r => ({
          id: r.id,
          title: r.title,
          provider: r.provider as AIProviderType,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        })),
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to list conversations' };
    }
  });

  ipcMain.handle('chat:get-conversation', async (_, id: string): Promise<IpcResponse<{ conversation: ChatConversation; messages: ChatMessage[] }>> => {
    try {
      requireAuth();
      const conv = dbManager.getConversation(id);
      if (!conv) return { success: false, error: 'Conversation not found' };

      const msgs = dbManager.getChatMessages(id);
      return {
        success: true,
        data: {
          conversation: {
            id: conv.id,
            title: conv.title,
            provider: conv.provider as AIProviderType,
            createdAt: conv.created_at,
            updatedAt: conv.updated_at,
          },
          messages: msgs.map(m => ({
            id: m.id,
            conversationId: m.conversation_id,
            role: m.role as any,
            content: m.content,
            toolName: m.tool_name || undefined,
            toolInput: m.tool_input || undefined,
            createdAt: m.created_at,
          })),
        },
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get conversation' };
    }
  });

  ipcMain.handle('chat:create-conversation', async (_, title: string, provider: string): Promise<IpcResponse<ChatConversation>> => {
    try {
      requireAuth();
      const id = crypto.randomUUID();
      dbManager.createConversation(id, title, provider);
      const conv = dbManager.getConversation(id)!;
      return {
        success: true,
        data: {
          id: conv.id,
          title: conv.title,
          provider: conv.provider as AIProviderType,
          createdAt: conv.created_at,
          updatedAt: conv.updated_at,
        },
      };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to create conversation' };
    }
  });

  ipcMain.handle('chat:delete-conversation', async (_, id: string): Promise<IpcResponse<void>> => {
    try {
      requireAuth();
      dbManager.deleteConversation(id);
      return { success: true, data: undefined };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to delete conversation' };
    }
  });

  ipcMain.handle('chat:update-title', async (_, id: string, title: string): Promise<IpcResponse<void>> => {
    try {
      requireAuth();
      dbManager.updateConversationTitle(id, title);
      return { success: true, data: undefined };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to update title' };
    }
  });

  ipcMain.handle('chat:get-providers', async (_, profileName?: string): Promise<IpcResponse<any[]>> => {
    try {
      requireAuth();
      return { success: true, data: aiService.getProviders(profileName) };
    } catch (error) {
      return { success: false, error: error instanceof Error ? error.message : 'Failed to get providers' };
    }
  });
}

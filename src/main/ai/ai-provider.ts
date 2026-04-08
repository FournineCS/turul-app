// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import type { AIStreamChunk, AIChatRequest, AIProviderType } from '../../shared/types/chat';

export interface AIProvider {
  id: AIProviderType;
  name: string;
  sendMessage(request: AIChatRequest): AsyncGenerator<AIStreamChunk>;
  validateConfig(): Promise<{ valid: boolean; error?: string }>;
}

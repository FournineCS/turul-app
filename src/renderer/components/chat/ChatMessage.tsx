// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ChatMessage as ChatMessageType } from '../../../shared/types';

/** Strip <thinking>...</thinking> blocks from model output */
export function stripThinking(text: string): string {
  return text.replace(/<thinking>[\s\S]*?<\/thinking>\s*/g, '').trim();
}

interface Props {
  message: ChatMessageType;
}

const ChatMessageComponent: React.FC<Props> = ({ message }) => {
  const [isToolExpanded, setIsToolExpanded] = useState(false);

  if (message.role === 'user') {
    return (
      <div className="chat-message chat-message--user">
        <div className="chat-message-bubble chat-message-bubble--user">
          {message.content}
        </div>
      </div>
    );
  }

  if (message.role === 'assistant') {
    const cleanContent = stripThinking(message.content);
    if (!cleanContent) return null;
    return (
      <div className="chat-message chat-message--assistant">
        <div className="chat-message-bubble chat-message-bubble--assistant">
          <div className="chat-markdown">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>
              {cleanContent}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    );
  }

  if (message.role === 'tool_use') {
    return (
      <div className="chat-message chat-message--tool">
        <button
          className="chat-tool-header"
          onClick={() => setIsToolExpanded(!isToolExpanded)}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
            <path d="M22.7 19l-9.1-9.1c.9-2.3.4-5-1.5-6.9-2-2-5-2.4-7.4-1.3L9 6 6 9 1.6 4.7C.4 7.1.9 10.1 2.9 12.1c1.9 1.9 4.6 2.4 6.9 1.5l9.1 9.1c.4.4 1 .4 1.4 0l2.3-2.3c.5-.4.5-1.1.1-1.4z" />
          </svg>
          <span className="chat-tool-name">{message.toolName}</span>
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            width="14"
            height="14"
            style={{ transform: isToolExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
          >
            <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z" />
          </svg>
        </button>
        {isToolExpanded && message.toolInput && (
          <pre className="chat-tool-body">{formatJson(message.toolInput)}</pre>
        )}
      </div>
    );
  }

  if (message.role === 'tool_result') {
    return (
      <div className="chat-message chat-message--tool">
        <button
          className="chat-tool-header chat-tool-header--result"
          onClick={() => setIsToolExpanded(!isToolExpanded)}
        >
          <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
          </svg>
          <span className="chat-tool-name">Result{message.toolName ? ` (${message.toolName})` : ''}</span>
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            width="14"
            height="14"
            style={{ transform: isToolExpanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
          >
            <path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z" />
          </svg>
        </button>
        {isToolExpanded && (
          <pre className="chat-tool-body">{formatJson(message.content)}</pre>
        )}
      </div>
    );
  }

  return null;
};

function formatJson(text: string): string {
  try {
    return JSON.stringify(JSON.parse(text), null, 2);
  } catch {
    return text;
  }
}

export default ChatMessageComponent;

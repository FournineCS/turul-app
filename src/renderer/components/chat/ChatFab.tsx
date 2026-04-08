// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React from 'react';
import { useChatStore } from '../../stores/chatStore';

const ChatIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
    <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z" />
    <path d="M7 9h2v2H7zm4 0h2v2h-2zm4 0h2v2h-2z" />
  </svg>
);

const ChatFab: React.FC = () => {
  const { togglePanel, isPanelOpen } = useChatStore();

  return (
    <button
      className={`chat-fab ${isPanelOpen ? 'chat-fab--active' : ''}`}
      onClick={togglePanel}
      title="AI Chat"
    >
      {isPanelOpen ? (
        <svg viewBox="0 0 24 24" fill="currentColor" width="24" height="24">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z" />
        </svg>
      ) : (
        <ChatIcon />
      )}
    </button>
  );
};

export default ChatFab;

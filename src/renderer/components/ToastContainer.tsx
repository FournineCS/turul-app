// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React from 'react';
import { useToastStore } from '../stores/toastStore';
import type { ToastType } from '../stores/toastStore';

const typeColors: Record<ToastType, string> = {
  success: 'var(--color-success)',
  error: 'var(--color-error)',
  info: 'var(--color-info)',
  warning: 'var(--color-warning)',
};

const typeIcons: Record<ToastType, string> = {
  success: 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
  error: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z',
  info: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z',
  warning: 'M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z',
};

const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToastStore();

  if (toasts.length === 0) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 16,
      right: 16,
      zIndex: 10000,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      maxWidth: 400,
    }}>
      {toasts.map((toast) => (
        <div
          key={toast.id}
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            padding: '12px 16px',
            borderRadius: 8,
            backgroundColor: 'var(--color-bg-secondary)',
            border: `1px solid ${typeColors[toast.type]}`,
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            animation: 'slideIn 0.2s ease-out',
          }}
        >
          <svg viewBox="0 0 24 24" fill={typeColors[toast.type]} style={{ width: 20, height: 20, flexShrink: 0, marginTop: 1 }}>
            <path d={typeIcons[toast.type]} />
          </svg>
          <span style={{ flex: 1, fontSize: 13, color: 'var(--color-text)', lineHeight: 1.4 }}>
            {toast.message}
          </span>
          <button
            onClick={() => removeToast(toast.id)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-text-secondary)',
              cursor: 'pointer',
              padding: 0,
              fontSize: 18,
              lineHeight: 1,
              flexShrink: 0,
            }}
          >
            &times;
          </button>
        </div>
      ))}
    </div>
  );
};

export default ToastContainer;

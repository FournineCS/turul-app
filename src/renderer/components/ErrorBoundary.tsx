// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React, { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          padding: 40,
          textAlign: 'center',
        }}>
          <div style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            backgroundColor: 'var(--color-error)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 20,
            opacity: 0.9,
          }}>
            <svg viewBox="0 0 24 24" fill="white" width="32" height="32">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
            </svg>
          </div>
          <h2 style={{ marginBottom: 8, color: 'var(--color-text)' }}>Something went wrong</h2>
          <p style={{ color: 'var(--color-text-secondary)', marginBottom: 20, maxWidth: 500 }}>
            An unexpected error occurred. You can try recovering by clicking the button below.
          </p>
          {this.state.error && (
            <pre style={{
              backgroundColor: 'var(--color-bg-secondary)',
              padding: 12,
              borderRadius: 8,
              fontSize: 12,
              color: 'var(--color-error)',
              maxWidth: 600,
              overflow: 'auto',
              marginBottom: 20,
              textAlign: 'left',
            }}>
              {this.state.error.message}
            </pre>
          )}
          <button className="btn btn-primary" onClick={this.handleReset}>
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

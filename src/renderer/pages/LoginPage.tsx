// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React, { useState, useCallback, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';

const CloudIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor">
    <path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z" />
  </svg>
);

const FingerprintIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="32" height="32">
    <path d="M18.9 7.2A9.973 9.973 0 0 0 12 4C9.39 4 7.06 5.14 5.42 6.94" />
    <path d="M3.6 11.07C3.22 11.97 3 12.96 3 14" />
    <path d="M21 14c0-1.04-.22-2.03-.6-2.93" />
    <path d="M12 8a6 6 0 0 0-6 6c0 1.09.21 2.12.56 3" />
    <path d="M17.44 11A5.96 5.96 0 0 1 18 14c0 .88-.19 1.72-.53 2.47" />
    <path d="M12 11a3 3 0 0 0-3 3c0 2.49.5 4.85 1.38 7" />
    <path d="M15 14c0 3.38-.87 6.52-2.4 9.26" />
    <path d="M9.13 21.75A15.46 15.46 0 0 1 9 14a3 3 0 0 1 3-3" />
  </svg>
);

const LoginPage: React.FC = () => {
  const {
    login, loginWithBiometric, isLoading, error, clearError,
    biometricAvailable, biometricEnabled,
  } = useAuthStore();
  const [password, setPassword] = useState('');
  const [biometricAttempted, setBiometricAttempted] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!password) return;
      await login(password);
    },
    [password, login]
  );

  const handleBiometricLogin = useCallback(async () => {
    clearError();
    await loginWithBiometric();
  }, [loginWithBiometric, clearError]);

  // Auto-trigger biometric on mount
  useEffect(() => {
    if (biometricAvailable && biometricEnabled && !biometricAttempted) {
      setBiometricAttempted(true);
      const timer = setTimeout(() => {
        loginWithBiometric();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [biometricAvailable, biometricEnabled, biometricAttempted, loginWithBiometric]);

  const showBiometric = biometricAvailable && biometricEnabled;

  return (
    <div className="auth-container">
      <div className="auth-card">
        <div className="auth-logo">
          <CloudIcon />
          <div>
            <div className="auth-logo-text">Turul</div>
            <div className="auth-logo-subtitle">Cloud Resource Analyzer</div>
          </div>
        </div>
        <div className="auth-title">Welcome Back</div>

        {showBiometric && (
          <>
            <div className="auth-biometric-section">
              <button
                type="button"
                className="auth-biometric-button"
                onClick={handleBiometricLogin}
                disabled={isLoading}
                title="Unlock with Touch ID"
              >
                <FingerprintIcon />
              </button>
              <div className="auth-biometric-hint">Unlock with Touch ID</div>
            </div>
            <div className="auth-divider">
              <span>or</span>
            </div>
          </>
        )}

        {!showBiometric && (
          <div className="auth-description">Enter your password to unlock the app</div>
        )}

        <form className="auth-form" onSubmit={handleSubmit}>
          {error && <div className="auth-error">{error}</div>}
          <div className="auth-field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (error) clearError();
              }}
              placeholder="Enter your password"
              autoFocus={!showBiometric}
            />
          </div>
          <button type="submit" className="auth-button" disabled={isLoading || !password}>
            {isLoading ? 'Unlocking...' : 'Unlock'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginPage;

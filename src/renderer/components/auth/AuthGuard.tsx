// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React, { useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '../../stores/authStore';
import LoginPage from '../../pages/LoginPage';
import SetupPage from '../../pages/SetupPage';

interface AuthGuardProps {
  children: React.ReactNode;
}

const ACTIVITY_THROTTLE_MS = 60_000; // report activity at most every 60s

const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const { isSetup, isAuthenticated, isLoading, checkStatus } = useAuthStore();
  const lastReportedRef = useRef(0);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  // Subscribe to session timeout event from main process
  useEffect(() => {
    if (!window.electronAPI?.auth?.onSessionTimeout) return;
    const unsubscribe = window.electronAPI.auth.onSessionTimeout(() => {
      useAuthStore.setState({ isAuthenticated: false });
    });
    return () => unsubscribe();
  }, []);

  // Throttled activity reporter
  const reportActivity = useCallback(() => {
    const now = Date.now();
    if (now - lastReportedRef.current < ACTIVITY_THROTTLE_MS) return;
    lastReportedRef.current = now;
    window.electronAPI?.auth?.touchActivity?.();
  }, []);

  // Track user activity (mouse/keyboard) to keep session alive
  useEffect(() => {
    if (!isAuthenticated) return;

    const handler = () => reportActivity();
    window.addEventListener('mousemove', handler, { passive: true });
    window.addEventListener('keydown', handler, { passive: true });
    window.addEventListener('click', handler, { passive: true });

    // Report initial activity on mount
    reportActivity();

    return () => {
      window.removeEventListener('mousemove', handler);
      window.removeEventListener('keydown', handler);
      window.removeEventListener('click', handler);
    };
  }, [isAuthenticated, reportActivity]);

  if (isLoading) {
    return <div className="auth-loading">Loading...</div>;
  }

  if (!isSetup) {
    return <SetupPage />;
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return <>{children}</>;
};

export default AuthGuard;

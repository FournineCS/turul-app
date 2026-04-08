// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { create } from 'zustand';

interface AuthState {
  isSetup: boolean;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  biometricAvailable: boolean;
  biometricEnabled: boolean;
  biometricType: string;

  checkStatus: () => Promise<void>;
  setup: (password: string, confirmPassword: string) => Promise<boolean>;
  login: (password: string) => Promise<boolean>;
  loginWithBiometric: () => Promise<boolean>;
  enableBiometric: () => Promise<boolean>;
  disableBiometric: () => Promise<boolean>;
  logout: () => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string, confirmNewPassword: string) => Promise<boolean>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  isSetup: false,
  isAuthenticated: false,
  isLoading: true,
  error: null,
  biometricAvailable: false,
  biometricEnabled: false,
  biometricType: 'none',

  checkStatus: async () => {
    if (!window.electronAPI?.auth) {
      set({ isLoading: false, error: 'Electron API not available' });
      return;
    }
    set({ isLoading: true, error: null });
    try {
      const response = await window.electronAPI.auth.checkStatus();
      if (response.success && response.data) {
        set({
          isSetup: response.data.isSetup,
          isAuthenticated: response.data.isAuthenticated,
          biometricAvailable: response.data.biometricAvailable ?? false,
          biometricEnabled: response.data.biometricEnabled ?? false,
          biometricType: response.data.biometricType ?? 'none',
          isLoading: false,
        });
      } else {
        set({ error: response.error || 'Failed to check auth status', isLoading: false });
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to check auth status',
        isLoading: false,
      });
    }
  },

  setup: async (password, confirmPassword) => {
    if (!window.electronAPI?.auth) return false;
    set({ isLoading: true, error: null });
    try {
      const response = await window.electronAPI.auth.setup({ password, confirmPassword });
      if (response.success) {
        set({ isSetup: true, isAuthenticated: true, isLoading: false });
        return true;
      } else {
        set({ error: response.error || 'Failed to set up password', isLoading: false });
        return false;
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to set up password',
        isLoading: false,
      });
      return false;
    }
  },

  login: async (password) => {
    if (!window.electronAPI?.auth) return false;
    set({ isLoading: true, error: null });
    try {
      const response = await window.electronAPI.auth.login({ password });
      if (response.success) {
        set({ isAuthenticated: true, isLoading: false });
        return true;
      } else {
        set({ error: response.error || 'Failed to login', isLoading: false });
        return false;
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to login',
        isLoading: false,
      });
      return false;
    }
  },

  loginWithBiometric: async () => {
    if (!window.electronAPI?.auth?.loginWithBiometric) return false;
    set({ isLoading: true, error: null });
    try {
      const response = await window.electronAPI.auth.loginWithBiometric();
      if (response.success) {
        set({ isAuthenticated: true, isLoading: false });
        return true;
      } else {
        set({ error: response.error || 'Biometric authentication failed', isLoading: false });
        return false;
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Biometric authentication failed',
        isLoading: false,
      });
      return false;
    }
  },

  enableBiometric: async () => {
    if (!window.electronAPI?.auth?.enableBiometric) return false;
    try {
      const response = await window.electronAPI.auth.enableBiometric();
      if (response.success) {
        set({ biometricEnabled: true });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  disableBiometric: async () => {
    if (!window.electronAPI?.auth?.disableBiometric) return false;
    try {
      const response = await window.electronAPI.auth.disableBiometric();
      if (response.success) {
        set({ biometricEnabled: false });
        return true;
      }
      return false;
    } catch {
      return false;
    }
  },

  logout: async () => {
    if (!window.electronAPI?.auth) return;
    try {
      await window.electronAPI.auth.logout();
      set({ isAuthenticated: false });
    } catch (error) {
      console.error('Logout error:', error);
    }
  },

  changePassword: async (currentPassword, newPassword, confirmNewPassword) => {
    if (!window.electronAPI?.auth) return false;
    set({ isLoading: true, error: null });
    try {
      const response = await window.electronAPI.auth.changePassword({
        currentPassword,
        newPassword,
        confirmNewPassword,
      });
      if (response.success) {
        set({ isLoading: false });
        return true;
      } else {
        set({ error: response.error || 'Failed to change password', isLoading: false });
        return false;
      }
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to change password',
        isLoading: false,
      });
      return false;
    }
  },

  clearError: () => set({ error: null }),
}));

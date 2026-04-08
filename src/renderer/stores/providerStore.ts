// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { create } from 'zustand';
import type { CloudProvider } from '../../shared/types';

interface ProviderState {
  selectedProvider: CloudProvider;
  setProvider: (provider: CloudProvider) => void;
}

export const useProviderStore = create<ProviderState>((set) => ({
  selectedProvider: 'aws',

  setProvider: (provider: CloudProvider) => {
    set({ selectedProvider: provider });
    // Persist preference
    window.electronAPI?.settings?.set('selectedProvider', provider).catch(() => {});
  },
}));

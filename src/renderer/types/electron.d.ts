// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import type { ElectronAPI } from '../../main/preload';

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}

export {};

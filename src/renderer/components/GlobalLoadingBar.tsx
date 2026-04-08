// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React from 'react';
import { useScanStore } from '../stores/scanStore';
import { useCostStore } from '../stores/costStore';
import { useSecurityStore } from '../stores/securityStore';

const GlobalLoadingBar: React.FC = () => {
  const scanLoading = useScanStore((s) => s.isLoading || s.isScanning);
  const costLoading = useCostStore((s) => s.isLoading);
  const securityLoading = useSecurityStore((s) => s.isLoading || s.isScanning);

  const isActive = scanLoading || costLoading || securityLoading;

  if (!isActive) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 3,
        zIndex: 9999,
        overflow: 'hidden',
        backgroundColor: 'rgba(59, 130, 246, 0.2)',
      }}
    >
      <div
        style={{
          height: '100%',
          width: '40%',
          backgroundColor: 'var(--color-primary)',
          borderRadius: 2,
          animation: 'loadingBarSlide 1.5s ease-in-out infinite',
        }}
      />
    </div>
  );
};

export default GlobalLoadingBar;

// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React, { createElement } from 'react';
import type { CloudProvider, DiagramViewMode } from '../../../shared/types';
import { getProviderColorMap, getProviderLabel, getProviderTierLabel, getProviderIcon } from './providerIcons';

interface DiagramLegendProps {
  viewMode: DiagramViewMode;
  cloudProvider?: CloudProvider;
}

const DiagramLegend: React.FC<DiagramLegendProps> = ({ viewMode, cloudProvider }) => {
  const colorMap = getProviderColorMap(cloudProvider, viewMode);

  const items = Object.entries(colorMap).map(([key, color]) => {
    let label: string;
    if (viewMode === 'network') {
      label = getProviderLabel(cloudProvider, key);
    } else {
      label = getProviderTierLabel(cloudProvider, key);
    }
    const icon = viewMode === 'network' ? getProviderIcon(cloudProvider, key) : null;
    return { key, label, color, icon };
  });

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 12,
        left: 12,
        background: 'var(--color-bg-secondary)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        padding: '10px 14px',
        fontSize: 11,
        zIndex: 10,
        maxWidth: 200,
        boxShadow: 'var(--shadow-md)',
      }}
    >
      <div style={{
        fontWeight: 600,
        marginBottom: 8,
        color: 'var(--color-text-secondary)',
        fontSize: 10,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
      }}>
        Legend
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {items.map(({ key, label, color, icon }) => (
          <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            {icon ? (
              <div style={{ width: 16, height: 16, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {createElement(icon, { size: '16' })}
              </div>
            ) : (
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: 3,
                  background: color,
                  flexShrink: 0,
                  boxShadow: `0 0 6px ${color}40`,
                }}
              />
            )}
            <span style={{ color: 'var(--color-text-secondary)', fontSize: 11 }}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default DiagramLegend;

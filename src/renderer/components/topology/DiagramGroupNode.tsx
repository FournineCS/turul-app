// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React, { memo } from 'react';
import type { NodeProps } from '@xyflow/react';
import { TIER_LABELS } from './serviceIcons';

interface GroupNodeData {
  label: string;
  color: string;
  tier?: string;
  viewMode?: string;
  [key: string]: unknown;
}

const DiagramGroupNode: React.FC<NodeProps> = ({ data }) => {
  const nodeData = data as GroupNodeData;
  const label = nodeData.tier ? (TIER_LABELS[nodeData.tier] || nodeData.tier) : nodeData.label;
  const color = nodeData.color || '#94a3b8';

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        borderRadius: 12,
        border: `2px solid ${color}40`,
        background: `${color}0a`,
        position: 'relative',
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 8,
          left: 12,
          fontSize: 11,
          fontWeight: 700,
          color: color,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          background: `${color}14`,
          padding: '2px 8px',
          borderRadius: 4,
          lineHeight: '18px',
        }}
      >
        {label}
      </div>
    </div>
  );
};

export default memo(DiagramGroupNode);

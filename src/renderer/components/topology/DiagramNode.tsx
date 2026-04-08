// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React, { memo, createElement } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { CloudProvider } from '../../../shared/types';
import { getProviderColor, getProviderLabel, getProviderIcon } from './providerIcons';

interface DiagramNodeData {
  label: string;
  resourceType: string;
  service: string;
  tier?: string;
  viewMode: string;
  region?: string;
  cloudProvider?: CloudProvider;
  [key: string]: unknown;
}

const DiagramNode: React.FC<NodeProps> = ({ data, selected }) => {
  const nodeData = data as DiagramNodeData;
  const isSummary = (data as any)._isSummaryNode === true;
  const summaryCount = (data as any)._count as number | undefined;
  const color = getProviderColor(nodeData.cloudProvider, nodeData.viewMode, nodeData.resourceType, nodeData.tier);
  const typeLabel = getProviderLabel(nodeData.cloudProvider, nodeData.resourceType);
  const IconComponent = getProviderIcon(nodeData.cloudProvider, nodeData.resourceType);

  const nodeWidth = isSummary ? 200 : 190;

  const baseBoxShadow = selected
    ? `0 0 0 2px var(--color-primary-glow), 0 2px 8px rgba(0,0,0,0.2)`
    : '0 1px 4px rgba(0,0,0,0.15)';

  const summaryBoxShadow = selected
    ? `0 0 0 2px var(--color-primary-glow), 0 2px 8px rgba(0,0,0,0.2), 3px 3px 0 ${color}30, 6px 6px 0 ${color}18`
    : `0 1px 4px rgba(0,0,0,0.15), 3px 3px 0 ${color}30, 6px 6px 0 ${color}18`;

  return (
    <div
      style={{
        padding: '8px 12px',
        borderRadius: 8,
        border: `2px solid ${selected ? 'var(--color-primary)' : color}`,
        background: selected ? 'var(--color-primary-soft)' : 'var(--color-bg-secondary)',
        boxShadow: isSummary ? summaryBoxShadow : baseBoxShadow,
        width: nodeWidth,
        maxWidth: nodeWidth,
        fontSize: 12,
        overflow: 'hidden',
        transition: 'all 0.15s ease',
      }}
    >
      <Handle type="target" position={Position.Top} style={{ background: color, width: 6, height: 6 }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 4,
            background: IconComponent ? 'transparent' : color,
            color: '#fff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 9,
            fontWeight: 700,
            flexShrink: 0,
            position: 'relative',
          }}
        >
          {IconComponent
            ? createElement(IconComponent, { size: '28' })
            : typeLabel.slice(0, 3).toUpperCase()}
          {isSummary && summaryCount != null && (
            <span
              style={{
                position: 'absolute',
                top: -6,
                right: -8,
                minWidth: 18,
                height: 18,
                borderRadius: 9,
                background: color,
                color: '#fff',
                fontSize: 10,
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '0 4px',
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
                lineHeight: 1,
              }}
            >
              {summaryCount}
            </span>
          )}
        </div>
        <div
          style={{
            fontWeight: 600,
            color: 'var(--color-text)',
            lineHeight: 1.2,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            maxWidth: isSummary ? 150 : 140,
          }}
          title={nodeData.label}
        >
          {isSummary && summaryCount != null
            ? `${summaryCount} ${nodeData.label}`
            : nodeData.label}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        <span
          style={{
            fontSize: 10,
            padding: '1px 5px',
            borderRadius: 3,
            background: `${color}18`,
            color: color,
            fontWeight: 500,
          }}
        >
          {typeLabel}
        </span>
        {nodeData.region && (
          <span
            style={{
              fontSize: 10,
              padding: '1px 5px',
              borderRadius: 3,
              background: 'var(--color-bg-tertiary)',
              color: 'var(--color-text-muted)',
            }}
          >
            {nodeData.region}
          </span>
        )}
      </div>

      <Handle type="source" position={Position.Bottom} style={{ background: color, width: 6, height: 6 }} />
    </div>
  );
};

export default memo(DiagramNode);

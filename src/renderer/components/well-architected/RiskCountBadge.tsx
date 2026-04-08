// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React from 'react';
import type { WARiskLevel } from '../../../shared/types';

interface RiskCountBadgeProps {
  riskLevel: WARiskLevel;
  count: number;
  showLabel?: boolean;
  size?: 'small' | 'medium' | 'large';
}

const riskColors: Record<WARiskLevel, { bg: string; text: string; border: string }> = {
  HIGH: { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444', border: '#ef4444' },
  MEDIUM: { bg: 'rgba(245, 158, 11, 0.15)', text: '#f59e0b', border: '#f59e0b' },
  NONE: { bg: 'rgba(34, 197, 94, 0.15)', text: '#22c55e', border: '#22c55e' },
  NOT_APPLICABLE: { bg: 'rgba(156, 163, 175, 0.15)', text: '#9ca3af', border: '#9ca3af' },
  UNANSWERED: { bg: 'rgba(59, 130, 246, 0.15)', text: '#3b82f6', border: '#3b82f6' },
};

const riskLabels: Record<WARiskLevel, string> = {
  HIGH: 'High',
  MEDIUM: 'Medium',
  NONE: 'None',
  NOT_APPLICABLE: 'N/A',
  UNANSWERED: 'Unanswered',
};

export const RiskCountBadge: React.FC<RiskCountBadgeProps> = ({
  riskLevel,
  count,
  showLabel = true,
  size = 'medium',
}) => {
  const colors = riskColors[riskLevel];
  const label = riskLabels[riskLevel];

  const sizeStyles = {
    small: { padding: '2px 6px', fontSize: 10 },
    medium: { padding: '4px 8px', fontSize: 12 },
    large: { padding: '6px 12px', fontSize: 14 },
  };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        backgroundColor: colors.bg,
        color: colors.text,
        border: `1px solid ${colors.border}`,
        borderRadius: 4,
        fontWeight: 600,
        ...sizeStyles[size],
      }}
    >
      {showLabel && <span>{label}:</span>}
      <span>{count}</span>
    </span>
  );
};

interface RiskSummaryProps {
  riskCounts: Record<WARiskLevel, number>;
  showZero?: boolean;
  size?: 'small' | 'medium' | 'large';
}

export const RiskSummary: React.FC<RiskSummaryProps> = ({
  riskCounts,
  showZero = false,
  size = 'medium',
}) => {
  const levels: WARiskLevel[] = ['HIGH', 'MEDIUM', 'NONE', 'UNANSWERED', 'NOT_APPLICABLE'];

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {levels.map((level) => {
        const count = riskCounts[level] ?? 0;
        if (!showZero && count === 0) return null;
        return (
          <RiskCountBadge
            key={level}
            riskLevel={level}
            count={count}
            size={size}
          />
        );
      })}
    </div>
  );
};

interface RiskIndicatorProps {
  riskLevel: WARiskLevel;
  size?: number;
}

export const RiskIndicator: React.FC<RiskIndicatorProps> = ({ riskLevel, size = 8 }) => {
  const colors = riskColors[riskLevel];

  return (
    <span
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: colors.text,
      }}
      title={riskLabels[riskLevel]}
    />
  );
};

// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React from 'react';
import type { WABPPillarSummary } from '../../../shared/types';
import { WABPFindingsTable } from './WABPFindingsTable';

interface WABPPillarSummaryCardProps {
  pillarSummary: WABPPillarSummary;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

const PILLAR_COLORS: Record<string, string> = {
  operationalExcellence: '#8b5cf6',
  security: '#ef4444',
  reliability: '#3b82f6',
  performance: '#f59e0b',
  costOptimization: '#22c55e',
  sustainability: '#06b6d4',
};

export const WABPPillarSummaryCard: React.FC<WABPPillarSummaryCardProps> = ({
  pillarSummary,
  isExpanded,
  onToggleExpand,
}) => {
  const color = PILLAR_COLORS[pillarSummary.pillarId] || '#6b7280';
  const total = pillarSummary.totalChecks;
  const passRate = total > 0 ? Math.round((pillarSummary.passCount / total) * 100) : 0;
  const failFindings = pillarSummary.findings.filter((f) => f.status === 'FAIL');

  return (
    <div
      style={{
        backgroundColor: 'var(--color-bg-secondary)',
        border: `1px solid ${isExpanded ? color : 'var(--color-border)'}`,
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      {/* Card Header - always visible */}
      <div
        onClick={onToggleExpand}
        style={{
          padding: 16,
          cursor: 'pointer',
          userSelect: 'none',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 4,
                height: 20,
                borderRadius: 2,
                backgroundColor: color,
              }}
            />
            <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--color-text)' }}>
              {pillarSummary.pillarName}
            </span>
          </div>
          <span
            style={{
              fontSize: 12,
              color: 'var(--color-text-secondary)',
              transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s',
            }}
          >
            &#9660;
          </span>
        </div>

        {/* Pass/Fail ratio bar */}
        <div style={{ marginBottom: 8 }}>
          <div
            style={{
              height: 6,
              borderRadius: 3,
              backgroundColor: 'var(--color-border)',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${passRate}%`,
                backgroundColor: passRate === 100 ? '#22c55e' : passRate >= 50 ? '#f59e0b' : '#ef4444',
                borderRadius: 3,
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        </div>

        {/* Stats row */}
        <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--color-text-secondary)' }}>
          <span>{total} check{total !== 1 ? 's' : ''}</span>
          <span style={{ color: '#22c55e' }}>{pillarSummary.passCount} passed</span>
          <span style={{ color: pillarSummary.failCount > 0 ? '#ef4444' : 'inherit' }}>
            {pillarSummary.failCount} failed
          </span>
          {pillarSummary.errorCount > 0 && (
            <span style={{ color: '#f59e0b' }}>{pillarSummary.errorCount} error</span>
          )}
        </div>
      </div>

      {/* Expanded findings */}
      {isExpanded && failFindings.length > 0 && (
        <div
          style={{
            borderTop: '1px solid var(--color-border)',
            padding: 16,
            maxHeight: 400,
            overflowY: 'auto',
          }}
        >
          <WABPFindingsTable findings={failFindings} />
        </div>
      )}

      {isExpanded && failFindings.length === 0 && (
        <div
          style={{
            borderTop: '1px solid var(--color-border)',
            padding: 16,
            textAlign: 'center',
            color: '#22c55e',
            fontSize: 13,
          }}
        >
          All checks passed for this pillar.
        </div>
      )}
    </div>
  );
};

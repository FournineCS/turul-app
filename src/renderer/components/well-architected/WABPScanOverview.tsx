// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React, { useState } from 'react';
import type { WABPScanResult } from '../../../shared/types';
import { WABPPillarSummaryCard } from './WABPPillarSummaryCard';

interface WABPScanOverviewProps {
  scanResult: WABPScanResult;
}

export const WABPScanOverview: React.FC<WABPScanOverviewProps> = ({ scanResult }) => {
  const [expandedPillar, setExpandedPillar] = useState<string | null>(null);

  const durationSeconds = (scanResult.duration / 1000).toFixed(1);
  const scanTime = new Date(scanResult.timestamp).toLocaleString();
  const passRate = scanResult.totalChecks > 0
    ? Math.round((scanResult.totalPass / scanResult.totalChecks) * 100)
    : 0;

  return (
    <div>
      {/* Summary Stats */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: 16,
          marginBottom: 24,
        }}
      >
        <div
          style={{
            backgroundColor: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            padding: 16,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 28, fontWeight: 700, color: 'var(--color-text)' }}>
            {scanResult.totalChecks}
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 4 }}>
            Total Checks
          </div>
        </div>
        <div
          style={{
            backgroundColor: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            padding: 16,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 28, fontWeight: 700, color: '#22c55e' }}>
            {scanResult.totalPass}
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 4 }}>
            Passed
          </div>
        </div>
        <div
          style={{
            backgroundColor: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            padding: 16,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 28, fontWeight: 700, color: '#ef4444' }}>
            {scanResult.totalFail}
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 4 }}>
            Failed
          </div>
        </div>
        <div
          style={{
            backgroundColor: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            padding: 16,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 28, fontWeight: 700, color: passRate >= 80 ? '#22c55e' : passRate >= 50 ? '#f59e0b' : '#ef4444' }}>
            {passRate}%
          </div>
          <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 4 }}>
            Pass Rate
          </div>
        </div>
      </div>

      {/* Scan metadata */}
      <div
        style={{
          fontSize: 12,
          color: 'var(--color-text-secondary)',
          marginBottom: 16,
          display: 'flex',
          gap: 16,
        }}
      >
        <span>Scanned at: {scanTime}</span>
        <span>Duration: {durationSeconds}s</span>
        {scanResult.totalError > 0 && (
          <span style={{ color: '#f59e0b' }}>{scanResult.totalError} check(s) had errors</span>
        )}
      </div>

      {/* Pillar Cards Grid */}
      <h3 style={{ margin: '0 0 16px', color: 'var(--color-text)', fontSize: 16 }}>
        Pillar Results
      </h3>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: 16,
          marginBottom: 24,
        }}
      >
        {scanResult.pillarSummaries.map((pillar) => (
          <WABPPillarSummaryCard
            key={pillar.pillarId}
            pillarSummary={pillar}
            isExpanded={expandedPillar === pillar.pillarId}
            onToggleExpand={() =>
              setExpandedPillar(expandedPillar === pillar.pillarId ? null : pillar.pillarId)
            }
          />
        ))}
      </div>
    </div>
  );
};

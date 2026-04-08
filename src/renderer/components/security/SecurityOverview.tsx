// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React from 'react';
import type { SecurityPostureSummary } from '../../../shared/types';

interface SecurityOverviewProps {
  summary: SecurityPostureSummary | null;
  isLoading: boolean;
}

interface StatCardProps {
  title: string;
  value: string | number;
  color?: string;
  isLoading?: boolean;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, color, isLoading }) => (
  <div className="stat-card" style={{ minWidth: 120, flex: '1 1 0' }}>
    <div className="stat-label">{title}</div>
    {isLoading ? (
      <div
        style={{
          height: 32,
          backgroundColor: 'var(--color-bg-tertiary)',
          borderRadius: 4,
          animation: 'pulse 1.5s ease-in-out infinite',
        }}
      />
    ) : (
      <div
        className="stat-value"
        style={color ? {
          background: 'none',
          WebkitBackgroundClip: 'unset',
          WebkitTextFillColor: color,
          backgroundClip: 'unset',
        } : undefined}
      >
        {value}
      </div>
    )}
  </div>
);

export const SecurityOverview: React.FC<SecurityOverviewProps> = ({ summary, isLoading }) => {
  const totalFindings = summary?.totalFindings ?? 0;
  const criticalCount = summary?.criticalCount ?? 0;
  const highCount = summary?.highCount ?? 0;
  const mediumCount = summary?.mediumCount ?? 0;
  const lowCount = summary?.lowCount ?? 0;

  return (
    <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
      <StatCard
        title="Total Findings"
        value={totalFindings}
        isLoading={isLoading}
      />
      <StatCard
        title="Critical"
        value={criticalCount}
        color={criticalCount > 0 ? '#dc2626' : 'var(--color-text)'}
        isLoading={isLoading}
      />
      <StatCard
        title="High"
        value={highCount}
        color={highCount > 0 ? '#ea580c' : 'var(--color-text)'}
        isLoading={isLoading}
      />
      <StatCard
        title="Medium"
        value={mediumCount}
        color={mediumCount > 0 ? '#ca8a04' : 'var(--color-text)'}
        isLoading={isLoading}
      />
      <StatCard
        title="Low"
        value={lowCount}
        color="var(--color-text)"
        isLoading={isLoading}
      />
    </div>
  );
};

export default SecurityOverview;

// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React from 'react';
import type { WALensReview, WAPillarReviewSummary, WAPillarId, WARiskLevel } from '../../../shared/types';
import { RiskSummary, RiskIndicator } from './RiskCountBadge';

interface PillarReviewCardProps {
  lensReview: WALensReview | null;
  isLoading: boolean;
}

const pillarInfo: Record<WAPillarId, { name: string; icon: string; description: string }> = {
  operationalExcellence: {
    name: 'Operational Excellence',
    icon: '⚙️',
    description: 'Run and monitor systems to deliver business value',
  },
  security: {
    name: 'Security',
    icon: '🔒',
    description: 'Protect data, systems, and assets',
  },
  reliability: {
    name: 'Reliability',
    icon: '🔄',
    description: 'Recover from failures and meet demand',
  },
  performance: {
    name: 'Performance Efficiency',
    icon: '⚡',
    description: 'Use resources efficiently',
  },
  costOptimization: {
    name: 'Cost Optimization',
    icon: '💰',
    description: 'Avoid unnecessary costs',
  },
  sustainability: {
    name: 'Sustainability',
    icon: '🌱',
    description: 'Minimize environmental impacts',
  },
};

// Compute the dominant risk level for a pillar
const getDominantRisk = (riskCounts: Record<WARiskLevel, number>): WARiskLevel => {
  if (riskCounts.HIGH > 0) return 'HIGH';
  if (riskCounts.MEDIUM > 0) return 'MEDIUM';
  if (riskCounts.UNANSWERED > 0) return 'UNANSWERED';
  if (riskCounts.NONE > 0) return 'NONE';
  return 'NOT_APPLICABLE';
};

export const PillarReviewCard: React.FC<PillarReviewCardProps> = ({ lensReview, isLoading }) => {
  if (isLoading) {
    return (
      <div
        style={{
          backgroundColor: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border)',
          borderRadius: 8,
          padding: 24,
          marginBottom: 24,
        }}
      >
        <h3 style={{ margin: '0 0 16px', color: 'var(--color-text)', fontSize: 16 }}>
          Pillar Review
        </h3>
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-secondary)' }}>
          Loading pillar review...
        </div>
      </div>
    );
  }

  if (!lensReview) {
    return null;
  }

  return (
    <div
      style={{
        backgroundColor: 'var(--color-bg-secondary)',
        border: '1px solid var(--color-border)',
        borderRadius: 8,
        padding: 24,
        marginBottom: 24,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 16,
        }}
      >
        <div>
          <h3 style={{ margin: '0 0 4px', color: 'var(--color-text)', fontSize: 16 }}>
            {lensReview.lensName}
          </h3>
          <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
            Version {lensReview.lensVersion}
          </span>
        </div>
        <RiskSummary riskCounts={lensReview.riskCounts} size="medium" />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: 16,
        }}
      >
        {lensReview.pillarReviewSummaries.map((pillar) => (
          <PillarCard key={pillar.pillarId} pillar={pillar} />
        ))}
      </div>
    </div>
  );
};

interface PillarCardProps {
  pillar: WAPillarReviewSummary;
}

const PillarCard: React.FC<PillarCardProps> = ({ pillar }) => {
  const info = pillarInfo[pillar.pillarId] || {
    name: pillar.pillarName,
    icon: '📋',
    description: '',
  };
  const dominantRisk = getDominantRisk(pillar.riskCounts);

  return (
    <div
      style={{
        backgroundColor: 'var(--color-bg)',
        border: '1px solid var(--color-border)',
        borderRadius: 8,
        padding: 16,
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 12,
        }}
      >
        <span style={{ fontSize: 20 }}>{info.icon}</span>
        <div style={{ flex: 1 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <h4
              style={{
                margin: 0,
                color: 'var(--color-text)',
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              {info.name}
            </h4>
            <RiskIndicator riskLevel={dominantRisk} size={10} />
          </div>
          <p
            style={{
              margin: '2px 0 0',
              color: 'var(--color-text-secondary)',
              fontSize: 11,
            }}
          >
            {info.description}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12 }}>
        <RiskCountItem label="High" count={pillar.riskCounts.HIGH} color="#ef4444" />
        <RiskCountItem label="Med" count={pillar.riskCounts.MEDIUM} color="#f59e0b" />
        <RiskCountItem label="None" count={pillar.riskCounts.NONE} color="#22c55e" />
      </div>

      {pillar.notes && (
        <p
          style={{
            margin: '12px 0 0',
            padding: '8px',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            borderRadius: 4,
            fontSize: 11,
            color: 'var(--color-text-secondary)',
            lineHeight: 1.4,
          }}
        >
          {pillar.notes}
        </p>
      )}
    </div>
  );
};

interface RiskCountItemProps {
  label: string;
  count: number;
  color: string;
}

const RiskCountItem: React.FC<RiskCountItemProps> = ({ label, count, color }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
    <span
      style={{
        width: 8,
        height: 8,
        borderRadius: '50%',
        backgroundColor: color,
      }}
    />
    <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
      {label}:
    </span>
    <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text)' }}>
      {count}
    </span>
  </div>
);

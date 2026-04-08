// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React from 'react';
import type { CostOptimizationResult, CostOptimizationRecommendation } from '../../../shared/types';

interface CostOptimizationsProps {
  optimizations: CostOptimizationResult | null;
  isLoading: boolean;
}

function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

const SEVERITY_COLORS: Record<CostOptimizationRecommendation['severity'], { bg: string; text: string }> = {
  high: { bg: 'rgba(239, 68, 68, 0.1)', text: '#ef4444' },
  medium: { bg: 'rgba(245, 158, 11, 0.1)', text: '#f59e0b' },
  low: { bg: 'rgba(34, 197, 94, 0.1)', text: '#22c55e' },
};

const TYPE_LABELS: Record<CostOptimizationRecommendation['type'], string> = {
  unused_resource: 'Unused Resource',
  underutilized: 'Underutilized',
  reserved_instance: 'Reserved Instance',
  savings_plan: 'Savings Plan',
  idle_resource: 'Idle Resource',
  orphaned_resource: 'Orphaned Resource',
  cost_anomaly: 'Cost Anomaly',
  rightsizing: 'Rightsizing',
  commitment_coverage: 'Commitment Coverage',
  best_practice: 'Best Practice',
  egress_optimization: 'Egress Optimization',
};

const TYPE_ICONS: Record<CostOptimizationRecommendation['type'], string> = {
  unused_resource: '\u26A0', // warning sign
  underutilized: '\u2139', // info
  reserved_instance: '\u2605', // star
  savings_plan: '\u2605', // star
  idle_resource: '\u23F8', // pause
  orphaned_resource: '\u2716', // heavy multiplication X
  cost_anomaly: '\u26A1', // lightning
  rightsizing: '\u2194', // left right arrow
  commitment_coverage: '\u2606', // white star
  best_practice: '\u2714', // check mark
  egress_optimization: '\u21D2', // rightward double arrow
};

interface RecommendationCardProps {
  recommendation: CostOptimizationRecommendation;
}

const RecommendationCard: React.FC<RecommendationCardProps> = ({ recommendation }) => {
  const severityColor = SEVERITY_COLORS[recommendation.severity];

  return (
    <div
      style={{
        backgroundColor: 'var(--color-bg-tertiary)',
        border: '1px solid var(--color-border)',
        borderRadius: 8,
        padding: 16,
        marginBottom: 12,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 12,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontSize: 20 }}>{TYPE_ICONS[recommendation.type]}</span>
          <div>
            <div style={{ fontWeight: 600, marginBottom: 2 }}>
              {TYPE_LABELS[recommendation.type]}
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
              {recommendation.service}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span
            style={{
              backgroundColor: severityColor.bg,
              color: severityColor.text,
              padding: '4px 10px',
              borderRadius: 4,
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'uppercase',
            }}
          >
            {recommendation.severity}
          </span>
        </div>
      </div>

      <p style={{ margin: '0 0 12px', fontSize: 14, lineHeight: 1.5 }}>
        {recommendation.description}
      </p>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingTop: 12,
          borderTop: '1px solid var(--color-border)',
        }}
      >
        <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
          <strong>Action:</strong> {recommendation.actionRequired}
        </div>
        <div
          style={{
            backgroundColor: 'var(--color-success)',
            color: 'white',
            padding: '6px 12px',
            borderRadius: 6,
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          Save: {formatCurrency(recommendation.estimatedMonthlySavings, recommendation.currency)}/mo
        </div>
      </div>
    </div>
  );
};

export const CostOptimizations: React.FC<CostOptimizationsProps> = ({
  optimizations,
  isLoading,
}) => {
  if (isLoading) {
    return (
      <div
        style={{
          backgroundColor: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border)',
          borderRadius: 8,
          padding: 20,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 16,
          }}
        >
          <h3 style={{ margin: 0, fontSize: 16 }}>Cost Optimization Recommendations</h3>
        </div>
        <div
          style={{
            height: 150,
            backgroundColor: 'var(--color-bg-tertiary)',
            borderRadius: 4,
            animation: 'pulse 1.5s ease-in-out infinite',
          }}
        />
      </div>
    );
  }

  const recommendations = optimizations?.recommendations || [];
  const totalSavings = optimizations?.totalPotentialSavings || 0;
  const currency = optimizations?.currency || 'USD';

  return (
    <div
      style={{
        backgroundColor: 'var(--color-bg-secondary)',
        border: '1px solid var(--color-border)',
        borderRadius: 8,
        padding: 20,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <h3 style={{ margin: 0, fontSize: 16 }}>Cost Optimization Recommendations</h3>
        {recommendations.length > 0 && (
          <div
            style={{
              backgroundColor: 'var(--color-primary)',
              color: 'white',
              padding: '6px 14px',
              borderRadius: 6,
              fontSize: 14,
              fontWeight: 600,
            }}
          >
            Potential Savings: {formatCurrency(totalSavings, currency)}/mo
          </div>
        )}
      </div>

      {recommendations.length === 0 ? (
        <div
          style={{
            padding: 40,
            textAlign: 'center',
            color: 'var(--color-text-secondary)',
            backgroundColor: 'var(--color-bg-tertiary)',
            borderRadius: 8,
          }}
        >
          <div style={{ fontSize: 40, marginBottom: 12 }}>{'\u2713'}</div>
          <p style={{ margin: 0, fontSize: 14 }}>
            No optimization recommendations at this time.
          </p>
          <p style={{ margin: '8px 0 0', fontSize: 12 }}>
            Your costs appear to be well-optimized. No recommendations found.
          </p>
        </div>
      ) : (
        <div>
          {recommendations.map((recommendation) => (
            <RecommendationCard key={recommendation.id} recommendation={recommendation} />
          ))}
        </div>
      )}
    </div>
  );
};

export default CostOptimizations;

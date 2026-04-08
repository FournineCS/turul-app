// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React from 'react';
import type { WAWorkloadSummary } from '../../../shared/types';
import { RiskSummary } from './RiskCountBadge';

interface WorkloadListProps {
  workloads: WAWorkloadSummary[];
  selectedWorkload: WAWorkloadSummary | null;
  onSelectWorkload: (workload: WAWorkloadSummary) => void;
  isLoading: boolean;
}

export const WorkloadList: React.FC<WorkloadListProps> = ({
  workloads,
  selectedWorkload,
  onSelectWorkload,
  isLoading,
}) => {
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
          Workloads
        </h3>
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-secondary)' }}>
          Loading workloads...
        </div>
      </div>
    );
  }

  if (workloads.length === 0) {
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
          Workloads
        </h3>
        <div style={{ textAlign: 'center', padding: 40 }}>
          <p style={{ color: 'var(--color-text-secondary)', margin: 0 }}>
            No workloads found in this region.
          </p>
          <p style={{ color: 'var(--color-text-secondary)', margin: '8px 0 0', fontSize: 13 }}>
            Create workloads in the{' '}
            <a
              href="https://console.aws.amazon.com/wellarchitected/"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--color-primary)' }}
            >
              AWS Well-Architected Tool Console
            </a>
          </p>
        </div>
      </div>
    );
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
      <h3 style={{ margin: '0 0 16px', color: 'var(--color-text)', fontSize: 16 }}>
        Workloads ({workloads.length})
      </h3>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: 16,
        }}
      >
        {workloads.map((workload) => (
          <WorkloadCard
            key={workload.workloadId}
            workload={workload}
            isSelected={selectedWorkload?.workloadId === workload.workloadId}
            onClick={() => onSelectWorkload(workload)}
          />
        ))}
      </div>
    </div>
  );
};

interface WorkloadCardProps {
  workload: WAWorkloadSummary;
  isSelected: boolean;
  onClick: () => void;
}

const WorkloadCard: React.FC<WorkloadCardProps> = ({ workload, isSelected, onClick }) => {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getEnvironmentBadge = (env: string) => {
    const envColors: Record<string, { bg: string; text: string }> = {
      PRODUCTION: { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444' },
      PREPRODUCTION: { bg: 'rgba(245, 158, 11, 0.15)', text: '#f59e0b' },
      default: { bg: 'rgba(59, 130, 246, 0.15)', text: '#3b82f6' },
    };
    const colors = envColors[env] || envColors.default;
    return (
      <span
        style={{
          fontSize: 10,
          padding: '2px 6px',
          borderRadius: 4,
          backgroundColor: colors.bg,
          color: colors.text,
          fontWeight: 500,
          textTransform: 'uppercase',
        }}
      >
        {env}
      </span>
    );
  };

  return (
    <div
      onClick={onClick}
      style={{
        backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.1)' : 'var(--color-bg)',
        border: `2px solid ${isSelected ? '#3b82f6' : 'var(--color-border)'}`,
        borderRadius: 8,
        padding: 16,
        cursor: 'pointer',
        transition: 'all 0.2s',
      }}
      onMouseEnter={(e) => {
        if (!isSelected) {
          e.currentTarget.style.borderColor = 'var(--color-border-hover)';
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          e.currentTarget.style.borderColor = 'var(--color-border)';
        }
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
        <h4
          style={{
            margin: 0,
            color: 'var(--color-text)',
            fontSize: 14,
            fontWeight: 600,
            flex: 1,
            marginRight: 8,
          }}
        >
          {workload.workloadName}
        </h4>
        {getEnvironmentBadge(workload.environment)}
      </div>

      {workload.description && (
        <p
          style={{
            margin: '0 0 12px',
            color: 'var(--color-text-secondary)',
            fontSize: 12,
            lineHeight: 1.4,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
          }}
        >
          {workload.description}
        </p>
      )}

      <RiskSummary riskCounts={workload.riskCounts} size="small" />

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 12,
          paddingTop: 12,
          borderTop: '1px solid var(--color-border)',
        }}
      >
        <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
          Updated: {formatDate(workload.updatedAt)}
        </span>
        <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
          {workload.lenses.length} lens{workload.lenses.length !== 1 ? 'es' : ''}
        </span>
      </div>
    </div>
  );
};

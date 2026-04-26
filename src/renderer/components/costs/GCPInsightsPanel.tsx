// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React, { useEffect } from 'react';
import { useGCPInsightStore } from '../../stores/gcpInsightStore';
import type {
  GCPCostInsight,
  GCPCostInsightSeverity,
} from '../../../shared/types';

interface GCPInsightsPanelProps {
  projectId: string | null;
}

const SEVERITY_COLOR: Record<GCPCostInsightSeverity, string> = {
  critical: '#f4212e',
  high: '#f4212e',
  medium: '#ffad1f',
  low: '#1d9bf0',
};

const INSIGHT_LABELS: Record<string, string> = {
  'google.cloudsql.instance.CpuUsageInsight': 'Cloud SQL — CPU usage',
  'google.cloudsql.instance.MemoryUsageInsight': 'Cloud SQL — Memory usage',
  'google.bigquery.table.StatsInsight': 'BigQuery — Table stats',
  'google.resourcemanager.projectUtilization.Insight': 'Project utilization',
};

const SeverityBadge: React.FC<{ severity: GCPCostInsightSeverity }> = ({ severity }) => (
  <span
    style={{
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: 10,
      fontSize: 11,
      fontWeight: 700,
      textTransform: 'uppercase',
      backgroundColor: `${SEVERITY_COLOR[severity]}22`,
      color: SEVERITY_COLOR[severity],
      border: `1px solid ${SEVERITY_COLOR[severity]}44`,
    }}
  >
    {severity}
  </span>
);

const InsightRow: React.FC<{ insight: GCPCostInsight }> = ({ insight }) => (
  <tr style={{ borderTop: '1px solid var(--color-border)' }}>
    <td style={{ padding: '10px 12px', verticalAlign: 'top' }}>
      <div style={{ fontWeight: 500 }}>{INSIGHT_LABELS[insight.insightType] ?? insight.service}</div>
      <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>
        {insight.location}
        {insight.insightSubtype ? ` · ${insight.insightSubtype}` : ''}
      </div>
    </td>
    <td style={{ padding: '10px 12px', verticalAlign: 'top' }}>
      <SeverityBadge severity={insight.severity} />
    </td>
    <td style={{ padding: '10px 12px', verticalAlign: 'top' }}>
      <code style={{ fontSize: 12 }}>{insight.primaryResourceName || '—'}</code>
    </td>
    <td style={{ padding: '10px 12px', verticalAlign: 'top', fontSize: 13 }}>
      {insight.description}
    </td>
    <td style={{ padding: '10px 12px', verticalAlign: 'top', fontSize: 12, color: 'var(--color-text-secondary)' }}>
      {insight.associatedRecommendations.length > 0
        ? `${insight.associatedRecommendations.length} linked rec${insight.associatedRecommendations.length === 1 ? '' : 's'}`
        : '—'}
    </td>
  </tr>
);

const GCPInsightsPanel: React.FC<GCPInsightsPanelProps> = ({ projectId }) => {
  const {
    insights,
    byType,
    bySeverity,
    locationsScanned,
    isLoading,
    error,
    errors,
    lastLoadedProjectId,
    loadInsights,
  } = useGCPInsightStore();

  useEffect(() => {
    if (projectId && projectId !== lastLoadedProjectId) {
      void loadInsights(projectId);
    }
  }, [projectId, lastLoadedProjectId, loadInsights]);

  if (!projectId) {
    return <div className="empty-state">Select a GCP project to view diagnostic insights.</div>;
  }

  if (isLoading) {
    return (
      <div style={{ padding: 16, color: 'var(--color-text-secondary)', fontSize: 13 }}>
        Querying insights across {locationsScanned.length || '—'} location{locationsScanned.length === 1 ? '' : 's'}…
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          padding: 12,
          background: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border)',
          borderRadius: 6,
          color: 'var(--color-error)',
          fontSize: 13,
        }}
      >
        {error}
      </div>
    );
  }

  if (insights.length === 0) {
    return (
      <div className="empty-state">
        No diagnostic insights available for this project. Insights appear once a workload accumulates enough utilization data (typically 7+ days for Cloud SQL, 30+ days for BigQuery).
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div
        style={{
          display: 'flex',
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        {(['critical', 'high', 'medium', 'low'] as GCPCostInsightSeverity[]).map((sev) => {
          const count = bySeverity[sev] ?? 0;
          if (count === 0) return null;
          return (
            <div
              key={sev}
              style={{
                padding: '10px 14px',
                background: 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border)',
                borderRadius: 8,
                minWidth: 100,
              }}
            >
              <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                {sev}
              </div>
              <div style={{ fontSize: 22, fontWeight: 600, color: SEVERITY_COLOR[sev] }}>
                {count}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
        {Object.entries(byType).map(([type, count]) => (
          <span key={type} style={{ marginRight: 12 }}>
            {INSIGHT_LABELS[type] ?? type}: <strong>{count}</strong>
          </span>
        ))}
      </div>

      <div
        style={{
          border: '1px solid var(--color-border)',
          borderRadius: 8,
          overflow: 'hidden',
          background: 'var(--color-bg-secondary)',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--color-bg-tertiary)' }}>
              <th style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 600 }}>Type</th>
              <th style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 600 }}>Severity</th>
              <th style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 600 }}>Resource</th>
              <th style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 600 }}>Description</th>
              <th style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 600 }}>Linked</th>
            </tr>
          </thead>
          <tbody>
            {insights.map((i) => <InsightRow key={i.id} insight={i} />)}
          </tbody>
        </table>
      </div>

      {errors.length > 0 && (
        <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
          Notes: {errors.slice(0, 3).join('; ')}{errors.length > 3 ? '…' : ''}
        </div>
      )}
    </div>
  );
};

export default GCPInsightsPanel;

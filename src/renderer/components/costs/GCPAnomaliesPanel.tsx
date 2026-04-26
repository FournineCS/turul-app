// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React, { useEffect, useMemo } from 'react';
import { useGCPAnomalyStore } from '../../stores/gcpAnomalyStore';
import type { GCPCostAnomaly, GCPCostAnomalySeverity } from '../../../shared/types';

interface GCPAnomaliesPanelProps {
  projectId: string | null;
  bqProject: string | null;
  bqDataset: string | null;
  bqRegion: string | null;
}

function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatSignedPct(pct: number): string {
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

const SEVERITY_COLOR: Record<GCPCostAnomalySeverity, string> = {
  high: '#f4212e',
  medium: '#ffad1f',
  low: '#1d9bf0',
};

const SeverityBadge: React.FC<{ severity: GCPCostAnomalySeverity }> = ({ severity }) => (
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

const AnomalyRow: React.FC<{ anomaly: GCPCostAnomaly }> = ({ anomaly }) => {
  const arrow = anomaly.direction === 'increase' ? '↑' : '↓';
  const arrowColor = anomaly.direction === 'increase' ? '#f4212e' : '#00ba7c';

  return (
    <tr style={{ borderTop: '1px solid var(--color-border)' }}>
      <td style={{ padding: '10px 12px', fontWeight: 500, verticalAlign: 'top' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span>{anomaly.service}</span>
          <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
            {anomaly.windowStart} → {anomaly.windowEnd}
          </span>
        </div>
      </td>
      <td style={{ padding: '10px 12px', verticalAlign: 'top' }}>
        <SeverityBadge severity={anomaly.severity} />
      </td>
      <td style={{ padding: '10px 12px', verticalAlign: 'top' }}>
        <span style={{ color: arrowColor, fontWeight: 600 }}>{arrow}</span>{' '}
        <strong>{formatSignedPct(anomaly.deviationPct)}</strong>
      </td>
      <td style={{ padding: '10px 12px', textAlign: 'right', verticalAlign: 'top' }}>
        <div style={{ fontWeight: 600 }}>{formatCurrency(anomaly.cost, anomaly.currency)}</div>
        <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
          was {formatCurrency(anomaly.priorCost, anomaly.currency)}
        </div>
      </td>
      <td
        style={{
          padding: '10px 12px',
          textAlign: 'right',
          verticalAlign: 'top',
          color: arrowColor,
          fontWeight: 600,
        }}
      >
        {anomaly.delta >= 0 ? '+' : ''}
        {formatCurrency(anomaly.delta, anomaly.currency)}
      </td>
      <td style={{ padding: '10px 12px', verticalAlign: 'top', fontSize: 12 }}>
        {anomaly.topSkus.length === 0 ? (
          <span style={{ color: 'var(--color-text-secondary)' }}>—</span>
        ) : (
          <ul style={{ margin: 0, paddingLeft: 16, color: 'var(--color-text-secondary)' }}>
            {anomaly.topSkus.map((s) => (
              <li key={s.sku}>
                {s.sku}: {s.delta >= 0 ? '+' : ''}{formatCurrency(s.delta, anomaly.currency)}
              </li>
            ))}
          </ul>
        )}
      </td>
    </tr>
  );
};

const GCPAnomaliesPanel: React.FC<GCPAnomaliesPanelProps> = ({
  projectId,
  bqProject,
  bqDataset,
  bqRegion,
}) => {
  const {
    anomalies,
    windowStart,
    windowEnd,
    baselineStart,
    baselineEnd,
    servicesEvaluated,
    thresholds,
    isLoading,
    error,
    errors,
    lastLoadedKey,
    detect,
  } = useGCPAnomalyStore();

  const detectKey = useMemo(
    () => projectId && bqProject && bqDataset
      ? `${projectId}|${bqProject}|${bqDataset}|${bqRegion ?? ''}|7|30|25`
      : null,
    [projectId, bqProject, bqDataset, bqRegion]
  );

  useEffect(() => {
    if (!projectId || !bqProject || !bqDataset) return;
    if (detectKey === lastLoadedKey) return;
    void detect(projectId, bqProject, bqDataset, bqRegion ?? undefined);
  }, [projectId, bqProject, bqDataset, bqRegion, detectKey, lastLoadedKey, detect]);

  if (!projectId) return null;
  if (!bqProject || !bqDataset) {
    return (
      <div className="empty-state">
        BigQuery billing export must be configured to detect cost anomalies.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div style={{ padding: 16, color: 'var(--color-text-secondary)', fontSize: 13 }}>
        Detecting anomalies…
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

  const totalImpact = anomalies.reduce((sum, a) => sum + a.delta, 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: 12,
          color: 'var(--color-text-secondary)',
        }}
      >
        <div>
          {anomalies.length === 0
            ? `No anomalies detected across ${servicesEvaluated} service${servicesEvaluated === 1 ? '' : 's'}.`
            : `${anomalies.length} anomal${anomalies.length === 1 ? 'y' : 'ies'} across ${servicesEvaluated} service${servicesEvaluated === 1 ? '' : 's'}.`}
        </div>
        {windowStart && windowEnd && baselineStart && baselineEnd && (
          <div>
            Window: <code>{windowStart} → {windowEnd}</code> vs baseline <code>{baselineStart} → {baselineEnd}</code>
          </div>
        )}
      </div>

      {anomalies.length > 0 && (
        <div
          style={{
            display: 'flex',
            gap: 16,
            padding: 12,
            background: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            fontSize: 13,
          }}
        >
          <div>
            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>Net impact</div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 600,
                color: totalImpact >= 0 ? '#f4212e' : '#00ba7c',
              }}
            >
              {totalImpact >= 0 ? '+' : ''}{formatCurrency(totalImpact)}
            </div>
          </div>
          {thresholds && (
            <div style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--color-text-secondary)' }}>
              Thresholds: ≥ {thresholds.minDeviationPct}% deviation · ≥ ${thresholds.minImpactUsd} impact · {thresholds.windowDays}d window
            </div>
          )}
        </div>
      )}

      {anomalies.length > 0 && (
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
                <th style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 600 }}>Service</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 600 }}>Severity</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 600 }}>Deviation</th>
                <th style={{ textAlign: 'right', padding: '10px 12px', fontWeight: 600 }}>Window cost</th>
                <th style={{ textAlign: 'right', padding: '10px 12px', fontWeight: 600 }}>Δ</th>
                <th style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 600 }}>Top SKU contributors</th>
              </tr>
            </thead>
            <tbody>
              {anomalies.map((a) => <AnomalyRow key={a.id} anomaly={a} />)}
            </tbody>
          </table>
        </div>
      )}

      {errors.length > 0 && (
        <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
          Notes: {errors.join('; ')}
        </div>
      )}
    </div>
  );
};

export default GCPAnomaliesPanel;

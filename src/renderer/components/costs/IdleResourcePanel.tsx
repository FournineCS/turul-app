// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React from 'react';
import type { ResourceIdleAnalysisResult, IdleResourceIssueType } from '../../../shared/types';

const ISSUE_LABELS: Record<IdleResourceIssueType, string> = {
  stopped_vm: 'Stopped VM',
  unused_ip: 'Unused External IP',
  unattached_disk: 'Unattached Disk',
  unused_lb: 'Unused Load Balancer',
  empty_dns_zone: 'Empty DNS Zone',
};

const ISSUE_COLORS: Record<IdleResourceIssueType, string> = {
  stopped_vm: '#f59e0b',
  unused_ip: '#3b82f6',
  unattached_disk: '#8b5cf6',
  unused_lb: '#ef4444',
  empty_dns_zone: '#6b7280',
};

interface Props {
  data: ResourceIdleAnalysisResult | null;
  isLoading: boolean;
  error: string | null;
  lastScanDate?: string | null;
}

export const IdleResourcePanel: React.FC<Props> = ({ data, isLoading, error, lastScanDate }) => {
  if (isLoading) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: 13 }}>
        Analyzing resources from scan data...
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          padding: 16,
          backgroundColor: 'rgba(239, 68, 68, 0.05)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          borderRadius: 8,
          color: '#ef4444',
          fontSize: 13,
        }}
      >
        {error}
        {error.includes('No completed GCP scan') && (
          <p style={{ margin: '8px 0 0', color: 'var(--color-text-secondary)' }}>
            Go to the Scan page and run a GCP resource scan first, then return here to analyze idle resources.
          </p>
        )}
      </div>
    );
  }

  if (!data) {
    return (
      <div
        style={{
          backgroundColor: 'var(--color-bg-tertiary)',
          border: '1px dashed var(--color-border)',
          borderRadius: 8,
          padding: 40,
          textAlign: 'center',
        }}
      >
        <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: 14 }}>
          No resource analysis data yet.
        </p>
        <p style={{ margin: '8px 0 0', color: 'var(--color-text-secondary)', fontSize: 13 }}>
          Click <strong>Run Full Scan</strong> to detect idle resources from your existing GCP resource scan.
          This uses your local scan data — no API calls required.
        </p>
      </div>
    );
  }

  const issueTypes: IdleResourceIssueType[] = [
    'stopped_vm', 'unused_ip', 'unattached_disk', 'unused_lb', 'empty_dns_zone',
  ];

  return (
    <div>
      {/* Summary cards */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
        <div
          style={{
            flex: '1 1 140px',
            padding: '12px 16px',
            backgroundColor: 'var(--color-bg-tertiary)',
            border: '1px solid var(--color-border)',
            borderRadius: 8,
          }}
        >
          <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--color-text)' }}>
            {data.totalFindings}
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>
            Total Findings
          </div>
        </div>
        <div
          style={{
            flex: '1 1 140px',
            padding: '12px 16px',
            backgroundColor: 'rgba(239, 68, 68, 0.05)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            borderRadius: 8,
          }}
        >
          <div style={{ fontSize: 22, fontWeight: 700, color: '#ef4444' }}>
            ${data.estimatedMonthlySavings.toFixed(2)}
          </div>
          <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>
            Est. Monthly Savings
          </div>
        </div>
        {issueTypes.map((type) => (
          data.byType[type] > 0 && (
            <div
              key={type}
              style={{
                flex: '1 1 120px',
                padding: '12px 16px',
                backgroundColor: 'var(--color-bg-tertiary)',
                border: `1px solid ${ISSUE_COLORS[type]}40`,
                borderRadius: 8,
              }}
            >
              <div style={{ fontSize: 22, fontWeight: 700, color: ISSUE_COLORS[type] }}>
                {data.byType[type]}
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                {ISSUE_LABELS[type]}
              </div>
            </div>
          )
        ))}
      </div>

      {/* Findings table */}
      {data.findings.length > 0 ? (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                {['Resource Name', 'Issue', 'Service', 'Region', 'Est. Savings/mo'].map((h) => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--color-text-secondary)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.findings.map((f) => (
                <tr
                  key={f.id}
                  style={{ borderBottom: '1px solid var(--color-border)' }}
                >
                  <td style={{ padding: '8px 12px', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <span title={f.resourceName}>{f.resourceName || f.resourceId}</span>
                  </td>
                  <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '2px 8px',
                        borderRadius: 10,
                        fontSize: 11,
                        fontWeight: 600,
                        backgroundColor: `${ISSUE_COLORS[f.issueType]}20`,
                        color: ISSUE_COLORS[f.issueType],
                      }}
                    >
                      {ISSUE_LABELS[f.issueType]}
                    </span>
                  </td>
                  <td style={{ padding: '8px 12px', color: 'var(--color-text-secondary)' }}>
                    {f.service}
                  </td>
                  <td style={{ padding: '8px 12px', color: 'var(--color-text-secondary)' }}>
                    {f.region}
                  </td>
                  <td style={{ padding: '8px 12px', fontWeight: 600, color: f.estimatedMonthlySavings > 0 ? '#ef4444' : 'var(--color-text-secondary)' }}>
                    {f.estimatedMonthlySavings > 0 ? `$${f.estimatedMonthlySavings.toFixed(2)}` : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: 13 }}>
          No idle resources detected.
        </div>
      )}

      {/* Footer */}
      <div style={{ marginTop: 12, fontSize: 11, color: 'var(--color-text-secondary)' }}>
        Analyzed scan <code>{data.scanId.slice(0, 8)}…</code> at {new Date(data.scannedAt).toLocaleString()}.
        {lastScanDate && ` Resource scan collected on ${new Date(lastScanDate).toLocaleDateString()}.`}
        {' '}No GCP API calls were made for this analysis.
      </div>
    </div>
  );
};

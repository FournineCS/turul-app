// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React, { useState } from 'react';
import type { WABPFinding } from '../../../shared/types';

interface WABPFindingsTableProps {
  findings: WABPFinding[];
}

const SEVERITY_COLORS: Record<string, { bg: string; text: string }> = {
  CRITICAL: { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444' },
  HIGH: { bg: 'rgba(249, 115, 22, 0.15)', text: '#f97316' },
  MEDIUM: { bg: 'rgba(245, 158, 11, 0.15)', text: '#f59e0b' },
  LOW: { bg: 'rgba(59, 130, 246, 0.15)', text: '#3b82f6' },
  INFORMATIONAL: { bg: 'rgba(107, 114, 128, 0.15)', text: '#6b7280' },
};

export const WABPFindingsTable: React.FC<WABPFindingsTableProps> = ({ findings }) => {
  const [expandedFinding, setExpandedFinding] = useState<string | null>(null);

  // Sort by severity
  const severityOrder = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFORMATIONAL'];
  const sortedFindings = [...findings].sort(
    (a, b) => severityOrder.indexOf(a.severity) - severityOrder.indexOf(b.severity)
  );

  return (
    <div>
      {sortedFindings.map((finding, index) => {
        const key = `${finding.checkId}-${finding.resourceId || index}`;
        const isExpanded = expandedFinding === key;
        const colors = SEVERITY_COLORS[finding.severity] || SEVERITY_COLORS.LOW;

        return (
          <div
            key={key}
            style={{
              borderBottom: index < sortedFindings.length - 1 ? '1px solid var(--color-border)' : 'none',
              padding: '10px 0',
            }}
          >
            {/* Finding header row */}
            <div
              onClick={() => setExpandedFinding(isExpanded ? null : key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                cursor: 'pointer',
              }}
            >
              {/* Severity badge */}
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  padding: '2px 6px',
                  borderRadius: 4,
                  backgroundColor: colors.bg,
                  color: colors.text,
                  flexShrink: 0,
                  minWidth: 55,
                  textAlign: 'center',
                }}
              >
                {finding.severity}
              </span>

              {/* Title */}
              <span style={{ fontSize: 13, color: 'var(--color-text)', flex: 1 }}>
                {finding.title}
              </span>

              {/* Resource ID */}
              {finding.resourceId && (
                <span
                  style={{
                    fontSize: 11,
                    color: 'var(--color-text-secondary)',
                    fontFamily: 'monospace',
                    flexShrink: 0,
                    maxWidth: 200,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {finding.resourceId}
                </span>
              )}

              {/* Expand indicator */}
              <span
                style={{
                  fontSize: 10,
                  color: 'var(--color-text-secondary)',
                  transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s',
                  flexShrink: 0,
                }}
              >
                &#9660;
              </span>
            </div>

            {/* Expanded details */}
            {isExpanded && (
              <div
                style={{
                  marginTop: 8,
                  padding: '10px 12px',
                  backgroundColor: 'rgba(0, 0, 0, 0.1)',
                  borderRadius: 6,
                  fontSize: 12,
                }}
              >
                <div style={{ color: 'var(--color-text)', marginBottom: 8 }}>
                  {finding.description}
                </div>
                {finding.remediationRecommendation && (
                  <div style={{ marginBottom: 6 }}>
                    <span style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                      Remediation:{' '}
                    </span>
                    <span style={{ color: 'var(--color-text)' }}>
                      {finding.remediationRecommendation}
                    </span>
                  </div>
                )}
                {finding.remediationUrl && (
                  <a
                    href={finding.remediationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: 'var(--color-primary)', fontSize: 12 }}
                  >
                    View documentation →
                  </a>
                )}
                {finding.resourceArn && (
                  <div style={{ marginTop: 6 }}>
                    <span style={{ color: 'var(--color-text-secondary)', fontWeight: 600 }}>
                      ARN:{' '}
                    </span>
                    <span
                      style={{
                        color: 'var(--color-text-secondary)',
                        fontFamily: 'monospace',
                        fontSize: 11,
                      }}
                    >
                      {finding.resourceArn}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

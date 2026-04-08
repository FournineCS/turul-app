// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React, { useEffect, useCallback } from 'react';
import type { SecurityFinding, FindingSeverity, FindingSource } from '../../../shared/types';

interface FindingDetailModalProps {
  finding: SecurityFinding | null;
  onClose: () => void;
}

const SEVERITY_COLORS: Record<FindingSeverity, string> = {
  CRITICAL: '#dc2626',
  HIGH: '#ea580c',
  MEDIUM: '#ca8a04',
  LOW: '#2563eb',
  INFORMATIONAL: '#6b7280',
};

const SOURCE_LABELS: Record<FindingSource, string> = {
  SECURITY_HUB: 'Security Hub',
  GUARDDUTY: 'GuardDuty',
  INSPECTOR: 'Inspector',
  ACCESS_ANALYZER: 'IAM Access Analyzer',
  CONFIG: 'AWS Config',
};

interface DetailRowProps {
  label: string;
  value: string | undefined;
  isLink?: boolean;
}

const DetailRow: React.FC<DetailRowProps> = ({ label, value, isLink }) => {
  if (!value) return null;

  return (
    <div style={{ marginBottom: 16 }}>
      <div
        style={{
          fontSize: 11,
          color: 'var(--color-text-secondary)',
          textTransform: 'uppercase',
          fontWeight: 500,
          letterSpacing: '0.5px',
          marginBottom: 4,
        }}
      >
        {label}
      </div>
      {isLink ? (
        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            fontSize: 13,
            color: 'var(--color-primary)',
            textDecoration: 'none',
            wordBreak: 'break-all',
          }}
        >
          {value}
        </a>
      ) : (
        <div
          style={{
            fontSize: 13,
            color: 'var(--color-text)',
            wordBreak: 'break-word',
          }}
        >
          {value}
        </div>
      )}
    </div>
  );
};

export const FindingDetailModal: React.FC<FindingDetailModalProps> = ({ finding, onClose }) => {
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    if (!finding) return;
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [finding, handleKeyDown]);

  if (!finding) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'var(--color-bg-secondary)',
          borderRadius: 12,
          width: '100%',
          maxWidth: 700,
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 16,
          }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <span
                style={{
                  display: 'inline-block',
                  padding: '4px 10px',
                  borderRadius: 4,
                  fontSize: 11,
                  fontWeight: 600,
                  backgroundColor: `${SEVERITY_COLORS[finding.severity]}20`,
                  color: SEVERITY_COLORS[finding.severity],
                  textTransform: 'uppercase',
                }}
              >
                {finding.severity}
              </span>
              <span
                style={{
                  fontSize: 12,
                  color: 'var(--color-text-secondary)',
                }}
              >
                {SOURCE_LABELS[finding.source]}
              </span>
            </div>
            <h2
              style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 600,
                color: 'var(--color-text)',
              }}
            >
              {finding.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-text-secondary)',
              cursor: 'pointer',
              padding: 4,
              fontSize: 24,
              lineHeight: 1,
            }}
          >
            &times;
          </button>
        </div>

        {/* Content */}
        <div
          style={{
            padding: 24,
            overflowY: 'auto',
            flex: 1,
          }}
        >
          {/* Description */}
          <div style={{ marginBottom: 24 }}>
            <div
              style={{
                fontSize: 11,
                color: 'var(--color-text-secondary)',
                textTransform: 'uppercase',
                fontWeight: 500,
                letterSpacing: '0.5px',
                marginBottom: 8,
              }}
            >
              Description
            </div>
            <div
              style={{
                fontSize: 13,
                color: 'var(--color-text)',
                lineHeight: 1.6,
                backgroundColor: 'var(--color-bg-tertiary)',
                padding: 16,
                borderRadius: 8,
              }}
            >
              {finding.description || 'No description available.'}
            </div>
          </div>

          {/* Resource Info */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 16,
              marginBottom: 24,
            }}
          >
            <DetailRow label="Resource Type" value={finding.resourceType} />
            <DetailRow label="Resource ID" value={finding.resourceId} />
            <DetailRow label="Region" value={finding.region} />
            <DetailRow label="AWS Account" value={finding.awsAccountId} />
            <DetailRow label="Status" value={finding.status} />
            <DetailRow label="Compliance Status" value={finding.complianceStatus} />
          </div>

          {/* Remediation */}
          {(finding.remediationRecommendation || finding.remediationUrl) && (
            <div
              style={{
                marginBottom: 24,
                backgroundColor: 'var(--color-bg-tertiary)',
                padding: 16,
                borderRadius: 8,
                border: '1px solid var(--color-border)',
              }}
            >
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color: 'var(--color-text)',
                  marginBottom: 12,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Remediation Guidance
              </div>
              {finding.remediationRecommendation && (
                <div
                  style={{
                    fontSize: 13,
                    color: 'var(--color-text)',
                    lineHeight: 1.6,
                    marginBottom: finding.remediationUrl ? 12 : 0,
                  }}
                >
                  {finding.remediationRecommendation}
                </div>
              )}
              {finding.remediationUrl && (
                <a
                  href={finding.remediationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 13,
                    color: 'var(--color-primary)',
                    textDecoration: 'none',
                  }}
                >
                  <svg
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3" />
                  </svg>
                  View Documentation
                </a>
              )}
            </div>
          )}

          {/* Timestamps */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 16,
            }}
          >
            <DetailRow
              label="First Observed"
              value={
                finding.firstObservedAt
                  ? new Date(finding.firstObservedAt).toLocaleString()
                  : undefined
              }
            />
            <DetailRow
              label="Last Observed"
              value={
                finding.lastObservedAt
                  ? new Date(finding.lastObservedAt).toLocaleString()
                  : undefined
              }
            />
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--color-border)',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              border: '1px solid var(--color-border)',
              borderRadius: 6,
              backgroundColor: 'var(--color-bg-tertiary)',
              color: 'var(--color-text)',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default FindingDetailModal;

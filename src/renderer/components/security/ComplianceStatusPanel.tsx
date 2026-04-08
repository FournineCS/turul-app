// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React from 'react';
import type { ComplianceScore, ComplianceStandard } from '../../../shared/types';

interface ComplianceStatusPanelProps {
  scores: ComplianceScore[];
  standards: ComplianceStandard[];
  isLoading: boolean;
}

function getScoreColor(score: number): string {
  if (score >= 80) return '#10b981';
  if (score >= 60) return '#f59e0b';
  if (score >= 40) return '#f97316';
  return '#ef4444';
}

interface ComplianceCardProps {
  score: ComplianceScore;
}

const ComplianceCard: React.FC<ComplianceCardProps> = ({ score }) => {
  const color = getScoreColor(score.score);
  const circumference = 2 * Math.PI * 40;
  const strokeDashoffset = circumference - (score.score / 100) * circumference;

  return (
    <div
      style={{
        backgroundColor: 'var(--color-bg-tertiary)',
        border: '1px solid var(--color-border)',
        borderRadius: 8,
        padding: 16,
        minWidth: 200,
        flex: '1 1 200px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ position: 'relative', width: 90, height: 90 }}>
          <svg width="90" height="90" viewBox="0 0 100 100">
            {/* Background circle */}
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke="var(--color-border)"
              strokeWidth="8"
            />
            {/* Progress circle */}
            <circle
              cx="50"
              cy="50"
              r="40"
              fill="none"
              stroke={color}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              style={{
                transform: 'rotate(-90deg)',
                transformOrigin: '50% 50%',
                transition: 'stroke-dashoffset 0.5s ease',
              }}
            />
          </svg>
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center',
            }}
          >
            <div
              style={{
                fontSize: 20,
                fontWeight: 600,
                color: color,
              }}
            >
              {score.score}%
            </div>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          <div
            style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--color-text)',
              marginBottom: 8,
            }}
          >
            {score.standardName}
          </div>
          <div
            style={{
              fontSize: 12,
              color: 'var(--color-text-secondary)',
            }}
          >
            <div style={{ marginBottom: 4 }}>
              <span style={{ color: '#10b981' }}>{score.passedControls}</span> passed
            </div>
            <div>
              <span style={{ color: '#ef4444' }}>{score.failedControls}</span> failed
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export const ComplianceStatusPanel: React.FC<ComplianceStatusPanelProps> = ({
  scores,
  standards,
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
          marginBottom: 24,
        }}
      >
        <h3
          style={{
            margin: '0 0 16px',
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--color-text)',
          }}
        >
          Compliance Standards
        </h3>
        <div
          style={{
            display: 'flex',
            gap: 16,
            flexWrap: 'wrap',
          }}
        >
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                backgroundColor: 'var(--color-bg-tertiary)',
                borderRadius: 8,
                padding: 16,
                minWidth: 200,
                flex: '1 1 200px',
                height: 110,
                animation: 'pulse 1.5s ease-in-out infinite',
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  if (scores.length === 0 && standards.length === 0) {
    return (
      <div
        style={{
          backgroundColor: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border)',
          borderRadius: 8,
          padding: 20,
          marginBottom: 24,
        }}
      >
        <h3
          style={{
            margin: '0 0 16px',
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--color-text)',
          }}
        >
          Compliance Standards
        </h3>
        <div
          style={{
            textAlign: 'center',
            padding: 24,
            color: 'var(--color-text-secondary)',
          }}
        >
          <p style={{ margin: 0 }}>No compliance standards enabled.</p>
          <p style={{ margin: '8px 0 0', fontSize: 12 }}>
            Enable security standards in AWS Security Hub to see compliance scores.
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
        padding: 20,
        marginBottom: 24,
      }}
    >
      <h3
        style={{
          margin: '0 0 16px',
          fontSize: 14,
          fontWeight: 600,
          color: 'var(--color-text)',
        }}
      >
        Compliance Standards
      </h3>
      <div
        style={{
          display: 'flex',
          gap: 16,
          flexWrap: 'wrap',
        }}
      >
        {scores.map((score) => (
          <ComplianceCard key={score.standardArn} score={score} />
        ))}
      </div>
    </div>
  );
};

export default ComplianceStatusPanel;

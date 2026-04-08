// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React from 'react';
import type { AssessmentResult, GCPAssessmentResult } from '../../../shared/types';

interface Props {
  assessment: AssessmentResult | GCPAssessmentResult | null;
}

const SecurityPostureGauge: React.FC<Props> = ({ assessment }) => {
  if (!assessment) {
    return (
      <div className="card dashboard-widget">
        <h3 className="card-title">Security Posture</h3>
        <p className="text-secondary">Run an assessment to see security score</p>
      </div>
    );
  }

  const securityDomain = assessment.domainScores.find((d) => d.domain === 'security');
  const score = securityDomain ? Math.round(securityDomain.score) : 0;

  // SVG semicircle gauge
  const radius = 60;
  const strokeWidth = 10;
  const cx = 80;
  const cy = 75;
  const circumference = Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const getColor = (s: number) => {
    if (s >= 80) return 'var(--color-success)';
    if (s >= 60) return 'var(--color-warning)';
    return 'var(--color-error)';
  };

  return (
    <div className="card dashboard-widget">
      <h3 className="card-title">Security Posture</h3>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <svg width="160" height="100" viewBox="0 0 160 100">
          {/* Background arc */}
          <path
            d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
            fill="none"
            stroke="var(--color-border)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          {/* Score arc */}
          <path
            d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
            fill="none"
            stroke={getColor(score)}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.5s ease' }}
          />
          <text x={cx} y={cy - 10} textAnchor="middle" fill="var(--color-text)" fontSize="24" fontWeight="700">
            {score}
          </text>
          <text x={cx} y={cy + 8} textAnchor="middle" fill="var(--color-text-secondary)" fontSize="11">
            / 100
          </text>
        </svg>
        <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
          {assessment.criticalCount > 0 && (
            <span style={{ color: 'var(--color-error)', fontSize: 12, fontWeight: 600 }}>
              {assessment.criticalCount} Critical
            </span>
          )}
          {assessment.highCount > 0 && (
            <span style={{ color: 'var(--color-warning)', fontSize: 12, fontWeight: 600 }}>
              {assessment.highCount} High
            </span>
          )}
          {assessment.mediumCount > 0 && (
            <span style={{ color: 'var(--color-info)', fontSize: 12, fontWeight: 600 }}>
              {assessment.mediumCount} Med
            </span>
          )}
          {assessment.lowCount > 0 && (
            <span style={{ color: 'var(--color-text-secondary)', fontSize: 12, fontWeight: 600 }}>
              {assessment.lowCount} Low
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default SecurityPostureGauge;

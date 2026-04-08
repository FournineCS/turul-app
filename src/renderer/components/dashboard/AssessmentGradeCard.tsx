// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React from 'react';
import type { AssessmentResult, GCPAssessmentResult } from '../../../shared/types';

interface Props {
  assessment: AssessmentResult | GCPAssessmentResult | null;
}

const gradeColors: Record<string, string> = {
  'A+': '#00ba7c', A: '#00ba7c',
  'B+': '#4caf50', B: '#4caf50',
  'C+': '#ffad1f', C: '#ffad1f',
  'D+': '#ff9800', D: '#ff9800',
  F: '#f4212e',
};

const AssessmentGradeCard: React.FC<Props> = ({ assessment }) => {
  if (!assessment) {
    return (
      <div className="card dashboard-widget">
        <h3 className="card-title">Assessment Grade</h3>
        <p className="text-secondary">Run an assessment to see your grade</p>
      </div>
    );
  }

  const gradeColor = gradeColors[assessment.overallGrade] || 'var(--color-text-secondary)';

  return (
    <div className="card dashboard-widget">
      <h3 className="card-title">Assessment Grade</h3>
      <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 16 }}>
        <div
          style={{
            width: 72, height: 72, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: `3px solid ${gradeColor}`,
            color: gradeColor, fontSize: 28, fontWeight: 700,
          }}
        >
          {assessment.overallGrade}
        </div>
        <div>
          <div style={{ fontSize: 24, fontWeight: 700 }}>{Math.round(assessment.overallScore)}</div>
          <div className="text-secondary" style={{ fontSize: 12 }}>Overall Score</div>
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {assessment.domainScores.map((ds) => (
          <div key={ds.domain} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 12, width: 80, textTransform: 'capitalize' }}>{ds.domain}</span>
            <div style={{ flex: 1, height: 6, background: 'var(--color-border)', borderRadius: 3 }}>
              <div
                style={{
                  width: `${Math.round(ds.score)}%`, height: '100%',
                  background: ds.score >= 80 ? 'var(--color-success)' : ds.score >= 60 ? 'var(--color-warning)' : 'var(--color-error)',
                  borderRadius: 3, transition: 'width 0.3s ease',
                }}
              />
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, width: 32, textAlign: 'right' }}>
              {Math.round(ds.score)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AssessmentGradeCard;

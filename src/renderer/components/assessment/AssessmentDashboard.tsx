// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React, { useState, useCallback } from 'react';
import type { AssessmentResult, DomainScore, AssessmentRecommendation } from '../../../shared/types';

const GRADE_COLORS: Record<string, string> = {
  A: '#22c55e', B: '#84cc16', C: '#eab308', D: '#f97316', F: '#ef4444',
};

const SEVERITY_COLORS: Record<string, string> = {
  critical: '#dc2626', high: '#ea580c', medium: '#d97706', low: '#2563eb', info: '#6b7280',
};

const DOMAIN_LABELS: Record<string, string> = {
  cost: 'Cost Optimization',
  security: 'Security',
  wellArchitected: 'Well-Architected',
  inventory: 'Resource Inventory',
};

function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(amount);
}

interface AssessmentDashboardProps {
  result: AssessmentResult;
  onGenerateReport: () => void;
  onReset: () => void;
  isGeneratingReport: boolean;
}

export const AssessmentDashboard: React.FC<AssessmentDashboardProps> = ({
  result, onGenerateReport, onReset, isGeneratingReport,
}) => {
  const [recFilter, setRecFilter] = useState<string>('all');
  const [recDomainFilter, setRecDomainFilter] = useState<string>('all');

  const allRecs = result.domainScores.flatMap(d => d.recommendations);
  const filteredRecs = allRecs.filter(r => {
    if (recFilter !== 'all' && r.severity !== recFilter) return false;
    if (recDomainFilter !== 'all' && r.domain !== recDomainFilter) return false;
    return true;
  });

  return (
    <div className="assessment-dashboard">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0 }}>Assessment Results</h1>
          <p style={{ color: 'var(--color-text-secondary)', marginTop: 4, fontSize: 13 }}>
            Profile: {result.profile} | Region: {result.region}
            {result.accountId && ` | Account: ${result.accountId}`}
            {' | '}{new Date(result.timestamp).toLocaleString()}
            {' | '}Duration: {formatDuration(result.duration)}
          </p>
          {result.errors.length > 0 && (
            <p style={{ color: '#d97706', fontSize: 12, marginTop: 4 }}>
              {result.errors.length} domain(s) had issues — scores adjusted accordingly
            </p>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="btn btn-primary"
            onClick={onGenerateReport}
            disabled={isGeneratingReport}
          >
            {isGeneratingReport ? 'Generating...' : 'Generate PDF Report'}
          </button>
          <button
            className="btn btn-secondary"
            onClick={onReset}
          >
            New Assessment
          </button>
        </div>
      </div>

      {/* Overall Score */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 24, padding: 24,
        background: 'var(--color-bg-secondary)', borderRadius: 12, border: '1px solid var(--color-border)', marginBottom: 24,
      }}>
        <div style={{
          width: 100, height: 100, borderRadius: '50%',
          background: GRADE_COLORS[result.overallGrade] || '#6b7280',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          color: '#fff', flexShrink: 0,
        }}>
          <span style={{ fontSize: 36, fontWeight: 700, lineHeight: 1 }}>{result.overallGrade}</span>
          <span style={{ fontSize: 13 }}>{result.overallScore}/100</span>
        </div>
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, fontSize: 20 }}>
            Overall Health: {result.overallGrade === 'A' ? 'Excellent' :
              result.overallGrade === 'B' ? 'Good' :
              result.overallGrade === 'C' ? 'Fair' :
              result.overallGrade === 'D' ? 'Poor' : 'Critical'}
          </h2>
          <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
            {result.criticalCount > 0 && (
              <span style={{ color: SEVERITY_COLORS.critical, fontWeight: 600, fontSize: 13 }}>
                {result.criticalCount} Critical
              </span>
            )}
            {result.highCount > 0 && (
              <span style={{ color: SEVERITY_COLORS.high, fontWeight: 600, fontSize: 13 }}>
                {result.highCount} High
              </span>
            )}
            {result.mediumCount > 0 && (
              <span style={{ color: SEVERITY_COLORS.medium, fontWeight: 600, fontSize: 13 }}>
                {result.mediumCount} Medium
              </span>
            )}
            {result.lowCount > 0 && (
              <span style={{ color: SEVERITY_COLORS.low, fontWeight: 600, fontSize: 13 }}>
                {result.lowCount} Low
              </span>
            )}
            <span style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>
              {result.totalRecommendations} total recommendations
            </span>
          </div>
        </div>
      </div>

      {/* Domain Score Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 24 }}>
        {result.domainScores.map(ds => (
          <DomainScoreCard key={ds.domain} domainScore={ds} />
        ))}
      </div>

      {/* Domain Details */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 16, marginBottom: 24 }}>
        {result.costData && <CostSummary result={result} />}
        {result.securityData && <SecuritySummary result={result} />}
        {result.waData && <WASummary result={result} />}
        {result.resourceSummary && <InventorySummary result={result} />}
      </div>

      {/* Recommendations */}
      <div style={{ background: 'var(--color-bg-secondary)', borderRadius: 12, border: '1px solid var(--color-border)', padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h3 style={{ margin: 0 }}>Recommendations ({filteredRecs.length})</h3>
          <div style={{ display: 'flex', gap: 8 }}>
            <select
              className="form-select"
              value={recFilter}
              onChange={e => setRecFilter(e.target.value)}
              style={{ fontSize: 13 }}
            >
              <option value="all">All Severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
              <option value="info">Info</option>
            </select>
            <select
              className="form-select"
              value={recDomainFilter}
              onChange={e => setRecDomainFilter(e.target.value)}
              style={{ fontSize: 13 }}
            >
              <option value="all">All Domains</option>
              {result.domainScores.map(d => (
                <option key={d.domain} value={d.domain}>{DOMAIN_LABELS[d.domain]}</option>
              ))}
            </select>
          </div>
        </div>

        {filteredRecs.length === 0 ? (
          <p style={{ color: 'var(--color-text-secondary)', textAlign: 'center', padding: 20 }}>
            No recommendations match the selected filters.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {filteredRecs.map(rec => (
              <RecommendationRow key={rec.id} rec={rec} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const DomainScoreCard: React.FC<{ domainScore: DomainScore }> = ({ domainScore }) => {
  const gradeColor = GRADE_COLORS[domainScore.grade] || '#6b7280';
  const hasError = domainScore.details?.error;

  return (
    <div style={{
      padding: 16, borderRadius: 10, border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)',
      borderTop: `4px solid ${gradeColor}`,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h4 style={{ margin: 0, fontSize: 14, color: 'var(--color-text-secondary)' }}>
            {DOMAIN_LABELS[domainScore.domain] || domainScore.domain}
          </h4>
          <div style={{ fontSize: 28, fontWeight: 700, color: gradeColor, marginTop: 4 }}>
            {domainScore.grade}
          </div>
        </div>
        <div style={{
          width: 44, height: 44, borderRadius: '50%', background: `${gradeColor}15`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: gradeColor, fontWeight: 700, fontSize: 15,
        }}>
          {domainScore.score}
        </div>
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: 'var(--color-text-secondary)' }}>
        {hasError ? (
          <span style={{ color: '#d97706' }}>Limited data available</span>
        ) : (
          <>
            {domainScore.findings} finding{domainScore.findings !== 1 ? 's' : ''}
            {' | '}
            Weight: {(domainScore.weight * 100).toFixed(0)}%
          </>
        )}
      </div>
    </div>
  );
};

const RecommendationRow: React.FC<{ rec: AssessmentRecommendation }> = ({ rec }) => {
  const [expanded, setExpanded] = useState(false);
  const sevColor = SEVERITY_COLORS[rec.severity] || '#6b7280';

  return (
    <div
      style={{
        padding: '10px 14px', borderRadius: 8, border: '1px solid var(--color-border)', background: 'var(--color-bg-tertiary)',
        cursor: 'pointer',
      }}
      onClick={() => setExpanded(!expanded)}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{
          fontSize: 10, fontWeight: 700, textTransform: 'uppercase', color: sevColor,
          padding: '2px 6px', borderRadius: 4, background: `${sevColor}15`,
        }}>
          {rec.severity}
        </span>
        <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
          {DOMAIN_LABELS[rec.domain]}
        </span>
        <span style={{ flex: 1, fontSize: 13, fontWeight: 500, color: 'var(--color-text)' }}>
          {rec.title}
        </span>
        {rec.estimatedSavings && (
          <span style={{ fontSize: 12, color: 'var(--color-success)', fontWeight: 500 }}>
            {formatCurrency(rec.estimatedSavings)}/mo
          </span>
        )}
      </div>
      {expanded && (
        <div style={{ marginTop: 8, paddingLeft: 20, fontSize: 12, color: 'var(--color-text-secondary)' }}>
          <p style={{ margin: '4px 0' }}>{rec.description}</p>
          {rec.remediation && (
            <p style={{ margin: '4px 0', color: 'var(--color-primary)' }}>Remediation: {rec.remediation}</p>
          )}
          {rec.resourceId && (
            <p style={{ margin: '4px 0', color: 'var(--color-text-secondary)' }}>Resource: {rec.resourceId}</p>
          )}
        </div>
      )}
    </div>
  );
};

const CostSummary: React.FC<{ result: AssessmentResult }> = ({ result }) => {
  const cost = result.costData!;
  const changeColor = cost.percentChange > 0 ? '#dc2626' : '#16a34a';
  const changeDir = cost.percentChange >= 0 ? '+' : '';

  return (
    <div style={{ padding: 16, borderRadius: 10, border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)' }}>
      <h4 style={{ margin: 0, fontSize: 14, color: 'var(--color-text-secondary)', marginBottom: 8 }}>Cost Overview</h4>
      <div style={{ fontSize: 22, fontWeight: 700 }}>{formatCurrency(cost.totalCost)}</div>
      <div style={{ fontSize: 12, color: changeColor, marginTop: 2 }}>
        {changeDir}{cost.percentChange.toFixed(1)}% vs previous period
      </div>
      {result.costOptimizations && (
        <div style={{ fontSize: 12, color: 'var(--color-success)', marginTop: 4 }}>
          Potential savings: {formatCurrency(result.costOptimizations.totalPotentialSavings)}/mo
        </div>
      )}
      {cost.byService.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 4 }}>Top Services</div>
          {cost.byService.slice(0, 3).map(s => (
            <div key={s.service} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 2 }}>
              <span style={{ color: 'var(--color-text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>
                {s.service}
              </span>
              <span style={{ fontWeight: 500 }}>{formatCurrency(s.cost)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const SecuritySummary: React.FC<{ result: AssessmentResult }> = ({ result }) => {
  const sec = result.securityData!;
  const { summary } = sec;

  return (
    <div style={{ padding: 16, borderRadius: 10, border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)' }}>
      <h4 style={{ margin: 0, fontSize: 14, color: 'var(--color-text-secondary)', marginBottom: 8 }}>Security Overview</h4>
      <div style={{ fontSize: 22, fontWeight: 700 }}>{summary.totalFindings} Findings</div>
      <div style={{ display: 'flex', gap: 12, marginTop: 8, flexWrap: 'wrap' }}>
        {summary.criticalCount > 0 && (
          <span style={{ fontSize: 12, color: SEVERITY_COLORS.critical, fontWeight: 600 }}>
            {summary.criticalCount} Critical
          </span>
        )}
        {summary.highCount > 0 && (
          <span style={{ fontSize: 12, color: SEVERITY_COLORS.high, fontWeight: 600 }}>
            {summary.highCount} High
          </span>
        )}
        {summary.mediumCount > 0 && (
          <span style={{ fontSize: 12, color: SEVERITY_COLORS.medium, fontWeight: 600 }}>
            {summary.mediumCount} Medium
          </span>
        )}
        {summary.lowCount > 0 && (
          <span style={{ fontSize: 12, color: SEVERITY_COLORS.low, fontWeight: 600 }}>
            {summary.lowCount} Low
          </span>
        )}
      </div>
      {summary.complianceScores.length > 0 && (
        <div style={{ marginTop: 10 }}>
          <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 4 }}>Compliance</div>
          {summary.complianceScores.map(cs => (
            <div key={cs.standardArn} style={{ fontSize: 12, marginTop: 2 }}>
              {cs.standardName}: {cs.score.toFixed(0)}%
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const WASummary: React.FC<{ result: AssessmentResult }> = ({ result }) => {
  const wa = result.waData!;
  const passRate = wa.totalChecks > 0 ? ((wa.totalPass / wa.totalChecks) * 100).toFixed(0) : '0';

  return (
    <div style={{ padding: 16, borderRadius: 10, border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)' }}>
      <h4 style={{ margin: 0, fontSize: 14, color: 'var(--color-text-secondary)', marginBottom: 8 }}>Well-Architected</h4>
      <div style={{ fontSize: 22, fontWeight: 700 }}>{passRate}% Pass Rate</div>
      <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
        {wa.totalPass}/{wa.totalChecks} checks passed | {wa.totalFail} failures
      </div>
      <div style={{ marginTop: 10 }}>
        {wa.pillarSummaries.map(p => {
          const pRate = p.totalChecks > 0 ? (p.passCount / p.totalChecks) * 100 : 0;
          const barColor = p.failCount === 0 ? '#22c55e' : pRate < 50 ? '#ef4444' : '#eab308';
          return (
            <div key={p.pillarId} style={{ marginTop: 4 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11 }}>
                <span style={{ color: 'var(--color-text-secondary)' }}>{p.pillarName}</span>
                <span style={{ fontWeight: 500 }}>{pRate.toFixed(0)}%</span>
              </div>
              <div style={{ height: 4, borderRadius: 2, background: 'var(--color-bg-tertiary)', marginTop: 2 }}>
                <div style={{ height: 4, borderRadius: 2, background: barColor, width: `${pRate}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const InventorySummary: React.FC<{ result: AssessmentResult }> = ({ result }) => {
  const inv = result.resourceSummary!;
  const serviceEntries = Object.entries(inv.byService).sort(([, a], [, b]) => b - a);

  return (
    <div style={{ padding: 16, borderRadius: 10, border: '1px solid var(--color-border)', background: 'var(--color-bg-secondary)' }}>
      <h4 style={{ margin: 0, fontSize: 14, color: 'var(--color-text-secondary)', marginBottom: 8 }}>Resource Inventory</h4>
      <div style={{ fontSize: 22, fontWeight: 700 }}>{inv.totalResources} Resources</div>
      <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
        {serviceEntries.length} services | Tag coverage: {inv.tagCoverage.toFixed(0)}%
      </div>
      {serviceEntries.length > 0 && (
        <div style={{ marginTop: 10 }}>
          {serviceEntries.slice(0, 5).map(([service, count]) => (
            <div key={service} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginTop: 2 }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>{service}</span>
              <span style={{ fontWeight: 500 }}>{count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React, { useState, useMemo } from 'react';
import type { SecurityFinding, FindingSeverity, FindingSource } from '../../../shared/types';

interface FindingsTableProps {
  findings: SecurityFinding[];
  isLoading: boolean;
  onSelectFinding: (finding: SecurityFinding) => void;
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
  ACCESS_ANALYZER: 'Access Analyzer',
  CONFIG: 'Config',
};

const ITEMS_PER_PAGE = 10;

interface SeverityBadgeProps {
  severity: FindingSeverity;
}

const SeverityBadge: React.FC<SeverityBadgeProps> = ({ severity }) => (
  <span
    style={{
      display: 'inline-block',
      padding: '4px 8px',
      borderRadius: 4,
      fontSize: 11,
      fontWeight: 600,
      backgroundColor: `${SEVERITY_COLORS[severity]}20`,
      color: SEVERITY_COLORS[severity],
      textTransform: 'uppercase',
    }}
  >
    {severity}
  </span>
);

export const FindingsTable: React.FC<FindingsTableProps> = ({
  findings,
  isLoading,
  onSelectFinding,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<'severity' | 'title' | 'source'>('severity');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  const severityOrder: Record<FindingSeverity, number> = {
    CRITICAL: 0,
    HIGH: 1,
    MEDIUM: 2,
    LOW: 3,
    INFORMATIONAL: 4,
  };

  const sortedFindings = useMemo(() => {
    return [...findings].sort((a, b) => {
      let comparison = 0;

      if (sortField === 'severity') {
        comparison = severityOrder[a.severity] - severityOrder[b.severity];
      } else if (sortField === 'title') {
        comparison = a.title.localeCompare(b.title);
      } else if (sortField === 'source') {
        comparison = a.source.localeCompare(b.source);
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [findings, sortField, sortDirection]);

  const totalPages = Math.ceil(sortedFindings.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedFindings = sortedFindings.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const handleSort = (field: 'severity' | 'title' | 'source') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) {
      return (
        <span style={{ opacity: 0.3, marginLeft: 4 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M7 10l5 5 5-5H7z" />
          </svg>
        </span>
      );
    }
    return (
      <span style={{ marginLeft: 4 }}>
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="currentColor"
          style={{ transform: sortDirection === 'asc' ? 'rotate(0)' : 'rotate(180deg)' }}
        >
          <path d="M7 10l5 5 5-5H7z" />
        </svg>
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="card">
        <h3 className="card-title" style={{ marginBottom: 16 }}>Security Findings</h3>
        <div className="loading-overlay" style={{ height: 200 }}>
          <div className="spinner" />
          <p>Loading findings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 className="card-title" style={{ marginBottom: 16 }}>
        Security Findings ({findings.length})
      </h3>

      {findings.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: 40,
            color: 'var(--color-text-secondary)',
          }}
        >
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            style={{ opacity: 0.5, marginBottom: 16 }}
          >
            <path d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <p style={{ margin: 0 }}>No findings match your current filters.</p>
        </div>
      ) : (
        <>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th className="sortable" onClick={() => handleSort('severity')}>
                    Severity <SortIcon field="severity" />
                  </th>
                  <th className="sortable" onClick={() => handleSort('title')}>
                    Title <SortIcon field="title" />
                  </th>
                  <th className="sortable" onClick={() => handleSort('source')}>
                    Source <SortIcon field="source" />
                  </th>
                  <th>Resource</th>
                  <th>Region</th>
                </tr>
              </thead>
              <tbody>
                {paginatedFindings.map((finding) => (
                  <tr
                    key={finding.id}
                    onClick={() => onSelectFinding(finding)}
                    style={{ cursor: 'pointer' }}
                  >
                    <td>
                      <SeverityBadge severity={finding.severity} />
                    </td>
                    <td
                      className="truncate"
                      style={{ maxWidth: 300 }}
                      title={finding.title}
                    >
                      {finding.title}
                    </td>
                    <td>{SOURCE_LABELS[finding.source]}</td>
                    <td
                      className="truncate"
                      style={{ maxWidth: 200 }}
                      title={finding.resourceId || '-'}
                    >
                      {finding.resourceType && (
                        <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                          {finding.resourceType}
                        </span>
                      )}
                      {finding.resourceId ? (
                        <div style={{ fontSize: 12 }}>
                          {finding.resourceId.split('/').pop() || finding.resourceId}
                        </div>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td>{finding.region}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="pagination">
              <span className="pagination-info">
                Showing {startIndex + 1}-{Math.min(startIndex + ITEMS_PER_PAGE, sortedFindings.length)} of{' '}
                {sortedFindings.length}
              </span>
              <div className="pagination-controls">
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  Previous
                </button>
                <span className="pagination-pages">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default FindingsTable;

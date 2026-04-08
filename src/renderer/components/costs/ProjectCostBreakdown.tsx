// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React, { useState, useMemo } from 'react';
import type { ProjectCost } from '../../../shared/types';

interface ProjectCostBreakdownProps {
  byProject: ProjectCost[];
  isLoading: boolean;
}

type SortField = 'projectName' | 'cost';
type SortDirection = 'asc' | 'desc';

function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

export const ProjectCostBreakdown: React.FC<ProjectCostBreakdownProps> = ({
  byProject,
  isLoading,
}) => {
  const [sortField, setSortField] = useState<SortField>('cost');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const totalCost = useMemo(
    () => byProject.reduce((sum, p) => sum + p.cost, 0),
    [byProject]
  );

  const sortedProjects = useMemo(() => {
    return [...byProject].sort((a, b) => {
      let aVal: number | string;
      let bVal: number | string;

      switch (sortField) {
        case 'projectName':
          aVal = (a.projectName || a.projectId).toLowerCase();
          bVal = (b.projectName || b.projectId).toLowerCase();
          break;
        case 'cost':
          aVal = a.cost;
          bVal = b.cost;
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [byProject, sortField, sortDirection]);

  const maxCost = useMemo(
    () => Math.max(...byProject.map((p) => p.cost), 0),
    [byProject]
  );

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const SortIndicator: React.FC<{ field: SortField }> = ({ field }) => {
    if (sortField !== field) return null;
    return <span style={{ marginLeft: 4 }}>{sortDirection === 'asc' ? '\u25B2' : '\u25BC'}</span>;
  };

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
        <h3 style={{ margin: '0 0 16px 0', fontSize: 16 }}>Cost by Project</h3>
        <div
          style={{
            height: 200,
            backgroundColor: 'var(--color-bg-tertiary)',
            borderRadius: 4,
            animation: 'pulse 1.5s ease-in-out infinite',
          }}
        />
      </div>
    );
  }

  if (byProject.length === 0) return null;

  const displayedProjects = sortedProjects.slice(0, 20);
  const remainingCount = sortedProjects.length - 20;

  return (
    <div
      style={{
        backgroundColor: 'var(--color-bg-secondary)',
        border: '1px solid var(--color-border)',
        borderRadius: 8,
        padding: 20,
        marginBottom: 24,
        maxHeight: 500,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <h3 style={{ margin: '0 0 16px 0', fontSize: 16 }}>Cost by Project</h3>
      <div style={{ overflowY: 'auto', flex: 1 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
              <th
                onClick={() => handleSort('projectName')}
                style={{
                  textAlign: 'left',
                  padding: '8px 0',
                  color: 'var(--color-text-secondary)',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                Project
                <SortIndicator field="projectName" />
              </th>
              <th
                onClick={() => handleSort('cost')}
                style={{
                  textAlign: 'right',
                  padding: '8px 0',
                  color: 'var(--color-text-secondary)',
                  cursor: 'pointer',
                  userSelect: 'none',
                  width: 120,
                }}
              >
                Cost
                <SortIndicator field="cost" />
              </th>
              <th
                style={{
                  textAlign: 'right',
                  padding: '8px 0',
                  color: 'var(--color-text-secondary)',
                  width: 70,
                }}
              >
                % of Total
              </th>
              <th style={{ width: 180, padding: '8px 0' }} />
            </tr>
          </thead>
          <tbody>
            {displayedProjects.map((project, index) => {
              const pct = totalCost > 0 ? (project.cost / totalCost) * 100 : 0;
              const barWidth = maxCost > 0 ? (project.cost / maxCost) * 100 : 0;

              return (
                <tr key={index} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '10px 0', maxWidth: 250 }}>
                    <div
                      style={{
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                      title={`${project.projectName} (${project.projectId})`}
                    >
                      {project.projectName}
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: 'var(--color-text-secondary)',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {project.projectId}
                    </div>
                  </td>
                  <td style={{ textAlign: 'right', padding: '10px 0', fontFamily: 'monospace' }}>
                    {formatCurrency(project.cost, project.currency)}
                  </td>
                  <td
                    style={{
                      textAlign: 'right',
                      padding: '10px 0',
                      fontFamily: 'monospace',
                      color: 'var(--color-text-secondary)',
                    }}
                  >
                    {pct.toFixed(1)}%
                  </td>
                  <td style={{ padding: '10px 8px' }}>
                    <div
                      style={{
                        height: 8,
                        backgroundColor: 'var(--color-bg-tertiary)',
                        borderRadius: 4,
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          height: '100%',
                          width: `${barWidth}%`,
                          backgroundColor: 'var(--color-primary, #3b82f6)',
                          borderRadius: 4,
                          transition: 'width 0.3s ease',
                        }}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {remainingCount > 0 && (
          <p style={{ margin: '12px 0 0', fontSize: 12, color: 'var(--color-text-secondary)' }}>
            + {remainingCount} more projects
          </p>
        )}
      </div>
    </div>
  );
};

export default ProjectCostBreakdown;

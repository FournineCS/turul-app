// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React from 'react';
import type { SecurityFilters as SecurityFiltersType, FindingSeverity, FindingSource } from '../../../shared/types';

interface SecurityFiltersProps {
  filters: SecurityFiltersType;
  onFiltersChange: (filters: Partial<SecurityFiltersType>) => void;
}

const SEVERITIES: FindingSeverity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW', 'INFORMATIONAL'];
const SOURCES: { value: FindingSource; label: string }[] = [
  { value: 'SECURITY_HUB', label: 'Security Hub' },
  { value: 'GUARDDUTY', label: 'GuardDuty' },
  { value: 'INSPECTOR', label: 'Inspector' },
  { value: 'ACCESS_ANALYZER', label: 'Access Analyzer' },
  { value: 'CONFIG', label: 'AWS Config' },
];

export const SecurityFilters: React.FC<SecurityFiltersProps> = ({ filters, onFiltersChange }) => {
  const handleSeverityChange = (severity: FindingSeverity) => {
    const newSeverities = filters.severities.includes(severity)
      ? filters.severities.filter((s) => s !== severity)
      : [...filters.severities, severity];
    onFiltersChange({ severities: newSeverities });
  };

  const handleSourceChange = (source: FindingSource) => {
    const newSources = filters.sources.includes(source)
      ? filters.sources.filter((s) => s !== source)
      : [...filters.sources, source];
    onFiltersChange({ sources: newSources });
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({ searchQuery: e.target.value });
  };

  const handleArchivedChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onFiltersChange({ includeArchived: e.target.checked });
  };

  const clearFilters = () => {
    onFiltersChange({
      severities: [],
      sources: [],
      searchQuery: '',
      includeArchived: false,
    });
  };

  const hasActiveFilters =
    filters.severities.length > 0 ||
    filters.sources.length > 0 ||
    filters.searchQuery !== '' ||
    filters.includeArchived;

  return (
    <div className="card" style={{ padding: 16, marginBottom: 24 }}>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 16,
          alignItems: 'flex-start',
        }}
      >
        {/* Search */}
        <div style={{ flex: '1 1 200px' }}>
          <label
            style={{
              display: 'block',
              fontSize: 11,
              color: 'var(--color-text-secondary)',
              textTransform: 'uppercase',
              fontWeight: 500,
              letterSpacing: '0.5px',
              marginBottom: 6,
            }}
          >
            Search
          </label>
          <input
            type="text"
            value={filters.searchQuery}
            onChange={handleSearchChange}
            placeholder="Search by title, description, resource..."
            style={{
              width: '100%',
              padding: '8px 12px',
              borderRadius: 6,
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-bg)',
              color: 'var(--color-text)',
              fontSize: 13,
            }}
          />
        </div>

        {/* Severity Filter */}
        <div style={{ flex: '1 1 300px' }}>
          <label
            style={{
              display: 'block',
              fontSize: 11,
              color: 'var(--color-text-secondary)',
              textTransform: 'uppercase',
              fontWeight: 500,
              letterSpacing: '0.5px',
              marginBottom: 6,
            }}
          >
            Severity
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {SEVERITIES.map((severity) => {
              const isSelected = filters.severities.includes(severity);
              return (
                <button
                  key={severity}
                  onClick={() => handleSeverityChange(severity)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 4,
                    border: '1px solid var(--color-border)',
                    backgroundColor: isSelected ? 'var(--color-primary)' : 'var(--color-bg-tertiary)',
                    color: isSelected ? '#fff' : 'var(--color-text-secondary)',
                    cursor: 'pointer',
                    fontSize: 11,
                    fontWeight: 500,
                    textTransform: 'uppercase',
                    transition: 'all 0.2s',
                  }}
                >
                  {severity}
                </button>
              );
            })}
          </div>
        </div>

        {/* Source Filter */}
        <div style={{ flex: '1 1 300px' }}>
          <label
            style={{
              display: 'block',
              fontSize: 11,
              color: 'var(--color-text-secondary)',
              textTransform: 'uppercase',
              fontWeight: 500,
              letterSpacing: '0.5px',
              marginBottom: 6,
            }}
          >
            Source
          </label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {SOURCES.map(({ value, label }) => {
              const isSelected = filters.sources.includes(value);
              return (
                <button
                  key={value}
                  onClick={() => handleSourceChange(value)}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 4,
                    border: '1px solid var(--color-border)',
                    backgroundColor: isSelected ? 'var(--color-primary)' : 'var(--color-bg-tertiary)',
                    color: isSelected ? '#fff' : 'var(--color-text-secondary)',
                    cursor: 'pointer',
                    fontSize: 11,
                    fontWeight: 500,
                    transition: 'all 0.2s',
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Additional options and Clear */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 16,
          paddingTop: 16,
          borderTop: '1px solid var(--color-border)',
        }}
      >
        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            cursor: 'pointer',
            fontSize: 13,
            color: 'var(--color-text-secondary)',
          }}
        >
          <input
            type="checkbox"
            checked={filters.includeArchived}
            onChange={handleArchivedChange}
            style={{ cursor: 'pointer' }}
          />
          Include archived findings
        </label>

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-primary)',
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M6 18L18 6M6 6l12 12" />
            </svg>
            Clear Filters
          </button>
        )}
      </div>
    </div>
  );
};

export default SecurityFilters;

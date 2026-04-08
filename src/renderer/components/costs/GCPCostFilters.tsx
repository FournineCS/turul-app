// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React, { useState, useRef, useEffect, useCallback } from 'react';
import type { GCPCostFilters } from '../../../shared/types';
import type { GCPFilterOptions, CostScope } from '../../stores/costStore';

interface GCPCostFiltersProps {
  filters: GCPCostFilters;
  options: GCPFilterOptions;
  costScope: CostScope;
  onFiltersChange: (filters: GCPCostFilters) => void;
  onApply: () => void;
  onClear: () => void;
  isLoading: boolean;
}

/** Multi-select dropdown with checkboxes */
const MultiSelectDropdown: React.FC<{
  label: string;
  options: { value: string; display: string }[];
  selected: string[];
  onChange: (selected: string[]) => void;
  disabled?: boolean;
}> = ({ label, options, selected, onChange, disabled }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const toggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const count = selected.length;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '5px 10px',
          fontSize: 12,
          border: '1px solid var(--color-border)',
          borderRadius: 6,
          background: count > 0 ? 'rgba(59, 130, 246, 0.1)' : 'var(--color-bg-secondary)',
          color: count > 0 ? 'var(--color-primary, #3b82f6)' : 'var(--color-text-secondary)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          whiteSpace: 'nowrap',
          opacity: disabled ? 0.5 : 1,
        }}
      >
        {label}
        {count > 0 && (
          <span
            style={{
              background: 'var(--color-primary, #3b82f6)',
              color: '#fff',
              borderRadius: 10,
              padding: '0 6px',
              fontSize: 10,
              fontWeight: 600,
              lineHeight: '16px',
            }}
          >
            {count}
          </span>
        )}
        <span style={{ fontSize: 10 }}>{open ? '\u25B2' : '\u25BC'}</span>
      </button>
      {open && options.length > 0 && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            zIndex: 100,
            marginTop: 4,
            background: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            maxHeight: 280,
            overflowY: 'auto',
            minWidth: 220,
          }}
        >
          {options.map((opt) => (
            <label
              key={opt.value}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 12px',
                cursor: 'pointer',
                fontSize: 12,
                color: 'var(--color-text)',
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = 'var(--color-bg-secondary)')
              }
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <input
                type="checkbox"
                checked={selected.includes(opt.value)}
                onChange={() => toggle(opt.value)}
                style={{ margin: 0 }}
              />
              <span
                style={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {opt.display}
              </span>
            </label>
          ))}
        </div>
      )}
      {open && options.length === 0 && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            zIndex: 100,
            marginTop: 4,
            background: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            padding: '12px 16px',
            fontSize: 12,
            color: 'var(--color-text-secondary)',
            minWidth: 180,
          }}
        >
          No options available. Load data first.
        </div>
      )}
    </div>
  );
};

/** Two-level label filter: select label keys, then values for each key */
const LabelFilterDropdown: React.FC<{
  options: { key: string; values: string[] }[];
  selected: { key: string; values: string[] }[];
  onChange: (labels: { key: string; values: string[] }[]) => void;
  disabled?: boolean;
}> = ({ options, selected, onChange, disabled }) => {
  const [open, setOpen] = useState(false);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setExpandedKey(null);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const getSelectedValues = (key: string): string[] => {
    const entry = selected.find((s) => s.key === key);
    return entry?.values || [];
  };

  const toggleValue = (key: string, value: string) => {
    const existing = selected.find((s) => s.key === key);
    let newSelected: { key: string; values: string[] }[];

    if (existing) {
      const hasValue = existing.values.includes(value);
      const newValues = hasValue
        ? existing.values.filter((v) => v !== value)
        : [...existing.values, value];
      if (newValues.length === 0) {
        newSelected = selected.filter((s) => s.key !== key);
      } else {
        newSelected = selected.map((s) => (s.key === key ? { ...s, values: newValues } : s));
      }
    } else {
      newSelected = [...selected, { key, values: [value] }];
    }
    onChange(newSelected);
  };

  const count = selected.reduce((sum, s) => sum + s.values.length, 0);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => !disabled && setOpen(!open)}
        disabled={disabled}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '5px 10px',
          fontSize: 12,
          border: '1px solid var(--color-border)',
          borderRadius: 6,
          background: count > 0 ? 'rgba(59, 130, 246, 0.1)' : 'var(--color-bg-secondary)',
          color: count > 0 ? 'var(--color-primary, #3b82f6)' : 'var(--color-text-secondary)',
          cursor: disabled ? 'not-allowed' : 'pointer',
          whiteSpace: 'nowrap',
          opacity: disabled ? 0.5 : 1,
        }}
      >
        Labels
        {count > 0 && (
          <span
            style={{
              background: 'var(--color-primary, #3b82f6)',
              color: '#fff',
              borderRadius: 10,
              padding: '0 6px',
              fontSize: 10,
              fontWeight: 600,
              lineHeight: '16px',
            }}
          >
            {count}
          </span>
        )}
        <span style={{ fontSize: 10 }}>{open ? '\u25B2' : '\u25BC'}</span>
      </button>
      {open && (
        <div
          style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            zIndex: 100,
            marginTop: 4,
            background: 'var(--color-bg)',
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            maxHeight: 320,
            overflowY: 'auto',
            minWidth: 240,
          }}
        >
          {options.length === 0 ? (
            <div style={{ padding: '12px 16px', fontSize: 12, color: 'var(--color-text-secondary)' }}>
              No labels available. Load data first.
            </div>
          ) : (
            options.map((opt) => {
              const isExpanded = expandedKey === opt.key;
              const selectedVals = getSelectedValues(opt.key);
              return (
                <div key={opt.key}>
                  <div
                    onClick={() => setExpandedKey(isExpanded ? null : opt.key)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 12px',
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 600,
                      color: 'var(--color-text)',
                      borderBottom: isExpanded ? '1px solid var(--color-border)' : 'none',
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = 'var(--color-bg-secondary)')
                    }
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span>{opt.key}</span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      {selectedVals.length > 0 && (
                        <span style={{
                          background: 'var(--color-primary, #3b82f6)',
                          color: '#fff',
                          borderRadius: 10,
                          padding: '0 5px',
                          fontSize: 9,
                          lineHeight: '14px',
                        }}>
                          {selectedVals.length}
                        </span>
                      )}
                      <span style={{ fontSize: 10 }}>{isExpanded ? '\u25B2' : '\u25BC'}</span>
                    </span>
                  </div>
                  {isExpanded && opt.values.map((val) => (
                    <label
                      key={val}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '4px 12px 4px 24px',
                        cursor: 'pointer',
                        fontSize: 12,
                        color: 'var(--color-text)',
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background = 'var(--color-bg-secondary)')
                      }
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <input
                        type="checkbox"
                        checked={selectedVals.includes(val)}
                        onChange={() => toggleValue(opt.key, val)}
                        style={{ margin: 0 }}
                      />
                      <span style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {val}
                      </span>
                    </label>
                  ))}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

const GCPCostFiltersBar: React.FC<GCPCostFiltersProps> = ({
  filters,
  options,
  costScope,
  onFiltersChange,
  onApply,
  onClear,
  isLoading,
}) => {
  // Build dropdown options
  const serviceOptions = options.services.map((s) => ({ value: s, display: s }));

  // Group SKUs by service for readability
  const skuOptions = options.skus.map((s) => ({
    value: s.sku,
    display: `${s.service} — ${s.sku}`,
  }));

  const regionOptions = options.regions.map((r) => ({ value: r, display: r }));

  const projectOptions = options.projectIds.map((p) => ({
    value: p.id,
    display: p.name !== p.id ? `${p.name} (${p.id})` : p.id,
  }));

  const updateFilter = useCallback(
    (key: keyof GCPCostFilters, values: string[]) => {
      const next = { ...filters, [key]: values.length > 0 ? values : undefined };
      onFiltersChange(next);
    },
    [filters, onFiltersChange]
  );

  const activeChips: { key: keyof GCPCostFilters; label: string; value: string }[] = [];
  if (filters.services) {
    for (const v of filters.services) {
      activeChips.push({ key: 'services', label: 'Service', value: v });
    }
  }
  if (filters.skus) {
    for (const v of filters.skus) {
      activeChips.push({ key: 'skus', label: 'SKU', value: v });
    }
  }
  if (filters.regions) {
    for (const v of filters.regions) {
      activeChips.push({ key: 'regions', label: 'Region', value: v });
    }
  }
  if (filters.projectIds) {
    for (const v of filters.projectIds) {
      const proj = options.projectIds.find((p) => p.id === v);
      activeChips.push({ key: 'projectIds', label: 'Project', value: proj?.name || v });
    }
  }
  if (filters.labels) {
    for (const l of filters.labels) {
      for (const v of l.values) {
        activeChips.push({ key: 'labels', label: 'Label', value: `${l.key}=${v}` });
      }
    }
  }
  if (filters.resourceName && filters.resourceName.trim()) {
    activeChips.push({ key: 'resourceName', label: 'Resource', value: filters.resourceName.trim() });
  }

  const removeChip = (key: keyof GCPCostFilters, value: string) => {
    if (key === 'labels') {
      // value is "key=val"
      const [labelKey, ...rest] = value.split('=');
      const labelVal = rest.join('=');
      const newLabels = (filters.labels || [])
        .map((l) => {
          if (l.key !== labelKey) return l;
          const newValues = l.values.filter((v) => v !== labelVal);
          return newValues.length > 0 ? { ...l, values: newValues } : null;
        })
        .filter(Boolean) as { key: string; values: string[] }[];
      onFiltersChange({ ...filters, labels: newLabels.length > 0 ? newLabels : undefined });
      return;
    }
    if (key === 'resourceName') {
      onFiltersChange({ ...filters, resourceName: undefined });
      return;
    }
    const current = (filters[key] as string[] | undefined) || [];
    let next: string[];
    if (key === 'projectIds') {
      const proj = options.projectIds.find((p) => p.name === value || p.id === value);
      const idToRemove = proj?.id || value;
      next = current.filter((v) => v !== idToRemove);
    } else {
      next = current.filter((v) => v !== value);
    }
    updateFilter(key, next);
  };

  const hasFilters = activeChips.length > 0;

  return (
    <div
      style={{
        backgroundColor: 'var(--color-bg-secondary)',
        border: '1px solid var(--color-border)',
        borderRadius: 8,
        padding: '12px 16px',
        marginBottom: 24,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', fontWeight: 600 }}>
          Filters:
        </span>

        <MultiSelectDropdown
          label="Service"
          options={serviceOptions}
          selected={filters.services || []}
          onChange={(v) => updateFilter('services', v)}
        />

        <MultiSelectDropdown
          label="SKU/Resource"
          options={skuOptions}
          selected={filters.skus || []}
          onChange={(v) => updateFilter('skus', v)}
        />

        <MultiSelectDropdown
          label="Region"
          options={regionOptions}
          selected={filters.regions || []}
          onChange={(v) => updateFilter('regions', v)}
        />

        {costScope === 'organization' && (
          <MultiSelectDropdown
            label="Project"
            options={projectOptions}
            selected={filters.projectIds || []}
            onChange={(v) => updateFilter('projectIds', v)}
          />
        )}

        <LabelFilterDropdown
          options={options.labels}
          selected={filters.labels || []}
          onChange={(labels) => onFiltersChange({ ...filters, labels: labels.length > 0 ? labels : undefined })}
        />

        <input
          type="text"
          placeholder="Resource name..."
          value={filters.resourceName || ''}
          onChange={(e) => onFiltersChange({ ...filters, resourceName: e.target.value || undefined })}
          style={{
            padding: '5px 10px',
            fontSize: 12,
            border: '1px solid var(--color-border)',
            borderRadius: 6,
            background: filters.resourceName ? 'rgba(59, 130, 246, 0.1)' : 'var(--color-bg-secondary)',
            color: 'var(--color-text)',
            width: 160,
          }}
        />

        <button
          className="btn btn-primary"
          onClick={onApply}
          disabled={isLoading}
          style={{ padding: '5px 14px', fontSize: 12 }}
        >
          {isLoading ? 'Loading...' : 'Apply Filters'}
        </button>

        {hasFilters && (
          <button
            onClick={() => {
              onClear();
              onApply();
            }}
            style={{
              padding: '5px 10px',
              fontSize: 12,
              border: '1px solid var(--color-border)',
              borderRadius: 6,
              background: 'transparent',
              color: 'var(--color-text-secondary)',
              cursor: 'pointer',
            }}
          >
            Clear All
          </button>
        )}
      </div>

      {/* Active filter chips */}
      {activeChips.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
          {activeChips.map((chip, idx) => (
            <span
              key={`${chip.key}-${chip.value}-${idx}`}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 8px',
                fontSize: 11,
                borderRadius: 12,
                background: 'rgba(59, 130, 246, 0.12)',
                color: 'var(--color-primary, #3b82f6)',
                border: '1px solid rgba(59, 130, 246, 0.25)',
              }}
            >
              <span style={{ color: 'var(--color-text-secondary)', fontSize: 10 }}>
                {chip.label}:
              </span>
              <span style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {chip.value}
              </span>
              <button
                onClick={() => removeChip(chip.key, chip.value)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--color-primary, #3b82f6)',
                  cursor: 'pointer',
                  padding: '0 2px',
                  fontSize: 14,
                  lineHeight: 1,
                }}
              >
                x
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default GCPCostFiltersBar;

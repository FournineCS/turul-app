// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React, { useState } from 'react';
import type { CostDateRange } from '../../../shared/types';

interface DateRangeSelectorProps {
  value: CostDateRange;
  onChange: (range: CostDateRange) => void;
  onCustomDateChange?: (startDate: string, endDate: string) => void;
  customStartDate?: string | null;
  customEndDate?: string | null;
}

const DATE_RANGE_OPTIONS: { value: CostDateRange; label: string }[] = [
  { value: '7d', label: 'Last 7 Days' },
  { value: '30d', label: 'Last 30 Days' },
  { value: '90d', label: 'Last 90 Days' },
  { value: '12m', label: 'Last 12 Months' },
  { value: 'custom', label: 'Custom Range' },
];

export const DateRangeSelector: React.FC<DateRangeSelectorProps> = ({
  value,
  onChange,
  onCustomDateChange,
  customStartDate,
  customEndDate,
}) => {
  const [showCustomPicker, setShowCustomPicker] = useState(value === 'custom');
  const [localStartDate, setLocalStartDate] = useState(customStartDate || '');
  const [localEndDate, setLocalEndDate] = useState(customEndDate || '');

  const handleRangeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newValue = e.target.value as CostDateRange;
    onChange(newValue);
    setShowCustomPicker(newValue === 'custom');
  };

  const handleApplyCustom = () => {
    if (localStartDate && localEndDate && onCustomDateChange) {
      onCustomDateChange(localStartDate, localEndDate);
    }
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <label
        style={{
          fontSize: 13,
          color: 'var(--color-text-secondary)',
          fontWeight: 500,
        }}
      >
        Period:
      </label>
      <select
        value={value}
        onChange={handleRangeChange}
        style={{
          padding: '8px 12px',
          borderRadius: 6,
          border: '1px solid var(--color-border)',
          backgroundColor: 'var(--color-bg-secondary)',
          color: 'var(--color-text)',
          fontSize: 13,
          cursor: 'pointer',
          minWidth: 150,
        }}
      >
        {DATE_RANGE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {showCustomPicker && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="date"
            value={localStartDate}
            onChange={(e) => setLocalStartDate(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: 6,
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-bg-secondary)',
              color: 'var(--color-text)',
              fontSize: 13,
            }}
          />
          <span style={{ color: 'var(--color-text-secondary)' }}>to</span>
          <input
            type="date"
            value={localEndDate}
            onChange={(e) => setLocalEndDate(e.target.value)}
            style={{
              padding: '8px 12px',
              borderRadius: 6,
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-bg-secondary)',
              color: 'var(--color-text)',
              fontSize: 13,
            }}
          />
          <button
            onClick={handleApplyCustom}
            disabled={!localStartDate || !localEndDate}
            className="btn btn-sm btn-primary"
            style={{ padding: '8px 16px' }}
          >
            Apply
          </button>
        </div>
      )}
    </div>
  );
};

export default DateRangeSelector;

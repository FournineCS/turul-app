// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React from 'react';
import { exportToCSV } from '../utils/csv-export';

interface ExportCSVButtonProps {
  data: Record<string, unknown>[];
  columns: { key: string; label: string }[];
  filename: string;
  label?: string;
}

const ExportCSVButton: React.FC<ExportCSVButtonProps> = ({
  data,
  columns,
  filename,
  label = 'Export CSV',
}) => {
  if (data.length === 0) return null;

  return (
    <button
      className="btn btn-sm btn-secondary"
      onClick={() => exportToCSV(data, columns, filename)}
      title={`Download ${filename}.csv`}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
    >
      <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 14, height: 14 }}>
        <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
      </svg>
      {label}
    </button>
  );
};

export default ExportCSVButton;

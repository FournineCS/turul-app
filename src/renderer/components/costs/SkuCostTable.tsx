// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React, { useState, useMemo } from 'react';
import type { SkuCost } from '../../../shared/types';

interface SkuCostTableProps {
  data: SkuCost[];
  isLoading: boolean;
}

type SortKey = 'service' | 'sku' | 'cost';
type SortDir = 'asc' | 'desc';

const SkuCostTable: React.FC<SkuCostTableProps> = ({ data, isLoading }) => {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('cost');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let items = data;
    if (q) {
      items = items.filter(
        (s) => s.service.toLowerCase().includes(q) || s.sku.toLowerCase().includes(q)
      );
    }
    items = [...items].sort((a, b) => {
      const av = sortKey === 'cost' ? a.cost : a[sortKey].toLowerCase();
      const bv = sortKey === 'cost' ? b.cost : b[sortKey].toLowerCase();
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return items;
  }, [data, search, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir(key === 'cost' ? 'desc' : 'asc');
    }
  };

  const arrow = (key: SortKey) => {
    if (sortKey !== key) return '';
    return sortDir === 'asc' ? ' \u25B2' : ' \u25BC';
  };

  if (isLoading) {
    return (
      <div className="card" style={{ padding: 24 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 14, color: 'var(--color-text)' }}>
          SKU Cost Breakdown
        </h3>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>Loading...</p>
      </div>
    );
  }

  if (!data || data.length === 0) return null;

  return (
    <div className="card" style={{ padding: 24, marginTop: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
          <h3 style={{ margin: 0, fontSize: 14, color: 'var(--color-text)' }}>
            SKU Cost Breakdown ({filtered.length} of {data.length})
          </h3>
          <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
            Total:{' '}
            <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>
              ${filtered.reduce((sum, r) => sum + r.cost, 0).toFixed(2)}{' '}
              {filtered[0]?.currency ?? ''}
            </span>
          </span>
        </div>
        <input
          type="text"
          placeholder="Search SKUs..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: '5px 10px',
            fontSize: 12,
            border: '1px solid var(--color-border)',
            borderRadius: 6,
            background: 'var(--color-bg)',
            color: 'var(--color-text)',
            width: 200,
          }}
        />
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              {([['service', 'Service'], ['sku', 'SKU Description'], ['cost', 'Cost']] as [SortKey, string][]).map(
                ([key, label]) => (
                  <th
                    key={key}
                    onClick={() => handleSort(key)}
                    style={{
                      textAlign: key === 'cost' ? 'right' : 'left',
                      padding: '8px 12px',
                      borderBottom: '2px solid var(--color-border)',
                      color: 'var(--color-text-secondary)',
                      fontWeight: 600,
                      cursor: 'pointer',
                      userSelect: 'none',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {label}{arrow(key)}
                  </th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, i) => (
              <tr
                key={`${row.service}-${row.sku}-${i}`}
                style={{
                  borderBottom: '1px solid var(--color-border)',
                }}
              >
                <td style={{ padding: '6px 12px', color: 'var(--color-text)', whiteSpace: 'nowrap' }}>
                  {row.service}
                </td>
                <td
                  style={{
                    padding: '6px 12px',
                    color: 'var(--color-text-secondary)',
                    maxWidth: 400,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={row.sku}
                >
                  {row.sku}
                </td>
                <td
                  style={{
                    padding: '6px 12px',
                    textAlign: 'right',
                    fontWeight: 500,
                    color: 'var(--color-text)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  ${row.cost.toFixed(2)} {row.currency}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default SkuCostTable;

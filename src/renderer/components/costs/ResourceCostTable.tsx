// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React, { useState, useMemo } from 'react';
import type { ResourceCost } from '../../../shared/types';

interface ResourceCostTableProps {
  data: ResourceCost[];
  isLoading: boolean;
  showProject?: boolean;
}

type SortKey = 'shortName' | 'service' | 'region' | 'cost';
type SortDir = 'asc' | 'desc';

const ResourceCostTable: React.FC<ResourceCostTableProps> = ({ data, isLoading, showProject }) => {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('cost');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    let items = data;
    if (q) {
      items = items.filter(
        (r) =>
          r.shortName.toLowerCase().includes(q) ||
          r.resourceName.toLowerCase().includes(q) ||
          r.service.toLowerCase().includes(q) ||
          (r.skuBreakdown || []).some((s) => s.sku.toLowerCase().includes(q)) ||
          Object.entries(r.labels).some(
            ([k, v]) => k.toLowerCase().includes(q) || v.toLowerCase().includes(q)
          )
      );
    }
    items = [...items].sort((a, b) => {
      if (sortKey === 'cost') {
        return sortDir === 'asc' ? a.cost - b.cost : b.cost - a.cost;
      }
      const av = String(a[sortKey] ?? '').toLowerCase();
      const bv = String(b[sortKey] ?? '').toLowerCase();
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

  const toggleRow = (key: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const arrow = (key: SortKey) => {
    if (sortKey !== key) return '';
    return sortDir === 'asc' ? ' \u25B2' : ' \u25BC';
  };

  if (isLoading) {
    return (
      <div className="card" style={{ padding: 24, marginTop: 24 }}>
        <h3 style={{ margin: '0 0 16px', fontSize: 14, color: 'var(--color-text)' }}>
          Resource Cost Breakdown
        </h3>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: 13 }}>Loading...</p>
      </div>
    );
  }

  if (!data || data.length === 0) return null;

  const columns: [SortKey, string][] = [
    ['shortName', 'Resource'],
    ['service', 'Service'],
    ['region', 'Region'],
    ['cost', 'Total Cost'],
  ];

  return (
    <div className="card" style={{ padding: 24, marginTop: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
          <h3 style={{ margin: 0, fontSize: 14, color: 'var(--color-text)' }}>
            Resource Cost Breakdown ({filtered.length} of {data.length})
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
          placeholder="Search resources..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            padding: '5px 10px',
            fontSize: 12,
            border: '1px solid var(--color-border)',
            borderRadius: 6,
            background: 'var(--color-bg)',
            color: 'var(--color-text)',
            width: 220,
          }}
        />
      </div>

      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
          <thead>
            <tr>
              {/* expand toggle column */}
              <th style={{ width: 28, padding: '8px 4px 8px 12px', borderBottom: '2px solid var(--color-border)' }} />
              {columns.map(([key, label]) => (
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
              ))}
              {showProject && (
                <th style={{
                  textAlign: 'left',
                  padding: '8px 12px',
                  borderBottom: '2px solid var(--color-border)',
                  color: 'var(--color-text-secondary)',
                  fontWeight: 600,
                  whiteSpace: 'nowrap',
                }}>
                  Project
                </th>
              )}
              <th style={{
                textAlign: 'left',
                padding: '8px 12px',
                borderBottom: '2px solid var(--color-border)',
                color: 'var(--color-text-secondary)',
                fontWeight: 600,
              }}>
                Labels
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, i) => {
              const rowKey = `${row.resourceName}::${row.service}::${row.region}::${i}`;
              const isExpanded = expandedRows.has(rowKey);
              const hasBreakdown = row.skuBreakdown && row.skuBreakdown.length > 0;
              const labelEntries = Object.entries(row.labels);

              return (
                <React.Fragment key={rowKey}>
                  <tr style={{ borderBottom: isExpanded ? 'none' : '1px solid var(--color-border)' }}>
                    {/* expand button */}
                    <td style={{ padding: '6px 4px 6px 12px', width: 28 }}>
                      {hasBreakdown ? (
                        <button
                          onClick={() => toggleRow(rowKey)}
                          title={isExpanded ? 'Collapse SKU breakdown' : 'Expand SKU breakdown'}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--color-text-secondary)',
                            fontSize: 10,
                            padding: 0,
                            lineHeight: 1,
                          }}
                        >
                          {isExpanded ? '▼' : '▶'}
                        </button>
                      ) : null}
                    </td>
                    <td
                      style={{
                        padding: '6px 12px',
                        color: 'var(--color-text)',
                        maxWidth: 220,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={row.resourceName}
                    >
                      <span>{row.shortName}</span>
                      {hasBreakdown && (
                        <span style={{
                          marginLeft: 6,
                          fontSize: 10,
                          padding: '1px 5px',
                          borderRadius: 8,
                          background: 'rgba(107,114,128,0.15)',
                          color: 'var(--color-text-secondary)',
                        }}>
                          {row.skuBreakdown!.length} SKUs
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '6px 12px', color: 'var(--color-text)', whiteSpace: 'nowrap' }}>
                      {row.service}
                    </td>
                    <td style={{ padding: '6px 12px', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                      {row.region}
                    </td>
                    <td
                      style={{
                        padding: '6px 12px',
                        textAlign: 'right',
                        fontWeight: 600,
                        color: 'var(--color-text)',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      ${row.cost.toFixed(2)} {row.currency}
                    </td>
                    {showProject && (
                      <td style={{ padding: '6px 12px', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                        {row.projectId || '-'}
                      </td>
                    )}
                    <td style={{ padding: '6px 12px' }}>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {labelEntries.length > 0 ? (
                          labelEntries.map(([k, v]) => (
                            <span
                              key={k}
                              style={{
                                display: 'inline-block',
                                padding: '1px 6px',
                                fontSize: 10,
                                borderRadius: 10,
                                background: 'rgba(99, 102, 241, 0.1)',
                                color: 'var(--color-primary, #6366f1)',
                                border: '1px solid rgba(99, 102, 241, 0.2)',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {k}:{v}
                            </span>
                          ))
                        ) : (
                          <span style={{ color: 'var(--color-text-secondary)', fontSize: 11 }}>-</span>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* SKU breakdown expansion row */}
                  {isExpanded && hasBreakdown && (
                    <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                      <td />
                      <td colSpan={showProject ? 5 : 4} style={{ padding: '0 12px 10px 12px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
                          <thead>
                            <tr>
                              <th style={{
                                textAlign: 'left',
                                padding: '4px 8px',
                                color: 'var(--color-text-secondary)',
                                fontWeight: 600,
                                borderBottom: '1px solid var(--color-border)',
                              }}>
                                SKU
                              </th>
                              <th style={{
                                textAlign: 'right',
                                padding: '4px 8px',
                                color: 'var(--color-text-secondary)',
                                fontWeight: 600,
                                borderBottom: '1px solid var(--color-border)',
                                whiteSpace: 'nowrap',
                              }}>
                                Cost
                              </th>
                              <th style={{
                                textAlign: 'right',
                                padding: '4px 8px',
                                color: 'var(--color-text-secondary)',
                                fontWeight: 600,
                                borderBottom: '1px solid var(--color-border)',
                                whiteSpace: 'nowrap',
                              }}>
                                % of Total
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {row.skuBreakdown!.map((sku, si) => (
                              <tr key={si} style={{ borderBottom: '1px solid rgba(var(--color-border-rgb, 55,65,81), 0.5)' }}>
                                <td style={{ padding: '3px 8px', color: 'var(--color-text-secondary)' }}>
                                  {sku.sku}
                                </td>
                                <td style={{ padding: '3px 8px', textAlign: 'right', color: 'var(--color-text)', whiteSpace: 'nowrap' }}>
                                  ${sku.cost.toFixed(2)} {row.currency}
                                </td>
                                <td style={{ padding: '3px 8px', textAlign: 'right', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                                  {row.cost > 0 ? ((sku.cost / row.cost) * 100).toFixed(1) : '0.0'}%
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </td>
                      {/* fill the labels column */}
                      <td />
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ResourceCostTable;

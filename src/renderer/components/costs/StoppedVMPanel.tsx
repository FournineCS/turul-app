// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React, { useState, useMemo } from 'react';
import type { StoppedVMResult, StoppedVMInfo } from '../../../shared/types';

interface Props {
  data: StoppedVMResult | null;
  isLoading: boolean;
  error: string | null;
  showProjectColumn?: boolean;
}

type SortKey = 'name' | 'zone' | 'machineType' | 'status' | 'stoppedSince' | 'totalDiskSizeGb' | 'totalMonthlyCost' | 'projectId';
type SortDir = 'asc' | 'desc';

function formatCost(n: number): string {
  return `$${n.toFixed(2)}`;
}

function formatDate(iso?: string): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return iso;
  }
}

const statusBadge = (status: StoppedVMInfo['status']) => (
  <span
    style={{
      fontSize: 10,
      fontWeight: 600,
      padding: '2px 6px',
      borderRadius: 4,
      backgroundColor: status === 'SUSPENDED' ? 'rgba(234, 179, 8, 0.15)' : 'rgba(239, 68, 68, 0.1)',
      color: status === 'SUSPENDED' ? '#ca8a04' : '#ef4444',
    }}
  >
    {status}
  </span>
);

export const StoppedVMPanel: React.FC<Props> = ({ data, isLoading, error, showProjectColumn = false }) => {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('totalMonthlyCost');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  if (isLoading) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: 13 }}>
        Scanning for stopped and suspended VMs...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 12, backgroundColor: 'rgba(239, 68, 68, 0.05)', borderRadius: 8, color: '#ef4444', fontSize: 13 }}>
        {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: 13 }}>
        No data loaded. Click Refresh to scan for stopped VMs.
      </div>
    );
  }

  if (data.vms.length === 0) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-secondary)', fontSize: 13 }}>
        No stopped or suspended VMs found in this project.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Summary banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 24,
          padding: '12px 16px',
          backgroundColor: 'rgba(234, 179, 8, 0.08)',
          border: '1px solid rgba(234, 179, 8, 0.25)',
          borderRadius: 8,
        }}
      >
        <div>
          <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 2 }}>Stopped / Suspended VMs</div>
          <div style={{ fontSize: 22, fontWeight: 700 }}>{data.vms.length}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginBottom: 2 }}>Est. Monthly Cost</div>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#ca8a04' }}>{formatCost(data.totalEstimatedMonthlyCost)}</div>
        </div>
        <div style={{ marginLeft: 'auto', fontSize: 12, color: 'var(--color-text-secondary)', maxWidth: 260 }}>
          Stopped VMs still incur charges for attached persistent disks and idle static IP addresses.
        </div>
      </div>

      {/* Action guidance */}
      <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', padding: '4px 4px' }}>
        <strong>Recommended action:</strong> Start each VM to verify it is still needed, then delete it (and its disks/IPs) if unused.
      </div>

      {/* Search bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input
          type="text"
          placeholder="Search by VM name, project, zone, or machine type..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            flex: 1,
            padding: '7px 12px',
            fontSize: 12,
            borderRadius: 6,
            border: '1px solid var(--color-border)',
            backgroundColor: 'var(--color-bg-tertiary)',
            color: 'var(--color-text)',
            outline: 'none',
          }}
        />
        {search && (
          <button
            onClick={() => setSearch('')}
            style={{
              padding: '6px 10px',
              fontSize: 12,
              borderRadius: 6,
              border: '1px solid var(--color-border)',
              backgroundColor: 'var(--color-bg-tertiary)',
              color: 'var(--color-text-secondary)',
              cursor: 'pointer',
            }}
          >
            ✕
          </button>
        )}
      </div>

      {/* Scrollable table */}
      {(() => {
        const q = search.toLowerCase();
        const filtered = q
          ? data.vms.filter(
              (vm) =>
                vm.name.toLowerCase().includes(q) ||
                (vm.projectId ?? '').toLowerCase().includes(q) ||
                vm.zone.toLowerCase().includes(q) ||
                vm.machineType.toLowerCase().includes(q)
            )
          : data.vms;

        const sorted = [...filtered].sort((a, b) => {
          let av: string | number = a[sortKey as keyof StoppedVMInfo] as string | number ?? '';
          let bv: string | number = b[sortKey as keyof StoppedVMInfo] as string | number ?? '';
          if (typeof av === 'string') av = av.toLowerCase();
          if (typeof bv === 'string') bv = bv.toLowerCase();
          if (av < bv) return sortDir === 'asc' ? -1 : 1;
          if (av > bv) return sortDir === 'asc' ? 1 : -1;
          return 0;
        });

        const handleSort = (key: SortKey) => {
          if (key === sortKey) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
          else { setSortKey(key); setSortDir('asc'); }
        };

        const sortIndicator = (key: SortKey) =>
          sortKey === key ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '';

        const thStyle = (key: SortKey): React.CSSProperties => ({
          padding: '8px 10px',
          textAlign: 'left',
          fontWeight: 600,
          color: sortKey === key ? 'var(--color-primary)' : 'var(--color-text-secondary)',
          whiteSpace: 'nowrap',
          cursor: 'pointer',
          userSelect: 'none',
        });

        return (
          <div style={{ border: '1px solid var(--color-border)', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 420 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead style={{ position: 'sticky', top: 0, backgroundColor: 'var(--color-bg-secondary)', zIndex: 1 }}>
                  <tr style={{ borderBottom: '2px solid var(--color-border)' }}>
                    {showProjectColumn && (
                      <th style={thStyle('projectId')} onClick={() => handleSort('projectId')}>
                        Project{sortIndicator('projectId')}
                      </th>
                    )}
                    <th style={thStyle('name')} onClick={() => handleSort('name')}>VM Name{sortIndicator('name')}</th>
                    <th style={thStyle('zone')} onClick={() => handleSort('zone')}>Zone{sortIndicator('zone')}</th>
                    <th style={thStyle('machineType')} onClick={() => handleSort('machineType')}>Machine Type{sortIndicator('machineType')}</th>
                    <th style={thStyle('status')} onClick={() => handleSort('status')}>Status{sortIndicator('status')}</th>
                    <th style={thStyle('stoppedSince')} onClick={() => handleSort('stoppedSince')}>Last Started{sortIndicator('stoppedSince')}</th>
                    <th style={thStyle('totalDiskSizeGb')} onClick={() => handleSort('totalDiskSizeGb')}>Disks{sortIndicator('totalDiskSizeGb')}</th>
                    <th style={thStyle('totalMonthlyCost')} onClick={() => handleSort('totalMonthlyCost')}>Monthly Cost{sortIndicator('totalMonthlyCost')}</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.length === 0 ? (
                    <tr>
                      <td
                        colSpan={showProjectColumn ? 8 : 7}
                        style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-secondary)' }}
                      >
                        No VMs match "{search}"
                      </td>
                    </tr>
                  ) : (
                    sorted.map((vm, i) => (
                      <tr
                        key={`${vm.projectId ?? ''}-${vm.name}-${vm.zone}`}
                        style={{
                          borderBottom: '1px solid var(--color-border)',
                          backgroundColor: i % 2 === 0 ? 'transparent' : 'rgba(0,0,0,0.015)',
                        }}
                      >
                        {showProjectColumn && (
                          <td style={{ padding: '8px 10px', color: 'var(--color-text-secondary)', fontFamily: 'monospace', fontSize: 11 }}>
                            {vm.projectId ?? '—'}
                          </td>
                        )}
                        <td style={{ padding: '8px 10px', fontWeight: 500 }}>{vm.name}</td>
                        <td style={{ padding: '8px 10px', color: 'var(--color-text-secondary)' }}>{vm.zone}</td>
                        <td style={{ padding: '8px 10px', color: 'var(--color-text-secondary)' }}>{vm.machineType}</td>
                        <td style={{ padding: '8px 10px' }}>{statusBadge(vm.status)}</td>
                        <td style={{ padding: '8px 10px', color: 'var(--color-text-secondary)' }}>{formatDate(vm.stoppedSince)}</td>
                        <td style={{ padding: '8px 10px', color: 'var(--color-text-secondary)' }}>
                          {vm.attachedDiskCount} ({vm.totalDiskSizeGb} GB)
                          {vm.hasStaticExternalIp && (
                            <span style={{ marginLeft: 4, color: '#f59e0b', fontSize: 10 }} title="Has idle static external IP">
                              + IP
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '8px 10px', fontWeight: 600, color: vm.totalMonthlyCost > 20 ? '#ef4444' : 'inherit' }}>
                          {formatCost(vm.totalMonthlyCost)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div style={{ padding: '6px 10px', borderTop: '1px solid var(--color-border)', fontSize: 11, color: 'var(--color-text-secondary)' }}>
              {search ? `${sorted.length} of ${data.vms.length} VMs` : `${data.vms.length} VMs`}
            </div>
          </div>
        );
      })()}

      <div style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
        Cost estimates: SSD {formatCost(0.17)}/GB·mo, HDD {formatCost(0.04)}/GB·mo, Balanced {formatCost(0.10)}/GB·mo.
        Idle static external IP: {formatCost(7.30)}/mo. Actual charges may differ by region.
      </div>
    </div>
  );
};

// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useGKECostStore } from '../stores/gkeCostStore';
import type { GKECostScope } from '../stores/gkeCostStore';
import { useGCPProjectStore } from '../stores/gcpProjectStore';
import { DateRangeSelector } from '../components/costs/DateRangeSelector';
import ExportCSVButton from '../components/ExportCSVButton';

type SortDir = 'asc' | 'desc';

const COLORS = [
  '#1d9bf0', '#00ba7c', '#ffad1f', '#f4212e', '#794bc4',
  '#ff6b6b', '#51cf66', '#339af0', '#ffd43b', '#cc5de8',
];

function fmtCurrency(amount: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(amount);
}

function fmtShort(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toFixed(2)}`;
}

function fmtDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

/* ── Scope Toggle ── */

const ScopeToggle: React.FC<{ value: GKECostScope; onChange: (s: GKECostScope) => void }> = ({ value, onChange }) => {
  const btn = (active: boolean): React.CSSProperties => ({
    padding: '5px 14px', fontSize: 13,
    border: '1px solid var(--color-border)',
    background: active ? 'var(--color-primary)' : 'var(--color-bg-secondary)',
    color: active ? 'var(--color-bg)' : 'var(--color-text-secondary)',
    cursor: 'pointer', transition: 'all 0.15s ease',
  });
  return (
    <div style={{ display: 'inline-flex', borderRadius: 6, overflow: 'hidden' }}>
      <button style={{ ...btn(value === 'project'), borderRadius: '6px 0 0 6px' }} onClick={() => onChange('project')}>Project</button>
      <button style={{ ...btn(value === 'organization'), borderRadius: '0 6px 6px 0', borderLeft: 'none' }} onClick={() => onChange('organization')}>Organization</button>
    </div>
  );
};

/* ── Stat Card (matches CostOverview.tsx) ── */

const StatCard: React.FC<{
  title: string; value: string; subtitle?: string; isLoading?: boolean;
}> = ({ title, value, subtitle, isLoading }) => (
  <div style={{
    backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)',
    borderRadius: 8, padding: 20, minWidth: 160, flex: '1 1 0',
  }}>
    <div style={{
      fontSize: 12, color: 'var(--color-text-secondary)', marginBottom: 8,
      textTransform: 'uppercase', fontWeight: 500, letterSpacing: '0.5px',
    }}>{title}</div>
    {isLoading ? (
      <div style={{ height: 32, backgroundColor: 'var(--color-bg-tertiary)', borderRadius: 4, animation: 'pulse 1.5s ease-in-out infinite' }} />
    ) : (
      <>
        <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--color-text)', marginBottom: subtitle ? 4 : 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {value}
        </div>
        {subtitle && <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{subtitle}</div>}
      </>
    )}
  </div>
);

/* ── SVG Line Chart (matches CostTrendChart.tsx) ── */

const TrendChart: React.FC<{ data: { date: string; cost: number }[]; currency: string; title: string }> = ({ data, currency, title }) => {
  const W = 800, H = 250;
  const pad = { top: 20, right: 20, bottom: 40, left: 70 };
  const cW = W - pad.left - pad.right, cH = H - pad.top - pad.bottom;

  const { points, pathD, areaD, maxCost, minCost } = useMemo(() => {
    if (!data.length) return { points: [] as { x: number; y: number; cost: number; date: string }[], pathD: '', areaD: '', maxCost: 0, minCost: 0 };
    const costs = data.map(d => d.cost);
    const mx = Math.max(...costs, 1), mn = Math.min(...costs, 0), rng = mx - mn || 1;
    const xS = cW / Math.max(data.length - 1, 1);
    const pts = data.map((d, i) => ({ x: pad.left + i * xS, y: pad.top + cH - ((d.cost - mn) / rng) * cH, cost: d.cost, date: d.date }));
    const pd = pts.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ');
    const ad = pd + ` L ${pts[pts.length - 1]?.x || 0} ${pad.top + cH} L ${pad.left} ${pad.top + cH} Z`;
    return { points: pts, pathD: pd, areaD: ad, maxCost: mx, minCost: mn };
  }, [data, cW, cH]);

  const yLabels = useMemo(() => {
    const n = 5, rng = maxCost - minCost || 1;
    return Array.from({ length: n + 1 }, (_, i) => ({ value: minCost + (rng * (n - i)) / n, y: pad.top + (cH * i) / n }));
  }, [maxCost, minCost, cH]);

  const xLabels = useMemo(() => {
    if (!data.length) return [];
    const step = Math.max(1, Math.floor(data.length / 7));
    const xS = cW / Math.max(data.length - 1, 1);
    return data.filter((_, i) => i % step === 0).map((d, _, arr) => ({ date: d.date, x: pad.left + data.indexOf(d) * xS }));
  }, [data, cW]);

  if (!data.length) return (
    <div className="card" style={{ padding: 20, marginBottom: 24 }}>
      <h3 style={{ margin: '0 0 16px', fontSize: 14 }}>{title}</h3>
      <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-text-secondary)' }}>No trend data available.</div>
    </div>
  );

  return (
    <div className="card" style={{ padding: 20, marginBottom: 24 }}>
      <h3 style={{ margin: '0 0 16px', fontSize: 14 }}>{title}</h3>
      <div style={{ overflowX: 'auto' }}>
        <svg width={W} height={H} style={{ display: 'block' }}>
          {yLabels.map((l, i) => <line key={i} x1={pad.left} y1={l.y} x2={W - pad.right} y2={l.y} stroke="var(--color-border)" strokeDasharray="4 4" strokeOpacity={0.5} />)}
          <path d={areaD} fill="var(--color-primary)" fillOpacity={0.1} />
          <path d={pathD} fill="none" stroke="var(--color-primary)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          {points.map((p, i) => (
            <g key={i}><circle cx={p.x} cy={p.y} r={3} fill="var(--color-primary)" stroke="var(--color-bg-secondary)" strokeWidth={2} /><title>{fmtDate(p.date)}: {fmtCurrency(p.cost, currency)}</title></g>
          ))}
          {yLabels.map((l, i) => <text key={i} x={pad.left - 10} y={l.y} textAnchor="end" alignmentBaseline="middle" fill="var(--color-text-secondary)" fontSize={11} fontFamily="monospace">{fmtShort(l.value)}</text>)}
          {xLabels.map((l, i) => <text key={i} x={l.x} y={pad.top + cH + 20} textAnchor="middle" fill="var(--color-text-secondary)" fontSize={11}>{fmtDate(l.date)}</text>)}
          <line x1={pad.left} y1={pad.top + cH} x2={W - pad.right} y2={pad.top + cH} stroke="var(--color-border)" />
        </svg>
      </div>
    </div>
  );
};

/* ── Donut Chart (matches CostPieChart.tsx) ── */

const DonutChart: React.FC<{
  data: { label: string; value: number }[]; title: string; currency?: string;
  onSliceClick?: (label: string) => void; selectedLabel?: string | null;
}> = ({ data, title, currency = 'USD', onSliceClick, selectedLabel }) => {
  if (!data?.length) return (
    <div className="card" style={{ flex: '1 1 300px', padding: 16, minHeight: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <h4 style={{ margin: '0 0 8px', fontSize: 13 }}>{title}</h4>
      <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-secondary)' }}>No data available</p>
    </div>
  );

  const sorted = [...data].sort((a, b) => b.value - a.value);
  const top = sorted.slice(0, 8);
  const other = sorted.slice(8).reduce((s, d) => s + d.value, 0);
  if (other > 0) top.push({ label: 'Other', value: other });
  const total = top.reduce((s, d) => s + d.value, 0);
  if (total === 0) return (
    <div className="card" style={{ flex: '1 1 300px', padding: 16, minHeight: 200, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <h4 style={{ margin: '0 0 8px', fontSize: 13 }}>{title}</h4>
      <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-secondary)' }}>$0.00 total</p>
    </div>
  );

  const cx = 70, cy = 70, oR = 60, iR = 38;
  let cum = -Math.PI / 2;
  const slices = top.map((item, i) => {
    const a = (item.value / total) * 2 * Math.PI, s = cum, e = cum + a; cum = e;
    const la = a > Math.PI ? 1 : 0;
    const d = `M ${cx + oR * Math.cos(s)} ${cy + oR * Math.sin(s)} A ${oR} ${oR} 0 ${la} 1 ${cx + oR * Math.cos(e)} ${cy + oR * Math.sin(e)} L ${cx + iR * Math.cos(e)} ${cy + iR * Math.sin(e)} A ${iR} ${iR} 0 ${la} 0 ${cx + iR * Math.cos(s)} ${cy + iR * Math.sin(s)} Z`;
    return { d, color: COLORS[i % COLORS.length], label: item.label, value: item.value };
  });

  return (
    <div className="card" style={{ flex: '1 1 300px', padding: 16 }}>
      <h4 style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--color-text)' }}>{title}</h4>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
        <svg width="140" height="140" viewBox="0 0 140 140" style={{ flexShrink: 0 }}>
          {slices.map((s, i) => (
            <path key={i} d={s.d} fill={s.color} opacity={selectedLabel && selectedLabel !== s.label ? 0.3 : 1}
              style={{ cursor: onSliceClick ? 'pointer' : 'default', transition: 'opacity 0.2s' }}
              onClick={() => onSliceClick?.(s.label)} />
          ))}
          <text x={cx} y={cy + 5} textAnchor="middle" fill="var(--color-text)" fontSize="13" fontWeight="700">{fmtShort(total)}</text>
        </svg>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0, flex: 1 }}>
          {slices.map((s, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, cursor: onSliceClick ? 'pointer' : 'default', opacity: selectedLabel && selectedLabel !== s.label ? 0.5 : 1 }} onClick={() => onSliceClick?.(s.label)}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: s.color, flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, color: 'var(--color-text)' }}>{s.label}</span>
              <span style={{ fontWeight: 500, flexShrink: 0, color: 'var(--color-text-secondary)' }}>{fmtShort(s.value)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ── Table Header Cell (reusable sortable th) ── */

const thStyle = (align: 'left' | 'right' = 'left'): React.CSSProperties => ({
  textAlign: align, padding: '8px 12px', borderBottom: '2px solid var(--color-border)',
  color: 'var(--color-text-secondary)', fontWeight: 600, cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap',
});

const tdStyle = (align: 'left' | 'right' = 'left', mono = false): React.CSSProperties => ({
  padding: '6px 12px', textAlign: align, color: 'var(--color-text)', whiteSpace: 'nowrap',
  ...(mono ? { fontWeight: 500 } : {}),
});

const searchInputStyle: React.CSSProperties = {
  padding: '5px 10px', fontSize: 12, border: '1px solid var(--color-border)',
  borderRadius: 6, background: 'var(--color-bg)', color: 'var(--color-text)', width: 200,
};

/* ═══ MAIN PAGE ═══ */

const GKECostsPage: React.FC = () => {
  const { selectedProjectId, selectedOrgId, billingConfig, loadBillingConfig } = useGCPProjectStore();
  const {
    analysis, isLoading, error, scope,
    selectedCluster, selectedNamespace,
    dateRange, customStartDate, customEndDate,
    loadGKECosts, loadGKECostsOrg, setSelectedCluster, setSelectedNamespace, setScope,
    setDateRange, setCustomDates,
    gkeCacheHistory, viewingCacheId,
    loadGKECacheHistory, viewCachedGKEEntry, deleteCachedGKEEntry, clearCacheView, restoreLatestGKECache,
  } = useGKECostStore();

  const isOrgScope = scope === 'organization';
  const noIdentity = isOrgScope ? !selectedOrgId : !selectedProjectId;
  const orgMissingConfig = isOrgScope && selectedOrgId && !billingConfig?.bqProject;

  const [showCacheDropdown, setShowCacheDropdown] = useState(false);
  const cacheDropdownRef = useRef<HTMLDivElement>(null);
  const cacheBtnRef = useRef<HTMLButtonElement>(null);

  const activeIdentity = isOrgScope ? (selectedOrgId || null) : selectedProjectId;

  // Close dropdown on outside click
  useEffect(() => {
    if (!showCacheDropdown) return;
    const handler = (e: MouseEvent) => {
      if (cacheDropdownRef.current && !cacheDropdownRef.current.contains(e.target as Node) &&
          cacheBtnRef.current && !cacheBtnRef.current.contains(e.target as Node)) {
        setShowCacheDropdown(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showCacheDropdown]);

  // Auto-restore cached data and load cache history on mount
  useEffect(() => {
    if (activeIdentity) {
      restoreLatestGKECache(activeIdentity);
      loadGKECacheHistory(activeIdentity);
    }
  }, [activeIdentity, restoreLatestGKECache, loadGKECacheHistory]);

  // Table local state
  const [wlSearch, setWlSearch] = useState('');
  const [wlSortKey, setWlSortKey] = useState<string>('cost');
  const [wlSortDir, setWlSortDir] = useState<SortDir>('desc');
  const [skuSearch, setSkuSearch] = useState('');
  const [skuSortKey, setSkuSortKey] = useState<string>('cost');
  const [skuSortDir, setSkuSortDir] = useState<SortDir>('desc');
  const [exportingExcel, setExportingExcel] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);

  useEffect(() => { loadBillingConfig(); }, [loadBillingConfig]);

  const handleRefresh = useCallback(async () => {
    clearCacheView();
    if (isOrgScope) await loadGKECostsOrg();
    else if (selectedProjectId) await loadGKECosts(selectedProjectId);
    // Reload cache history after fresh data is saved
    if (activeIdentity) loadGKECacheHistory(activeIdentity);
  }, [selectedProjectId, isOrgScope, loadGKECosts, loadGKECostsOrg, clearCacheView, activeIdentity, loadGKECacheHistory]);

  const exportLabel = isOrgScope ? (selectedOrgId || 'org') : (selectedProjectId || 'project');

  const handleExportExcel = useCallback(async () => {
    if (!analysis) return;
    setExportingExcel(true);
    try {
      const res = await window.electronAPI.gcp.cost.exportGKEExcel(analysis, exportLabel);
      if (!res.success) console.error('Excel export failed:', res.error);
    } catch (err) {
      console.error('Excel export error:', err);
    }
    setExportingExcel(false);
  }, [analysis, exportLabel]);

  const handleExportPdf = useCallback(async () => {
    if (!analysis) return;
    setExportingPdf(true);
    try {
      const res = await window.electronAPI.gcp.cost.exportGKEPdf(analysis, exportLabel);
      if (!res.success) console.error('PDF export failed:', res.error);
    } catch (err) {
      console.error('PDF export error:', err);
    }
    setExportingPdf(false);
  }, [analysis, exportLabel]);

  // ── Derived data ──

  const trendData = useMemo(() => {
    if (!analysis?.trend.length) return [];
    const map = new Map<string, number>();
    for (const t of analysis.trend) {
      if (selectedCluster && t.cluster && t.cluster !== selectedCluster) continue;
      map.set(t.date, (map.get(t.date) || 0) + t.cost);
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([date, cost]) => ({ date, cost }));
  }, [analysis, selectedCluster]);

  const filteredNamespaces = useMemo(() => {
    if (!analysis) return [];
    const items = selectedCluster ? analysis.byNamespace.filter(n => n.cluster === selectedCluster) : analysis.byNamespace;
    return [...items].sort((a, b) => b.cost - a.cost);
  }, [analysis, selectedCluster]);

  const filteredWorkloads = useMemo(() => {
    if (!analysis) return [];
    let items = analysis.byWorkload;
    if (selectedCluster) items = items.filter(w => w.cluster === selectedCluster);
    if (selectedNamespace) items = items.filter(w => w.namespace === selectedNamespace);
    const q = wlSearch.toLowerCase();
    if (q) items = items.filter(w => w.workload.toLowerCase().includes(q) || w.namespace.toLowerCase().includes(q) || w.cluster.toLowerCase().includes(q) || w.workloadType.toLowerCase().includes(q));
    return [...items].sort((a, b) => {
      const ak = wlSortKey === 'cost' ? a.cost : (a as Record<string, unknown>)[wlSortKey] as string || '';
      const bk = wlSortKey === 'cost' ? b.cost : (b as Record<string, unknown>)[wlSortKey] as string || '';
      if (ak < bk) return wlSortDir === 'asc' ? -1 : 1;
      if (ak > bk) return wlSortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [analysis, selectedCluster, selectedNamespace, wlSearch, wlSortKey, wlSortDir]);

  const filteredSkus = useMemo(() => {
    if (!analysis) return [];
    let items = analysis.bySku;
    const q = skuSearch.toLowerCase();
    if (q) items = items.filter(s => s.sku.toLowerCase().includes(q));
    return [...items].sort((a, b) => {
      const ak = skuSortKey === 'cost' ? a.cost : a.sku.toLowerCase();
      const bk = skuSortKey === 'cost' ? b.cost : b.sku.toLowerCase();
      if (ak < bk) return skuSortDir === 'asc' ? -1 : 1;
      if (ak > bk) return skuSortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [analysis, skuSearch, skuSortKey, skuSortDir]);

  // ── Sort helpers ──

  const handleWlSort = (key: string) => {
    if (wlSortKey === key) setWlSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setWlSortKey(key); setWlSortDir(key === 'cost' ? 'desc' : 'asc'); }
  };
  const handleSkuSort = (key: string) => {
    if (skuSortKey === key) setSkuSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSkuSortKey(key); setSkuSortDir(key === 'cost' ? 'desc' : 'asc'); }
  };
  const arrow = (active: string, key: string, dir: SortDir) => active === key ? (dir === 'asc' ? ' \u25B2' : ' \u25BC') : '';

  return (
    <>
      <header className="page-header">
        <h1 className="page-title">GKE Costs</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {(selectedCluster || selectedNamespace) && (
            <button className="btn btn-secondary" onClick={() => { setSelectedCluster(null); setSelectedNamespace(null); }}>Clear Filters</button>
          )}
          {analysis && (
            <>
              <button className="btn btn-secondary" onClick={handleExportExcel} disabled={exportingExcel}>
                {exportingExcel ? 'Exporting...' : 'Excel'}
              </button>
              <button className="btn btn-secondary" onClick={handleExportPdf} disabled={exportingPdf}>
                {exportingPdf ? 'Exporting...' : 'PDF'}
              </button>
            </>
          )}
          {gkeCacheHistory.length > 0 && (
              <button
                ref={cacheBtnRef}
                className="btn btn-secondary"
                onClick={() => setShowCacheDropdown(!showCacheDropdown)}
                title="View cached GKE cost data history"
                style={{ fontSize: 12 }}
              >
                History ({gkeCacheHistory.length})
              </button>
          )}
          <button className="btn btn-primary" onClick={handleRefresh} disabled={isLoading || noIdentity || !!orgMissingConfig}>
            {isLoading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </header>

      <div className="page-content">
        {/* Cached data banner */}
        {viewingCacheId && (
          <div style={{
            backgroundColor: 'var(--color-primary-glow)', border: '1px solid var(--color-primary)',
            borderRadius: 8, padding: '10px 16px', marginBottom: 16,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13,
          }}>
            <span>
              Viewing cached data from {gkeCacheHistory.find(e => e.id === viewingCacheId)
                ? new Date(gkeCacheHistory.find(e => e.id === viewingCacheId)!.fetchedAt).toLocaleString()
                : 'cache'}
            </span>
            <button
              className="btn btn-primary"
              onClick={handleRefresh}
              disabled={isLoading || noIdentity}
              style={{ fontSize: 12, padding: '4px 12px' }}
            >
              Load Fresh
            </button>
          </div>
        )}
        {/* Scope toggle + Period selector */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
          <ScopeToggle value={scope} onChange={setScope} />
          <DateRangeSelector
            value={dateRange}
            onChange={setDateRange}
            onCustomDateChange={setCustomDates}
            customStartDate={customStartDate}
            customEndDate={customEndDate}
          />
        </div>

        {/* Prompts */}
        {noIdentity && (
          <div style={{ backgroundColor: 'var(--color-primary-glow)', border: '1px solid var(--color-primary)', borderRadius: 8, padding: 24, marginBottom: 24 }}>
            <h3 style={{ margin: '0 0 8px' }}>{isOrgScope ? 'Select a GCP Organization' : 'Select a GCP Project'}</h3>
            <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: 13 }}>
              {isOrgScope ? 'Choose a GCP organization from the global selector to view org-wide GKE cluster cost breakdowns.' : 'Choose a GCP project from the global selector to view GKE cluster cost breakdowns.'}
            </p>
          </div>
        )}
        {orgMissingConfig && (
          <div style={{ backgroundColor: 'var(--color-warning-glow, rgba(245, 158, 11, 0.1))', border: '1px solid var(--color-warning)', borderRadius: 8, padding: 16, marginBottom: 24 }}>
            <strong>BigQuery billing project required</strong>
            <p style={{ margin: '8px 0 0', color: 'var(--color-text-secondary)', fontSize: 13 }}>
              Organization-level GKE cost analysis requires a configured BigQuery billing project. Set the BQ Project in the Costs page Billing Config card, then click Refresh.
            </p>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ backgroundColor: 'var(--color-error-glow, rgba(244, 33, 46, 0.08))', border: '1px solid var(--color-error)', borderRadius: 8, padding: 16, marginBottom: 24 }}>
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Breadcrumb */}
        {(selectedCluster || selectedNamespace) && (
          <div style={{ marginBottom: 16, fontSize: 13, display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ cursor: 'pointer', color: 'var(--color-primary)', fontWeight: 500 }} onClick={() => { setSelectedCluster(null); setSelectedNamespace(null); }}>All Clusters</span>
            {selectedCluster && (
              <><span style={{ color: 'var(--color-text-secondary)' }}>/</span><span style={{ cursor: selectedNamespace ? 'pointer' : 'default', color: selectedNamespace ? 'var(--color-primary)' : 'var(--color-text)', fontWeight: 500 }} onClick={() => selectedNamespace && setSelectedNamespace(null)}>{selectedCluster}</span></>
            )}
            {selectedNamespace && (
              <><span style={{ color: 'var(--color-text-secondary)' }}>/</span><span style={{ fontWeight: 500 }}>{selectedNamespace}</span></>
            )}
          </div>
        )}

        {/* Loading skeleton */}
        {isLoading && !analysis && (
          <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
            {[1, 2, 3, 4].map(i => <StatCard key={i} title="..." value="" isLoading />)}
          </div>
        )}

        {/* Empty state — prompt to click Refresh */}
        {!isLoading && !analysis && !error && !noIdentity && !orgMissingConfig && (
          <div className="card" style={{ padding: 48, textAlign: 'center', marginBottom: 24 }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 18 }}>GKE Cost Analysis</h3>
            <p style={{ margin: 0, color: 'var(--color-text-secondary)', fontSize: 13 }}>
              Click <strong>Refresh</strong> to load GKE cost data for {isOrgScope ? 'your organization' : selectedProjectId}.
            </p>
          </div>
        )}

        {analysis && (
          <>
            {/* ── Summary Cards ── */}
            <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
              <StatCard title="Total GKE Spend" value={fmtCurrency(analysis.totalCost, analysis.currency)} subtitle={dateRange === '7d' ? 'Last 7 days' : dateRange === '30d' ? 'Last 30 days' : dateRange === '90d' ? 'Last 90 days' : dateRange === '12m' ? 'Last 12 months' : 'Custom range'} />
              <StatCard title="Clusters" value={String(analysis.byCluster.length)} subtitle={`${new Set(analysis.byNamespace.map(n => `${n.cluster}/${n.namespace}`)).size} namespaces`} />
              <StatCard title="Top Cluster" value={analysis.byCluster[0]?.cluster || '-'} subtitle={analysis.byCluster[0] ? `${fmtCurrency(analysis.byCluster[0].cost)} (${analysis.totalCost > 0 ? ((analysis.byCluster[0].cost / analysis.totalCost) * 100).toFixed(0) : 0}%)` : ''} />
              <StatCard title="Top Namespace" value={analysis.byNamespace[0]?.namespace || '-'} subtitle={analysis.byNamespace[0] ? fmtCurrency(analysis.byNamespace[0].cost) : ''} />
            </div>

            {/* ── Donut Charts Row ── */}
            <div style={{ display: 'flex', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
              <DonutChart title="Cost by Cluster" data={analysis.byCluster.map(c => ({ label: c.cluster, value: c.cost }))} currency={analysis.currency}
                onSliceClick={l => setSelectedCluster(selectedCluster === l ? null : l)} selectedLabel={selectedCluster} />
              <DonutChart title="Cost by SKU Category" data={analysis.bySku.map(s => ({ label: s.sku, value: s.cost }))} currency={analysis.currency} />
            </div>

            {/* ── Cost Trend ── */}
            <TrendChart data={trendData} currency={analysis.currency} title={`Daily Cost Trend ${selectedCluster ? `(${selectedCluster})` : '(All Clusters)'}`} />

            {/* ── Cluster Table ── */}
            <div className="card" style={{ padding: 24, marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 14 }}>Clusters ({analysis.byCluster.length})</h3>
                <ExportCSVButton
                  data={analysis.byCluster.map(c => ({ cluster: c.cluster, namespaces: c.namespaceCount ?? 0, cost: c.cost.toFixed(2), percent: analysis.totalCost > 0 ? ((c.cost / analysis.totalCost) * 100).toFixed(1) + '%' : '-' }))}
                  columns={[{ key: 'cluster', label: 'Cluster' }, { key: 'namespaces', label: 'Namespaces' }, { key: 'cost', label: 'Cost' }, { key: 'percent', label: '% of Total' }]}
                  filename="gke-clusters" label="CSV"
                />
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead><tr>
                    <th style={thStyle()}>Cluster</th>
                    <th style={thStyle()}>Namespaces</th>
                    <th style={thStyle('right')}>Cost</th>
                    <th style={thStyle('right')}>% of Total</th>
                  </tr></thead>
                  <tbody>
                    {analysis.byCluster.map(c => (
                      <tr key={c.cluster} onClick={() => setSelectedCluster(selectedCluster === c.cluster ? null : c.cluster)}
                        style={{ borderBottom: '1px solid var(--color-border)', cursor: 'pointer', backgroundColor: selectedCluster === c.cluster ? 'var(--color-primary-glow)' : undefined }}>
                        <td style={{ ...tdStyle(), fontWeight: 500 }}>{c.cluster}</td>
                        <td style={tdStyle()}>{c.namespaceCount ?? '-'}</td>
                        <td style={tdStyle('right', true)}>{fmtCurrency(c.cost, analysis.currency)}</td>
                        <td style={{ ...tdStyle('right'), color: 'var(--color-text-secondary)' }}>{analysis.totalCost > 0 ? ((c.cost / analysis.totalCost) * 100).toFixed(1) + '%' : '-'}</td>
                      </tr>
                    ))}
                    {analysis.byCluster.length === 0 && <tr><td colSpan={4} style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-secondary)' }}>No GKE cluster costs found</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── Namespace Table ── */}
            <div className="card" style={{ padding: 24, marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h3 style={{ margin: 0, fontSize: 14 }}>
                  Namespaces {selectedCluster && <span style={{ fontWeight: 400, color: 'var(--color-text-secondary)' }}>({selectedCluster})</span>}
                  {' '}({filteredNamespaces.length})
                </h3>
                <ExportCSVButton
                  data={filteredNamespaces.map(n => ({ namespace: n.namespace, cluster: n.cluster, cost: n.cost.toFixed(2) }))}
                  columns={[{ key: 'namespace', label: 'Namespace' }, { key: 'cluster', label: 'Cluster' }, { key: 'cost', label: 'Cost' }]}
                  filename="gke-namespaces" label="CSV"
                />
              </div>
              <div style={{ overflowX: 'auto', maxHeight: 400, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead><tr>
                    <th style={thStyle()}>Namespace</th>
                    {!selectedCluster && <th style={thStyle()}>Cluster</th>}
                    <th style={thStyle('right')}>Cost</th>
                    <th style={thStyle('right')}>Share</th>
                  </tr></thead>
                  <tbody>
                    {filteredNamespaces.map((n, i) => (
                      <tr key={`${n.cluster}/${n.namespace}-${i}`}
                        onClick={() => { if (!selectedCluster) setSelectedCluster(n.cluster); setSelectedNamespace(selectedNamespace === n.namespace ? null : n.namespace); }}
                        style={{ borderBottom: '1px solid var(--color-border)', cursor: 'pointer', backgroundColor: selectedNamespace === n.namespace ? 'var(--color-primary-glow)' : undefined }}>
                        <td style={{ ...tdStyle(), fontWeight: 500 }}>
                          {n.namespace}
                          {(n.namespace.startsWith('kube:')) && <span style={{ fontSize: 10, marginLeft: 6, color: 'var(--color-text-muted)', background: 'var(--color-bg-tertiary)', padding: '1px 4px', borderRadius: 3 }}>system</span>}
                        </td>
                        {!selectedCluster && <td style={tdStyle()}>{n.cluster}</td>}
                        <td style={tdStyle('right', true)}>{fmtCurrency(n.cost, analysis.currency)}</td>
                        <td style={{ ...tdStyle('right'), color: 'var(--color-text-secondary)' }}>{analysis.totalCost > 0 ? ((n.cost / analysis.totalCost) * 100).toFixed(1) + '%' : '-'}</td>
                      </tr>
                    ))}
                    {filteredNamespaces.length === 0 && <tr><td colSpan={selectedCluster ? 3 : 4} style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-secondary)' }}>No namespace data</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── Workload Table ── */}
            <div className="card" style={{ padding: 24, marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
                  <h3 style={{ margin: 0, fontSize: 14 }}>Workloads ({filteredWorkloads.length})</h3>
                  <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                    Total: <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{fmtCurrency(filteredWorkloads.reduce((s, w) => s + w.cost, 0), analysis.currency)}</span>
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input type="text" placeholder="Search workloads..." value={wlSearch} onChange={e => setWlSearch(e.target.value)} style={searchInputStyle} />
                  <ExportCSVButton
                    data={filteredWorkloads.map(w => ({ workload: w.workload, type: w.workloadType, namespace: w.namespace, cluster: w.cluster, cost: w.cost.toFixed(2) }))}
                    columns={[{ key: 'workload', label: 'Workload' }, { key: 'type', label: 'Type' }, { key: 'namespace', label: 'Namespace' }, { key: 'cluster', label: 'Cluster' }, { key: 'cost', label: 'Cost' }]}
                    filename="gke-workloads" label="CSV"
                  />
                </div>
              </div>
              <div style={{ overflowX: 'auto', maxHeight: 460, overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead><tr>
                    <th style={thStyle()} onClick={() => handleWlSort('workload')}>Workload{arrow(wlSortKey, 'workload', wlSortDir)}</th>
                    <th style={thStyle()} onClick={() => handleWlSort('workloadType')}>Type{arrow(wlSortKey, 'workloadType', wlSortDir)}</th>
                    {!selectedNamespace && <th style={thStyle()} onClick={() => handleWlSort('namespace')}>Namespace{arrow(wlSortKey, 'namespace', wlSortDir)}</th>}
                    {!selectedCluster && <th style={thStyle()} onClick={() => handleWlSort('cluster')}>Cluster{arrow(wlSortKey, 'cluster', wlSortDir)}</th>}
                    <th style={thStyle('right')} onClick={() => handleWlSort('cost')}>Cost{arrow(wlSortKey, 'cost', wlSortDir)}</th>
                    <th style={{ ...thStyle('right'), cursor: 'default' }}>Share</th>
                  </tr></thead>
                  <tbody>
                    {filteredWorkloads.map((w, i) => (
                      <tr key={`${w.cluster}/${w.namespace}/${w.workload}-${i}`} style={{ borderBottom: '1px solid var(--color-border)' }}>
                        <td style={{ ...tdStyle(), fontWeight: 500 }}>{w.workload}</td>
                        <td style={tdStyle()}>
                          {w.workloadType ? (
                            <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 3, backgroundColor: 'var(--color-bg-tertiary)', color: 'var(--color-text-secondary)' }}>{w.workloadType}</span>
                          ) : <span style={{ color: 'var(--color-text-secondary)' }}>-</span>}
                        </td>
                        {!selectedNamespace && <td style={tdStyle()}>{w.namespace}</td>}
                        {!selectedCluster && <td style={tdStyle()}>{w.cluster}</td>}
                        <td style={tdStyle('right', true)}>{fmtCurrency(w.cost, analysis.currency)}</td>
                        <td style={{ ...tdStyle('right'), color: 'var(--color-text-secondary)' }}>{analysis.totalCost > 0 ? ((w.cost / analysis.totalCost) * 100).toFixed(1) + '%' : '-'}</td>
                      </tr>
                    ))}
                    {filteredWorkloads.length === 0 && <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: 'var(--color-text-secondary)' }}>No workload data</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

            {/* ── SKU Table ── */}
            {analysis.bySku.length > 0 && (
              <div className="card" style={{ padding: 24 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
                    <h3 style={{ margin: 0, fontSize: 14 }}>SKU Cost Breakdown ({filteredSkus.length} of {analysis.bySku.length})</h3>
                    <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                      Total: <span style={{ fontWeight: 600, color: 'var(--color-text)' }}>{fmtCurrency(filteredSkus.reduce((s, r) => s + r.cost, 0), analysis.currency)}</span>
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <input type="text" placeholder="Search SKUs..." value={skuSearch} onChange={e => setSkuSearch(e.target.value)} style={searchInputStyle} />
                    <ExportCSVButton
                      data={filteredSkus.map(s => ({ sku: s.sku, cost: s.cost.toFixed(2), percent: analysis.totalCost > 0 ? ((s.cost / analysis.totalCost) * 100).toFixed(1) + '%' : '-' }))}
                      columns={[{ key: 'sku', label: 'SKU Description' }, { key: 'cost', label: 'Cost' }, { key: 'percent', label: 'Share' }]}
                      filename="gke-skus" label="CSV"
                    />
                  </div>
                </div>
                <div style={{ overflowX: 'auto', maxHeight: 400, overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                    <thead><tr>
                      <th style={thStyle()} onClick={() => handleSkuSort('sku')}>SKU Description{arrow(skuSortKey, 'sku', skuSortDir)}</th>
                      <th style={thStyle('right')} onClick={() => handleSkuSort('cost')}>Cost{arrow(skuSortKey, 'cost', skuSortDir)}</th>
                      <th style={{ ...thStyle('right'), cursor: 'default' }}>Share</th>
                    </tr></thead>
                    <tbody>
                      {filteredSkus.map((s, i) => (
                        <tr key={`${s.sku}-${i}`} style={{ borderBottom: '1px solid var(--color-border)' }}>
                          <td style={{ ...tdStyle(), maxWidth: 500, overflow: 'hidden', textOverflow: 'ellipsis' }} title={s.sku}>{s.sku}</td>
                          <td style={tdStyle('right', true)}>{fmtCurrency(s.cost, analysis.currency)}</td>
                          <td style={{ ...tdStyle('right'), color: 'var(--color-text-secondary)' }}>{analysis.totalCost > 0 ? ((s.cost / analysis.totalCost) * 100).toFixed(1) + '%' : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Cache history dropdown — rendered outside header to avoid clipping */}
      {showCacheDropdown && cacheBtnRef.current && (() => {
        const rect = cacheBtnRef.current!.getBoundingClientRect();
        return (
          <div
            ref={cacheDropdownRef}
            style={{
              position: 'fixed', top: rect.bottom + 4, left: rect.right - 360, zIndex: 9999,
              width: 360, maxHeight: 320, overflowY: 'auto',
              backgroundColor: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)',
              borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.25)', padding: 6,
            }}
          >
            <div style={{ padding: '6px 10px 8px', fontSize: 12, fontWeight: 600, color: 'var(--color-text-secondary)', borderBottom: '1px solid var(--color-border)', marginBottom: 4 }}>
              Cached GKE Cost Data
            </div>
            {gkeCacheHistory.map((entry) => (
              <div
                key={entry.id}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 10px', borderRadius: 6, cursor: 'pointer',
                  backgroundColor: viewingCacheId === entry.id ? 'var(--color-primary-glow)' : 'transparent',
                }}
                onMouseEnter={(e) => { if (viewingCacheId !== entry.id) (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.04)'); }}
                onMouseLeave={(e) => { if (viewingCacheId !== entry.id) (e.currentTarget.style.backgroundColor = 'transparent'); }}
                onClick={() => { viewCachedGKEEntry(entry.id); setShowCacheDropdown(false); }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{entry.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                    {new Date(entry.fetchedAt).toLocaleString()} &middot; ${entry.totalCost.toFixed(2)} &middot; {entry.serviceCount} clusters
                  </div>
                </div>
                <button
                  style={{ background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', fontSize: 16, padding: '2px 8px', flexShrink: 0, lineHeight: 1 }}
                  title="Delete cached entry"
                  onClick={(e) => { e.stopPropagation(); deleteCachedGKEEntry(entry.id, activeIdentity || ''); }}
                >
                  &times;
                </button>
              </div>
            ))}
          </div>
        );
      })()}
    </>
  );
};

export default GKECostsPage;

// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React, { useEffect } from 'react';
import { useHealthStore } from '../../stores/healthStore';
import type { HealthStatus, ToolCheck } from '../../../shared/types';

const STATUS_COLORS: Record<HealthStatus, string> = {
  ok: '#22c55e',
  warning: '#eab308',
  error: '#ef4444',
  'not-found': '#6b7280',
};

const STATUS_LABELS: Record<HealthStatus, string> = {
  ok: 'OK',
  warning: 'Warning',
  error: 'Error',
  'not-found': 'Not Found',
};

function StatusDot({ status }: { status: HealthStatus }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 10,
        height: 10,
        borderRadius: '50%',
        backgroundColor: STATUS_COLORS[status],
        flexShrink: 0,
      }}
      title={STATUS_LABELS[status]}
    />
  );
}

function CheckRow({ check }: { check: ToolCheck }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
        padding: '10px 0',
        borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.08))',
      }}
    >
      <div style={{ paddingTop: 3 }}>
        <StatusDot status={check.status} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontWeight: 500 }}>{check.name}</span>
          {check.version && (
            <span className="text-secondary text-sm">v{check.version}</span>
          )}
          {check.required && (
            <span
              style={{
                fontSize: 10,
                padding: '1px 6px',
                borderRadius: 4,
                backgroundColor: 'rgba(239,68,68,0.15)',
                color: '#ef4444',
              }}
            >
              Required
            </span>
          )}
        </div>
        {check.details && (
          <div className="text-secondary text-sm" style={{ marginTop: 2 }}>
            {check.details}
          </div>
        )}
        {check.status === 'not-found' && check.installUrl && (
          <a
            href={check.installUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm"
            style={{ color: 'var(--accent-color, #3b82f6)', marginTop: 4, display: 'inline-block' }}
            onClick={(e) => {
              e.preventDefault();
              window.electronAPI?.app?.saveFile && void 0; // keep TS happy
              // Use window.open as fallback; Electron's setWindowOpenHandler routes to shell.openExternal
              window.open(check.installUrl, '_blank');
            }}
          >
            Install instructions
          </a>
        )}
      </div>
      <div
        className="text-sm"
        style={{
          color: STATUS_COLORS[check.status],
          fontWeight: 500,
          flexShrink: 0,
        }}
      >
        {STATUS_LABELS[check.status]}
      </div>
    </div>
  );
}

const EnvironmentHealthCard: React.FC = () => {
  const { health, isLoading, loadHealth, recheckHealth } = useHealthStore();

  useEffect(() => {
    loadHealth();
  }, [loadHealth]);

  const platformLabel =
    health?.platform === 'darwin'
      ? 'macOS'
      : health?.platform === 'win32'
        ? 'Windows'
        : health?.platform === 'linux'
          ? 'Linux'
          : health?.platform || '—';

  return (
    <div className="card mb-4">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h3 className="card-title" style={{ margin: 0 }}>Environment Health</h3>
        <button
          className="btn btn-secondary"
          onClick={recheckHealth}
          disabled={isLoading}
          style={{ minWidth: 90 }}
        >
          {isLoading ? 'Checking...' : 'Re-check'}
        </button>
      </div>

      {!health && !isLoading && (
        <p className="text-secondary text-sm">No health data yet. Click Re-check to run diagnostics.</p>
      )}

      {health && (
        <>
          <div className="text-secondary text-sm" style={{ marginBottom: 12, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <span>Platform: {platformLabel}</span>
            <span>Node: {health.nodeVersion}</span>
            {health.electronVersion && <span>Electron: {health.electronVersion}</span>}
            <span>Checked: {new Date(health.checkedAt).toLocaleTimeString()}</span>
          </div>
          <div>
            {health.checks.map((check) => (
              <CheckRow key={check.id} check={check} />
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default EnvironmentHealthCard;

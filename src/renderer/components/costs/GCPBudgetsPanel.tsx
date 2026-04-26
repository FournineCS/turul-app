// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React, { useEffect } from 'react';
import { useGCPBudgetStore } from '../../stores/gcpBudgetStore';
import type { GCPBudget, GCPBudgetThreshold } from '../../../shared/types';

interface GCPBudgetsPanelProps {
  projectId: string | null;
}

function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatThresholds(thresholds: GCPBudgetThreshold[]): string {
  if (!thresholds.length) return '—';
  return thresholds
    .map((t) => {
      const pct = `${Math.round(t.thresholdPercent * 100)}%`;
      const basis = t.spendBasis === 'FORECASTED_SPEND' ? 'forecast' : 'actual';
      return `${pct} ${basis}`;
    })
    .join(', ');
}

function formatAmount(b: GCPBudget): string {
  if (b.amount.lastPeriodAmount) return 'Last period spend';
  if (typeof b.amount.units === 'number' && b.amount.units > 0) {
    return formatCurrency(b.amount.units, b.amount.currencyCode);
  }
  return '—';
}

function budgetConsoleUrl(budgetName: string): string {
  // budgetName: billingAccounts/{id}/budgets/{uuid}
  const match = budgetName.match(/billingAccounts\/([^/]+)/);
  if (!match) return 'https://console.cloud.google.com/billing';
  return `https://console.cloud.google.com/billing/${match[1]}/budgets`;
}

const GCPBudgetsPanel: React.FC<GCPBudgetsPanelProps> = ({ projectId }) => {
  const { billingAccountName, budgets, isLoading, error, lastLoadedProjectId, loadBudgets } = useGCPBudgetStore();

  useEffect(() => {
    if (projectId && projectId !== lastLoadedProjectId) {
      void loadBudgets(projectId);
    }
  }, [projectId, lastLoadedProjectId, loadBudgets]);

  if (!projectId) {
    return (
      <div className="empty-state">
        Select a GCP project to view billing budgets.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div style={{ padding: 16, color: 'var(--color-text-secondary)', fontSize: 13 }}>
        Loading budgets…
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          padding: 12,
          background: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border)',
          borderRadius: 6,
          color: 'var(--color-error)',
          fontSize: 13,
        }}
      >
        {error}
      </div>
    );
  }

  if (!billingAccountName) {
    return (
      <div className="empty-state">
        No billing account is linked to this project. Link a billing account in the GCP console to enable budget tracking.
      </div>
    );
  }

  if (!budgets.length) {
    return (
      <div className="empty-state" style={{ flexDirection: 'column', gap: 8 }}>
        <div>No budgets configured for billing account {billingAccountName.split('/')[1]}.</div>
        <a
          href={budgetConsoleUrl(`${billingAccountName}/budgets/new`)}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'var(--color-primary)', fontSize: 13 }}
        >
          Create a budget in the GCP console →
        </a>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
          Billing account: <code>{billingAccountName.split('/')[1]}</code> · {budgets.length} budget{budgets.length === 1 ? '' : 's'}
        </div>
        <a
          href={budgetConsoleUrl(budgets[0].name)}
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: 'var(--color-primary)', fontSize: 12 }}
        >
          Manage in GCP console →
        </a>
      </div>

      <div
        style={{
          border: '1px solid var(--color-border)',
          borderRadius: 8,
          overflow: 'hidden',
          background: 'var(--color-bg-secondary)',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ background: 'var(--color-bg-tertiary)' }}>
              <th style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 600 }}>Name</th>
              <th style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 600 }}>Amount</th>
              <th style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 600 }}>Period</th>
              <th style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 600 }}>Thresholds</th>
              <th style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 600 }}>Scope</th>
              <th style={{ textAlign: 'left', padding: '10px 12px', fontWeight: 600 }}>Notifications</th>
            </tr>
          </thead>
          <tbody>
            {budgets.map((b) => {
              const projectCount = b.filter?.projects?.length ?? 0;
              const serviceCount = b.filter?.services?.length ?? 0;
              const scopeParts: string[] = [];
              if (projectCount > 0) scopeParts.push(`${projectCount} project${projectCount === 1 ? '' : 's'}`);
              if (serviceCount > 0) scopeParts.push(`${serviceCount} service${serviceCount === 1 ? '' : 's'}`);
              if (b.filter?.labels && Object.keys(b.filter.labels).length > 0) {
                scopeParts.push(`${Object.keys(b.filter.labels).length} label filter${Object.keys(b.filter.labels).length === 1 ? '' : 's'}`);
              }
              const scope = scopeParts.length ? scopeParts.join(' · ') : 'Entire billing account';
              const period = b.filter?.calendarPeriod ?? (b.filter?.customPeriodStart ? 'Custom' : 'Month');

              const notif: string[] = [];
              if (b.notificationEmail) notif.push('Email');
              if (b.pubsubTopic) notif.push('Pub/Sub');

              return (
                <tr key={b.name} style={{ borderTop: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 500 }}>{b.displayName}</td>
                  <td style={{ padding: '10px 12px' }}>{formatAmount(b)}</td>
                  <td style={{ padding: '10px 12px' }}>{period}</td>
                  <td style={{ padding: '10px 12px' }}>{formatThresholds(b.thresholds)}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--color-text-secondary)' }}>{scope}</td>
                  <td style={{ padding: '10px 12px', color: 'var(--color-text-secondary)' }}>
                    {notif.length ? notif.join(' · ') : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default GCPBudgetsPanel;

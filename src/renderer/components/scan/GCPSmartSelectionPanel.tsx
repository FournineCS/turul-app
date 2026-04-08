// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React, { useState } from 'react';
import type { GCPServiceType, GCPServiceDiscoveryResult } from '../../../shared/types';
import { GCP_SERVICE_NAMES } from '../../../shared/types';

interface GCPSmartSelectionPanelProps {
  data: GCPServiceDiscoveryResult;
  selectedServices: GCPServiceType[];
  onSelectServices: (services: GCPServiceType[]) => void;
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDateRange(startDate: string, endDate: string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
  return `${start.toLocaleDateString('en-US', options)} – ${end.toLocaleDateString('en-US', options)}`;
}

export const GCPSmartSelectionPanel: React.FC<GCPSmartSelectionPanelProps> = ({
  data,
  selectedServices,
  onSelectServices,
}) => {
  const [showAll, setShowAll] = useState(false);

  const handleSelectAllActive = () => {
    onSelectServices(data.activeServices);
  };

  const displayedServices = showAll ? data.billingServices : data.billingServices.slice(0, 12);

  return (
    <div
      style={{
        backgroundColor: 'var(--color-bg-secondary)',
        border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)',
        padding: 16,
      }}
    >
      {/* Header row */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 16,
        }}
      >
        <div>
          <h4 style={{ margin: 0, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
            Billing Analysis
            <span
              style={{
                backgroundColor: 'var(--color-primary)',
                color: 'white',
                padding: '2px 8px',
                borderRadius: 4,
                fontSize: 12,
                fontWeight: 500,
                fontFamily: 'var(--font-mono)',
              }}
            >
              {formatCurrency(data.totalCost, data.currency)}
            </span>
          </h4>
          <p style={{ margin: 0, fontSize: 12, color: 'var(--color-text-secondary)' }}>
            {formatDateRange(data.startDate, data.endDate)}
          </p>
        </div>
        <button
          className="btn btn-sm btn-primary"
          onClick={handleSelectAllActive}
          disabled={data.activeServices.length === 0}
        >
          Select Active ({data.activeServices.length})
        </button>
      </div>

      {/* Billing services table */}
      {data.billingServices.length > 0 ? (
        <div style={{ marginBottom: 16 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                <th style={{ textAlign: 'left', padding: '8px 0', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                  Service
                </th>
                <th style={{ textAlign: 'right', padding: '8px 0', color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                  Net Cost
                </th>
                <th style={{ textAlign: 'center', padding: '8px 0', width: 90, color: 'var(--color-text-secondary)', fontWeight: 500 }}>
                  Scannable
                </th>
              </tr>
            </thead>
            <tbody>
              {displayedServices.map((svc, i) => {
                const hasScanners = svc.scannerTypes.length > 0;
                const anySelected = svc.scannerTypes.some((st) => selectedServices.includes(st));

                return (
                  <tr
                    key={i}
                    style={{
                      borderBottom: '1px solid var(--color-border-subtle)',
                      backgroundColor: anySelected
                        ? 'var(--color-primary-soft)'
                        : 'transparent',
                      transition: 'background-color 0.15s ease',
                    }}
                  >
                    <td style={{ padding: '8px 0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {hasScanners && (
                          <span
                            style={{
                              width: 7,
                              height: 7,
                              borderRadius: '50%',
                              backgroundColor: 'var(--color-success)',
                              flexShrink: 0,
                            }}
                          />
                        )}
                        <span style={{ color: hasScanners ? 'var(--color-text)' : 'var(--color-text-secondary)' }}>
                          {svc.service}
                        </span>
                      </div>
                    </td>
                    <td
                      style={{
                        textAlign: 'right',
                        padding: '8px 0',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 12,
                        color: 'var(--color-text)',
                      }}
                    >
                      {formatCurrency(svc.cost, svc.currency)}
                    </td>
                    <td style={{ textAlign: 'center', padding: '8px 0' }}>
                      {hasScanners ? (
                        <span
                          style={{
                            backgroundColor: 'var(--color-success-glow)',
                            color: 'var(--color-success)',
                            padding: '2px 8px',
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 500,
                          }}
                        >
                          Yes
                        </span>
                      ) : (
                        <span style={{ color: 'var(--color-text-muted)', fontSize: 11 }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {data.billingServices.length > 12 && (
            <button
              onClick={() => setShowAll(!showAll)}
              style={{
                margin: '8px 0 0',
                padding: 0,
                fontSize: 12,
                color: 'var(--color-primary)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {showAll ? 'Show less' : `+ ${data.billingServices.length - 12} more services`}
            </button>
          )}
        </div>
      ) : (
        <div
          style={{
            padding: 24,
            textAlign: 'center',
            color: 'var(--color-text-secondary)',
          }}
        >
          <p style={{ margin: 0 }}>No billing data found for this project.</p>
          <p style={{ margin: '8px 0 0', fontSize: 12 }}>
            Ensure BigQuery billing export is enabled and data has populated.
          </p>
        </div>
      )}

      {/* Active scannable services chips */}
      {data.activeServices.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 6,
            padding: 12,
            backgroundColor: 'var(--color-bg-tertiary)',
            borderRadius: 'var(--radius-sm)',
          }}
        >
          <span
            style={{
              fontSize: 12,
              color: 'var(--color-text-secondary)',
              marginRight: 4,
              alignSelf: 'center',
            }}
          >
            Scannable:
          </span>
          {data.activeServices.map((serviceType) => (
            <span
              key={serviceType}
              style={{
                backgroundColor: selectedServices.includes(serviceType)
                  ? 'var(--color-primary)'
                  : 'var(--color-bg-secondary)',
                color: selectedServices.includes(serviceType) ? 'white' : 'var(--color-text)',
                padding: '3px 10px',
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 500,
                border: `1px solid ${selectedServices.includes(serviceType) ? 'var(--color-primary)' : 'var(--color-border)'}`,
                transition: 'all 0.15s ease',
              }}
            >
              {GCP_SERVICE_NAMES[serviceType] || serviceType}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default GCPSmartSelectionPanel;

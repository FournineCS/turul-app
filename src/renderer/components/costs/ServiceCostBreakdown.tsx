// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React, { useState, useMemo } from 'react';
import type { DetailedServiceCost, RegionCost } from '../../../shared/types';

interface ServiceCostBreakdownProps {
  byService: DetailedServiceCost[];
  byRegion: RegionCost[];
  isLoading: boolean;
}

type SortField = 'service' | 'cost' | 'percentChange';
type SortDirection = 'asc' | 'desc';

function formatCurrency(amount: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatPercentChange(change: number): string {
  const sign = change >= 0 ? '+' : '';
  return `${sign}${change.toFixed(1)}%`;
}

export const ServiceCostBreakdown: React.FC<ServiceCostBreakdownProps> = ({
  byService,
  byRegion,
  isLoading,
}) => {
  const [sortField, setSortField] = useState<SortField>('cost');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const sortedServices = useMemo(() => {
    return [...byService].sort((a, b) => {
      let aVal: number | string;
      let bVal: number | string;

      switch (sortField) {
        case 'service':
          aVal = a.service.toLowerCase();
          bVal = b.service.toLowerCase();
          break;
        case 'cost':
          aVal = a.cost;
          bVal = b.cost;
          break;
        case 'percentChange':
          aVal = a.percentChange;
          bVal = b.percentChange;
          break;
        default:
          return 0;
      }

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [byService, sortField, sortDirection]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const SortIndicator: React.FC<{ field: SortField }> = ({ field }) => {
    if (sortField !== field) return null;
    return <span style={{ marginLeft: 4 }}>{sortDirection === 'asc' ? '\u25B2' : '\u25BC'}</span>;
  };

  if (isLoading) {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, marginBottom: 24 }}>
        <div
          style={{
            backgroundColor: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            padding: 20,
          }}
        >
          <h3 style={{ margin: '0 0 16px 0', fontSize: 16 }}>Cost by Service</h3>
          <div
            style={{
              height: 200,
              backgroundColor: 'var(--color-bg-tertiary)',
              borderRadius: 4,
              animation: 'pulse 1.5s ease-in-out infinite',
            }}
          />
        </div>
        <div
          style={{
            backgroundColor: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            padding: 20,
          }}
        >
          <h3 style={{ margin: '0 0 16px 0', fontSize: 16 }}>Cost by Region</h3>
          <div
            style={{
              height: 200,
              backgroundColor: 'var(--color-bg-tertiary)',
              borderRadius: 4,
              animation: 'pulse 1.5s ease-in-out infinite',
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 24, marginBottom: 24 }}>
      {/* Service breakdown */}
      <div
        style={{
          backgroundColor: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border)',
          borderRadius: 8,
          padding: 20,
          maxHeight: 400,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <h3 style={{ margin: '0 0 16px 0', fontSize: 16 }}>Cost by Service</h3>
        {sortedServices.length === 0 ? (
          <div
            style={{
              padding: 24,
              textAlign: 'center',
              color: 'var(--color-text-secondary)',
            }}
          >
            No service cost data available.
          </div>
        ) : (
          <div style={{ overflowY: 'auto', flex: 1 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <th
                    onClick={() => handleSort('service')}
                    style={{
                      textAlign: 'left',
                      padding: '8px 0',
                      color: 'var(--color-text-secondary)',
                      cursor: 'pointer',
                      userSelect: 'none',
                    }}
                  >
                    Service
                    <SortIndicator field="service" />
                  </th>
                  <th
                    onClick={() => handleSort('cost')}
                    style={{
                      textAlign: 'right',
                      padding: '8px 0',
                      color: 'var(--color-text-secondary)',
                      cursor: 'pointer',
                      userSelect: 'none',
                    }}
                  >
                    Cost
                    <SortIndicator field="cost" />
                  </th>
                  <th
                    onClick={() => handleSort('percentChange')}
                    style={{
                      textAlign: 'right',
                      padding: '8px 0',
                      color: 'var(--color-text-secondary)',
                      cursor: 'pointer',
                      userSelect: 'none',
                      width: 100,
                    }}
                  >
                    Change
                    <SortIndicator field="percentChange" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedServices.slice(0, 20).map((service, index) => (
                  <tr key={index} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '10px 0', maxWidth: 300 }}>
                      <div
                        style={{
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                        title={service.service}
                      >
                        {service.service}
                      </div>
                    </td>
                    <td style={{ textAlign: 'right', padding: '10px 0', fontFamily: 'monospace' }}>
                      {formatCurrency(service.cost, service.currency)}
                    </td>
                    <td
                      style={{
                        textAlign: 'right',
                        padding: '10px 0',
                        fontFamily: 'monospace',
                        color:
                          service.percentChange > 0
                            ? 'var(--color-error)'
                            : service.percentChange < 0
                            ? 'var(--color-success)'
                            : 'var(--color-text-secondary)',
                      }}
                    >
                      {formatPercentChange(service.percentChange)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {sortedServices.length > 20 && (
              <p style={{ margin: '12px 0 0', fontSize: 12, color: 'var(--color-text-secondary)' }}>
                + {sortedServices.length - 20} more services
              </p>
            )}
          </div>
        )}
      </div>

      {/* Region breakdown */}
      <div
        style={{
          backgroundColor: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border)',
          borderRadius: 8,
          padding: 20,
          maxHeight: 400,
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <h3 style={{ margin: '0 0 16px 0', fontSize: 16 }}>Cost by Region</h3>
        {byRegion.length === 0 ? (
          <div
            style={{
              padding: 24,
              textAlign: 'center',
              color: 'var(--color-text-secondary)',
            }}
          >
            No region cost data available.
          </div>
        ) : (
          <div style={{ overflowY: 'auto', flex: 1 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <th
                    style={{
                      textAlign: 'left',
                      padding: '8px 0',
                      color: 'var(--color-text-secondary)',
                    }}
                  >
                    Region
                  </th>
                  <th
                    style={{
                      textAlign: 'right',
                      padding: '8px 0',
                      color: 'var(--color-text-secondary)',
                    }}
                  >
                    Cost
                  </th>
                </tr>
              </thead>
              <tbody>
                {byRegion.map((region, index) => (
                  <tr key={index} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '10px 0' }}>
                      {region.region === 'global' || region.region === '' ? 'Global' : region.region}
                    </td>
                    <td style={{ textAlign: 'right', padding: '10px 0', fontFamily: 'monospace' }}>
                      {formatCurrency(region.cost, region.currency)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default ServiceCostBreakdown;

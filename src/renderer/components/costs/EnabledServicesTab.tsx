// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React, { useState, useMemo, useEffect } from 'react';
import type { DetailedServiceCost, ServiceType, CostDateRange } from '../../../shared/types';

interface EnabledServicesTabProps {
  profile: string | null;
  dateRange: CostDateRange;
  customStartDate?: string | null;
  customEndDate?: string | null;
}

// Map AWS service names to our ServiceType for scannable detection
const SERVICE_TYPE_MAPPINGS: Record<string, ServiceType> = {
  'amazon elastic compute cloud - compute': 'ec2',
  'ec2 - other': 'ec2',
  'amazon ec2': 'ec2',
  'aws lambda': 'lambda',
  'amazon simple storage service': 's3',
  'amazon relational database service': 'rds',
  'amazon dynamodb': 'dynamodb',
  'amazon elastic container service': 'ecs',
  'amazon elastic kubernetes service': 'eks',
  'amazon elasticache': 'elasticache',
  'amazon elastic file system': 'efs',
  'elastic load balancing': 'alb',
  'amazon cloudfront': 'cloudfront',
  'amazon route 53': 'route53',
  'aws cloudformation': 'cloudformation',
  'amazon cloudwatch': 'cloudwatch',
  'aws glue': 'glue',
  'amazon athena': 'athena',
  'amazon simple notification service': 'sns',
  'amazon simple queue service': 'sqs',
  'aws step functions': 'stepfunctions',
  'amazon eventbridge': 'eventbridge',
  'amazon api gateway': 'apigateway',
  'aws secrets manager': 'secretsmanager',
  'aws key management service': 'kms',
  'amazon redshift': 'redshift',
  'amazon managed workflows for apache airflow': 'mwaa',
  'amazon virtual private cloud': 'vpc',
};

const SERVICE_DISPLAY_NAMES: Record<ServiceType, string> = {
  ec2: 'EC2',
  lambda: 'Lambda',
  s3: 'S3',
  rds: 'RDS',
  dynamodb: 'DynamoDB',
  ecs: 'ECS',
  eks: 'EKS',
  elasticache: 'ElastiCache',
  efs: 'EFS',
  alb: 'ALB/NLB',
  cloudfront: 'CloudFront',
  route53: 'Route 53',
  cloudformation: 'CloudFormation',
  cloudwatch: 'CloudWatch',
  glue: 'Glue',
  athena: 'Athena',
  sns: 'SNS',
  sqs: 'SQS',
  stepfunctions: 'Step Functions',
  eventbridge: 'EventBridge',
  apigateway: 'API Gateway',
  secretsmanager: 'Secrets Manager',
  kms: 'KMS',
  redshift: 'Redshift',
  mwaa: 'MWAA',
  vpc: 'VPC',
  subnet: 'Subnet',
  securityGroup: 'Security Group',
};

type SortField = 'service' | 'cost' | 'percentOfTotal' | 'percentChange';
type SortDirection = 'asc' | 'desc';
type FilterType = 'all' | 'scannable' | 'non-scannable';

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

function getScannableServiceType(serviceName: string): ServiceType | null {
  const lowerName = serviceName.toLowerCase();

  // Direct mapping lookup
  for (const [key, value] of Object.entries(SERVICE_TYPE_MAPPINGS)) {
    if (lowerName.includes(key) || key.includes(lowerName)) {
      return value;
    }
  }

  // Check if service name contains any ServiceType
  for (const serviceType of Object.keys(SERVICE_DISPLAY_NAMES) as ServiceType[]) {
    if (lowerName.includes(serviceType.toLowerCase())) {
      return serviceType;
    }
  }

  return null;
}

export const EnabledServicesTab: React.FC<EnabledServicesTabProps> = ({
  profile,
  dateRange,
  customStartDate,
  customEndDate,
}) => {
  const [services, setServices] = useState<DetailedServiceCost[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('cost');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');
  const [filter, setFilter] = useState<FilterType>('all');

  // Load services data
  useEffect(() => {
    const loadServices = async () => {
      if (!profile || !window.electronAPI?.cost) {
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const endDate = new Date();
        let startDate = new Date();
        let granularity: 'DAILY' | 'MONTHLY' = 'DAILY';

        switch (dateRange) {
          case '7d':
            startDate.setDate(startDate.getDate() - 7);
            break;
          case '30d':
            startDate.setDate(startDate.getDate() - 30);
            break;
          case '90d':
            startDate.setDate(startDate.getDate() - 90);
            granularity = 'MONTHLY';
            break;
          case '12m':
            startDate.setDate(startDate.getDate() - 365);
            granularity = 'MONTHLY';
            break;
          case 'custom':
            if (customStartDate && customEndDate) {
              const response = await window.electronAPI.cost.getAnalysis(
                profile,
                customStartDate,
                customEndDate,
                granularity
              );
              if (response.success && response.data) {
                setServices(response.data.byService);
              } else {
                setError(response.error || 'Failed to load services');
              }
              setIsLoading(false);
              return;
            }
            startDate.setDate(startDate.getDate() - 30);
            break;
          default:
            startDate.setDate(startDate.getDate() - 30);
        }

        const response = await window.electronAPI.cost.getAnalysis(
          profile,
          startDate.toISOString().split('T')[0],
          endDate.toISOString().split('T')[0],
          granularity
        );

        if (response.success && response.data) {
          setServices(response.data.byService);
        } else {
          setError(response.error || 'Failed to load services');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load services');
      } finally {
        setIsLoading(false);
      }
    };

    loadServices();
  }, [profile, dateRange, customStartDate, customEndDate]);

  // Calculate total cost for percentage calculation
  const totalCost = useMemo(() => {
    return services.reduce((sum, s) => sum + s.cost, 0);
  }, [services]);

  // Enrich services with scannable info
  const enrichedServices = useMemo(() => {
    return services.map((service) => ({
      ...service,
      scannableServiceType: getScannableServiceType(service.service),
      percentOfTotal: totalCost > 0 ? (service.cost / totalCost) * 100 : 0,
    }));
  }, [services, totalCost]);

  // Filter and sort services
  const filteredAndSortedServices = useMemo(() => {
    let filtered = enrichedServices;

    if (filter === 'scannable') {
      filtered = enrichedServices.filter((s) => s.scannableServiceType !== null);
    } else if (filter === 'non-scannable') {
      filtered = enrichedServices.filter((s) => s.scannableServiceType === null);
    }

    return [...filtered].sort((a, b) => {
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
        case 'percentOfTotal':
          aVal = a.percentOfTotal;
          bVal = b.percentOfTotal;
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
  }, [enrichedServices, filter, sortField, sortDirection]);

  // Calculate summary stats
  const stats = useMemo(() => {
    const scannableCount = enrichedServices.filter((s) => s.scannableServiceType !== null).length;
    const scannableCost = enrichedServices
      .filter((s) => s.scannableServiceType !== null)
      .reduce((sum, s) => sum + s.cost, 0);

    return {
      totalServices: enrichedServices.length,
      scannableCount,
      nonScannableCount: enrichedServices.length - scannableCount,
      totalCost,
      scannableCost,
    };
  }, [enrichedServices, totalCost]);

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
      <div
        style={{
          backgroundColor: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border)',
          borderRadius: 8,
          padding: 40,
          textAlign: 'center',
        }}
      >
        <div className="spinner" style={{ margin: '0 auto 16px' }} />
        <p style={{ color: 'var(--color-text-secondary)' }}>Loading services...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div
        style={{
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid #ef4444',
          borderRadius: 8,
          padding: 20,
        }}
      >
        <strong style={{ color: '#ef4444' }}>Error:</strong>{' '}
        <span style={{ color: 'var(--color-text)' }}>{error}</span>
      </div>
    );
  }

  return (
    <div>
      {/* Summary Stats */}
      <div className="stats-grid" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-value">{stats.totalServices}</div>
          <div className="stat-label">Total Services</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--color-success)' }}>
            {stats.scannableCount}
          </div>
          <div className="stat-label">Scannable Services</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{formatCurrency(stats.totalCost, 'USD')}</div>
          <div className="stat-label">Total Cost</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--color-success)' }}>
            {formatCurrency(stats.scannableCost, 'USD')}
          </div>
          <div className="stat-label">Scannable Services Cost</div>
        </div>
      </div>

      {/* Filter Controls */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          marginBottom: 16,
        }}
      >
        <button
          className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setFilter('all')}
        >
          All ({stats.totalServices})
        </button>
        <button
          className={`btn btn-sm ${filter === 'scannable' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setFilter('scannable')}
        >
          Scannable ({stats.scannableCount})
        </button>
        <button
          className={`btn btn-sm ${filter === 'non-scannable' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setFilter('non-scannable')}
        >
          Non-Scannable ({stats.nonScannableCount})
        </button>
      </div>

      {/* Services Table */}
      <div
        style={{
          backgroundColor: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border)',
          borderRadius: 8,
          overflow: 'hidden',
        }}
      >
        {filteredAndSortedServices.length === 0 ? (
          <div
            style={{
              padding: 40,
              textAlign: 'center',
              color: 'var(--color-text-secondary)',
            }}
          >
            No services found for the selected filter.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--color-bg-tertiary)' }}>
                  <th
                    onClick={() => handleSort('service')}
                    style={{
                      textAlign: 'left',
                      padding: '12px 16px',
                      color: 'var(--color-text-secondary)',
                      cursor: 'pointer',
                      userSelect: 'none',
                      fontWeight: 600,
                      fontSize: 12,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}
                  >
                    Service
                    <SortIndicator field="service" />
                  </th>
                  <th
                    onClick={() => handleSort('cost')}
                    style={{
                      textAlign: 'right',
                      padding: '12px 16px',
                      color: 'var(--color-text-secondary)',
                      cursor: 'pointer',
                      userSelect: 'none',
                      fontWeight: 600,
                      fontSize: 12,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                    }}
                  >
                    Cost
                    <SortIndicator field="cost" />
                  </th>
                  <th
                    onClick={() => handleSort('percentOfTotal')}
                    style={{
                      textAlign: 'right',
                      padding: '12px 16px',
                      color: 'var(--color-text-secondary)',
                      cursor: 'pointer',
                      userSelect: 'none',
                      fontWeight: 600,
                      fontSize: 12,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      width: 100,
                    }}
                  >
                    % of Total
                    <SortIndicator field="percentOfTotal" />
                  </th>
                  <th
                    onClick={() => handleSort('percentChange')}
                    style={{
                      textAlign: 'right',
                      padding: '12px 16px',
                      color: 'var(--color-text-secondary)',
                      cursor: 'pointer',
                      userSelect: 'none',
                      fontWeight: 600,
                      fontSize: 12,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      width: 100,
                    }}
                  >
                    Change
                    <SortIndicator field="percentChange" />
                  </th>
                  <th
                    style={{
                      textAlign: 'center',
                      padding: '12px 16px',
                      color: 'var(--color-text-secondary)',
                      fontWeight: 600,
                      fontSize: 12,
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px',
                      width: 100,
                    }}
                  >
                    Scannable
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredAndSortedServices.map((service, index) => (
                  <tr
                    key={index}
                    style={{
                      borderBottom: '1px solid var(--color-border)',
                      backgroundColor:
                        service.scannableServiceType !== null
                          ? 'rgba(0, 186, 124, 0.05)'
                          : 'transparent',
                    }}
                  >
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {service.scannableServiceType && (
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              backgroundColor: 'var(--color-success)',
                              flexShrink: 0,
                            }}
                          />
                        )}
                        <div>
                          <div
                            style={{
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              maxWidth: 300,
                            }}
                            title={service.service}
                          >
                            {service.service}
                          </div>
                          {service.scannableServiceType && (
                            <div
                              style={{
                                fontSize: 11,
                                color: 'var(--color-text-secondary)',
                                marginTop: 2,
                              }}
                            >
                              Maps to: {SERVICE_DISPLAY_NAMES[service.scannableServiceType]}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td style={{ textAlign: 'right', padding: '12px 16px', fontFamily: 'monospace' }}>
                      {formatCurrency(service.cost, service.currency)}
                    </td>
                    <td style={{ textAlign: 'right', padding: '12px 16px', fontFamily: 'monospace' }}>
                      {service.percentOfTotal.toFixed(1)}%
                    </td>
                    <td
                      style={{
                        textAlign: 'right',
                        padding: '12px 16px',
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
                    <td style={{ textAlign: 'center', padding: '12px 16px' }}>
                      {service.scannableServiceType ? (
                        <span
                          style={{
                            backgroundColor: 'var(--color-success)',
                            color: 'white',
                            padding: '4px 8px',
                            borderRadius: 4,
                            fontSize: 11,
                            fontWeight: 500,
                          }}
                        >
                          Yes
                        </span>
                      ) : (
                        <span
                          style={{
                            color: 'var(--color-text-secondary)',
                            fontSize: 11,
                          }}
                        >
                          -
                        </span>
                      )}
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

export default EnabledServicesTab;

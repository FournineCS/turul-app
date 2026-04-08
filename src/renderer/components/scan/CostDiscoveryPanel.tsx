// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React, { useState } from 'react';
import type { CostDiscoveryResponse, ServiceType } from '../../../shared/types';

interface CostDiscoveryPanelProps {
  data: CostDiscoveryResponse;
  onSelectServices: (services: ServiceType[]) => void;
  selectedServices: ServiceType[];
}

// Map AWS service names to our ServiceType for display
const SERVICE_DISPLAY_NAMES: Record<string, string> = {
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

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatDateRange(startDate: string, endDate: string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const options: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
  return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}`;
}

export const CostDiscoveryPanel: React.FC<CostDiscoveryPanelProps> = ({
  data,
  onSelectServices,
  selectedServices,
}) => {
  const [showAllServices, setShowAllServices] = useState(false);

  const handleSelectAllWithUsage = () => {
    onSelectServices(data.activeServices);
  };

  const isServiceSelected = (serviceType: ServiceType): boolean => {
    return selectedServices.includes(serviceType);
  };

  // Filter services that have cost > 0 for display
  const servicesWithCost = data.services.filter((s) => s.cost > 0);
  const servicesWithoutCost = data.services.filter((s) => s.cost === 0);

  return (
    <div
      style={{
        backgroundColor: 'var(--color-bg-secondary)',
        border: '1px solid var(--color-border)',
        borderRadius: 8,
        padding: 16,
        marginBottom: 16,
      }}
    >
      {/* Header */}
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
            Cost Analysis
            <span
              style={{
                backgroundColor: 'var(--color-primary)',
                color: 'white',
                padding: '2px 8px',
                borderRadius: 4,
                fontSize: 12,
                fontWeight: 'normal',
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
          onClick={handleSelectAllWithUsage}
          disabled={data.activeServices.length === 0}
        >
          Select All with Usage ({data.activeServices.length})
        </button>
      </div>

      {/* Services with cost */}
      {servicesWithCost.length > 0 ? (
        <div style={{ marginBottom: 16 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                <th style={{ textAlign: 'left', padding: '8px 0', color: 'var(--color-text-secondary)' }}>
                  Service
                </th>
                <th style={{ textAlign: 'right', padding: '8px 0', color: 'var(--color-text-secondary)' }}>
                  Cost
                </th>
                <th style={{ textAlign: 'center', padding: '8px 0', width: 80, color: 'var(--color-text-secondary)' }}>
                  Scannable
                </th>
              </tr>
            </thead>
            <tbody>
              {(showAllServices ? servicesWithCost : servicesWithCost.slice(0, 15)).map((service, index) => {
                // Use the serviceType mapped by the backend
                const matchedServiceType = service.serviceType && data.activeServices.includes(service.serviceType)
                  ? service.serviceType
                  : undefined;

                return (
                  <tr
                    key={index}
                    style={{
                      borderBottom: '1px solid var(--color-border)',
                      backgroundColor:
                        matchedServiceType && isServiceSelected(matchedServiceType)
                          ? 'rgba(var(--color-primary-rgb), 0.1)'
                          : 'transparent',
                    }}
                  >
                    <td style={{ padding: '8px 0' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        {matchedServiceType && (
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
                        <span>{service.service}</span>
                      </div>
                    </td>
                    <td style={{ textAlign: 'right', padding: '8px 0', fontFamily: 'monospace' }}>
                      {formatCurrency(service.cost, service.currency)}
                    </td>
                    <td style={{ textAlign: 'center', padding: '8px 0' }}>
                      {matchedServiceType ? (
                        <span
                          style={{
                            backgroundColor: 'var(--color-success)',
                            color: 'white',
                            padding: '2px 6px',
                            borderRadius: 4,
                            fontSize: 11,
                          }}
                        >
                          Yes
                        </span>
                      ) : (
                        <span style={{ color: 'var(--color-text-secondary)', fontSize: 11 }}>-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {servicesWithCost.length > 15 && (
            <button
              onClick={() => setShowAllServices(!showAllServices)}
              style={{
                margin: '8px 0 0',
                padding: 0,
                fontSize: 12,
                color: 'var(--color-primary)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                textDecoration: 'none',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.textDecoration = 'underline')}
              onMouseLeave={(e) => (e.currentTarget.style.textDecoration = 'none')}
            >
              {showAllServices ? 'Show less' : `+ ${servicesWithCost.length - 15} more services`}
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
          <p style={{ margin: 0 }}>No cost data found for the selected period.</p>
          <p style={{ margin: '8px 0 0', fontSize: 12 }}>
            This may indicate no usage or Cost Explorer is not enabled.
          </p>
        </div>
      )}

      {/* Active services summary */}
      {data.activeServices.length > 0 && (
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            padding: 12,
            backgroundColor: 'var(--color-bg-tertiary)',
            borderRadius: 6,
          }}
        >
          <span style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginRight: 8 }}>
            Scannable services with usage:
          </span>
          {data.activeServices.map((serviceType) => (
            <span
              key={serviceType}
              style={{
                backgroundColor: isServiceSelected(serviceType)
                  ? 'var(--color-primary)'
                  : 'var(--color-bg-secondary)',
                color: isServiceSelected(serviceType) ? 'white' : 'var(--color-text)',
                padding: '2px 8px',
                borderRadius: 4,
                fontSize: 12,
                border: '1px solid var(--color-border)',
              }}
            >
              {SERVICE_DISPLAY_NAMES[serviceType] || serviceType.toUpperCase()}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

export default CostDiscoveryPanel;

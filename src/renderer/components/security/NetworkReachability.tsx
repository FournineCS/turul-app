// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React, { useState } from 'react';
import type { NetworkReachabilityResult, ExposedResource } from '../../../shared/types';

interface Props {
  result: NetworkReachabilityResult | null;
  isLoading: boolean;
  onAnalyze: () => void;
  error: string | null;
}

const severityColors: Record<string, string> = {
  CRITICAL: 'var(--color-error)',
  HIGH: '#ff9800',
  MEDIUM: 'var(--color-warning)',
  LOW: 'var(--color-text-secondary)',
};

const NetworkReachability: React.FC<Props> = ({ result, isLoading, onAnalyze, error }) => {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <p className="text-secondary" style={{ fontSize: 13 }}>
          Traces internet exposure paths: Internet Gateway &rarr; Route Table &rarr; Subnet &rarr; NACL &rarr; Security Group &rarr; Instance
        </p>
        <button className="btn btn-primary" onClick={onAnalyze} disabled={isLoading}>
          {isLoading ? 'Analyzing...' : 'Analyze Reachability'}
        </button>
      </div>

      {error && (
        <div className="card mb-4" style={{ borderColor: 'var(--color-error)' }}>
          <span style={{ color: 'var(--color-error)' }}>{error}</span>
        </div>
      )}

      {result && (
        <>
          {/* Summary stats */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-value">{result.vpcCount}</div>
              <div className="stat-label">VPCs</div>
            </div>
            <div className="stat-card">
              <div className="stat-value">{result.publicSubnetCount} / {result.subnetCount}</div>
              <div className="stat-label">Public Subnets</div>
            </div>
            <div className="stat-card">
              <div className="stat-value" style={{ color: 'var(--color-error)' }}>
                {result.exposedResources.length}
              </div>
              <div className="stat-label">Exposed Resources</div>
            </div>
            <div className="stat-card">
              <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
                {result.criticalCount > 0 && (
                  <span style={{ color: severityColors.CRITICAL, fontWeight: 700, fontSize: 20 }}>
                    {result.criticalCount}
                  </span>
                )}
                {result.highCount > 0 && (
                  <span style={{ color: severityColors.HIGH, fontWeight: 700, fontSize: 20 }}>
                    {result.highCount}
                  </span>
                )}
                {result.mediumCount > 0 && (
                  <span style={{ color: severityColors.MEDIUM, fontWeight: 700, fontSize: 20 }}>
                    {result.mediumCount}
                  </span>
                )}
              </div>
              <div className="stat-label">C / H / M</div>
            </div>
          </div>

          {/* Exposed resources table */}
          {result.exposedResources.length > 0 ? (
            <div className="card">
              <h3 className="card-title mb-4">Exposed Resources</h3>
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Severity</th>
                      <th>Resource</th>
                      <th>Public IP</th>
                      <th>Open Ports</th>
                      <th>VPC</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.exposedResources.map((res) => (
                      <React.Fragment key={res.resourceId}>
                        <tr>
                          <td>
                            <span
                              className="badge"
                              style={{
                                background: severityColors[res.severity],
                                color: '#fff', fontSize: 11,
                              }}
                            >
                              {res.severity}
                            </span>
                          </td>
                          <td>
                            <div>{res.name || res.resourceId}</div>
                            <div className="text-secondary" style={{ fontSize: 11 }}>
                              {res.resourceType}
                            </div>
                          </td>
                          <td style={{ fontFamily: 'monospace', fontSize: 12 }}>
                            {res.publicIp || '-'}
                          </td>
                          <td>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                              {res.openPorts.slice(0, 5).map((p, i) => (
                                <span
                                  key={i}
                                  className="badge"
                                  style={{
                                    fontSize: 10, padding: '1px 6px',
                                    background: 'var(--color-bg-tertiary)',
                                    border: '1px solid var(--color-border)',
                                  }}
                                >
                                  {p.fromPort === p.toPort ? p.fromPort : `${p.fromPort}-${p.toPort}`}
                                </span>
                              ))}
                              {res.openPorts.length > 5 && (
                                <span className="text-secondary" style={{ fontSize: 10 }}>
                                  +{res.openPorts.length - 5} more
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ fontSize: 11 }}>{res.vpcId}</td>
                          <td>
                            <button
                              className="btn btn-sm btn-secondary"
                              onClick={() =>
                                setExpandedId(expandedId === res.resourceId ? null : res.resourceId)
                              }
                            >
                              {expandedId === res.resourceId ? 'Hide' : 'Path'}
                            </button>
                          </td>
                        </tr>
                        {expandedId === res.resourceId && (
                          <tr>
                            <td colSpan={6} style={{ padding: '12px 16px', background: 'var(--color-bg-tertiary)' }}>
                              <ExposurePathView resource={res} />
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="card">
              <div className="empty-state" style={{ padding: 40 }}>
                <h3 style={{ color: 'var(--color-success)' }}>No exposed resources found</h3>
                <p>No EC2 instances are directly reachable from the internet in this region.</p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

const ExposurePathView: React.FC<{ resource: ExposedResource }> = ({ resource }) => {
  const stepIcons: Record<string, string> = {
    igw: 'Internet GW',
    route_table: 'Route Table',
    subnet: 'Subnet',
    nacl: 'NACL',
    security_group: 'Security Group',
    instance: 'Instance',
  };

  return (
    <div>
      <p className="text-secondary" style={{ fontSize: 12, marginBottom: 8 }}>Exposure Path:</p>
      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 4 }}>
        <span style={{
          padding: '4px 10px', borderRadius: 4, fontSize: 11,
          background: 'var(--color-error)', color: '#fff', fontWeight: 600,
        }}>
          Internet
        </span>
        {resource.exposurePath.map((step, i) => (
          <React.Fragment key={i}>
            <span style={{ color: 'var(--color-text-secondary)', fontSize: 16 }}>&rarr;</span>
            <span
              style={{
                padding: '4px 10px', borderRadius: 4, fontSize: 11,
                background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)',
              }}
              title={step.detail}
            >
              <strong>{stepIcons[step.type] || step.type}</strong>
              <br />
              <span className="text-secondary" style={{ fontSize: 10 }}>
                {step.name || step.id}
              </span>
            </span>
          </React.Fragment>
        ))}
        <span style={{ color: 'var(--color-text-secondary)', fontSize: 16 }}>&rarr;</span>
        <span style={{
          padding: '4px 10px', borderRadius: 4, fontSize: 11,
          background: severityColors[resource.severity] + '22',
          border: `1px solid ${severityColors[resource.severity]}`,
          fontWeight: 600,
        }}>
          {resource.name || resource.resourceId}
        </span>
      </div>
      <div style={{ marginTop: 8 }}>
        <p className="text-secondary" style={{ fontSize: 11 }}>Open Ports:</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
          {resource.openPorts.map((p, i) => (
            <span key={i} style={{
              padding: '2px 8px', borderRadius: 3, fontSize: 11,
              background: 'var(--color-bg-secondary)', border: '1px solid var(--color-border)',
            }}>
              {p.protocol.toUpperCase()} {p.fromPort === p.toPort ? p.fromPort : `${p.fromPort}-${p.toPort}`} from {p.source}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
};

export default NetworkReachability;

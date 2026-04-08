// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React from 'react';
import type { TagServiceCompliance } from '../../../shared/types';

interface Props {
  byService: TagServiceCompliance[];
  overallPercent: number;
}

const TagComplianceReport: React.FC<Props> = ({ byService, overallPercent }) => {
  return (
    <div className="card mb-4">
      <div className="card-header">
        <h3 className="card-title">Compliance by Service</h3>
        <span className="badge" style={{
          background: overallPercent >= 80 ? 'var(--color-success)' :
                      overallPercent >= 50 ? 'var(--color-warning)' : 'var(--color-error)',
          color: '#fff',
        }}>
          {overallPercent}% Overall
        </span>
      </div>
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Service</th>
              <th>Total</th>
              <th>Compliant</th>
              <th>Compliance</th>
              <th style={{ width: '30%' }}>Progress</th>
            </tr>
          </thead>
          <tbody>
            {byService.map((svc) => (
              <tr key={svc.service}>
                <td>{svc.service}</td>
                <td>{svc.totalResources}</td>
                <td>{svc.compliantResources}</td>
                <td>
                  <span style={{
                    color: svc.compliancePercent >= 80 ? 'var(--color-success)' :
                           svc.compliancePercent >= 50 ? 'var(--color-warning)' : 'var(--color-error)',
                    fontWeight: 600,
                  }}>
                    {svc.compliancePercent}%
                  </span>
                </td>
                <td>
                  <div style={{ height: 6, background: 'var(--color-border)', borderRadius: 3 }}>
                    <div style={{
                      width: `${svc.compliancePercent}%`, height: '100%', borderRadius: 3,
                      background: svc.compliancePercent >= 80 ? 'var(--color-success)' :
                                  svc.compliancePercent >= 50 ? 'var(--color-warning)' : 'var(--color-error)',
                      transition: 'width 0.3s ease',
                    }} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default TagComplianceReport;

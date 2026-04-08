// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React from 'react';
import type { ScanSchedule } from '../../../shared/types';

interface ScheduleListProps {
  schedules: ScanSchedule[];
  onToggle: (id: string, enabled: boolean) => void;
  onDelete: (id: string) => void;
}

const frequencyLabels: Record<string, string> = {
  hourly: 'Every hour',
  daily: 'Every day',
  weekly: 'Every week',
};

const ScheduleList: React.FC<ScheduleListProps> = ({ schedules, onToggle, onDelete }) => {
  if (schedules.length === 0) {
    return (
      <div className="card">
        <div className="empty-state">
          <p>No schedules created yet. Create one above to automate your scans.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h3 className="card-title mb-4">Active Schedules</h3>
      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Profile</th>
              <th>Frequency</th>
              <th>Regions</th>
              <th>Services</th>
              <th>Last Run</th>
              <th>Next Run</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {schedules.map((schedule) => (
              <tr key={schedule.id}>
                <td>
                  <strong>{schedule.name}</strong>
                  {schedule.autoAssess && (
                    <span
                      className="badge badge-info"
                      style={{ marginLeft: 6, fontSize: 10 }}
                    >
                      Auto-assess
                    </span>
                  )}
                </td>
                <td>{schedule.profileName}</td>
                <td>{frequencyLabels[schedule.frequency] || schedule.frequency}</td>
                <td>
                  <span title={schedule.regions.join(', ')}>
                    {schedule.regions.length} region{schedule.regions.length !== 1 ? 's' : ''}
                  </span>
                </td>
                <td>
                  <span title={schedule.services.join(', ')}>
                    {schedule.services.length} service{schedule.services.length !== 1 ? 's' : ''}
                  </span>
                </td>
                <td>
                  {schedule.lastRunAt
                    ? new Date(schedule.lastRunAt).toLocaleString()
                    : 'Never'}
                </td>
                <td>
                  {schedule.nextRunAt
                    ? new Date(schedule.nextRunAt).toLocaleString()
                    : '-'}
                </td>
                <td>
                  <span className={`badge ${schedule.enabled ? 'badge-success' : 'badge-warning'}`}>
                    {schedule.enabled ? 'Active' : 'Paused'}
                  </span>
                </td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      className={`btn btn-sm ${schedule.enabled ? 'btn-secondary' : 'btn-primary'}`}
                      onClick={() => onToggle(schedule.id, !schedule.enabled)}
                      title={schedule.enabled ? 'Pause schedule' : 'Enable schedule'}
                    >
                      {schedule.enabled ? 'Pause' : 'Enable'}
                    </button>
                    <button
                      className="btn btn-sm btn-secondary"
                      style={{ color: 'var(--color-error)' }}
                      onClick={() => onDelete(schedule.id)}
                      title="Delete schedule"
                    >
                      Delete
                    </button>
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

export default ScheduleList;

// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React, { useEffect } from 'react';
import { useScheduleStore } from '../stores/scheduleStore';
import ScheduleForm from '../components/schedule/ScheduleForm';
import ScheduleList from '../components/schedule/ScheduleList';

const SchedulePage: React.FC = () => {
  const {
    schedules, isLoading, error,
    loadSchedules, createSchedule, toggleSchedule, deleteSchedule, clearError,
  } = useScheduleStore();

  useEffect(() => {
    loadSchedules();
  }, [loadSchedules]);

  return (
    <>
      <header className="page-header">
        <h1 className="page-title">Scan Schedules</h1>
      </header>

      <div className="page-content">
        {error && (
          <div className="card mb-4" style={{ borderColor: 'var(--color-error)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--color-error)' }}>{error}</span>
              <button className="btn btn-sm btn-secondary" onClick={clearError}>Dismiss</button>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="loading-overlay">
            <div className="spinner" />
            <p>Loading schedules...</p>
          </div>
        )}

        <ScheduleForm onSubmit={createSchedule} />
        <ScheduleList
          schedules={schedules}
          onToggle={toggleSchedule}
          onDelete={deleteSchedule}
        />
      </div>
    </>
  );
};

export default SchedulePage;

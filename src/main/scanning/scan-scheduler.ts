// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import crypto from 'crypto';
import { Notification } from 'electron';
import type { ScanSchedule, ScanScheduleConfig, ScheduleFrequency, ServiceType, GCPServiceType } from '../../shared/types';
import { DatabaseManager } from '../database/db-manager';
import { getScanOrchestrator } from './scan-orchestrator';
import { getGCPScanOrchestrator } from './gcp-scan-orchestrator';

const FREQUENCY_MS: Record<ScheduleFrequency, number> = {
  hourly: 60 * 60 * 1000,
  daily: 24 * 60 * 60 * 1000,
  weekly: 7 * 24 * 60 * 60 * 1000,
};

export class ScanScheduler {
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private db: DatabaseManager;

  constructor(db: DatabaseManager) {
    this.db = db;
  }

  /** Load all enabled schedules and start timers */
  start(): void {
    const schedules = this.getAll();
    for (const schedule of schedules) {
      if (schedule.enabled) {
        this.scheduleNext(schedule);
      }
    }
  }

  stop(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }

  create(config: ScanScheduleConfig): ScanSchedule {
    const id = crypto.randomUUID();
    const nextRunAt = this.computeNextRun(config.frequency);

    this.db.createSchedule({
      id,
      name: config.name,
      profileName: config.profileName,
      regions: config.regions,
      services: config.services,
      frequency: config.frequency,
      autoAssess: config.autoAssess,
      nextRunAt: nextRunAt.toISOString(),
      provider: config.provider || 'aws',
      projectId: config.projectId,
    });

    const schedule = this.mapRaw(this.db.getAllSchedules().find((s) => s.id === id)!);
    this.scheduleNext(schedule);
    return schedule;
  }

  toggle(id: string, enabled: boolean): void {
    this.db.updateScheduleEnabled(id, enabled);
    if (!enabled) {
      const timer = this.timers.get(id);
      if (timer) {
        clearTimeout(timer);
        this.timers.delete(id);
      }
    } else {
      const schedules = this.getAll();
      const schedule = schedules.find((s) => s.id === id);
      if (schedule) this.scheduleNext(schedule);
    }
  }

  delete(id: string): void {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
    this.db.deleteSchedule(id);
  }

  getAll(): ScanSchedule[] {
    return this.db.getAllSchedules().map(this.mapRaw);
  }

  private scheduleNext(schedule: ScanSchedule): void {
    // Clear existing timer
    const existing = this.timers.get(schedule.id);
    if (existing) clearTimeout(existing);

    const nextRun = schedule.nextRunAt ? new Date(schedule.nextRunAt) : this.computeNextRun(schedule.frequency);
    const delay = Math.max(0, nextRun.getTime() - Date.now());

    const timer = setTimeout(() => {
      this.executeScan(schedule);
    }, delay);

    this.timers.set(schedule.id, timer);
  }

  private async executeScan(schedule: ScanSchedule): Promise<void> {
    if (schedule.provider === 'gcp') {
      await this.executeGCPScan(schedule);
      return;
    }

    const orchestrator = getScanOrchestrator();
    if (!orchestrator) {
      console.warn(`ScanScheduler: orchestrator not available for schedule ${schedule.name}`);
      return;
    }

    // Skip if a scan is already running
    if (orchestrator.isScanning()) {
      // Re-schedule for 5 minutes later
      const nextRun = new Date(Date.now() + 5 * 60 * 1000);
      this.db.updateScheduleLastRun(schedule.id, new Date().toISOString(), nextRun.toISOString());
      this.scheduleNext({ ...schedule, nextRunAt: nextRun.toISOString() });
      return;
    }

    try {
      await orchestrator.startScan({
        profileName: schedule.profileName,
        regions: schedule.regions,
        services: schedule.services as ServiceType[],
        includeGlobal: true,
      });

      // Show notification
      try {
        new Notification({
          title: 'Scheduled Scan Complete',
          body: `Scan "${schedule.name}" completed successfully.`,
        }).show();
      } catch {
        // Notifications may not be available in all environments
      }
    } catch (err) {
      console.error(`ScanScheduler: scan "${schedule.name}" failed:`, err);
    }

    // Schedule next run
    const nextRun = this.computeNextRun(schedule.frequency);
    this.db.updateScheduleLastRun(schedule.id, new Date().toISOString(), nextRun.toISOString());
    this.scheduleNext({ ...schedule, nextRunAt: nextRun.toISOString() });
  }

  private async executeGCPScan(schedule: ScanSchedule): Promise<void> {
    const orchestrator = getGCPScanOrchestrator(this.db);
    if (!orchestrator) {
      console.warn(`ScanScheduler: GCP orchestrator not available for schedule ${schedule.name}`);
      return;
    }

    const projectId = schedule.projectId;
    if (!projectId) {
      console.warn(`ScanScheduler: no projectId for GCP schedule ${schedule.name}`);
      return;
    }

    try {
      await orchestrator.startScan({
        projectId,
        services: schedule.services as GCPServiceType[],
      });

      try {
        new Notification({
          title: 'Scheduled GCP Scan Complete',
          body: `GCP scan "${schedule.name}" for project ${projectId} completed.`,
        }).show();
      } catch {
        // Notifications may not be available
      }
    } catch (err) {
      console.error(`ScanScheduler: GCP scan "${schedule.name}" failed:`, err);
    }

    const nextRun = this.computeNextRun(schedule.frequency);
    this.db.updateScheduleLastRun(schedule.id, new Date().toISOString(), nextRun.toISOString());
    this.scheduleNext({ ...schedule, nextRunAt: nextRun.toISOString() });
  }

  private computeNextRun(frequency: ScheduleFrequency): Date {
    return new Date(Date.now() + FREQUENCY_MS[frequency]);
  }

  private mapRaw(raw: {
    id: string; name: string; profile_name: string;
    regions: string; services: string; frequency: string;
    enabled: number; auto_assess: number;
    last_run_at: string | null; next_run_at: string | null;
    created_at: string;
    provider?: string; project_id?: string | null;
  }): ScanSchedule {
    return {
      id: raw.id,
      name: raw.name,
      profileName: raw.profile_name,
      regions: JSON.parse(raw.regions),
      services: JSON.parse(raw.services),
      frequency: raw.frequency as ScheduleFrequency,
      enabled: raw.enabled === 1,
      autoAssess: raw.auto_assess === 1,
      lastRunAt: raw.last_run_at || undefined,
      nextRunAt: raw.next_run_at || undefined,
      createdAt: raw.created_at,
      provider: (raw.provider as 'aws' | 'gcp') || 'aws',
      projectId: raw.project_id || undefined,
    };
  }
}

let schedulerInstance: ScanScheduler | null = null;

export function initScheduler(db: DatabaseManager): ScanScheduler {
  schedulerInstance = new ScanScheduler(db);
  schedulerInstance.start();
  return schedulerInstance;
}

export function getScheduler(): ScanScheduler | null {
  return schedulerInstance;
}

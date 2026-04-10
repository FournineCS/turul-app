// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import crypto from 'crypto';
import Database from 'better-sqlite3';
import path from 'path';
import type {
  Scan,
  Resource,
  Relationship,
  ScanStatus,
  ServiceType,
  GCPServiceType,
  CloudProvider,
  RelationshipType,
  AssessmentResult,
  AssessmentSummary,
  AppProfileSummary,
  AppProfileCredentialType,
  GCPOptimizationSnapshot,
  GCPCostCacheEntry,
  GCPAssessmentResult,
  GCPAssessmentSummary,
  GCPIAMAnalysisResult,
  GCPIAMAnalysisSummary,
  SecurityAnalysisResult,
  GCPSecurityScanSummary,
  ComplianceAssessmentResult,
  GCPComplianceSummary,
  GCPWAScanResult,
  GCPWellArchitectedSummary,
  GCPLabelComplianceResult,
  GCPLabelComplianceSummary,
  GCPNetworkAnalysisResult,
  GCPNetworkAnalysisSummary,
} from '../../shared/types';
import { encrypt, decrypt, type EncryptedData } from '../auth/crypto-service';

function getDefaultDbDir(): string {
  try {
    // Try Electron's app module (will throw if not running in Electron)
    const { app } = require('electron');
    return app?.getPath('userData') || process.cwd();
  } catch {
    return process.cwd();
  }
}

function safeParse<T>(json: string | null | undefined, fallback: T): T {
  if (!json) return fallback;
  try { return JSON.parse(json) as T; } catch { return fallback; }
}

export class DatabaseManager {
  private db: Database.Database | null = null;
  private dbPath: string;


  constructor(customDbDir?: string) {
    const userDataPath = customDbDir || getDefaultDbDir();
    this.dbPath = path.join(userDataPath, 'aws-analyzer.db');
  }

  getDbPath(): string {
    return this.dbPath;
  }

  async initialize(): Promise<void> {
    this.db = new Database(this.dbPath);

    // Enable WAL mode for better performance
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('wal_autocheckpoint = 1000');
    this.db.pragma('foreign_keys = ON');

    this.runMigrations();
  }

  private runMigrations(): void {
    if (!this.db) throw new Error('Database not initialized');

    // Create migrations table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const migrations = [
      {
        name: '001_initial_schema',
        sql: `
          -- Scan sessions
          CREATE TABLE IF NOT EXISTS scans (
            id TEXT PRIMARY KEY,
            profile TEXT NOT NULL,
            regions TEXT NOT NULL,
            services TEXT NOT NULL,
            started_at DATETIME NOT NULL,
            completed_at DATETIME,
            status TEXT NOT NULL DEFAULT 'pending',
            resource_count INTEGER DEFAULT 0,
            error TEXT
          );

          -- Resources
          CREATE TABLE IF NOT EXISTS resources (
            id TEXT PRIMARY KEY,
            scan_id TEXT NOT NULL,
            service TEXT NOT NULL,
            resource_type TEXT NOT NULL,
            region TEXT NOT NULL,
            name TEXT,
            tags TEXT,
            data TEXT,
            created_at DATETIME,
            FOREIGN KEY (scan_id) REFERENCES scans(id) ON DELETE CASCADE
          );

          -- Relationships
          CREATE TABLE IF NOT EXISTS relationships (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            scan_id TEXT NOT NULL,
            source_arn TEXT NOT NULL,
            target_arn TEXT NOT NULL,
            relationship_type TEXT NOT NULL,
            FOREIGN KEY (scan_id) REFERENCES scans(id) ON DELETE CASCADE
          );

          -- Indexes for performance
          CREATE INDEX IF NOT EXISTS idx_resources_scan_id ON resources(scan_id);
          CREATE INDEX IF NOT EXISTS idx_resources_service ON resources(service);
          CREATE INDEX IF NOT EXISTS idx_resources_region ON resources(region);
          CREATE INDEX IF NOT EXISTS idx_relationships_scan_id ON relationships(scan_id);
          CREATE INDEX IF NOT EXISTS idx_relationships_source ON relationships(source_arn);
          CREATE INDEX IF NOT EXISTS idx_relationships_target ON relationships(target_arn);
        `,
      },
      {
        name: '002_assessments_table',
        sql: `
          CREATE TABLE IF NOT EXISTS assessments (
            id TEXT PRIMARY KEY,
            profile TEXT NOT NULL,
            region TEXT NOT NULL,
            account_id TEXT,
            timestamp DATETIME NOT NULL,
            overall_score REAL NOT NULL,
            overall_grade TEXT NOT NULL,
            total_recommendations INTEGER NOT NULL DEFAULT 0,
            critical_count INTEGER NOT NULL DEFAULT 0,
            high_count INTEGER NOT NULL DEFAULT 0,
            medium_count INTEGER NOT NULL DEFAULT 0,
            low_count INTEGER NOT NULL DEFAULT 0,
            duration INTEGER NOT NULL DEFAULT 0,
            data TEXT NOT NULL
          );

          CREATE INDEX IF NOT EXISTS idx_assessments_timestamp ON assessments(timestamp);
          CREATE INDEX IF NOT EXISTS idx_assessments_profile ON assessments(profile);
        `,
      },
      {
        name: '006_scan_groups',
        sql: `
          CREATE TABLE IF NOT EXISTS scan_groups (
            id TEXT PRIMARY KEY,
            profile_names TEXT NOT NULL DEFAULT '[]',
            regions TEXT NOT NULL DEFAULT '[]',
            services TEXT NOT NULL DEFAULT '[]',
            started_at DATETIME NOT NULL,
            completed_at DATETIME,
            status TEXT NOT NULL DEFAULT 'pending'
          );
          -- Add group_id column to scans if not exists
          -- SQLite ALTER TABLE ADD COLUMN is idempotent-safe
          ALTER TABLE scans ADD COLUMN group_id TEXT REFERENCES scan_groups(id);
        `,
      },
      {
        name: '005_scan_schedules',
        sql: `
          CREATE TABLE IF NOT EXISTS scan_schedules (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            profile_name TEXT NOT NULL,
            regions TEXT NOT NULL DEFAULT '[]',
            services TEXT NOT NULL DEFAULT '[]',
            frequency TEXT NOT NULL CHECK(frequency IN ('hourly', 'daily', 'weekly')),
            enabled INTEGER NOT NULL DEFAULT 1,
            auto_assess INTEGER NOT NULL DEFAULT 0,
            last_run_at DATETIME,
            next_run_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );
        `,
      },
      {
        name: '004_tag_governance',
        sql: `
          CREATE TABLE IF NOT EXISTS tag_governance_config (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            required_tags TEXT NOT NULL DEFAULT '[]',
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );
          INSERT OR IGNORE INTO tag_governance_config (id, required_tags) VALUES (1, '[]');
        `,
      },
      {
        name: '007_cloud_provider_support',
        sql: `
          ALTER TABLE scans ADD COLUMN cloud_provider TEXT NOT NULL DEFAULT 'aws';
          ALTER TABLE resources ADD COLUMN cloud_provider TEXT NOT NULL DEFAULT 'aws';
          CREATE INDEX IF NOT EXISTS idx_scans_cloud_provider ON scans(cloud_provider);
          CREATE INDEX IF NOT EXISTS idx_resources_cloud_provider ON resources(cloud_provider);
        `,
      },
      {
        name: '008_gcp_optimization_snapshots',
        sql: `
          CREATE TABLE IF NOT EXISTS gcp_optimization_snapshots (
            id TEXT PRIMARY KEY,
            scope TEXT NOT NULL,
            identity TEXT NOT NULL,
            scanned_at DATETIME NOT NULL,
            total_savings REAL DEFAULT 0,
            rec_count INTEGER DEFAULT 0,
            vm_count INTEGER DEFAULT 0,
            resource_findings_count INTEGER DEFAULT 0,
            data TEXT NOT NULL
          );
          CREATE INDEX IF NOT EXISTS idx_gcp_opt_snapshots_identity ON gcp_optimization_snapshots(identity, scanned_at DESC);
        `,
      },
      {
        name: '009_schedule_index_and_cleanup',
        sql: `
          CREATE INDEX IF NOT EXISTS idx_scan_schedules_enabled ON scan_schedules(enabled, next_run_at);
        `,
      },
      {
        name: '010_chat_tables',
        sql: `
          CREATE TABLE IF NOT EXISTS chat_conversations (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            provider TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );

          CREATE TABLE IF NOT EXISTS chat_messages (
            id TEXT PRIMARY KEY,
            conversation_id TEXT NOT NULL,
            role TEXT NOT NULL,
            content TEXT NOT NULL DEFAULT '',
            tool_name TEXT,
            tool_input TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (conversation_id) REFERENCES chat_conversations(id) ON DELETE CASCADE
          );

          CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation ON chat_messages(conversation_id, created_at);
        `,
      },
      {
        name: '003_auth_and_app_profiles',
        sql: `
          CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );

          CREATE TABLE IF NOT EXISTS app_profiles (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL UNIQUE,
            credential_type TEXT NOT NULL CHECK(credential_type IN ('iam_keys', 'sso_config', 'assume_role')),
            region TEXT,
            encrypted_access_key_id TEXT,
            encrypted_secret_access_key TEXT,
            encrypted_session_token TEXT,
            sso_start_url TEXT,
            sso_region TEXT,
            sso_account_id TEXT,
            sso_role_name TEXT,
            assume_role_arn TEXT,
            encrypted_external_id TEXT,
            source_profile TEXT,
            description TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );
          CREATE INDEX IF NOT EXISTS idx_app_profiles_name ON app_profiles(name);
        `,
      },
      {
        name: '011_chat_tool_use_id',
        sql: `
          ALTER TABLE chat_messages ADD COLUMN tool_use_id TEXT;
        `,
      },
      {
        name: '012_gcp_cost_cache',
        sql: `
          CREATE TABLE IF NOT EXISTS gcp_cost_cache (
            id TEXT PRIMARY KEY,
            data_type TEXT NOT NULL CHECK(data_type IN ('cost_analysis', 'gke_cost')),
            scope TEXT NOT NULL CHECK(scope IN ('project', 'org')),
            identity TEXT NOT NULL,
            fetched_at DATETIME NOT NULL,
            start_date TEXT NOT NULL,
            end_date TEXT NOT NULL,
            date_range_label TEXT NOT NULL DEFAULT '30d',
            label TEXT NOT NULL DEFAULT '',
            filters TEXT,
            total_cost REAL DEFAULT 0,
            service_count INTEGER DEFAULT 0,
            data TEXT NOT NULL
          );
          CREATE INDEX IF NOT EXISTS idx_gcp_cost_cache_lookup
            ON gcp_cost_cache(identity, data_type, fetched_at DESC);
        `,
      },
      {
        name: '013_schedule_provider',
        sql: `
          ALTER TABLE scan_schedules ADD COLUMN provider TEXT NOT NULL DEFAULT 'aws';
          ALTER TABLE scan_schedules ADD COLUMN project_id TEXT;
          CREATE TABLE IF NOT EXISTS gcp_label_governance_config (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            required_labels TEXT NOT NULL DEFAULT '[]',
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );
          INSERT OR IGNORE INTO gcp_label_governance_config (id, required_labels) VALUES (1, '[]');
        `,
      },
      {
        name: '014_gcp_assessments',
        sql: `
          CREATE TABLE IF NOT EXISTS gcp_assessments (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            timestamp DATETIME NOT NULL,
            overall_score REAL NOT NULL,
            overall_grade TEXT NOT NULL,
            total_recommendations INTEGER NOT NULL DEFAULT 0,
            critical_count INTEGER NOT NULL DEFAULT 0,
            high_count INTEGER NOT NULL DEFAULT 0,
            medium_count INTEGER NOT NULL DEFAULT 0,
            low_count INTEGER NOT NULL DEFAULT 0,
            duration INTEGER NOT NULL DEFAULT 0,
            data TEXT NOT NULL
          );
          CREATE INDEX IF NOT EXISTS idx_gcp_assessments_timestamp ON gcp_assessments(timestamp DESC);
          CREATE INDEX IF NOT EXISTS idx_gcp_assessments_project ON gcp_assessments(project_id, timestamp DESC);
        `,
      },
      {
        name: '015_gcp_iam_analyses',
        sql: `
          CREATE TABLE IF NOT EXISTS gcp_iam_analyses (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            analyzed_at DATETIME NOT NULL,
            unused_service_account_count INTEGER NOT NULL DEFAULT 0,
            permissive_binding_count INTEGER NOT NULL DEFAULT 0,
            key_issue_count INTEGER NOT NULL DEFAULT 0,
            cross_project_count INTEGER NOT NULL DEFAULT 0,
            total_findings INTEGER NOT NULL DEFAULT 0,
            duration INTEGER NOT NULL DEFAULT 0,
            data TEXT NOT NULL
          );
          CREATE INDEX IF NOT EXISTS idx_gcp_iam_analyses_project ON gcp_iam_analyses(project_id, analyzed_at DESC);
        `,
      },
      {
        name: '016_gcp_security_scans',
        sql: `
          CREATE TABLE IF NOT EXISTS gcp_security_scans (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            scan_mode TEXT NOT NULL,
            timestamp DATETIME NOT NULL,
            total_findings INTEGER NOT NULL DEFAULT 0,
            critical_count INTEGER NOT NULL DEFAULT 0,
            high_count INTEGER NOT NULL DEFAULT 0,
            medium_count INTEGER NOT NULL DEFAULT 0,
            low_count INTEGER NOT NULL DEFAULT 0,
            duration INTEGER NOT NULL DEFAULT 0,
            data TEXT NOT NULL
          );
          CREATE INDEX IF NOT EXISTS idx_gcp_security_scans_project ON gcp_security_scans(project_id, timestamp DESC);
        `,
      },
      {
        name: '017_gcp_compliance',
        sql: `
          CREATE TABLE IF NOT EXISTS gcp_compliance (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            framework_id TEXT NOT NULL,
            assessed_at DATETIME NOT NULL,
            overall_score REAL NOT NULL,
            total_controls INTEGER NOT NULL DEFAULT 0,
            passed_controls INTEGER NOT NULL DEFAULT 0,
            failed_controls INTEGER NOT NULL DEFAULT 0,
            not_checked_controls INTEGER NOT NULL DEFAULT 0,
            duration INTEGER NOT NULL DEFAULT 0,
            data TEXT NOT NULL
          );
          CREATE INDEX IF NOT EXISTS idx_gcp_compliance_project ON gcp_compliance(project_id, assessed_at DESC);
        `,
      },
      {
        name: '018_gcp_well_architected',
        sql: `
          CREATE TABLE IF NOT EXISTS gcp_well_architected (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            timestamp DATETIME NOT NULL,
            total_checks INTEGER NOT NULL DEFAULT 0,
            total_pass INTEGER NOT NULL DEFAULT 0,
            total_fail INTEGER NOT NULL DEFAULT 0,
            total_error INTEGER NOT NULL DEFAULT 0,
            duration INTEGER NOT NULL DEFAULT 0,
            data TEXT NOT NULL
          );
          CREATE INDEX IF NOT EXISTS idx_gcp_well_architected_project ON gcp_well_architected(project_id, timestamp DESC);
        `,
      },
      {
        name: '019_gcp_label_compliance',
        sql: `
          CREATE TABLE IF NOT EXISTS gcp_label_compliance (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            analyzed_at DATETIME NOT NULL,
            total_resources INTEGER NOT NULL DEFAULT 0,
            fully_compliant INTEGER NOT NULL DEFAULT 0,
            compliance_percent INTEGER NOT NULL DEFAULT 0,
            non_compliant_count INTEGER NOT NULL DEFAULT 0,
            duration INTEGER NOT NULL DEFAULT 0,
            data TEXT NOT NULL
          );
          CREATE INDEX IF NOT EXISTS idx_gcp_label_compliance_project ON gcp_label_compliance(project_id, analyzed_at DESC);
        `,
      },
      {
        name: '020_gcp_network_analysis',
        sql: `
          CREATE TABLE IF NOT EXISTS gcp_network_analysis (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL,
            analyzed_at DATETIME NOT NULL,
            total_networks INTEGER NOT NULL DEFAULT 0,
            total_firewall_rules INTEGER NOT NULL DEFAULT 0,
            critical_count INTEGER NOT NULL DEFAULT 0,
            high_count INTEGER NOT NULL DEFAULT 0,
            medium_count INTEGER NOT NULL DEFAULT 0,
            low_count INTEGER NOT NULL DEFAULT 0,
            total_findings INTEGER NOT NULL DEFAULT 0,
            duration INTEGER NOT NULL DEFAULT 0,
            data TEXT NOT NULL
          );
          CREATE INDEX IF NOT EXISTS idx_gcp_network_analysis_project ON gcp_network_analysis(project_id, analyzed_at DESC);
        `,
      },
      {
        name: '021_aws_security_scans',
        sql: `
          CREATE TABLE IF NOT EXISTS aws_security_scans (
            id TEXT PRIMARY KEY,
            profile TEXT NOT NULL,
            region TEXT NOT NULL,
            timestamp DATETIME NOT NULL,
            scan_mode TEXT NOT NULL DEFAULT 'best-practices',
            total_findings INTEGER NOT NULL DEFAULT 0,
            critical_count INTEGER NOT NULL DEFAULT 0,
            high_count INTEGER NOT NULL DEFAULT 0,
            medium_count INTEGER NOT NULL DEFAULT 0,
            low_count INTEGER NOT NULL DEFAULT 0,
            duration INTEGER NOT NULL DEFAULT 0,
            data TEXT NOT NULL
          );
          CREATE INDEX IF NOT EXISTS idx_aws_security_scans_profile ON aws_security_scans(profile, timestamp DESC);
        `,
      },
      {
        name: '022_aws_iam_analyses',
        sql: `
          CREATE TABLE IF NOT EXISTS aws_iam_analyses (
            id TEXT PRIMARY KEY,
            profile TEXT NOT NULL,
            timestamp DATETIME NOT NULL,
            unused_roles_count INTEGER NOT NULL DEFAULT 0,
            permissive_count INTEGER NOT NULL DEFAULT 0,
            cross_account_count INTEGER NOT NULL DEFAULT 0,
            duration INTEGER NOT NULL DEFAULT 0,
            data TEXT NOT NULL
          );
          CREATE INDEX IF NOT EXISTS idx_aws_iam_analyses_profile ON aws_iam_analyses(profile, timestamp DESC);
        `,
      },
      {
        name: '023_aws_compliance',
        sql: `
          CREATE TABLE IF NOT EXISTS aws_compliance (
            id TEXT PRIMARY KEY,
            profile TEXT NOT NULL,
            region TEXT NOT NULL,
            framework_id TEXT NOT NULL,
            framework_name TEXT NOT NULL DEFAULT '',
            timestamp DATETIME NOT NULL,
            pass_count INTEGER NOT NULL DEFAULT 0,
            fail_count INTEGER NOT NULL DEFAULT 0,
            total_controls INTEGER NOT NULL DEFAULT 0,
            duration INTEGER NOT NULL DEFAULT 0,
            data TEXT NOT NULL
          );
          CREATE INDEX IF NOT EXISTS idx_aws_compliance_profile ON aws_compliance(profile, timestamp DESC);
        `,
      },
      {
        name: '024_aws_well_architected',
        sql: `
          CREATE TABLE IF NOT EXISTS aws_well_architected (
            id TEXT PRIMARY KEY,
            profile TEXT NOT NULL,
            region TEXT NOT NULL,
            timestamp DATETIME NOT NULL,
            total_checks INTEGER NOT NULL DEFAULT 0,
            pass_count INTEGER NOT NULL DEFAULT 0,
            warn_count INTEGER NOT NULL DEFAULT 0,
            fail_count INTEGER NOT NULL DEFAULT 0,
            duration INTEGER NOT NULL DEFAULT 0,
            data TEXT NOT NULL
          );
          CREATE INDEX IF NOT EXISTS idx_aws_well_architected_profile ON aws_well_architected(profile, timestamp DESC);
        `,
      },
      {
        name: '025_aws_network_analysis',
        sql: `
          CREATE TABLE IF NOT EXISTS aws_network_analysis (
            id TEXT PRIMARY KEY,
            profile TEXT NOT NULL,
            region TEXT NOT NULL,
            timestamp DATETIME NOT NULL,
            total_resources INTEGER NOT NULL DEFAULT 0,
            publicly_accessible INTEGER NOT NULL DEFAULT 0,
            duration INTEGER NOT NULL DEFAULT 0,
            data TEXT NOT NULL
          );
          CREATE INDEX IF NOT EXISTS idx_aws_network_analysis_profile ON aws_network_analysis(profile, timestamp DESC);
        `,
      },
      {
        name: '026_aws_iam_user_analysis',
        sql: `
          ALTER TABLE aws_iam_analyses ADD COLUMN user_issues_count INTEGER NOT NULL DEFAULT 0;
        `,
      },
      {
        name: '027_gcp_credentials',
        sql: `
          CREATE TABLE IF NOT EXISTS gcp_credentials (
            id TEXT PRIMARY KEY,
            project_id TEXT NOT NULL UNIQUE,
            label TEXT NOT NULL DEFAULT '',
            google_email TEXT,
            encrypted_credentials TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
          );
          CREATE INDEX IF NOT EXISTS idx_gcp_credentials_project ON gcp_credentials(project_id);
        `,
      },
      {
        name: '028_migrate_gcp_default_accounts',
        sql: `
          -- Convert legacy 'default' and raw project-id keys to UUID-based account keys
          UPDATE gcp_credentials
            SET project_id = 'gcp-acct-' || id,
                label = CASE
                  WHEN label != '' THEN label
                  WHEN project_id = 'default' THEN 'Default'
                  ELSE project_id
                END
            WHERE project_id NOT LIKE 'gcp-acct-%';
        `,
      },
    ];

    const appliedMigrations = (this.db
      .prepare('SELECT name FROM migrations')
      .all() as { name: string }[])
      .map((row) => row.name);

    for (const migration of migrations) {
      if (!appliedMigrations.includes(migration.name)) {
        this.db.exec(migration.sql);
        this.db
          .prepare('INSERT INTO migrations (name) VALUES (?)')
          .run(migration.name);
        console.log(`Applied migration: ${migration.name}`);
      }
    }
  }

  // Scan operations
  createScan(scan: Omit<Scan, 'resourceCount'>): void {
    if (!this.db) throw new Error('Database not initialized');

    this.db
      .prepare(
        `INSERT INTO scans (id, profile, regions, services, started_at, status, cloud_provider)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        scan.id,
        scan.profile,
        JSON.stringify(scan.regions),
        JSON.stringify(scan.services),
        scan.startedAt,
        scan.status,
        scan.cloudProvider || 'aws'
      );
  }

  updateScanStatus(
    scanId: string,
    status: ScanStatus,
    completedAt?: string,
    error?: string
  ): void {
    if (!this.db) throw new Error('Database not initialized');

    if (completedAt) {
      this.db
        .prepare(
          `UPDATE scans SET status = ?, completed_at = ?, error = ? WHERE id = ?`
        )
        .run(status, completedAt, error || null, scanId);
    } else {
      this.db
        .prepare(`UPDATE scans SET status = ?, error = ? WHERE id = ?`)
        .run(status, error || null, scanId);
    }
  }

  updateScanResourceCount(scanId: string, count: number): void {
    if (!this.db) throw new Error('Database not initialized');

    this.db
      .prepare(`UPDATE scans SET resource_count = ? WHERE id = ?`)
      .run(count, scanId);
  }

  getScan(scanId: string): Scan | null {
    if (!this.db) throw new Error('Database not initialized');

    const row = this.db
      .prepare('SELECT * FROM scans WHERE id = ?')
      .get(scanId) as RawScan | undefined;

    if (!row) return null;
    return this.mapScanRow(row);
  }

  getAllScans(limit = 50): Scan[] {
    if (!this.db) throw new Error('Database not initialized');

    const rows = this.db
      .prepare('SELECT * FROM scans ORDER BY started_at DESC LIMIT ?')
      .all(limit) as RawScan[];

    return rows.map(this.mapScanRow);
  }

  getAllScansByProvider(provider: CloudProvider, limit = 50): Scan[] {
    if (!this.db) throw new Error('Database not initialized');

    const rows = this.db
      .prepare('SELECT * FROM scans WHERE cloud_provider = ? ORDER BY started_at DESC LIMIT ?')
      .all(provider, limit) as RawScan[];

    return rows.map(this.mapScanRow);
  }

  deleteScan(scanId: string): void {
    if (!this.db) throw new Error('Database not initialized');

    // Cascading delete will remove resources and relationships
    this.db.prepare('DELETE FROM scans WHERE id = ?').run(scanId);
  }

  // Resource operations
  insertResources(resources: Resource[]): void {
    if (!this.db) throw new Error('Database not initialized');

    const insert = this.db.prepare(
      `INSERT OR REPLACE INTO resources
       (id, scan_id, service, resource_type, region, name, tags, data, created_at, cloud_provider)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const insertMany = this.db.transaction((resources: Resource[]) => {
      for (const resource of resources) {
        insert.run(
          resource.id,
          resource.scanId,
          resource.service,
          resource.resourceType,
          resource.region,
          resource.name,
          JSON.stringify(resource.tags),
          JSON.stringify(resource.data),
          resource.createdAt || null,
          resource.cloudProvider || 'aws'
        );
      }
    });

    insertMany(resources);
  }

  getResourcesByScan(scanId: string): Resource[] {
    if (!this.db) throw new Error('Database not initialized');

    const rows = this.db
      .prepare('SELECT * FROM resources WHERE scan_id = ?')
      .all(scanId) as RawResource[];

    return rows.map(this.mapResourceRow);
  }

  getResourcesByService(scanId: string, service: ServiceType | GCPServiceType | string): Resource[] {
    if (!this.db) throw new Error('Database not initialized');

    const rows = this.db
      .prepare('SELECT * FROM resources WHERE scan_id = ? AND service = ?')
      .all(scanId, service) as RawResource[];

    return rows.map(this.mapResourceRow);
  }

  searchResources(scanId: string, query: string): Resource[] {
    if (!this.db) throw new Error('Database not initialized');

    // Escape LIKE wildcards to prevent unintended pattern matching
    const escaped = query.replace(/[%_\\]/g, '\\$&');
    const searchQuery = `%${escaped}%`;
    const rows = this.db
      .prepare(
        `SELECT * FROM resources
         WHERE scan_id = ? AND (name LIKE ? ESCAPE '\\' OR id LIKE ? ESCAPE '\\' OR tags LIKE ? ESCAPE '\\')`
      )
      .all(scanId, searchQuery, searchQuery, searchQuery) as RawResource[];

    return rows.map(this.mapResourceRow);
  }

  // Relationship operations
  insertRelationships(relationships: Omit<Relationship, 'id'>[]): void {
    if (!this.db) throw new Error('Database not initialized');

    const insert = this.db.prepare(
      `INSERT INTO relationships (scan_id, source_arn, target_arn, relationship_type)
       VALUES (?, ?, ?, ?)`
    );

    const insertMany = this.db.transaction(
      (relationships: Omit<Relationship, 'id'>[]) => {
        for (const rel of relationships) {
          insert.run(
            rel.scanId,
            rel.sourceArn,
            rel.targetArn,
            rel.relationshipType
          );
        }
      }
    );

    insertMany(relationships);
  }

  getRelationshipsByScan(scanId: string): Relationship[] {
    if (!this.db) throw new Error('Database not initialized');

    const rows = this.db
      .prepare('SELECT * FROM relationships WHERE scan_id = ?')
      .all(scanId) as RawRelationship[];

    return rows.map((row) => ({
      id: row.id,
      scanId: row.scan_id,
      sourceArn: row.source_arn,
      targetArn: row.target_arn,
      relationshipType: row.relationship_type as RelationshipType,
    }));
  }

  // Assessment operations
  createAssessment(result: AssessmentResult): void {
    if (!this.db) throw new Error('Database not initialized');

    this.db
      .prepare(
        `INSERT INTO assessments
         (id, profile, region, account_id, timestamp, overall_score, overall_grade,
          total_recommendations, critical_count, high_count, medium_count, low_count,
          duration, data)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        result.id,
        result.profile,
        result.region,
        result.accountId || null,
        result.timestamp,
        result.overallScore,
        result.overallGrade,
        result.totalRecommendations,
        result.criticalCount,
        result.highCount,
        result.mediumCount,
        result.lowCount,
        result.duration,
        JSON.stringify(result)
      );
  }

  getAssessment(id: string): AssessmentResult | null {
    if (!this.db) throw new Error('Database not initialized');

    const row = this.db
      .prepare('SELECT data FROM assessments WHERE id = ?')
      .get(id) as { data: string } | undefined;

    if (!row) return null;
    return safeParse<AssessmentResult | null>(row.data, null) as AssessmentResult;
  }

  getAllAssessments(limit = 50): AssessmentSummary[] {
    if (!this.db) throw new Error('Database not initialized');

    const rows = this.db
      .prepare(
        `SELECT id, profile, region, account_id, timestamp, overall_score, overall_grade,
                total_recommendations, critical_count, high_count, medium_count, low_count, duration
         FROM assessments ORDER BY timestamp DESC LIMIT ?`
      )
      .all(limit) as RawAssessment[];

    return rows.map((row) => ({
      id: row.id,
      profile: row.profile,
      region: row.region,
      accountId: row.account_id || undefined,
      timestamp: row.timestamp,
      overallScore: row.overall_score,
      overallGrade: row.overall_grade,
      totalRecommendations: row.total_recommendations,
      criticalCount: row.critical_count,
      highCount: row.high_count,
      mediumCount: row.medium_count,
      lowCount: row.low_count,
      duration: row.duration,
    }));
  }

  deleteAssessment(id: string): void {
    if (!this.db) throw new Error('Database not initialized');

    this.db.prepare('DELETE FROM assessments WHERE id = ?').run(id);
  }

  // GCP Assessment operations
  createGCPAssessment(result: GCPAssessmentResult): void {
    if (!this.db) throw new Error('Database not initialized');

    this.db
      .prepare(
        `INSERT INTO gcp_assessments
         (id, project_id, timestamp, overall_score, overall_grade,
          total_recommendations, critical_count, high_count, medium_count, low_count,
          duration, data)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        result.id,
        result.projectId,
        result.timestamp,
        result.overallScore,
        result.overallGrade,
        result.totalRecommendations,
        result.criticalCount,
        result.highCount,
        result.mediumCount,
        result.lowCount,
        result.duration,
        JSON.stringify(result)
      );
  }

  getGCPAssessment(id: string): GCPAssessmentResult | null {
    if (!this.db) throw new Error('Database not initialized');

    const row = this.db
      .prepare('SELECT data FROM gcp_assessments WHERE id = ?')
      .get(id) as { data: string } | undefined;

    if (!row) return null;
    return safeParse<GCPAssessmentResult | null>(row.data, null) as GCPAssessmentResult;
  }

  getAllGCPAssessments(projectId?: string, limit = 50): GCPAssessmentSummary[] {
    if (!this.db) throw new Error('Database not initialized');

    const query = projectId
      ? `SELECT id, project_id, timestamp, overall_score, overall_grade,
                total_recommendations, critical_count, high_count, medium_count, low_count, duration
         FROM gcp_assessments WHERE project_id = ? ORDER BY timestamp DESC LIMIT ?`
      : `SELECT id, project_id, timestamp, overall_score, overall_grade,
                total_recommendations, critical_count, high_count, medium_count, low_count, duration
         FROM gcp_assessments ORDER BY timestamp DESC LIMIT ?`;

    const rows = (projectId
      ? this.db.prepare(query).all(projectId, limit)
      : this.db.prepare(query).all(limit)) as RawGCPAssessment[];

    return rows.map((row) => ({
      id: row.id,
      projectId: row.project_id,
      timestamp: row.timestamp,
      overallScore: row.overall_score,
      overallGrade: row.overall_grade,
      totalRecommendations: row.total_recommendations,
      criticalCount: row.critical_count,
      highCount: row.high_count,
      mediumCount: row.medium_count,
      lowCount: row.low_count,
      duration: row.duration,
    }));
  }

  deleteGCPAssessment(id: string): void {
    if (!this.db) throw new Error('Database not initialized');

    this.db.prepare('DELETE FROM gcp_assessments WHERE id = ?').run(id);
  }

  // GCP IAM Analysis operations
  createGCPIAMAnalysis(result: GCPIAMAnalysisResult): void {
    if (!this.db) throw new Error('Database not initialized');

    const totalFindings = result.unusedServiceAccounts.length +
      result.overlyPermissiveBindings.length +
      result.serviceAccountKeyIssues.length +
      result.crossProjectBindings.length;

    this.db
      .prepare(
        `INSERT INTO gcp_iam_analyses
         (id, project_id, analyzed_at, unused_service_account_count, permissive_binding_count,
          key_issue_count, cross_project_count, total_findings, duration, data)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        result.id,
        result.projectId,
        result.analyzedAt,
        result.unusedServiceAccounts.length,
        result.overlyPermissiveBindings.length,
        result.serviceAccountKeyIssues.length,
        result.crossProjectBindings.length,
        totalFindings,
        result.duration,
        JSON.stringify(result)
      );
  }

  getGCPIAMAnalysis(id: string): GCPIAMAnalysisResult | null {
    if (!this.db) throw new Error('Database not initialized');

    const row = this.db
      .prepare('SELECT data FROM gcp_iam_analyses WHERE id = ?')
      .get(id) as { data: string } | undefined;

    if (!row) return null;
    return safeParse<GCPIAMAnalysisResult | null>(row.data, null) as GCPIAMAnalysisResult;
  }

  getAllGCPIAMAnalyses(projectId?: string, limit = 50): GCPIAMAnalysisSummary[] {
    if (!this.db) throw new Error('Database not initialized');

    const query = projectId
      ? `SELECT id, project_id, analyzed_at, unused_service_account_count, permissive_binding_count,
                key_issue_count, cross_project_count, total_findings, duration
         FROM gcp_iam_analyses WHERE project_id = ? ORDER BY analyzed_at DESC LIMIT ?`
      : `SELECT id, project_id, analyzed_at, unused_service_account_count, permissive_binding_count,
                key_issue_count, cross_project_count, total_findings, duration
         FROM gcp_iam_analyses ORDER BY analyzed_at DESC LIMIT ?`;

    const rows = (projectId
      ? this.db.prepare(query).all(projectId, limit)
      : this.db.prepare(query).all(limit)) as RawGCPIAMAnalysis[];

    return rows.map((row) => ({
      id: row.id,
      projectId: row.project_id,
      analyzedAt: row.analyzed_at,
      unusedServiceAccountCount: row.unused_service_account_count,
      permissiveBindingCount: row.permissive_binding_count,
      keyIssueCount: row.key_issue_count,
      crossProjectCount: row.cross_project_count,
      totalFindings: row.total_findings,
      duration: row.duration,
    }));
  }

  deleteGCPIAMAnalysis(id: string): void {
    if (!this.db) throw new Error('Database not initialized');

    this.db.prepare('DELETE FROM gcp_iam_analyses WHERE id = ?').run(id);
  }

  // ── GCP Security Scan CRUD ──

  createGCPSecurityScan(result: SecurityAnalysisResult): void {
    if (!this.db) throw new Error('Database not initialized');

    this.db
      .prepare(
        `INSERT INTO gcp_security_scans
         (id, project_id, scan_mode, timestamp, total_findings, critical_count, high_count,
          medium_count, low_count, duration, data)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        result.id,
        result.projectId,
        result.scanMode,
        result.timestamp,
        result.summary.totalFindings,
        result.summary.criticalCount,
        result.summary.highCount,
        result.summary.mediumCount,
        result.summary.lowCount,
        result.duration ?? 0,
        JSON.stringify(result)
      );
  }

  getGCPSecurityScan(id: string): SecurityAnalysisResult | null {
    if (!this.db) throw new Error('Database not initialized');

    const row = this.db
      .prepare('SELECT data FROM gcp_security_scans WHERE id = ?')
      .get(id) as { data: string } | undefined;

    return row ? safeParse(row.data, null) : null;
  }

  getAllGCPSecurityScans(projectId?: string, limit: number = 50): GCPSecurityScanSummary[] {
    if (!this.db) throw new Error('Database not initialized');

    const query = projectId
      ? `SELECT id, project_id, scan_mode, timestamp, total_findings, critical_count,
                high_count, medium_count, low_count, duration
         FROM gcp_security_scans WHERE project_id = ? ORDER BY timestamp DESC LIMIT ?`
      : `SELECT id, project_id, scan_mode, timestamp, total_findings, critical_count,
                high_count, medium_count, low_count, duration
         FROM gcp_security_scans ORDER BY timestamp DESC LIMIT ?`;

    interface RawRow {
      id: string; project_id: string; scan_mode: string; timestamp: string;
      total_findings: number; critical_count: number; high_count: number;
      medium_count: number; low_count: number; duration: number;
    }

    const rows = (projectId
      ? this.db.prepare(query).all(projectId, limit)
      : this.db.prepare(query).all(limit)) as RawRow[];

    return rows.map((row) => ({
      id: row.id,
      projectId: row.project_id,
      scanMode: row.scan_mode,
      timestamp: row.timestamp,
      totalFindings: row.total_findings,
      criticalCount: row.critical_count,
      highCount: row.high_count,
      mediumCount: row.medium_count,
      lowCount: row.low_count,
      duration: row.duration,
    }));
  }

  deleteGCPSecurityScan(id: string): void {
    if (!this.db) throw new Error('Database not initialized');

    this.db.prepare('DELETE FROM gcp_security_scans WHERE id = ?').run(id);
  }

  // GCP Compliance operations

  createGCPCompliance(result: ComplianceAssessmentResult): void {
    if (!this.db) throw new Error('Database not initialized');

    this.db
      .prepare(
        `INSERT INTO gcp_compliance
         (id, project_id, framework_id, assessed_at, overall_score, total_controls,
          passed_controls, failed_controls, not_checked_controls, duration, data)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        result.id,
        result.projectId,
        result.framework.id,
        result.assessedAt,
        result.overallScore,
        result.totalControls,
        result.passedControls,
        result.failedControls,
        result.notCheckedControls,
        result.duration ?? 0,
        JSON.stringify(result)
      );
  }

  getGCPCompliance(id: string): ComplianceAssessmentResult | null {
    if (!this.db) throw new Error('Database not initialized');

    const row = this.db
      .prepare('SELECT data FROM gcp_compliance WHERE id = ?')
      .get(id) as { data: string } | undefined;

    return row ? safeParse(row.data, null) : null;
  }

  getAllGCPCompliance(projectId?: string, limit = 50): GCPComplianceSummary[] {
    if (!this.db) throw new Error('Database not initialized');

    const query = projectId
      ? `SELECT id, project_id, framework_id, assessed_at, overall_score, total_controls,
                passed_controls, failed_controls, not_checked_controls, duration
         FROM gcp_compliance WHERE project_id = ? ORDER BY assessed_at DESC LIMIT ?`
      : `SELECT id, project_id, framework_id, assessed_at, overall_score, total_controls,
                passed_controls, failed_controls, not_checked_controls, duration
         FROM gcp_compliance ORDER BY assessed_at DESC LIMIT ?`;

    interface RawRow {
      id: string; project_id: string; framework_id: string; assessed_at: string;
      overall_score: number; total_controls: number; passed_controls: number;
      failed_controls: number; not_checked_controls: number; duration: number;
    }

    const rows = projectId
      ? (this.db.prepare(query).all(projectId, limit) as RawRow[])
      : (this.db.prepare(query).all(limit) as RawRow[]);

    return rows.map((row) => ({
      id: row.id,
      projectId: row.project_id,
      frameworkId: row.framework_id,
      assessedAt: row.assessed_at,
      overallScore: row.overall_score,
      totalControls: row.total_controls,
      passedControls: row.passed_controls,
      failedControls: row.failed_controls,
      notCheckedControls: row.not_checked_controls,
      duration: row.duration,
    }));
  }

  deleteGCPCompliance(id: string): void {
    if (!this.db) throw new Error('Database not initialized');

    this.db.prepare('DELETE FROM gcp_compliance WHERE id = ?').run(id);
  }

  // ── GCP Well-Architected CRUD ──

  createGCPWellArchitected(result: GCPWAScanResult): void {
    if (!this.db) throw new Error('Database not initialized');

    this.db
      .prepare(
        `INSERT INTO gcp_well_architected
         (id, project_id, timestamp, total_checks, total_pass, total_fail,
          total_error, duration, data)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        result.id,
        result.projectId,
        result.timestamp,
        result.totalChecks,
        result.totalPass,
        result.totalFail,
        result.totalError,
        result.duration ?? 0,
        JSON.stringify(result)
      );
  }

  getGCPWellArchitected(id: string): GCPWAScanResult | null {
    if (!this.db) throw new Error('Database not initialized');

    const row = this.db
      .prepare('SELECT data FROM gcp_well_architected WHERE id = ?')
      .get(id) as { data: string } | undefined;

    return row ? safeParse(row.data, null) : null;
  }

  getAllGCPWellArchitected(projectId?: string, limit: number = 50): GCPWellArchitectedSummary[] {
    if (!this.db) throw new Error('Database not initialized');

    const query = projectId
      ? `SELECT id, project_id, timestamp, total_checks, total_pass, total_fail,
                total_error, duration
         FROM gcp_well_architected WHERE project_id = ? ORDER BY timestamp DESC LIMIT ?`
      : `SELECT id, project_id, timestamp, total_checks, total_pass, total_fail,
                total_error, duration
         FROM gcp_well_architected ORDER BY timestamp DESC LIMIT ?`;

    interface RawRow {
      id: string; project_id: string; timestamp: string;
      total_checks: number; total_pass: number; total_fail: number;
      total_error: number; duration: number;
    }

    const rows = (projectId
      ? this.db.prepare(query).all(projectId, limit)
      : this.db.prepare(query).all(limit)) as RawRow[];

    return rows.map((row) => ({
      id: row.id,
      projectId: row.project_id,
      timestamp: row.timestamp,
      totalChecks: row.total_checks,
      totalPass: row.total_pass,
      totalFail: row.total_fail,
      totalError: row.total_error,
      duration: row.duration,
    }));
  }

  deleteGCPWellArchitected(id: string): void {
    if (!this.db) throw new Error('Database not initialized');

    this.db.prepare('DELETE FROM gcp_well_architected WHERE id = ?').run(id);
  }

  // ── GCP Label Compliance CRUD ──

  createGCPLabelCompliance(result: GCPLabelComplianceResult): void {
    if (!this.db) throw new Error('Database not initialized');

    this.db
      .prepare(
        `INSERT INTO gcp_label_compliance
         (id, project_id, analyzed_at, total_resources, fully_compliant,
          compliance_percent, non_compliant_count, duration, data)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        result.id,
        result.projectId,
        result.analyzedAt,
        result.totalResources,
        result.fullyCompliantResources,
        result.overallCompliancePercent,
        result.unlabeledResources.length,
        result.duration ?? 0,
        JSON.stringify(result)
      );
  }

  getGCPLabelCompliance(id: string): GCPLabelComplianceResult | null {
    if (!this.db) throw new Error('Database not initialized');

    const row = this.db
      .prepare('SELECT data FROM gcp_label_compliance WHERE id = ?')
      .get(id) as { data: string } | undefined;

    return row ? safeParse(row.data, null) : null;
  }

  getAllGCPLabelCompliance(projectId?: string, limit: number = 50): GCPLabelComplianceSummary[] {
    if (!this.db) throw new Error('Database not initialized');

    const query = projectId
      ? `SELECT id, project_id, analyzed_at, total_resources, fully_compliant,
                compliance_percent, non_compliant_count, duration
         FROM gcp_label_compliance WHERE project_id = ? ORDER BY analyzed_at DESC LIMIT ?`
      : `SELECT id, project_id, analyzed_at, total_resources, fully_compliant,
                compliance_percent, non_compliant_count, duration
         FROM gcp_label_compliance ORDER BY analyzed_at DESC LIMIT ?`;

    interface RawRow {
      id: string; project_id: string; analyzed_at: string;
      total_resources: number; fully_compliant: number;
      compliance_percent: number; non_compliant_count: number; duration: number;
    }

    const rows = (projectId
      ? this.db.prepare(query).all(projectId, limit)
      : this.db.prepare(query).all(limit)) as RawRow[];

    return rows.map((row) => ({
      id: row.id,
      projectId: row.project_id,
      analyzedAt: row.analyzed_at,
      totalResources: row.total_resources,
      fullyCompliantResources: row.fully_compliant,
      overallCompliancePercent: row.compliance_percent,
      nonCompliantCount: row.non_compliant_count,
      duration: row.duration,
    }));
  }

  deleteGCPLabelCompliance(id: string): void {
    if (!this.db) throw new Error('Database not initialized');

    this.db.prepare('DELETE FROM gcp_label_compliance WHERE id = ?').run(id);
  }

  // ── GCP Network Analysis CRUD ──

  createGCPNetworkAnalysis(result: GCPNetworkAnalysisResult): void {
    if (!this.db) throw new Error('Database not initialized');

    const totalFindings = result.firewallFindings.length + result.exposedResources.length;

    this.db
      .prepare(
        `INSERT INTO gcp_network_analysis
         (id, project_id, analyzed_at, total_networks, total_firewall_rules,
          critical_count, high_count, medium_count, low_count, total_findings, duration, data)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        result.id,
        result.projectId,
        result.analyzedAt,
        result.totalNetworks,
        result.totalFirewallRules,
        result.criticalCount,
        result.highCount,
        result.mediumCount,
        result.lowCount,
        totalFindings,
        result.duration ?? 0,
        JSON.stringify(result)
      );
  }

  getGCPNetworkAnalysis(id: string): GCPNetworkAnalysisResult | null {
    if (!this.db) throw new Error('Database not initialized');

    const row = this.db
      .prepare('SELECT data FROM gcp_network_analysis WHERE id = ?')
      .get(id) as { data: string } | undefined;

    return row ? safeParse(row.data, null) : null;
  }

  getAllGCPNetworkAnalysis(projectId?: string, limit: number = 50): GCPNetworkAnalysisSummary[] {
    if (!this.db) throw new Error('Database not initialized');

    const query = projectId
      ? `SELECT id, project_id, analyzed_at, total_networks, total_firewall_rules,
                critical_count, high_count, medium_count, low_count, total_findings, duration
         FROM gcp_network_analysis WHERE project_id = ? ORDER BY analyzed_at DESC LIMIT ?`
      : `SELECT id, project_id, analyzed_at, total_networks, total_firewall_rules,
                critical_count, high_count, medium_count, low_count, total_findings, duration
         FROM gcp_network_analysis ORDER BY analyzed_at DESC LIMIT ?`;

    interface RawRow {
      id: string; project_id: string; analyzed_at: string;
      total_networks: number; total_firewall_rules: number;
      critical_count: number; high_count: number; medium_count: number;
      low_count: number; total_findings: number; duration: number;
    }

    const rows = (projectId
      ? this.db.prepare(query).all(projectId, limit)
      : this.db.prepare(query).all(limit)) as RawRow[];

    return rows.map((row) => ({
      id: row.id,
      projectId: row.project_id,
      analyzedAt: row.analyzed_at,
      totalNetworks: row.total_networks,
      totalFirewallRules: row.total_firewall_rules,
      criticalCount: row.critical_count,
      highCount: row.high_count,
      mediumCount: row.medium_count,
      lowCount: row.low_count,
      totalFindings: row.total_findings,
      duration: row.duration,
    }));
  }

  deleteGCPNetworkAnalysis(id: string): void {
    if (!this.db) throw new Error('Database not initialized');

    this.db.prepare('DELETE FROM gcp_network_analysis WHERE id = ?').run(id);
  }

  // Scan Schedule operations
  createSchedule(schedule: {
    id: string; name: string; profileName: string;
    regions: string[]; services: string[]; frequency: string;
    autoAssess: boolean; nextRunAt: string;
    provider?: string; projectId?: string;
  }): void {
    if (!this.db) throw new Error('Database not initialized');
    this.db.prepare(
      `INSERT INTO scan_schedules (id, name, profile_name, regions, services, frequency, enabled, auto_assess, next_run_at, provider, project_id)
       VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`
    ).run(
      schedule.id, schedule.name, schedule.profileName,
      JSON.stringify(schedule.regions), JSON.stringify(schedule.services),
      schedule.frequency, schedule.autoAssess ? 1 : 0, schedule.nextRunAt,
      schedule.provider || 'aws', schedule.projectId || null
    );
  }

  getAllSchedules(): RawSchedule[] {
    if (!this.db) throw new Error('Database not initialized');
    return this.db.prepare('SELECT * FROM scan_schedules ORDER BY created_at DESC').all() as RawSchedule[];
  }

  updateScheduleEnabled(id: string, enabled: boolean): void {
    if (!this.db) throw new Error('Database not initialized');
    this.db.prepare('UPDATE scan_schedules SET enabled = ? WHERE id = ?').run(enabled ? 1 : 0, id);
  }

  updateScheduleLastRun(id: string, lastRunAt: string, nextRunAt: string): void {
    if (!this.db) throw new Error('Database not initialized');
    this.db.prepare('UPDATE scan_schedules SET last_run_at = ?, next_run_at = ? WHERE id = ?')
      .run(lastRunAt, nextRunAt, id);
  }

  deleteSchedule(id: string): void {
    if (!this.db) throw new Error('Database not initialized');
    this.db.prepare('DELETE FROM scan_schedules WHERE id = ?').run(id);
  }

  // GCP Label Governance Config
  getGCPLabelConfig(): string[] {
    if (!this.db) throw new Error('Database not initialized');
    const row = this.db.prepare('SELECT required_labels FROM gcp_label_governance_config WHERE id = 1').get() as { required_labels: string } | undefined;
    return row ? safeParse<string[]>(row.required_labels, []) : [];
  }

  saveGCPLabelConfig(requiredLabels: string[]): void {
    if (!this.db) throw new Error('Database not initialized');
    this.db.prepare('UPDATE gcp_label_governance_config SET required_labels = ?, updated_at = CURRENT_TIMESTAMP WHERE id = 1')
      .run(JSON.stringify(requiredLabels));
  }

  // Tag Governance operations
  getTagGovernanceConfig(): string[] {
    if (!this.db) throw new Error('Database not initialized');

    const row = this.db
      .prepare('SELECT required_tags FROM tag_governance_config WHERE id = 1')
      .get() as { required_tags: string } | undefined;

    if (!row) return [];
    return safeParse<string[]>(row.required_tags, []);
  }

  saveTagGovernanceConfig(requiredTags: string[]): void {
    if (!this.db) throw new Error('Database not initialized');

    this.db
      .prepare(
        `INSERT INTO tag_governance_config (id, required_tags, updated_at)
         VALUES (1, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(id) DO UPDATE SET required_tags = excluded.required_tags, updated_at = CURRENT_TIMESTAMP`
      )
      .run(JSON.stringify(requiredTags));
  }

  // Settings operations
  getSetting(key: string): string | null {
    if (!this.db) throw new Error('Database not initialized');

    const row = this.db
      .prepare('SELECT value FROM settings WHERE key = ?')
      .get(key) as { value: string } | undefined;

    return row?.value ?? null;
  }

  setSetting(key: string, value: string): void {
    if (!this.db) throw new Error('Database not initialized');

    this.db
      .prepare(
        `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`
      )
      .run(key, value);
  }

  // App Profile operations
  createAppProfile(profile: RawAppProfileInsert): string {
    if (!this.db) throw new Error('Database not initialized');

    const id = crypto.randomUUID();
    this.db
      .prepare(
        `INSERT INTO app_profiles
         (id, name, credential_type, region, encrypted_access_key_id, encrypted_secret_access_key,
          encrypted_session_token, sso_start_url, sso_region, sso_account_id, sso_role_name,
          assume_role_arn, encrypted_external_id, source_profile, description)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        profile.name,
        profile.credential_type,
        profile.region || null,
        profile.encrypted_access_key_id || null,
        profile.encrypted_secret_access_key || null,
        profile.encrypted_session_token || null,
        profile.sso_start_url || null,
        profile.sso_region || null,
        profile.sso_account_id || null,
        profile.sso_role_name || null,
        profile.assume_role_arn || null,
        profile.encrypted_external_id || null,
        profile.source_profile || null,
        profile.description || null
      );

    return id;
  }

  updateAppProfile(id: string, profile: Partial<RawAppProfileInsert>): void {
    if (!this.db) throw new Error('Database not initialized');

    const fields: string[] = [];
    const values: unknown[] = [];

    if (profile.name !== undefined) { fields.push('name = ?'); values.push(profile.name); }
    if (profile.credential_type !== undefined) { fields.push('credential_type = ?'); values.push(profile.credential_type); }
    if (profile.region !== undefined) { fields.push('region = ?'); values.push(profile.region || null); }
    if (profile.encrypted_access_key_id !== undefined) { fields.push('encrypted_access_key_id = ?'); values.push(profile.encrypted_access_key_id || null); }
    if (profile.encrypted_secret_access_key !== undefined) { fields.push('encrypted_secret_access_key = ?'); values.push(profile.encrypted_secret_access_key || null); }
    if (profile.encrypted_session_token !== undefined) { fields.push('encrypted_session_token = ?'); values.push(profile.encrypted_session_token || null); }
    if (profile.sso_start_url !== undefined) { fields.push('sso_start_url = ?'); values.push(profile.sso_start_url || null); }
    if (profile.sso_region !== undefined) { fields.push('sso_region = ?'); values.push(profile.sso_region || null); }
    if (profile.sso_account_id !== undefined) { fields.push('sso_account_id = ?'); values.push(profile.sso_account_id || null); }
    if (profile.sso_role_name !== undefined) { fields.push('sso_role_name = ?'); values.push(profile.sso_role_name || null); }
    if (profile.assume_role_arn !== undefined) { fields.push('assume_role_arn = ?'); values.push(profile.assume_role_arn || null); }
    if (profile.encrypted_external_id !== undefined) { fields.push('encrypted_external_id = ?'); values.push(profile.encrypted_external_id || null); }
    if (profile.source_profile !== undefined) { fields.push('source_profile = ?'); values.push(profile.source_profile || null); }
    if (profile.description !== undefined) { fields.push('description = ?'); values.push(profile.description || null); }

    if (fields.length === 0) return;

    fields.push('updated_at = CURRENT_TIMESTAMP');
    values.push(id);

    this.db
      .prepare(`UPDATE app_profiles SET ${fields.join(', ')} WHERE id = ?`)
      .run(...values);
  }

  deleteAppProfile(id: string): void {
    if (!this.db) throw new Error('Database not initialized');
    this.db.prepare('DELETE FROM app_profiles WHERE id = ?').run(id);
  }

  getAllAppProfiles(): RawAppProfile[] {
    if (!this.db) throw new Error('Database not initialized');

    return this.db
      .prepare('SELECT * FROM app_profiles ORDER BY name ASC')
      .all() as RawAppProfile[];
  }

  getAppProfileByName(name: string): RawAppProfile | null {
    if (!this.db) throw new Error('Database not initialized');

    const row = this.db
      .prepare('SELECT * FROM app_profiles WHERE name = ?')
      .get(name) as RawAppProfile | undefined;

    return row || null;
  }

  getAppProfileById(id: string): RawAppProfile | null {
    if (!this.db) throw new Error('Database not initialized');

    const row = this.db
      .prepare('SELECT * FROM app_profiles WHERE id = ?')
      .get(id) as RawAppProfile | undefined;

    return row || null;
  }

  reEncryptAppProfiles(oldKey: Buffer, newKey: Buffer): void {
    if (!this.db) throw new Error('Database not initialized');

    const profiles = this.getAllAppProfiles();

    const reEncrypt = (encrypted: string | null): string | null => {
      if (!encrypted) return null;
      let data: EncryptedData;
      try {
        data = JSON.parse(encrypted) as EncryptedData;
      } catch {
        throw new Error('Failed to re-encrypt stored credential — database may be corrupt');
      }
      const plaintext = decrypt(data, oldKey);
      return JSON.stringify(encrypt(plaintext, newKey));
    };

    const updateStmt = this.db.prepare(
      `UPDATE app_profiles SET
        encrypted_access_key_id = ?,
        encrypted_secret_access_key = ?,
        encrypted_session_token = ?,
        encrypted_external_id = ?,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    );

    const transaction = this.db.transaction(() => {
      for (const profile of profiles) {
        updateStmt.run(
          reEncrypt(profile.encrypted_access_key_id),
          reEncrypt(profile.encrypted_secret_access_key),
          reEncrypt(profile.encrypted_session_token),
          reEncrypt(profile.encrypted_external_id),
          profile.id
        );
      }
    });

    transaction();
  }

  /**
   * Atomic password change: re-encrypts all profiles AND updates password
   * settings in a single SQLite transaction. Prevents corrupted state if
   * the process crashes mid-operation.
   */
  changePasswordAtomic(
    oldKey: Buffer,
    newKey: Buffer,
    newHash: string,
    newPasswordSalt: string,
    newEncryptionSalt: string
  ): void {
    if (!this.db) throw new Error('Database not initialized');

    const profiles = this.getAllAppProfiles();

    const reEncrypt = (encrypted: string | null): string | null => {
      if (!encrypted) return null;
      let data: EncryptedData;
      try {
        data = JSON.parse(encrypted) as EncryptedData;
      } catch {
        throw new Error('Failed to re-encrypt stored credential — database may be corrupt');
      }
      const plaintext = decrypt(data, oldKey);
      return JSON.stringify(encrypt(plaintext, newKey));
    };

    const updateProfileStmt = this.db.prepare(
      `UPDATE app_profiles SET
        encrypted_access_key_id = ?,
        encrypted_secret_access_key = ?,
        encrypted_session_token = ?,
        encrypted_external_id = ?,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    );

    const upsertSettingStmt = this.db.prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`
    );

    // Prepare GCP credential re-encryption
    const gcpCreds = this.getAllGCPCredentials();
    const updateGCPCredStmt = this.db.prepare(
      `UPDATE gcp_credentials SET encrypted_credentials = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    );

    const transaction = this.db.transaction(() => {
      // Re-encrypt all AWS profile secrets
      for (const profile of profiles) {
        updateProfileStmt.run(
          reEncrypt(profile.encrypted_access_key_id),
          reEncrypt(profile.encrypted_secret_access_key),
          reEncrypt(profile.encrypted_session_token),
          reEncrypt(profile.encrypted_external_id),
          profile.id
        );
      }

      // Re-encrypt all GCP credentials
      for (const cred of gcpCreds) {
        updateGCPCredStmt.run(
          reEncrypt(cred.encrypted_credentials),
          cred.id
        );
      }

      // Update password settings
      upsertSettingStmt.run('password_hash', newHash);
      upsertSettingStmt.run('password_salt', newPasswordSalt);
      upsertSettingStmt.run('encryption_salt', newEncryptionSalt);
    });

    transaction();
  }

  // GCP Optimization Snapshot operations
  getLatestGCPScanId(identity: string): string | null {
    if (!this.db) throw new Error('Database not initialized');
    const row = this.db
      .prepare(
        `SELECT id FROM scans
         WHERE cloud_provider = 'gcp' AND status = 'completed' AND (profile = ? OR profile LIKE ?)
         ORDER BY completed_at DESC LIMIT 1`
      )
      .get(identity, `%${identity}%`) as { id: string } | undefined;
    return row?.id ?? null;
  }

  saveGCPOptimizationSnapshot(snapshot: GCPOptimizationSnapshot): void {
    if (!this.db) throw new Error('Database not initialized');
    this.db
      .prepare(
        `INSERT OR REPLACE INTO gcp_optimization_snapshots
         (id, scope, identity, scanned_at, total_savings, rec_count, vm_count, resource_findings_count, data)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        snapshot.id,
        snapshot.scope,
        snapshot.identity,
        snapshot.scannedAt,
        snapshot.totalSavings,
        snapshot.recCount,
        snapshot.vmCount,
        snapshot.resourceFindingsCount,
        JSON.stringify(snapshot)
      );
  }

  listGCPOptimizationSnapshots(identity: string, limit = 20): GCPOptimizationSnapshot[] {
    if (!this.db) throw new Error('Database not initialized');
    const rows = this.db
      .prepare(
        `SELECT id, scope, identity, scanned_at, total_savings, rec_count, vm_count, resource_findings_count
         FROM gcp_optimization_snapshots WHERE identity = ? ORDER BY scanned_at DESC LIMIT ?`
      )
      .all(identity, limit) as Array<{
        id: string; scope: string; identity: string; scanned_at: string;
        total_savings: number; rec_count: number; vm_count: number; resource_findings_count: number;
      }>;
    return rows.map((r) => ({
      id: r.id,
      scope: r.scope as 'project' | 'org',
      identity: r.identity,
      scannedAt: r.scanned_at,
      totalSavings: r.total_savings,
      recCount: r.rec_count,
      vmCount: r.vm_count,
      resourceFindingsCount: r.resource_findings_count,
    }));
  }

  getGCPOptimizationSnapshot(id: string): GCPOptimizationSnapshot | null {
    if (!this.db) throw new Error('Database not initialized');
    const row = this.db
      .prepare('SELECT data FROM gcp_optimization_snapshots WHERE id = ?')
      .get(id) as { data: string } | undefined;
    if (!row) return null;
    return safeParse<GCPOptimizationSnapshot | null>(row.data, null) as GCPOptimizationSnapshot;
  }

  deleteGCPOptimizationSnapshot(id: string): void {
    if (!this.db) throw new Error('Database not initialized');
    this.db.prepare('DELETE FROM gcp_optimization_snapshots WHERE id = ?').run(id);
  }

  /** Delete scans older than the given number of days, keeping at least `keepMin` scans per profile. */
  pruneOldScans(retentionDays: number = 90, keepMin: number = 10): number {
    if (!this.db) throw new Error('Database not initialized');

    const cutoff = new Date(Date.now() - retentionDays * 86400000).toISOString();
    // Get IDs to delete: older than cutoff, but keep the most recent `keepMin` per profile
    const rows = this.db.prepare(`
      SELECT id FROM scans
      WHERE started_at < ?
        AND id NOT IN (
          SELECT id FROM (
            SELECT id, ROW_NUMBER() OVER (PARTITION BY profile ORDER BY started_at DESC) AS rn
            FROM scans
          ) WHERE rn <= ?
        )
    `).all(cutoff, keepMin) as { id: string }[];

    if (rows.length === 0) return 0;

    const deleteStmt = this.db.prepare('DELETE FROM scans WHERE id = ?');
    const deleteAll = this.db.transaction(() => {
      for (const row of rows) {
        deleteStmt.run(row.id);
      }
    });
    deleteAll();
    return rows.length;
  }

  /** Delete GCP optimization snapshots older than the given number of days. */
  pruneOldSnapshots(retentionDays: number = 90): number {
    if (!this.db) throw new Error('Database not initialized');
    const cutoff = new Date(Date.now() - retentionDays * 86400000).toISOString();
    const result = this.db.prepare('DELETE FROM gcp_optimization_snapshots WHERE scanned_at < ?').run(cutoff);
    return result.changes;
  }

  // GCP Cost Cache operations
  saveGCPCostCacheEntry(entry: GCPCostCacheEntry): void {
    if (!this.db) throw new Error('Database not initialized');
    this.db
      .prepare(
        `INSERT OR REPLACE INTO gcp_cost_cache
         (id, data_type, scope, identity, fetched_at, start_date, end_date, date_range_label, label, filters, total_cost, service_count, data)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        entry.id,
        entry.dataType,
        entry.scope,
        entry.identity,
        entry.fetchedAt,
        entry.startDate,
        entry.endDate,
        entry.dateRangeLabel,
        entry.label,
        entry.filters ? JSON.stringify(entry.filters) : null,
        entry.totalCost,
        entry.serviceCount,
        JSON.stringify(entry.data)
      );
  }

  listGCPCostCacheEntries(identity: string, dataType: string, limit = 20): GCPCostCacheEntry[] {
    if (!this.db) throw new Error('Database not initialized');
    const rows = this.db
      .prepare(
        `SELECT id, data_type, scope, identity, fetched_at, start_date, end_date, date_range_label, label, filters, total_cost, service_count
         FROM gcp_cost_cache WHERE identity = ? AND data_type = ? ORDER BY fetched_at DESC LIMIT ?`
      )
      .all(identity, dataType, limit) as Array<{
        id: string; data_type: string; scope: string; identity: string; fetched_at: string;
        start_date: string; end_date: string; date_range_label: string; label: string;
        filters: string | null; total_cost: number; service_count: number;
      }>;
    return rows.map((r) => ({
      id: r.id,
      dataType: r.data_type as 'cost_analysis' | 'gke_cost',
      scope: r.scope as 'project' | 'org',
      identity: r.identity,
      fetchedAt: r.fetched_at,
      startDate: r.start_date,
      endDate: r.end_date,
      dateRangeLabel: r.date_range_label,
      label: r.label,
      filters: r.filters ? safeParse(r.filters, undefined) : undefined,
      totalCost: r.total_cost,
      serviceCount: r.service_count,
    }));
  }

  getGCPCostCacheEntry(id: string): GCPCostCacheEntry | null {
    if (!this.db) throw new Error('Database not initialized');
    const row = this.db
      .prepare('SELECT * FROM gcp_cost_cache WHERE id = ?')
      .get(id) as any | undefined;
    if (!row) return null;
    return {
      id: row.id,
      dataType: row.data_type,
      scope: row.scope,
      identity: row.identity,
      fetchedAt: row.fetched_at,
      startDate: row.start_date,
      endDate: row.end_date,
      dateRangeLabel: row.date_range_label,
      label: row.label,
      filters: row.filters ? safeParse(row.filters, undefined) : undefined,
      totalCost: row.total_cost,
      serviceCount: row.service_count,
      data: safeParse(row.data, undefined as any),
    };
  }

  getLatestGCPCostCacheEntry(identity: string, dataType: string): GCPCostCacheEntry | null {
    if (!this.db) throw new Error('Database not initialized');
    const row = this.db
      .prepare('SELECT * FROM gcp_cost_cache WHERE identity = ? AND data_type = ? ORDER BY fetched_at DESC LIMIT 1')
      .get(identity, dataType) as any | undefined;
    if (!row) return null;
    return {
      id: row.id,
      dataType: row.data_type,
      scope: row.scope,
      identity: row.identity,
      fetchedAt: row.fetched_at,
      startDate: row.start_date,
      endDate: row.end_date,
      dateRangeLabel: row.date_range_label,
      label: row.label,
      filters: row.filters ? safeParse(row.filters, undefined) : undefined,
      totalCost: row.total_cost,
      serviceCount: row.service_count,
      data: safeParse(row.data, undefined as any),
    };
  }

  deleteGCPCostCacheEntry(id: string): void {
    if (!this.db) throw new Error('Database not initialized');
    this.db.prepare('DELETE FROM gcp_cost_cache WHERE id = ?').run(id);
  }

  pruneGCPCostCache(retentionDays: number = 90, maxPerIdentity: number = 20): number {
    if (!this.db) throw new Error('Database not initialized');
    const cutoff = new Date(Date.now() - retentionDays * 86400000).toISOString();
    // Delete old entries
    const aged = this.db.prepare('DELETE FROM gcp_cost_cache WHERE fetched_at < ?').run(cutoff);
    // Delete overflow entries per identity+data_type
    const overflow = this.db.prepare(`
      DELETE FROM gcp_cost_cache WHERE id IN (
        SELECT id FROM (
          SELECT id, ROW_NUMBER() OVER (PARTITION BY identity, data_type ORDER BY fetched_at DESC) AS rn
          FROM gcp_cost_cache
        ) WHERE rn > ?
      )
    `).run(maxPerIdentity);
    return aged.changes + overflow.changes;
  }

  // Chat operations
  createConversation(id: string, title: string, provider: string): void {
    if (!this.db) throw new Error('Database not initialized');
    this.db.prepare(
      'INSERT INTO chat_conversations (id, title, provider) VALUES (?, ?, ?)'
    ).run(id, title, provider);
  }

  listConversations(limit = 50): Array<{ id: string; title: string; provider: string; created_at: string; updated_at: string }> {
    if (!this.db) throw new Error('Database not initialized');
    return this.db.prepare(
      'SELECT * FROM chat_conversations ORDER BY updated_at DESC LIMIT ?'
    ).all(limit) as Array<{ id: string; title: string; provider: string; created_at: string; updated_at: string }>;
  }

  getConversation(id: string): { id: string; title: string; provider: string; created_at: string; updated_at: string } | null {
    if (!this.db) throw new Error('Database not initialized');
    return (this.db.prepare('SELECT * FROM chat_conversations WHERE id = ?').get(id) as any) || null;
  }

  deleteConversation(id: string): void {
    if (!this.db) throw new Error('Database not initialized');
    this.db.prepare('DELETE FROM chat_conversations WHERE id = ?').run(id);
  }

  updateConversationTitle(id: string, title: string): void {
    if (!this.db) throw new Error('Database not initialized');
    this.db.prepare(
      'UPDATE chat_conversations SET title = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(title, id);
  }

  touchConversation(id: string): void {
    if (!this.db) throw new Error('Database not initialized');
    this.db.prepare(
      'UPDATE chat_conversations SET updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(id);
  }

  addChatMessage(msg: { id: string; conversationId: string; role: string; content: string; toolName?: string; toolInput?: string; toolUseId?: string }): void {
    if (!this.db) throw new Error('Database not initialized');
    this.db.prepare(
      'INSERT INTO chat_messages (id, conversation_id, role, content, tool_name, tool_input, tool_use_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(msg.id, msg.conversationId, msg.role, msg.content, msg.toolName || null, msg.toolInput || null, msg.toolUseId || null);
    this.touchConversation(msg.conversationId);
  }

  getChatMessages(conversationId: string): Array<{ id: string; conversation_id: string; role: string; content: string; tool_name: string | null; tool_input: string | null; tool_use_id: string | null; created_at: string }> {
    if (!this.db) throw new Error('Database not initialized');
    return this.db.prepare(
      'SELECT * FROM chat_messages WHERE conversation_id = ? ORDER BY created_at ASC'
    ).all(conversationId) as any[];
  }

  // ── GCP Credential operations ──

  createGCPCredential(projectId: string, encryptedCredentials: string, label?: string, googleEmail?: string): string {
    if (!this.db) throw new Error('Database not initialized');
    const id = require('crypto').randomUUID();
    this.db.prepare(
      `INSERT INTO gcp_credentials (id, project_id, label, google_email, encrypted_credentials)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(project_id) DO UPDATE SET
         encrypted_credentials = excluded.encrypted_credentials,
         label = excluded.label,
         google_email = excluded.google_email,
         updated_at = CURRENT_TIMESTAMP`
    ).run(id, projectId, label || '', googleEmail || null, encryptedCredentials);
    return id;
  }

  getGCPCredentialByProjectId(projectId: string): { id: string; project_id: string; label: string; google_email: string | null; encrypted_credentials: string; created_at: string; updated_at: string } | null {
    if (!this.db) throw new Error('Database not initialized');
    return this.db.prepare('SELECT * FROM gcp_credentials WHERE project_id = ?').get(projectId) as any || null;
  }

  getAllGCPCredentials(): Array<{ id: string; project_id: string; label: string; google_email: string | null; encrypted_credentials: string; created_at: string; updated_at: string }> {
    if (!this.db) throw new Error('Database not initialized');
    return this.db.prepare('SELECT * FROM gcp_credentials ORDER BY updated_at DESC').all() as any[];
  }

  deleteGCPCredential(projectId: string): void {
    if (!this.db) throw new Error('Database not initialized');
    this.db.prepare('DELETE FROM gcp_credentials WHERE project_id = ?').run(projectId);
  }

  updateGCPCredentialLabel(projectId: string, label: string): void {
    if (!this.db) throw new Error('Database not initialized');
    this.db.prepare(
      'UPDATE gcp_credentials SET label = ?, updated_at = CURRENT_TIMESTAMP WHERE project_id = ?'
    ).run(label, projectId);
  }

  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  private mapScanRow(row: RawScan): Scan {
    return {
      id: row.id,
      profile: row.profile,
      regions: safeParse<string[]>(row.regions, []),
      services: safeParse<(ServiceType | GCPServiceType)[]>(row.services, []),
      startedAt: row.started_at,
      completedAt: row.completed_at || undefined,
      status: row.status as ScanStatus,
      resourceCount: row.resource_count,
      error: row.error || undefined,
      cloudProvider: (row.cloud_provider as CloudProvider) || 'aws',
    };
  }

  // ── AWS Security Scan CRUD ──
  createAWSSecurityScan(result: any): void {
    if (!this.db) throw new Error('Database not initialized');
    const findings = result.findings || result.bestPractices || [];
    this.db.prepare(
      `INSERT INTO aws_security_scans (id, profile, region, timestamp, scan_mode, total_findings, critical_count, high_count, medium_count, low_count, duration, data)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(result.id, result.profileName || result.profile || '', result.region || 'us-east-1', result.timestamp || new Date().toISOString(),
      result.scanMode || 'best-practices', findings.length,
      findings.filter((f: any) => f.severity === 'CRITICAL').length,
      findings.filter((f: any) => f.severity === 'HIGH').length,
      findings.filter((f: any) => f.severity === 'MEDIUM').length,
      findings.filter((f: any) => f.severity === 'LOW').length,
      result.duration || 0, JSON.stringify(result));
  }
  getAllAWSSecurityScans(profileName?: string, limit = 20): any[] {
    if (!this.db) throw new Error('Database not initialized');
    const q = profileName
      ? 'SELECT id, profile, region, timestamp, scan_mode, total_findings, critical_count, high_count, medium_count, low_count, duration FROM aws_security_scans WHERE profile = ? ORDER BY timestamp DESC LIMIT ?'
      : 'SELECT id, profile, region, timestamp, scan_mode, total_findings, critical_count, high_count, medium_count, low_count, duration FROM aws_security_scans ORDER BY timestamp DESC LIMIT ?';
    const rows = profileName ? this.db.prepare(q).all(profileName, limit) : this.db.prepare(q).all(limit);
    return (rows as any[]).map(r => ({ id: r.id, profileName: r.profile, region: r.region, timestamp: r.timestamp, scanMode: r.scan_mode, totalFindings: r.total_findings, criticalCount: r.critical_count, highCount: r.high_count, mediumCount: r.medium_count, lowCount: r.low_count, duration: r.duration }));
  }
  getAWSSecurityScan(id: string): any { if (!this.db) throw new Error('Database not initialized'); const row = this.db.prepare('SELECT data FROM aws_security_scans WHERE id = ?').get(id) as any; return row ? safeParse(row.data, null) : null; }
  deleteAWSSecurityScan(id: string): void { if (!this.db) throw new Error('Database not initialized'); this.db.prepare('DELETE FROM aws_security_scans WHERE id = ?').run(id); }

  // ── AWS IAM Analysis CRUD ──
  createAWSIAMAnalysis(result: any): void {
    if (!this.db) throw new Error('Database not initialized');
    this.db.prepare(
      `INSERT INTO aws_iam_analyses (id, profile, timestamp, unused_roles_count, permissive_count, cross_account_count, user_issues_count, duration, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(result.id, result.profileName || result.profile || '', result.timestamp || new Date().toISOString(),
      result.unusedRoles?.length || 0, result.permissivePolicies?.length || 0, result.crossAccountTrusts?.length || 0,
      result.userAnalysis?.issues?.length || 0,
      result.duration || 0, JSON.stringify(result));
  }
  getAllAWSIAMAnalyses(profileName?: string, limit = 20): any[] {
    if (!this.db) throw new Error('Database not initialized');
    const q = profileName
      ? 'SELECT id, profile, timestamp, unused_roles_count, permissive_count, cross_account_count, user_issues_count, duration FROM aws_iam_analyses WHERE profile = ? ORDER BY timestamp DESC LIMIT ?'
      : 'SELECT id, profile, timestamp, unused_roles_count, permissive_count, cross_account_count, user_issues_count, duration FROM aws_iam_analyses ORDER BY timestamp DESC LIMIT ?';
    const rows = profileName ? this.db.prepare(q).all(profileName, limit) : this.db.prepare(q).all(limit);
    return (rows as any[]).map(r => ({ id: r.id, profileName: r.profile, timestamp: r.timestamp, unusedRolesCount: r.unused_roles_count, permissiveCount: r.permissive_count, crossAccountCount: r.cross_account_count, userIssuesCount: r.user_issues_count, duration: r.duration }));
  }
  getAWSIAMAnalysis(id: string): any { if (!this.db) throw new Error('Database not initialized'); const row = this.db.prepare('SELECT data FROM aws_iam_analyses WHERE id = ?').get(id) as any; return row ? safeParse(row.data, null) : null; }
  deleteAWSIAMAnalysis(id: string): void { if (!this.db) throw new Error('Database not initialized'); this.db.prepare('DELETE FROM aws_iam_analyses WHERE id = ?').run(id); }

  // ── AWS Compliance CRUD ──
  createAWSCompliance(result: any): void {
    if (!this.db) throw new Error('Database not initialized');
    this.db.prepare(
      `INSERT INTO aws_compliance (id, profile, region, framework_id, framework_name, timestamp, pass_count, fail_count, total_controls, duration, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(result.id, result.profileName || result.profile || '', result.region || 'us-east-1',
      result.frameworkId || '', result.frameworkName || '', result.timestamp || new Date().toISOString(),
      result.passedControls || 0, result.failedControls || 0, result.totalControls || 0,
      result.duration || 0, JSON.stringify(result));
  }
  getAllAWSCompliance(profileName?: string, limit = 20): any[] {
    if (!this.db) throw new Error('Database not initialized');
    const q = profileName
      ? 'SELECT id, profile, region, framework_id, framework_name, timestamp, pass_count, fail_count, total_controls, duration FROM aws_compliance WHERE profile = ? ORDER BY timestamp DESC LIMIT ?'
      : 'SELECT id, profile, region, framework_id, framework_name, timestamp, pass_count, fail_count, total_controls, duration FROM aws_compliance ORDER BY timestamp DESC LIMIT ?';
    const rows = profileName ? this.db.prepare(q).all(profileName, limit) : this.db.prepare(q).all(limit);
    return (rows as any[]).map(r => ({ id: r.id, profileName: r.profile, region: r.region, frameworkId: r.framework_id, frameworkName: r.framework_name, timestamp: r.timestamp, passCount: r.pass_count, failCount: r.fail_count, totalControls: r.total_controls, duration: r.duration }));
  }
  getAWSCompliance(id: string): any { if (!this.db) throw new Error('Database not initialized'); const row = this.db.prepare('SELECT data FROM aws_compliance WHERE id = ?').get(id) as any; return row ? safeParse(row.data, null) : null; }
  deleteAWSCompliance(id: string): void { if (!this.db) throw new Error('Database not initialized'); this.db.prepare('DELETE FROM aws_compliance WHERE id = ?').run(id); }

  // ── AWS Well-Architected CRUD ──
  createAWSWellArchitected(result: any): void {
    if (!this.db) throw new Error('Database not initialized');
    const checks = result.checks || result.bestPractices || [];
    this.db.prepare(
      `INSERT INTO aws_well_architected (id, profile, region, timestamp, total_checks, pass_count, warn_count, fail_count, duration, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(result.id, result.profileName || result.profile || '', result.region || 'us-west-2',
      result.timestamp || new Date().toISOString(), checks.length,
      checks.filter((c: any) => c.status === 'pass' || c.status === 'PASS').length,
      checks.filter((c: any) => c.status === 'warn' || c.status === 'WARNING').length,
      checks.filter((c: any) => c.status === 'fail' || c.status === 'FAIL').length,
      result.duration || 0, JSON.stringify(result));
  }
  getAllAWSWellArchitected(profileName?: string, limit = 20): any[] {
    if (!this.db) throw new Error('Database not initialized');
    const q = profileName
      ? 'SELECT id, profile, region, timestamp, total_checks, pass_count, warn_count, fail_count, duration FROM aws_well_architected WHERE profile = ? ORDER BY timestamp DESC LIMIT ?'
      : 'SELECT id, profile, region, timestamp, total_checks, pass_count, warn_count, fail_count, duration FROM aws_well_architected ORDER BY timestamp DESC LIMIT ?';
    const rows = profileName ? this.db.prepare(q).all(profileName, limit) : this.db.prepare(q).all(limit);
    return (rows as any[]).map(r => ({ id: r.id, profileName: r.profile, region: r.region, timestamp: r.timestamp, totalChecks: r.total_checks, passCount: r.pass_count, warnCount: r.warn_count, failCount: r.fail_count, duration: r.duration }));
  }
  getAWSWellArchitected(id: string): any { if (!this.db) throw new Error('Database not initialized'); const row = this.db.prepare('SELECT data FROM aws_well_architected WHERE id = ?').get(id) as any; return row ? safeParse(row.data, null) : null; }
  deleteAWSWellArchitected(id: string): void { if (!this.db) throw new Error('Database not initialized'); this.db.prepare('DELETE FROM aws_well_architected WHERE id = ?').run(id); }

  // ── AWS Network Analysis CRUD ──
  createAWSNetworkAnalysis(result: any): void {
    if (!this.db) throw new Error('Database not initialized');
    const resources = result.resources || result.findings || [];
    this.db.prepare(
      `INSERT INTO aws_network_analysis (id, profile, region, timestamp, total_resources, publicly_accessible, duration, data) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(result.id, result.profileName || result.profile || '', result.region || 'us-east-1',
      result.timestamp || new Date().toISOString(), resources.length,
      resources.filter((r: any) => r.publiclyAccessible || r.isPublic).length,
      result.duration || 0, JSON.stringify(result));
  }
  getAllAWSNetworkAnalyses(profileName?: string, limit = 20): any[] {
    if (!this.db) throw new Error('Database not initialized');
    const q = profileName
      ? 'SELECT id, profile, region, timestamp, total_resources, publicly_accessible, duration FROM aws_network_analysis WHERE profile = ? ORDER BY timestamp DESC LIMIT ?'
      : 'SELECT id, profile, region, timestamp, total_resources, publicly_accessible, duration FROM aws_network_analysis ORDER BY timestamp DESC LIMIT ?';
    const rows = profileName ? this.db.prepare(q).all(profileName, limit) : this.db.prepare(q).all(limit);
    return (rows as any[]).map(r => ({ id: r.id, profileName: r.profile, region: r.region, timestamp: r.timestamp, totalResources: r.total_resources, publiclyAccessible: r.publicly_accessible, duration: r.duration }));
  }
  getAWSNetworkAnalysis(id: string): any { if (!this.db) throw new Error('Database not initialized'); const row = this.db.prepare('SELECT data FROM aws_network_analysis WHERE id = ?').get(id) as any; return row ? safeParse(row.data, null) : null; }
  deleteAWSNetworkAnalysis(id: string): void { if (!this.db) throw new Error('Database not initialized'); this.db.prepare('DELETE FROM aws_network_analysis WHERE id = ?').run(id); }

  private mapResourceRow(row: RawResource): Resource {
    return {
      id: row.id,
      scanId: row.scan_id,
      service: row.service as ServiceType | GCPServiceType,
      resourceType: row.resource_type,
      region: row.region,
      name: row.name || '',
      tags: safeParse(row.tags, {}),
      data: safeParse(row.data, {}),
      createdAt: row.created_at || undefined,
      cloudProvider: (row.cloud_provider as CloudProvider) || 'aws',
    };
  }
}

// Raw database row types
interface RawScan {
  id: string;
  profile: string;
  regions: string;
  services: string;
  started_at: string;
  completed_at: string | null;
  status: string;
  resource_count: number;
  error: string | null;
  cloud_provider: string;
}

interface RawResource {
  id: string;
  scan_id: string;
  service: string;
  resource_type: string;
  region: string;
  name: string | null;
  tags: string | null;
  data: string | null;
  created_at: string | null;
  cloud_provider: string;
}

interface RawRelationship {
  id: number;
  scan_id: string;
  source_arn: string;
  target_arn: string;
  relationship_type: string;
}

interface RawAssessment {
  id: string;
  profile: string;
  region: string;
  account_id: string | null;
  timestamp: string;
  overall_score: number;
  overall_grade: string;
  total_recommendations: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  duration: number;
}

interface RawGCPAssessment {
  id: string;
  project_id: string;
  timestamp: string;
  overall_score: number;
  overall_grade: string;
  total_recommendations: number;
  critical_count: number;
  high_count: number;
  medium_count: number;
  low_count: number;
  duration: number;
}

interface RawGCPIAMAnalysis {
  id: string;
  project_id: string;
  analyzed_at: string;
  unused_service_account_count: number;
  permissive_binding_count: number;
  key_issue_count: number;
  cross_project_count: number;
  total_findings: number;
  duration: number;
}

interface RawSchedule {
  id: string;
  name: string;
  profile_name: string;
  regions: string;
  services: string;
  frequency: string;
  enabled: number;
  auto_assess: number;
  last_run_at: string | null;
  next_run_at: string | null;
  created_at: string;
  provider: string;
  project_id: string | null;
}

export interface RawAppProfile {
  id: string;
  name: string;
  credential_type: string;
  region: string | null;
  encrypted_access_key_id: string | null;
  encrypted_secret_access_key: string | null;
  encrypted_session_token: string | null;
  sso_start_url: string | null;
  sso_region: string | null;
  sso_account_id: string | null;
  sso_role_name: string | null;
  assume_role_arn: string | null;
  encrypted_external_id: string | null;
  source_profile: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface RawAppProfileInsert {
  name: string;
  credential_type: string;
  region?: string;
  encrypted_access_key_id?: string;
  encrypted_secret_access_key?: string;
  encrypted_session_token?: string;
  sso_start_url?: string;
  sso_region?: string;
  sso_account_id?: string;
  sso_role_name?: string;
  assume_role_arn?: string;
  encrypted_external_id?: string;
  source_profile?: string;
  description?: string;
}

# Database Schema

## Overview

The app uses SQLite via `better-sqlite3` with WAL mode enabled for concurrent read performance. The database file is stored in the Electron app data directory (or current directory in server mode).

Database manager: `src/main/database/db-manager.ts`

## Configuration

```sql
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
```

## Tables

### scans

Tracks scan metadata and status.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PRIMARY KEY | UUID |
| profile | TEXT | AWS profile or GCP project name |
| regions | TEXT | JSON array of regions |
| services | TEXT | JSON array of service types |
| started_at | TEXT | ISO 8601 timestamp |
| completed_at | TEXT | ISO 8601 timestamp (nullable) |
| status | TEXT | pending, running, completed, failed, cancelled |
| resource_count | INTEGER | Total resources discovered |
| error | TEXT | Error message (nullable) |
| group_id | TEXT | Multi-account scan group ID (nullable) |
| cloud_provider | TEXT | 'aws' or 'gcp' (default 'aws') |

### resources

Discovered cloud resources.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT | ARN (AWS) or selfLink (GCP) |
| scan_id | TEXT | Foreign key to scans.id |
| service | TEXT | Service type (e.g., 'ec2', 'gce') |
| resource_type | TEXT | Specific type (e.g., 'EC2::Instance') |
| region | TEXT | AWS region or GCP zone |
| name | TEXT | Resource name |
| tags | TEXT | JSON object of tags |
| data | TEXT | JSON object of resource-specific data |
| created_at | TEXT | Resource creation date (nullable) |
| cloud_provider | TEXT | 'aws' or 'gcp' |

**Indexes**: `(scan_id)`, `(scan_id, service)`, `(scan_id, region)`

### relationships

Resource-to-resource connections.

| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER PRIMARY KEY AUTOINCREMENT | |
| scan_id | TEXT | Foreign key to scans.id |
| source_arn | TEXT | Source resource ID |
| target_arn | TEXT | Target resource ID |
| relationship_type | TEXT | contains, member_of, targets, routes_to, serves, attached_to, uses, depends_on |

**Index**: `(scan_id)`

### settings

Key-value application settings.

| Column | Type | Description |
|--------|------|-------------|
| key | TEXT PRIMARY KEY | Setting name |
| value | TEXT | JSON-encoded value |

### schedules

Recurring scan configurations.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PRIMARY KEY | UUID |
| name | TEXT | Schedule name |
| profile_name | TEXT | AWS profile name |
| regions | TEXT | JSON array |
| services | TEXT | JSON array |
| frequency | TEXT | hourly, daily, weekly |
| enabled | INTEGER | 0 or 1 |
| auto_assess | INTEGER | Run assessment after scan (0/1) |
| last_run_at | TEXT | Last execution timestamp |
| next_run_at | TEXT | Next scheduled execution |
| created_at | TEXT | Creation timestamp |

### scan_groups

Multi-account scan grouping.

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PRIMARY KEY | UUID |
| profile_names | TEXT | JSON array of profile names |
| regions | TEXT | JSON array |
| services | TEXT | JSON array |
| started_at | TEXT | ISO 8601 |
| completed_at | TEXT | ISO 8601 (nullable) |
| status | TEXT | running, completed, partial, failed |

### app_profiles

Encrypted credential storage (managed by auth system).

| Column | Type | Description |
|--------|------|-------------|
| id | TEXT PRIMARY KEY | UUID |
| name | TEXT UNIQUE | Profile display name |
| credential_type | TEXT | iam_keys, sso_config, assume_role |
| encrypted_data | TEXT | AES-256-GCM encrypted JSON |
| region | TEXT | Default region (nullable) |
| description | TEXT | Description (nullable) |
| created_at | TEXT | Creation timestamp |
| updated_at | TEXT | Last update timestamp |

Non-secret fields (SSO URL, role ARN, etc.) are stored alongside encrypted data for display purposes.

### assessments

Assessment result storage (implicit via settings or dedicated table).

Assessment results are persisted as JSON in the database for history and comparison.

## Migrations

Migrations run automatically at startup. The `db-manager.ts` tracks applied migrations and applies new ones sequentially.

## Key Operations

### Scan CRUD

```typescript
dbManager.createScan(scan: Scan): void
dbManager.updateScan(id: string, updates: Partial<Scan>): void
dbManager.getScanById(id: string): Scan | null
dbManager.getAllScans(): Scan[]
dbManager.deleteScan(id: string): void
```

### Resource Storage

```typescript
dbManager.saveResources(resources: Resource[]): void
dbManager.getResourcesByScan(scanId: string): Resource[]
dbManager.searchResources(scanId: string, query: string): Resource[]
```

### Relationship Storage

```typescript
dbManager.saveRelationships(relationships: Relationship[]): void
dbManager.getRelationshipsByScan(scanId: string): Relationship[]
```

### Schedule Management

```typescript
dbManager.createSchedule(schedule: ScanSchedule): void
dbManager.getSchedules(): ScanSchedule[]
dbManager.updateSchedule(id: string, updates: Partial<ScanSchedule>): void
dbManager.deleteSchedule(id: string): void
```

### Profile Encryption

On password change, all `app_profiles` rows are atomically re-encrypted:
1. Decrypt all profiles with old key
2. Re-encrypt with new key
3. Update all rows in a single transaction

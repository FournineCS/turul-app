# Architecture

## Overview

The app runs as a desktop application. The React frontend communicates with the Electron main process exclusively via IPC.

```
┌──────────────────────────────────────────────────────────┐
│                    React Frontend                         │
│  (Pages, Components, Zustand Stores)                      │
│  src/renderer/                                            │
├──────────────────────────────────────────────────────────┤
│              Electron IPC (preload.ts)                    │
│              window.electronAPI.*                         │
├──────────────────────────────────────────────────────────┤
│                  Backend Services                          │
│  AWS SDK v3  │  GCP SDKs  │  SQLite  │  Report Gen        │
│  src/main/aws/  src/main/gcp/  src/main/database/         │
├──────────────────────────────────────────────────────────┤
│              Electron Main Process                         │
│              src/main/index.ts                            │
└──────────────────────────────────────────────────────────┘
```

## Execution Model

- Entry: `src/main/index.ts`
- Communication: IPC via `contextBridge` (`preload.ts`)
- Renderer loads from Vite dev server (dev) or `dist/renderer/index.html` (prod)
- All AWS/GCP SDK calls, SQLite reads/writes, and file I/O run in the main process

## Directory Structure

```
src/
├── main/                              # Backend (Node.js / Electron main process)
│   ├── index.ts                       # Electron entry point
│   ├── preload.ts                     # IPC bridge (contextIsolation)
│   │
│   ├── ai/                            # AI Chat backend
│   │   ├── ai-service.ts              # Tool loop (max 10 rounds), streaming AsyncGenerator
│   │   ├── ai-provider.ts             # Provider interface
│   │   ├── system-prompt.ts           # System prompt
│   │   ├── providers/                 # bedrock-provider.ts (ConverseStreamCommand)
│   │   └── tools/                     # aws-tools.ts, db-tools.ts, gcp-tools.ts, tool-registry.ts
│   │
│   ├── auth/                          # Authentication
│   │   ├── auth-service.ts            # Scrypt password hashing, session management
│   │   ├── crypto-service.ts          # AES-256-GCM encryption/decryption
│   │   ├── app-profile-manager.ts     # Encrypted AWS profile storage in SQLite
│   │   └── biometric-service.ts       # Touch ID via Electron safeStorage (macOS)
│   │
│   ├── aws/                           # AWS integration
│   │   ├── client-factory.ts          # SDK v3 client management (122 clients)
│   │   ├── scanners/                  # 117 service scanner files
│   │   │   ├── base-scanner.ts        # Abstract base class
│   │   │   └── ...
│   │   ├── discovery/                 # Cost Explorer, tagging API, resource checks
│   │   ├── security/                  # Security Hub + best practices + compliance
│   │   │   ├── best-practices/        # EC2, S3, IAM, RDS, CloudTrail, KMS, VPC checks
│   │   │   └── compliance/            # CIS AWS v3 framework (cis-controls.ts)
│   │   ├── well-architected/          # Well-Architected Tool API
│   │   ├── iam-analysis/              # Unused roles, overly permissive, cross-account trust
│   │   └── network-analysis/          # EC2/RDS reachability via security groups + NACLs
│   │
│   ├── gcp/                           # GCP integration
│   │   ├── client-factory.ts          # GCP SDK client management (36 imports, 119 getters)
│   │   ├── auth-manager.ts            # OAuth 2.0
│   │   ├── project-manager.ts         # Multi-project support (billing-enabled filter)
│   │   ├── scanners/                  # 85 GCP service scanners
│   │   ├── cost/                      # Billing, CUD, recommendations, GKE costs
│   │   └── security/                  # SCC + best practices
│   │
│   ├── database/                      # Data persistence
│   │   └── db-manager.ts              # SQLite via better-sqlite3 (WAL mode, 12 migrations)
│   │
│   ├── health/                        # Startup validation
│   │   └── environment-checker.ts     # Environment health checks
│   │
│   ├── scanning/                      # Orchestration
│   │   ├── scan-orchestrator.ts       # AWS scan controller
│   │   ├── gcp-scan-orchestrator.ts   # GCP scan controller
│   │   ├── multi-account-orchestrator.ts
│   │   ├── scan-scheduler.ts          # Recurring scans (hourly/daily/weekly)
│   │   ├── relationship-builder.ts    # AWS resource relationships
│   │   ├── gcp-relationship-builder.ts
│   │   └── scan-diff.ts               # Scan comparison
│   │
│   ├── assessment/                    # Multi-dimensional scoring (A-F grades)
│   ├── reports/                       # PDF, Excel, CSV generators (pdfkit, exceljs)
│   │
│   └── ipc/                           # Electron IPC handlers (10 files)
│       ├── index.ts                   # Handler registration
│       ├── aws-handlers.ts
│       ├── gcp-handlers.ts
│       ├── auth-handlers.ts
│       ├── app-handlers.ts
│       ├── chat-handlers.ts
│       ├── resource-handlers.ts
│       ├── profile-handlers.ts
│       ├── validation.ts
│       └── ipc-utils.ts
│
├── renderer/                          # Frontend (React)
│   ├── App.tsx                        # Router + sidebar layout (19 nav items + Settings footer)
│   ├── main.tsx                       # React entry point
│   ├── pages/                         # 22 page components
│   ├── components/                    # 80+ component files organized by feature
│   ├── stores/                        # 21 Zustand stores
│   ├── utils/                         # Helpers
│   └── styles/                        # CSS files
│
└── shared/                            # Shared between main & renderer
    └── types/
        ├── index.ts                   # Barrel export
        ├── common.ts                  # Provider-agnostic types
        ├── aws.ts                     # AWS-specific types
        ├── gcp.ts                     # GCP-specific types
        └── chat.ts                    # AI Chat types
```

## Data Flow

### Scan Lifecycle

```
User clicks "Start Scan"
  → Store calls electronAPI.scan.start(config)
  → IPC → ScanOrchestrator
    → Creates scan record in SQLite
    → For each region:
      → For each service:
        → Instantiate scanner (e.g., EC2Scanner)
        → Scanner calls AWS SDK APIs with rate limiting
        → Returns Resource[] + errors
        → Resources saved to SQLite
        → Progress event sent (webContents.send → ipcRenderer.on)
    → RelationshipBuilder maps resource connections
    → Relationships saved to SQLite
    → Scan status updated to 'completed'
  → Store receives progress updates → UI re-renders
```

### Assessment Pipeline

```
AssessmentOrchestrator.run(config)
  ├── Cost analysis (Cost Explorer API)
  ├── Security scan (best practices checks)
  ├── Well-Architected review (BP scan or API)
  ├── Resource scan (optional)
  └── Compliance assessment (CIS v3 mapping)
  → DomainScore[] computed (0-100 per domain)
  → Overall grade (A-F) derived from weighted scores
  → Results persisted to SQLite
```

## Key Design Patterns

### Scanner Pattern
All scanners extend `BaseScanner` which provides:
- `createResource()` - Standardized resource creation
- `createError()` - Error wrapping
- `parseTags()` / `parseTagsLowercase()` - AWS tag normalization
- `withRateLimit()` - Per-service rate limiting

### Client Factory (Singleton)
`getClientFactory()` returns a singleton that caches AWS/GCP SDK clients keyed by `(service, region, profile)`. Avoids creating duplicate clients across scan operations.

### IPC Handler Structure
Each IPC handler file registers a set of related channels on the `ipcMain` object. `preload.ts` exposes a typed `window.electronAPI` object that maps to those channels. Stores and components call `window.electronAPI.*` without knowing the IPC channel names.

### Progress Streaming
Long-running operations (scans, reports, assessments) stream progress via `webContents.send()` in the main process and `ipcRenderer.on()` in the renderer via preload listeners.

### Global Service Deduplication
CloudFront, Route53, and IAM are global (not region-scoped). The scan orchestrator tracks which global services have been scanned and skips them on subsequent regions.

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Desktop Runtime | Electron 28 |
| Frontend | React 18, React Router 6 |
| Build | Vite 5, TypeScript 5.3 |
| State | Zustand 4.5 |
| Database | SQLite (better-sqlite3 9.4) |
| AWS | AWS SDK v3 (122 clients) |
| GCP | Google Cloud SDKs (36 libraries) |
| Visualization | D3 7.8, React Flow 12, dagre |
| Auth | Scrypt (hashing), AES-256-GCM (encryption) |
| AI Chat | AWS Bedrock (ConverseStreamCommand) |
| Reports | pdfkit, exceljs |
| Packaging | electron-builder |

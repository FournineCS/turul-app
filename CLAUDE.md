# Turul - Development Notes

## Running the App

### Electron (Desktop) Mode
**Recommended approach** (most reliable):
```bash
npm run dev:simple
```

Or manually:
```bash
npm run dev:vite &
npx electron .
```

**Why `npm run dev` may not work:**
- Uses `wait-on` which can get stuck; `dev:simple` uses a sleep delay instead

## Build Commands

```bash
npm run build              # Compile Vite + Electron (runs build:vite then build:electron)
npm run package            # Current platform
npm run package:mac        # macOS
npm run package:win        # Windows
npm run package:linux      # Linux
```

## Project Structure

```
src/
├── main/                          # Electron main process (Node.js)
│   ├── index.ts                   # Electron entry point
│   ├── preload.ts                 # IPC bridge (contextIsolation)
│   ├── auth/                      # Auth service
│   │   ├── auth-service.ts        # Password-based auth, session management
│   │   ├── biometric-service.ts   # Touch ID (macOS)
│   │   ├── crypto-service.ts      # AES-256-GCM encryption/decryption
│   │   └── app-profile-manager.ts # App-level profile persistence
│   ├── ai/                        # AI Chat backend
│   │   ├── ai-service.ts          # Tool loop, streaming via AsyncGenerator
│   │   ├── ai-provider.ts         # Provider interface
│   │   ├── system-prompt.ts       # System prompt
│   │   ├── providers/             # bedrock-provider.ts (primary)
│   │   └── tools/                 # aws-tools.ts, db-tools.ts, gcp-tools.ts, tool-registry.ts
│   ├── aws/
│   │   ├── client-factory.ts      # AWS SDK v3 client management (122 clients)
│   │   ├── profile-manager.ts     # AWS profile/credential management
│   │   ├── rate-limiter.ts        # Per-service API rate limiting
│   │   ├── scanners/              # 117 service scanner files
│   │   ├── iam-analysis/          # IAM security analysis (6 files: unused-roles, overly-permissive, cross-account-trust, password-policy, types, index)
│   │   ├── network-analysis/      # EC2/RDS reachability (reachability.ts, types.ts, index.ts)
│   │   ├── discovery/             # cost-explorer.ts, cost-resource-checks.ts, discovery-engine.ts, tagging-api.ts
│   │   ├── security/
│   │   │   ├── security-hub.ts    # Security Hub integration
│   │   │   ├── best-practices/    # EC2, S3, IAM, RDS, CloudTrail, KMS, VPC checks + index + types
│   │   │   └── compliance/        # CIS AWS v3 framework (cis-controls.ts, index.ts, types.ts)
│   │   └── well-architected/      # Workloads, lens reviews, improvements, best-practices/, types, index
│   ├── gcp/
│   │   ├── client-factory.ts      # GCP SDK client management (36 imports, 119 getters)
│   │   ├── auth-manager.ts        # gcloud ADC login/revoke via CLI subprocess
│   │   ├── gcloud-resolver.ts     # Cross-platform gcloud binary path resolver (cached, DB-backed)
│   │   ├── project-manager.ts     # Multi-project support
│   │   ├── scanners/              # 85 GCP service scanners
│   │   ├── assessment/            # Multi-dimensional scoring (orchestrator.ts, scoring.ts, types.ts, index.ts)
│   │   ├── iam-analysis/          # Service account analysis (unused-service-accounts.ts, overly-permissive.ts, service-account-keys.ts, cross-project-bindings.ts, types.ts, index.ts)
│   │   ├── label-governance/      # Label compliance pipeline (index.ts, types.ts)
│   │   ├── network-analysis/      # VPC reachability (reachability.ts, vpc-analysis.ts, types.ts, index.ts)
│   │   ├── cost/                  # Billing, CUD, recommendations, GKE costs, idle resources, stopped VMs (11 files)
│   │   ├── security/
│   │   │   ├── scc-integration.ts # Security Command Center
│   │   │   ├── best-practices.ts  # GCP best practices checks
│   │   │   └── compliance/        # CIS GCP framework (cis-gcp-controls.ts, index.ts)
│   │   └── well-architected/      # 5 pillar check files + index + types (GCP-native, no API dependency)
│   ├── database/
│   │   └── db-manager.ts          # SQLite (better-sqlite3, WAL mode, 20 migrations)
│   ├── health/
│   │   └── environment-checker.ts # Validates gcloud, AWS CLI, credentials at startup
│   ├── scanning/                  # scan-orchestrator.ts, gcp-scan-orchestrator.ts, multi-account-orchestrator.ts, relationship-builder.ts, gcp-relationship-builder.ts, scan-scheduler.ts, scan-diff.ts
│   ├── assessment/                # AWS assessment (orchestrator.ts, scoring.ts, recommendations.ts, index.ts)
│   ├── reports/                   # assessment-pdf-generator.ts, cost-export.ts, cost-pdf-generator.ts, csv-generator.ts, excel-generator.ts, gke-cost-export.ts, gke-cost-pdf-generator.ts, optimization-export.ts, optimization-pdf-generator.ts, pdf-chart-helpers.ts, pdf-generator.ts
│   └── ipc/                       # 10 Electron IPC handler files: app-handlers.ts, auth-handlers.ts, aws-handlers.ts, chat-handlers.ts, gcp-handlers.ts, profile-handlers.ts, resource-handlers.ts, ipc-utils.ts, validation.ts, index.ts
├── renderer/                      # React frontend (Vite)
│   ├── App.tsx                    # Router + sidebar (21 nav items filtered by provider; Settings/Profiles/Lock in sidebar footer)
│   ├── main.tsx                   # React entry
│   ├── pages/                     # 24 page components
│   ├── components/                # 81 component files across: assessment/, auth/, chat/, costs/, dashboard/, profiles/, scan/, schedule/, security/, settings/, tag-governance/, topology/, well-architected/ + top-level shared components
│   ├── stores/                    # 22 Zustand stores
│   ├── styles/                    # global.css, auth.css, chat.css, help.css, profiles.css
│   └── utils/                     # csv-export.ts
└── shared/types/                  # index.ts (barrel), common.ts, aws.ts, gcp.ts, chat.ts
```

## Key Features

- **Desktop App**: Electron with React frontend (IPC bridge); desktop-only, no HTTP server mode
- **AWS Scanning**: 117 service scanners with multi-region, multi-account support
- **GCP Scanning**: 85 service scanners with multi-project support
- **Cost Analysis**: AWS Cost Explorer + GCP Billing (trends, forecasts, recommendations); GKE cluster/namespace/workload cost drill-down; GCP optimization with idle resource and stopped VM analysis
- **Security**: AWS Security Hub, Best Practices, GCP SCC, CIS AWS v3 compliance (120+ controls), CIS GCP compliance
- **IAM Analysis**: AWS — unused roles, overly permissive policies, cross-account trust, password policy; GCP — unused service accounts, overly permissive bindings, service account key audit, cross-project bindings
- **Network Analysis**: AWS — EC2/RDS reachability via security groups + NACLs; GCP — VPC reachability and firewall rule analysis
- **Well-Architected**: AWS 6-pillar workload reviews via Well-Architected API with improvement recommendations; GCP native 5-pillar checks (no API dependency)
- **Assessment**: Multi-dimensional scoring (Cost, Security, Reliability, Compliance, IAM) with A-F grades; persisted history for both AWS and GCP
- **Architecture Diagrams**: Network, Application, Data views (React Flow + dagre) + Full Topology (D3); GCP icon set included
- **Tag / Label Governance**: AWS tag compliance + GCP label compliance with 9-layer async pipeline
- **Scan Management**: Scheduling (hourly/daily/weekly) per provider, multi-account, scan diff/comparison
- **Authentication**: Password-based with AES-256-GCM encrypted credential storage; Touch ID (macOS); onboarding tour for first-time users
- **AI Chat**: AWS Bedrock integration (ConverseStreamCommand) with tool calling; tool loop up to 10 rounds; tools cover AWS resources, GCP resources, and SQLite DB
- **Reports**: PDF, Excel, CSV export (assessment, costs, GKE costs, GCP optimization)
- **Help**: Dedicated HelpPage + top-bar help/tour buttons; bug report button

## Provider-Specific Navigation

The sidebar filters nav items by the active provider (AWS or GCP). AWS-only pages: Multi-Account, Comparison. GCP-only pages: GCP Optimization, GKE Costs, Network Analysis. All other pages support both providers.

## UI Design System Rules

- **Never hardcode colors** — use CSS variables: `--color-primary`, `--color-success`, `--color-warning`, `--color-error`, `--color-bg`, `--color-bg-secondary`, `--color-bg-tertiary`, `--color-text`, `--color-text-secondary`, `--color-border`
- **Page layout**: Every page must use `<header className="page-header">` (fixed) + `<div className="page-content">` (scrollable) — never nest header inside content
- **Buttons**: Use `btn btn-primary/secondary/danger` + optional `btn-sm` — never inline-style buttons
- **Dropdowns**: Use `className="global-profile-select"` for styled selects in headers
- **Empty states**: Use `className="empty-state"` div when no profile/project is selected
- **AWS-GCP consistency**: Both provider views on dual-provider pages must have identical layout — Run buttons in `page-header`, same empty states, same card structure
- **OK to leave as hardcoded**: Chart palette colors, grade-scale colors (A-F), `box-shadow` rgba, hover highlight rgba
- See `src/renderer/styles/global.css` for all available CSS classes and variables

## Adding New AWS Service Integrations

1. **Add SDK dependency**: `package.json` - add `@aws-sdk/client-<service>`
2. **Add client to factory**: `src/main/aws/client-factory.ts`
3. **Add shared types**: `src/shared/types/aws.ts` or `common.ts`
4. **Create backend module**: `src/main/aws/<service>/`
5. **Add IPC handlers**: `src/main/ipc/aws-handlers.ts`
6. **Update preload**: `src/main/preload.ts`
7. **Create Zustand store**: `src/renderer/stores/<service>Store.ts`
8. **Create components**: `src/renderer/components/<service>/`
9. **Create page**: `src/renderer/pages/<Service>Page.tsx`
10. **Add navigation**: `src/renderer/App.tsx` - add route and sidebar nav item

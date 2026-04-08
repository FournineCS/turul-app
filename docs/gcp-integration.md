# GCP Integration

## Overview

GCP support mirrors the AWS architecture with its own client factory, scanners, cost analysis, and security checks.

## Authentication

`src/main/gcp/auth-manager.ts`

- OAuth 2.0 flow for GCP authentication
- Uses Application Default Credentials (ADC)
- Project discovery and selection
- Credential caching

```bash
# Set up ADC before using GCP features
gcloud auth application-default login
```

## Client Factory

`src/main/gcp/client-factory.ts`

Caches GCP SDK clients for 29 service libraries:

| Category | Services |
|----------|----------|
| Compute | Instances, Disks, Images, Snapshots, Instance Groups, Networks, Firewalls, Routers, Addresses, Load Balancers |
| Containers | GKE, Cloud Run, Cloud Functions |
| Storage | GCS, Filestore |
| Database | Cloud SQL, Spanner, Firestore, Bigtable, Memorystore, AlloyDB, Datastore |
| Networking | VPC, DNS, CDN, Cloud Armor, Interconnect, Service Directory |
| Analytics | BigQuery, Dataflow, Dataproc, Cloud Composer, Dataplex |
| AI/ML | Vertex AI, Dialogflow, Document AI, Vision, Speech, Language, Translate |
| Security | SCC, KMS, Secret Manager, DLP, Certificate Authority |
| DevOps | Cloud Build, Cloud Deploy, Artifact Registry |
| Monitoring | Logging, Monitoring, Trace, Error Reporting |

## Scanners

`src/main/gcp/scanners/` - **68 scanner files**

Each scanner follows the same `BaseScanner` pattern as AWS scanners. Scanners are organized by service category matching the GCP service types defined in `src/shared/types/gcp.ts`.

### GCP Service Types (68 total)

Compute & Containers, Storage, Database, Networking, Analytics & Data, Messaging & Integration, Security & Identity, DevOps & CI/CD, AI/ML, Monitoring & Logging, Cost & Management.

See `GCPServiceType` in `src/shared/types/gcp.ts` and `GCP_SERVICE_CATEGORIES` for UI grouping.

## Scan Orchestration

`src/main/scanning/gcp-scan-orchestrator.ts`

- Project-scoped scanning (vs. region-scoped for AWS)
- Parallel service scanning within a project
- Progress tracking via IPC/SSE
- Error resilience (partial completion on service failures)

## Relationship Building

`src/main/scanning/gcp-relationship-builder.ts` (18 KB)

Maps GCP resource relationships:
- Compute instance → disk, network, subnet
- GKE cluster → node pool, VPC
- Cloud SQL → VPC, backup
- Load balancer → backend service → instance group
- Pub/Sub topic → subscription
- And many more

## Cost Analysis

`src/main/gcp/cost/`

| Module | Purpose |
|--------|---------|
| `billing-analysis.ts` | Project-level cost breakdown by service, SKU, region |
| `cud-coverage.ts` | Committed Use Discount coverage analysis |
| `recommender-expanded.ts` | Google Recommender API for cost optimization |
| `cost-best-practices.ts` | Best practice checks (idle resources, rightsizing) |
| `types.ts` | Cost result types |

### Cost Features

- **Service-level costs** with period-over-period comparison
- **SKU-level breakdown** for granular analysis
- **CUD coverage ratio** across regions
- **Recommender integration** (Compute Engine, Storage, etc.)
- **Best practice findings** for cost optimization

## Security

### Security Command Center

`src/main/gcp/security/scc-integration.ts`

- Fetches findings from GCP Security Command Center
- Severity mapping to unified finding types
- Source attribution

### Best Practices

`src/main/gcp/security/best-practices.ts`

GCP-specific security checks following industry best practices.

## Project Management

`src/main/gcp/project-manager.ts`

- List available GCP projects
- Project validation
- Organization discovery
- Multi-project support in the UI

## Provider Switching

The frontend uses `providerStore.ts` to track the active cloud provider (`aws` | `gcp`). Pages and components adapt their behavior based on the selected provider.

# API Reference

## Dual Interface

Every operation is available via both Electron IPC and HTTP REST. The HTTP API runs on `http://localhost:3001` in server mode.

## SSE Event Streams

| Endpoint | Channel | Purpose |
|----------|---------|---------|
| `GET /api/events/scan` | `scan` | Scan progress updates |
| `GET /api/events/report` | `report` | Report generation progress |
| `GET /api/events/wa-bp` | `wa-bp` | Well-Architected best practices scan progress |
| `GET /api/events/assessment` | `assessment` | Assessment progress updates |

SSE events are JSON-encoded in the `data` field.

## AWS Operations

### Profiles

| HTTP | IPC Channel | Description |
|------|-------------|-------------|
| `GET /api/aws/profiles` | `aws:get-profiles` | List available AWS profiles |
| `POST /api/aws/validate` | `aws:validate-profile` | Validate profile credentials |
| `GET /api/aws/regions` | `aws:get-regions` | List AWS regions |
| `POST /api/aws/discover-services` | `aws:discover-services-by-cost` | Discover active services via Cost Explorer |

### Scanning

| HTTP | IPC Channel | Description |
|------|-------------|-------------|
| `POST /api/scan/start` | `scan:start` | Start a resource scan |
| `POST /api/scan/stop` | `scan:stop` | Cancel running scan |
| `GET /api/scan/all` | `scan:get-all` | List all scans |
| `POST /api/scan/by-id` | `scan:get-by-id` | Get scan details |

### Resources

| HTTP | IPC Channel | Description |
|------|-------------|-------------|
| `POST /api/resources/by-scan` | `resources:get-by-scan` | Get resources for a scan |
| `POST /api/resources/search` | `resources:search` | Search resources by query |

### Topology

| HTTP | IPC Channel | Description |
|------|-------------|-------------|
| `POST /api/topology/graph` | `topology:get-graph` | Get D3 force-directed graph data |
| `POST /api/topology/diagram` | `topology:get-diagram` | Get React Flow diagram data |

### Reports

| HTTP | IPC Channel | Description |
|------|-------------|-------------|
| `POST /api/report/generate` | `report:generate` | Generate PDF/Excel/CSV report |

### Cost Analysis

| HTTP | IPC Channel | Description |
|------|-------------|-------------|
| `POST /api/cost/analysis` | `cost:get-analysis` | Get cost breakdown |
| `POST /api/cost/trend` | `cost:get-trend` | Get cost trend data |
| `POST /api/cost/optimizations` | `cost:get-optimizations` | Get optimization recommendations |

### Security

| HTTP | IPC Channel | Description |
|------|-------------|-------------|
| `POST /api/security/posture` | `security:get-posture` | Get security posture summary |
| `POST /api/security/finding-details` | `security:get-finding-details` | Get finding details |
| `POST /api/security/best-practices` | `security:run-best-practices-scan` | Run best practices scan |

### Well-Architected

| HTTP | IPC Channel | Description |
|------|-------------|-------------|
| `POST /api/wellarchitected/workloads` | `wellarchitected:list-workloads` | List workloads |
| `POST /api/wellarchitected/workload` | `wellarchitected:get-workload` | Get workload details |
| `POST /api/wellarchitected/lens-review` | `wellarchitected:get-lens-review` | Get lens review |
| `POST /api/wellarchitected/improvements` | `wellarchitected:get-improvements` | Get improvements |
| `POST /api/wellarchitected/best-practices` | `wellarchitected:run-best-practices-scan` | Run WA best practices |

### Assessment

| HTTP | IPC Channel | Description |
|------|-------------|-------------|
| `POST /api/assessment/run` | `assessment:run` | Run multi-dimensional assessment |
| `POST /api/assessment/report` | `assessment:generate-report` | Generate assessment report |
| `GET /api/assessment/all` | `assessment:get-all` | List all assessments |
| `POST /api/assessment/by-id` | `assessment:get-by-id` | Get assessment by ID |
| `DELETE /api/assessment/:id` | `assessment:delete` | Delete assessment |

### Database / History

| HTTP | IPC Channel | Description |
|------|-------------|-------------|
| `GET /api/db/history` | `db:get-scan-history` | Get scan history |
| `DELETE /api/db/scan/:id` | `db:delete-scan` | Delete a scan |

## GCP Operations

### Projects

| HTTP | IPC Channel | Description |
|------|-------------|-------------|
| `POST /api/gcp/check-auth` | `gcp:check-auth` | Check GCP authentication |
| `POST /api/gcp/login` | `gcp:login` | Initiate GCP login |
| `GET /api/gcp/projects` | `gcp:list-projects` | List GCP projects |
| `GET /api/gcp/organizations` | `gcp:list-organizations` | List GCP organizations |
| `POST /api/gcp/validate-project` | `gcp:validate-project` | Validate project access |

### GCP Scanning

| HTTP | IPC Channel | Description |
|------|-------------|-------------|
| `POST /api/gcp/scan/start` | `gcp:scan:start` | Start GCP scan |
| `POST /api/gcp/scan/stop` | `gcp:scan:stop` | Stop GCP scan |

### GCP Cost

| HTTP | IPC Channel | Description |
|------|-------------|-------------|
| `POST /api/gcp/cost/analysis` | `gcp:cost:get-analysis` | Project cost analysis |
| `POST /api/gcp/cost/org-analysis` | `gcp:cost:get-org-analysis` | Org-level cost analysis |
| `POST /api/gcp/cost/recommendations` | `gcp:cost:get-expanded-recommendations` | Cost recommendations |
| `POST /api/gcp/cost/best-practices` | `gcp:cost:get-best-practices` | Cost best practices |
| `POST /api/gcp/cost/cud-coverage` | `gcp:cost:get-cud-coverage` | CUD coverage analysis |

### GCP Security

| HTTP | IPC Channel | Description |
|------|-------------|-------------|
| `POST /api/gcp/security/posture` | `gcp:security:get-posture` | Security posture |
| `POST /api/gcp/security/best-practices` | `gcp:security:run-best-practices` | Run security checks |

## Authentication (Electron Only)

| IPC Channel | Description |
|-------------|-------------|
| `auth:check-status` | Check auth status (setup? authenticated?) |
| `auth:setup` | Set initial password |
| `auth:login` | Login with password |
| `auth:logout` | End session |
| `auth:change-password` | Change password |

## App Profile Management (Electron Only)

| IPC Channel | Description |
|-------------|-------------|
| `profile:list` | List stored profiles |
| `profile:add` | Add encrypted profile |
| `profile:update` | Update profile |
| `profile:delete` | Delete profile |

## Response Format

All IPC and HTTP responses follow:

```typescript
interface IpcResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
```

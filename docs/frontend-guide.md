# Frontend Guide

## Overview

The renderer is a React 18 SPA built with Vite, using React Router 6 for navigation and Zustand for state management.

- Entry: `src/renderer/main.tsx`
- Root component: `src/renderer/App.tsx`
- HTML template: `src/renderer/index.html`

## Vite Configuration

```typescript
// vite.config.ts
root: 'src/renderer'
base: './'                    // Relative paths for Electron file:// protocol
build.outDir: '../../dist/renderer'
aliases: @shared, @renderer
server.port: 5173 (strict)
```

## Pages (19)

All pages live in `src/renderer/pages/`:

| Page | File | Description |
|------|------|-------------|
| Login | `LoginPage.tsx` | Password authentication |
| Dashboard | `DashboardPage.tsx` | Overview with gauges, charts, grade cards |
| Scan | `ScanPage.tsx` | Region/service selection, scan initiation |
| Resources | `ResourcesPage.tsx` | Browse, filter, search resources |
| Architecture | `TopologyPage.tsx` | Network/App/Data/Full topology views |
| History | `HistoryPage.tsx` | Scan history, re-run, comparison |
| Reports | `ReportsPage.tsx` | PDF, Excel, CSV export |
| Costs | `CostsPage.tsx` | Cost Explorer analysis |
| Security | `SecurityPage.tsx` | Security Hub + best practices |
| Well-Architected | `WellArchitectedPage.tsx` | Workload reviews |
| Assessment | `AssessmentPage.tsx` | Multi-dimensional scoring |
| Compliance | `CompliancePage.tsx` | CIS compliance scorecard |
| IAM Analysis | `IAMAnalysisPage.tsx` | IAM deep analysis |
| Tag Governance | `TagGovernancePage.tsx` | Untagged resource tracking |
| Schedule | `SchedulePage.tsx` | Recurring scan setup |
| Multi-Account | `MultiAccountPage.tsx` | Multi-profile scanning |
| Comparison | `ComparisonPage.tsx` | Side-by-side scan diff |
| Settings | `SettingsPage.tsx` | App config, profile management |
| Setup | `SetupPage.tsx` | Initial app setup |

## Zustand Stores (17)

All stores in `src/renderer/stores/`:

| Store | File | Purpose |
|-------|------|---------|
| Auth | `authStore.ts` | Login state, session, password change |
| Profile | `profileStore.ts` | AWS profile list, selection, validation |
| Scan | `scanStore.ts` | Active scan, progress, resource counts |
| Cost | `costStore.ts` | Cost analysis, trends, recommendations |
| Security | `securityStore.ts` | Findings, severity distribution |
| Well-Architected | `wellArchitectedStore.ts` | Workloads, pillar reviews |
| Assessment | (in pages) | Assessment results, grades |
| Multi-Account | `multiAccountStore.ts` | Multi-account scan groups |
| IAM Analysis | `iamAnalysisStore.ts` | IAM analysis results |
| Compliance | `complianceStore.ts` | Compliance scores |
| Tag Governance | `tagGovernanceStore.ts` | Tag compliance tracking |
| Schedule | `scheduleStore.ts` | Scan schedules |
| GCP Project | `gcpProjectStore.ts` | GCP project selection |
| Provider | `providerStore.ts` | AWS/GCP provider toggle |
| Settings | `settingsStore.ts` | App preferences |
| Toast | `toastStore.ts` | Notification queue |
| Comparison | `comparisonStore.ts` | Scan comparison state |

### Store Pattern

```typescript
import { create } from 'zustand';

interface CostState {
  analysis: CostAnalysisResult | null;
  loading: boolean;
  error: string | null;
  fetchAnalysis: (profile: string, region: string, dateRange: CostDateRange) => Promise<void>;
}

export const useCostStore = create<CostState>((set) => ({
  analysis: null,
  loading: false,
  error: null,

  fetchAnalysis: async (profile, region, dateRange) => {
    set({ loading: true, error: null });
    try {
      const result = await window.electronAPI.cost.getAnalysis(profile, region, dateRange);
      if (result.success) {
        set({ analysis: result.data, loading: false });
      } else {
        set({ error: result.error, loading: false });
      }
    } catch (err) {
      set({ error: String(err), loading: false });
    }
  },
}));
```

## API Layer

`src/renderer/api/`

### Environment Detection

```typescript
// src/renderer/api/index.ts
export function getAPI() {
  if (window.electronAPI) {
    return window.electronAPI;  // Electron IPC
  }
  return createHttpBackend();   // HTTP fetch + SSE
}
```

### HTTP Backend

`http-backend.ts` mirrors the full `electronAPI` interface using `fetch()` for requests and `EventSource` for SSE progress streams. All stores work identically in both modes.

## Component Organization

Components are grouped by feature in `src/renderer/components/`:

```
components/
├── auth/              # AuthGuard, ChangePasswordModal
├── dashboard/         # SecurityPostureGauge, CostSummaryWidget, etc.
├── scan/              # MultiProfileSelector, CostDiscoveryPanel
├── topology/          # ArchitectureDiagram, DiagramNode, DiagramControls, etc.
├── costs/             # CostOverview, CostTrendChart, ServiceCostBreakdown, etc.
├── security/          # SecurityOverview, FindingsTable, FindingDetailModal, etc.
├── well-architected/  # WorkloadList, PillarReviewCard, ImprovementsList, etc.
├── assessment/        # AssessmentDashboard, AssessmentConfig
├── tag-governance/    # TagCoverageHeatmap, UntaggedResourcesList, etc.
├── profiles/          # ProfileForm, ProfileList, ManageProfilesModal
├── schedule/          # ScheduleForm, ScheduleList
├── ErrorBoundary.tsx
├── ToastContainer.tsx
├── GlobalLoadingBar.tsx
├── GlobalProfileSelector.tsx
└── ExportCSVButton.tsx
```

## Architecture Visualization

### React Flow (Network, App, Data views)

`src/renderer/components/topology/ArchitectureDiagram.tsx`

- Uses React Flow 12 with dagre layout
- Custom node types: `DiagramNode.tsx`, `DiagramGroupNode.tsx`
- Controls: zoom, pan, fit, layout direction
- Filters: by service, region, tier
- Search: highlight matching resources

### D3 Force-Directed (Full Topology view)

`src/renderer/components/topology/TopologyCanvas.tsx`

- D3 7.8 force simulation
- Collision detection, link forces
- Drag-to-pin nodes
- Zoom + pan

## Styling

- `src/renderer/styles/global.css` - Global styles, CSS variables
- `src/renderer/styles/auth.css` - Authentication pages
- `src/renderer/styles/profiles.css` - Profile management
- No CSS framework - custom minimal CSS

## Protected Routes

`src/renderer/components/auth/AuthGuard.tsx` wraps routes that require authentication. Unauthenticated users are redirected to the login page.

## Adding a New Page

1. Create `src/renderer/pages/MyPage.tsx`
2. Create store if needed: `src/renderer/stores/myStore.ts`
3. Create components: `src/renderer/components/my-feature/`
4. Add route in `App.tsx`:
   ```tsx
   <Route path="/my-page" element={<MyPage />} />
   ```
5. Add sidebar nav item in `App.tsx`

# Fournine Cloud Analyzer - User Guide

Fournine Cloud Analyzer is a desktop application for scanning, analyzing, and reporting on AWS and GCP cloud resources. It runs entirely on your machine — all credentials, scan data, and results are stored locally in an encrypted SQLite database.

---

## Table of Contents

1. [Getting Started / First Time Setup](#1-getting-started--first-time-setup)
2. [Authentication](#2-authentication)
3. [App Settings](#3-app-settings)
4. [Adding AWS Profiles](#4-adding-aws-profiles)
5. [Connecting GCP](#5-connecting-gcp)
6. [Switching Between AWS and GCP](#6-switching-between-aws-and-gcp)
7. [Running a Resource Scan](#7-running-a-resource-scan)
8. [Multi-Account Scanning](#8-multi-account-scanning)
9. [Security Analysis](#9-security-analysis)
10. [CIS Compliance](#10-cis-compliance)
11. [IAM Analysis](#11-iam-analysis)
12. [Cost Reports and Analysis](#12-cost-reports-and-analysis)
13. [GCP Cost Optimization](#13-gcp-cost-optimization)
14. [GKE Cost Analysis](#14-gke-cost-analysis)
15. [Well-Architected Reviews](#15-well-architected-reviews)
16. [Assessment Reports](#16-assessment-reports)
17. [Tag Governance](#17-tag-governance)
18. [Architecture Diagrams](#18-architecture-diagrams)
19. [Scan Scheduling](#19-scan-scheduling)
20. [Scan History and Comparison](#20-scan-history-and-comparison)
21. [Report Exports](#21-report-exports)
22. [AI Chat Assistant](#22-ai-chat-assistant)
23. [Network Analysis](#23-network-analysis)
24. [Troubleshooting](#24-troubleshooting)

---

## 1. Getting Started / First Time Setup

### Installation

Download the appropriate installer for your operating system from the GitHub Releases page:

- **macOS**: `FournineCloud-{version}-mac-x64.dmg` (Intel) or `FournineCloud-{version}-mac-arm64.dmg` (Apple Silicon)
- **Linux**: `FournineCloud-{version}-linux-x64.zip` or `FournineCloud-{version}-linux-arm64.zip`

On macOS, open the `.dmg` file and drag the app to your Applications folder. On first launch, macOS Gatekeeper may show a security warning because the app is ad-hoc signed. Right-click the app icon and choose **Open** to bypass this prompt the first time.

### First Launch

When you open the app for the first time, you will see a **Set Up Password** screen. The app requires a password to protect access and to encrypt any credentials you store in it. No data is accessible without authenticating first.

---

## 2. Authentication

### Creating Your Password

On first launch:

1. Enter a password in the **Password** field. The placeholder reads "Minimum 12 characters".
2. Re-enter the same password in **Confirm Password**.
3. Click **Create Password**.

If your device supports Touch ID (macOS), the app will immediately ask if you want to enable it for faster login. Click **Enable Touch ID** or **Skip** to decide later.

Your password is hashed with scrypt and derives the AES-256-GCM key used to encrypt stored credentials. It cannot be recovered if lost.

### Logging In

On subsequent launches, you will see the **Welcome Back** screen:

- **Touch ID**: If you enabled Touch ID, the app automatically attempts biometric authentication 300 ms after the screen appears. You can also click the fingerprint button manually.
- **Password**: Enter your password and click **Unlock**.

After 5 consecutive failed password attempts, the app enforces a progressive lockout that increases up to 600 seconds.

### Session Timeout

The app times out and locks after 15 minutes of inactivity (no mouse movement, keyboard input, or clicks). Activity is checked every 60 seconds, so you will not see unnecessary prompts during active use.

### Changing Your Password

Click **Change Password** in the sidebar footer at any time:

1. Enter your current password.
2. Enter and confirm the new password.
3. Click **Change Password**.

Press `Escape` to dismiss the modal without saving.

### Enabling or Disabling Touch ID

Go to **Settings** (sidebar footer) and find the **Security** card. If your device supports Touch ID, you will see a toggle button. Click **Enable** or **Enabled** to toggle it on or off.

---

## 3. App Settings

Navigate to **Settings** using the link in the sidebar footer (not the main navigation list).

### Appearance

Click **Dark Mode** or **Light Mode** to switch the application theme. The selection is saved and applied on the next launch.

### Default Scan Configuration (AWS)

When AWS is the active provider, you can configure defaults that pre-populate the Scan page:

- **Default Profile**: Select an AWS profile from the dropdown. The app will automatically select this profile when it starts.
- **Default Regions**: Check one or more regions. These will be pre-selected on the Scan page.
- **Default Services**: Check services from the list (EC2, Lambda, RDS, S3, ECS, DynamoDB, ALB/NLB, IAM, KMS, CloudWatch). These will be pre-selected on the Scan page.

### GCP Configuration (BigQuery Billing)

When GCP is the active provider, this section appears. It configures the BigQuery export used for cost analysis and the Smart Selection feature on the Scan page:

- **BigQuery Billing Project**: The GCP project ID that contains your billing export dataset.
- **BigQuery Dataset**: The dataset name (defaults to `billing_export`).
- **BigQuery Dataset Region**: Select the region where your dataset lives. Use "Auto-detect" unless you get "Cannot parse as CloudRegion" errors, in which case set this explicitly.

Click **Save Settings** in the top-right corner to apply all changes.

### Data Retention

Choose how long the app keeps scan data and assessment results: 30, 60, 90, or 180 days, 1 year, or forever. Old data is pruned automatically based on this setting.

### Environment Health

The **Environment Health** card at the bottom of Settings shows whether the tools required by the app (such as the AWS CLI, gcloud CLI, and Node.js) are installed and working correctly. Click **Re-check** to run the diagnostics again.

---

## 4. Adding AWS Profiles

The app reads AWS profiles from two sources:

- **System profiles**: Profiles defined in `~/.aws/credentials` and `~/.aws/config` on your machine. These are automatically discovered and appear in the profile selector prefixed without a label.
- **App profiles**: Profiles you add directly inside the app. These appear with an `[App]` prefix. Credentials are stored encrypted in the local database.

### Opening the Profile Manager

Click **Manage Profiles** in the sidebar footer. This button only appears when AWS is the active provider.

### Adding an App Profile

In the Manage Profiles modal, click **Add Profile** (or the button shown on the list screen). The profile form has three credential types, selectable via tabs:

**IAM Keys**

| Field | Required | Notes |
|-------|----------|-------|
| Profile Name | Yes | Must be unique. Cannot be changed after creation. |
| Region | Yes | Default home region for this profile. |
| Description | No | Free-text label. |
| Access Key ID | Yes (new) | Your AWS access key (`AKIA...`). Leave blank on edit to keep the existing key. |
| Secret Access Key | Yes (new) | Your AWS secret access key. Leave blank on edit to keep the existing value. |
| Session Token | No | Required for temporary (STS) credentials. |

**SSO Config**

Use this to configure AWS IAM Identity Center (SSO) login. The app will use the `sso_get_role_credentials` flow at scan time.

| Field | Required | Notes |
|-------|----------|-------|
| SSO Start URL | Yes | The SSO portal URL, e.g. `https://my-org.awsapps.com/start`. |
| SSO Region | Yes | The region where your IAM Identity Center is hosted. |
| SSO Account ID | Yes | 12-digit AWS account ID. |
| SSO Role Name | Yes | The permission set name, e.g. `AdministratorAccess`. |

**Assume Role**

Use this when you want the app to assume a role in another account, using an existing profile as the source of credentials.

| Field | Required | Notes |
|-------|----------|-------|
| Role ARN | Yes | Full ARN of the role to assume. |
| External ID | No | Required if the trust policy uses a condition on `sts:ExternalId`. |
| Source Profile | Yes | An existing profile (system or app) that provides the base credentials. |

Click **Add Profile** to save.

### Editing and Deleting Profiles

Existing app profiles are listed in the modal. Click **Edit** to update fields (profile name cannot be changed after creation). Click **Delete** and confirm to remove the profile and its encrypted credentials.

Note: System profiles sourced from `~/.aws/` are read-only and cannot be edited or deleted from within the app.

### Selecting the Active Profile

Use the **Profile** dropdown in the top bar to select which AWS profile is active. All pages use the active profile for data display and operations. You can change this at any time without restarting.

---

## 5. Connecting GCP

GCP authentication uses your existing `gcloud` CLI session (OAuth 2.0 application default credentials). The app does not store OAuth tokens itself.

### Prerequisites

The `gcloud` CLI must be installed and authenticated on your machine:

```bash
gcloud auth application-default login
```

### Logging In

1. Switch to GCP mode using the **GCP** button in the sidebar provider toggle.
2. The top bar will show a **Login with gcloud** button.
3. Click it. The app invokes the gcloud authentication flow. If gcloud is already authenticated, this completes immediately. Otherwise, a browser window opens for you to sign in with your Google account.
4. After successful login, the top bar loads your accessible GCP projects.

### Selecting a Project

Use the **Project** dropdown in the top bar to select the GCP project you want to work with. All pages use this selection for scans, cost data, and security analysis.

### Selecting an Organization (Optional)

If your account has access to GCP organizations, an **Org** dropdown appears to the left of the Project dropdown. Selecting an organization enables organization-level cost views and optimization scans.

### Switching Google Accounts

Click **Switch Account** in the top bar to log out and immediately trigger a new gcloud login, allowing you to sign in with a different Google account.

### Logging Out of GCP

Clicking **Switch Account** effectively logs you out. The app clears the project list, selected project, and organization data.

---

## 6. Switching Between AWS and GCP

The **AWS / GCP** toggle is located at the top of the sidebar, below the Fournine Cloud logo.

- Click **AWS** to switch to AWS mode. The navigation will show all AWS-specific pages (Multi-Account, Comparison, Well-Architected, Tag Governance, IAM Analysis, Compliance, Schedules).
- Click **GCP** to switch to GCP mode. AWS-only pages are hidden. GCP-specific pages appear: GCP Optimization, GKE Costs.

If you switch to GCP while viewing an AWS-only page, the app automatically redirects you to the Dashboard.

Your provider selection is saved and restored when you relaunch the app.

---

## 7. Running a Resource Scan

Navigate to **Scan** in the sidebar.

### AWS Scan

1. **Select an AWS profile** from the top bar if you have not already.
2. The scan page shows the active profile and its validated AWS account ID once verified.
3. **(Optional) Smart Scan**: Click **Discover Services by Cost (Last 30 Days)** to query AWS Cost Explorer and automatically select only the services with active spend. This requires `ce:GetCostAndUsage` permission on the profile. Once results load, you can adjust the selection or clear the cost data.
4. **Select Regions**: The page initially shows 4 popular regions (us-east-1, us-west-2, eu-west-1, ap-southeast-1). Click **Show All Regions** to see all 27 supported regions. Use **Select All** or **Clear** to bulk-select. Check or uncheck individual regions.
5. **Select Services**: Services are grouped by category (Compute, Storage, Database, Networking, Integration, Migration, Management, Governance, Analytics, Security, Identity, Developer Tools, ML & AI, Frontend & Mobile, Business Apps, Media, IoT, End User Computing, Data Pipeline). Click a category checkbox to select or deselect all services within it. You can also toggle individual services.
6. Click **Start Scan**.

The scan page shows a progress card with the current region, current service, regions completed, and total resources found so far. A progress bar fills as regions complete.

When the scan finishes, the app navigates to the Dashboard automatically.

### GCP Scan

1. **Select a GCP project** from the top bar.
2. **(Optional) Smart Selection (Beta)**: If BigQuery billing is configured, click **Discover Active Services (Last 30 Days)** to detect which GCP services have usage. This pre-selects those services.
3. **Select GCP Services**: Services are grouped by category. Use:
   - **Architecture Essentials**: Pre-selects compute (GCE, GKE, Cloud Run, Cloud Functions), networking (VPC, subnets, firewalls, routers, NAT, addresses), load balancing, and data (Cloud SQL, GCS). Use this for architecture diagram scans.
   - **Select All** / **Clear**: Bulk-select or clear all services.
   - Individual checkboxes to fine-tune.
4. The scan page shows how many services are selected and which project will be scanned.
5. Click **Start Scan**. After launch, the app navigates to the Dashboard.

Note: GCP scans default to including networking services (VPC network, subnets, firewall rules, Cloud Router, NAT, addresses) in the initial selection.

---

## 8. Multi-Account Scanning

Navigate to **Multi-Account** in the sidebar. This page is only available in AWS mode.

Multi-account scanning runs scans across multiple AWS profiles sequentially, grouping the results together for comparison and cross-account search.

### Starting a Multi-Account Scan

1. **Select Profiles**: The profile list shows all available AWS profiles (system and app). Check at least 2 profiles.
2. **Select Regions**: Choose from the common region list.
3. **Select Services**: Choose from the common service list.
4. Click **Start Multi-Account Scan (N profiles)**.

The app scans each profile one at a time, in the order selected. Each individual scan appears as a row in the scan group result table, showing its status, resource count, and completion time.

Scan group statuses:
- `running`: At least one profile scan is still in progress.
- `completed`: All profiles scanned successfully.
- `partial`: Some profiles completed, but at least one failed.
- `failed`: All profile scans failed.

### Cross-Account Resource Search

Once a scan group reaches `completed` or `partial` status, it becomes available in the **Cross-Account Resource Search** panel. Select a scan group and enter a search query to find resources by name, ARN, or tag across all accounts in the group. Results show up to 100 matches and can be exported to CSV.

---

## 9. Security Analysis

Navigate to **Security** in the sidebar.

### Selecting a Profile or Project

The Security page requires an active AWS profile or GCP project from the top bar. Without one, an empty state message is shown.

### Scan Mode

Use the **Mode** dropdown to choose between:

- **Security Hub** (AWS) / **Security Command Center** (GCP): Loads findings from the native security service. For AWS, this requires Security Hub to be enabled in the selected region. For GCP, this uses Security Command Center findings.
- **Best Practices Scan**: Runs a direct scan of your resources against security best practices. This does not require Security Hub or SCC to be configured.

### Running a Security Hub / SCC Scan

1. Select the mode **Security Hub** (or Security Command Center for GCP).
2. For AWS, select a region from the **Region** dropdown.
3. Click **Refresh** in the page header.

If Security Hub is not enabled in the region, the page shows an error with a link to enable it in the AWS console, or offers a switch to Best Practices mode.

### Running a Best Practices Scan

1. Select the mode **Best Practices Scan**.
2. For AWS, select a region.
3. Click **Run Scan**.

For AWS, Best Practices checks cover: security groups, S3 buckets, IAM users, RDS instances, and EBS volumes. For GCP, it scans resources against GCP security best practices.

### Reading Results

After a scan completes, the page shows:

- **Security Overview**: Summary cards with total findings broken down by severity (Critical, High, Medium, Low, Informational).
- **Findings by Severity Chart**: Visual breakdown of finding counts by severity level.
- **Findings by Source Chart**: Breakdown by which security service or check produced each finding (AWS: Security Hub standards, GuardDuty, Inspector, etc.).
- **Compliance Status Panel** (AWS only): Pass/fail rates across enabled Security Hub standards (e.g., AWS Foundational Security Best Practices, CIS AWS Foundations Benchmark).
- **Findings Table**: Full list of findings, sortable and filterable. Click any row to open the finding detail modal showing the full title, description, resource ARN, recommendation, and remediation guidance.

### Filtering Findings

The filter bar above the findings table allows filtering by severity level and finding status (ACTIVE, RESOLVED, SUPPRESSED).

### Exporting Findings

Click the **Export CSV** button above the findings table to download the filtered findings as a CSV file with columns: Title, Severity, Status, Resource, Source, Description.

---

## 10. CIS Compliance

Navigate to **Compliance** in the sidebar. This page is AWS-only.

The Compliance page runs CIS AWS Foundations Benchmark v3.0 Level 1 controls against your AWS account. The framework checks 120+ controls mapped to the CIS standard.

### Running a CIS Assessment

1. Select an AWS profile from the top bar.
2. Choose a region from the **Region** dropdown.
3. Click **Run CIS Assessment**.

The assessment queries your account for relevant configurations and maps findings to CIS control IDs. Results appear as collapsible section cards.

### Reading Results

Each CIS section (e.g., "1 Identity and Access Management", "2 Storage", "3 Logging") shows:

- A progress bar indicating the pass rate for applicable controls.
- A percentage score.
- Pass/fail counts.

Click a section to expand it and view individual control results. Each control row shows:

- **Control ID** (e.g., `1.1`)
- **Title**
- **Level** (L1 = Level 1)
- **Status**: Pass, Fail, or N/A (not checked)
- **Findings**: Count of failing findings, if any.

### Exporting Compliance Results

Click **Export CSV** to download the full compliance result set.

---

## 11. IAM Analysis

Navigate to **IAM Analysis** in the sidebar. This page is AWS-only.

### Running an IAM Analysis

1. Select an AWS profile from the top bar.
2. Click **Run IAM Analysis** on the page.

The analysis runs four checks against your account's IAM configuration.

### Unused Roles

Lists IAM roles that have not been used in the last 90 days. For each role, you see:

- Role name and ARN
- Creation date
- Last used date (or "Never")
- Days since last use (highlighted in orange for >90 days, red for >180 days)

### Permissive Policies

Lists customer-managed IAM policies that contain dangerous permission statements (e.g., `*:*` wildcards or `iam:PassRole` without conditions). For each policy:

- Policy name and ARN
- Attachment count (how many users, roles, or groups use it)
- Dangerous statements flagged on the policy

### Cross-Account Trusts

Lists IAM roles that trust principals in other AWS accounts. For each trust relationship:

- Role name
- Trusted account ID
- Trusted principal (ARN or service)
- Condition keys applied to the trust (if any). Trusts without conditions are flagged with a warning badge.

### Password Policy

Shows the account's IAM password policy compliance score and a checklist of individual settings (minimum length, uppercase/lowercase requirements, numbers, symbols, expiry period, reuse prevention). Each check shows the current value, recommended value, and pass/fail status.

### Exporting IAM Results

Each tab has an **Export CSV** button to download the data from that specific view.

---

## 12. Cost Reports and Analysis

Navigate to **Costs** in the sidebar.

### AWS Cost Analysis

1. Select an AWS profile from the top bar.
2. Use the **Date Range** selector in the top-right to choose a period:
   - Last 7 days
   - Last 30 days (default)
   - Last 3 months
   - Last 6 months
   - Last 12 months
   - Custom date range
3. Click **Refresh** to load cost data from AWS Cost Explorer.

The page shows:

- **Cost Overview**: Total spend for the period, daily average, and comparison to the previous period (e.g., "12% higher than previous 30 days").
- **Cost Trend Chart**: Day-by-day spend plotted over time.
- **Service Cost Breakdown**: Bar chart and table of spend broken down by AWS service.
- **Cost Optimizations**: Recommendations from AWS Cost Explorer (savings plan recommendations, right-sizing suggestions, etc.).

Two tabs are available: **Overview** (charts and summary) and **Services** (detailed service breakdown table).

### GCP Cost Analysis

For GCP, cost data is fetched from your BigQuery billing export. Ensure BigQuery billing is configured in Settings before using this feature.

**Scope**: Toggle between **Project** (costs for the selected GCP project) and **Organization** (org-wide costs, requires an organization to be selected in the top bar).

- **Refresh**: Loads from cache if available, then queries BigQuery if cache is stale.
- **Force Reload**: Bypasses the cache and fetches fresh data from BigQuery.
- **History** (shown when cached data exists): Click to browse previous data snapshots. A banner indicates when you are viewing cached data.

GCP-specific filters are available once data loads: filter by label, service, and region. Click **Apply** to re-filter, or **Clear** to reset.

The page shows:

- **Cost Overview**: Total spend, trend direction, and comparison to the previous period.
- **Cost Trend Chart**: Daily cost over the selected period.
- **Service Cost Breakdown**: Pie chart and table of spend by GCP service.
- **SKU Cost Table**: Cost broken down by individual billing SKU.
- **Resource Cost Table**: Cost attributed to named resources where billing data supports it.
- **GCP Recommender Recommendations**: Cost-saving recommendations fetched from GCP Recommender API.

### Exporting Cost Data (GCP)

When GCP cost data is loaded, two export buttons appear in the header:

- **PDF**: Exports the current cost view as a PDF.
- **Excel**: Exports a multi-sheet Excel workbook with sheets for Service breakdown, Region breakdown, SKU breakdown, and Resource breakdown.

---

## 13. GCP Cost Optimization

Navigate to **GCP Optimization** in the sidebar. This page is GCP-only.

GCP Cost Optimization runs a comprehensive analysis combining GCP Recommender API recommendations with direct resource inspection for idle and stopped resources.

### Scope Toggle

Choose **Project** (selected project) or **Organization** (all projects in the selected org).

### Running an Optimization Scan

Click **Run Full Scan** in the page header. The scan runs two analyses in parallel:

1. **GCP Recommender recommendations**: Fetches recommendations from 13+ GCP Recommender types (right-sizing, idle VMs, unattached disks, cost optimization, etc.).
2. **Resource idle analysis**: Scans the project or organization directly for idle and oversized resources.

When complete, results are automatically saved as a named snapshot.

### Tabs

- **Live**: Shows the current scan results.
  - **Recommendations Panel**: Lists GCP Recommender recommendations with estimated savings, priority, and recommended actions.
  - **Idle Resources Panel**: Lists resources identified as idle or underutilized, with cost estimates.
- **Resources**: Detailed resource findings from the idle analysis.
- **History**: List of previously saved snapshots. Click a snapshot to load it into the Live tab for review.

### Exporting Optimization Data

Export buttons in the header:

- **Excel**: Exports the optimization findings to an Excel file.
- **PDF**: Exports the optimization findings to a PDF report.

---

## 14. GKE Cost Analysis

Navigate to **GKE Costs** in the sidebar. This page is GCP-only.

GKE Costs provides cost breakdown for Google Kubernetes Engine clusters, drilled down to namespace and workload level. Requires BigQuery billing to be configured.

### Scope

Toggle between **Project** and **Organization** using the scope selector.

### Date Range

Use the Date Range selector to choose the analysis period (same options as the Costs page).

### Loading Data

Click **Refresh** to load GKE cost data from BigQuery.

### Reading Results

After loading:

- **Summary stat cards**: Total GKE spend, top cluster, and average cost.
- **Cost Trend Chart**: Daily GKE spend over the selected period.
- **Cluster breakdown**: Cost per GKE cluster.
- **Namespace breakdown**: Cost per Kubernetes namespace (drill-down from cluster selection).
- **Workload breakdown**: Cost per workload within the selected namespace.

Hover over chart data points to see exact values. Bar charts are color-coded by cluster.

### Exporting GKE Cost Data

- **Export CSV**: Downloads the currently visible table data as CSV.
- **Excel**: Exports a full multi-sheet workbook with cluster, namespace, and workload sheets.
- **PDF**: Exports a summary PDF.

---

## 15. Well-Architected Reviews

Navigate to **Well-Architected** in the sidebar. This page is AWS-only.

Well-Architected Reviews require an active AWS profile from the top bar.

### Scan Mode

Use the **Mode** dropdown to choose between:

- **AWS Well-Architected Workloads**: Connects to the AWS Well-Architected Tool API to retrieve existing workload reviews.
- **Best Practices Scan**: Runs direct best-practices checks against your AWS resources without requiring the Well-Architected Tool to be configured.

### Using Well-Architected Workloads Mode

1. Select a region from the **Region** dropdown.
2. Click **Refresh** to load workloads from the AWS Well-Architected Tool.
3. Click a workload in the **Workload List** panel to select it.
4. The page loads the workload's lens review across all 6 pillars:
   - Operational Excellence
   - Security
   - Reliability
   - Performance Efficiency
   - Cost Optimization
   - Sustainability
5. Each pillar card shows the number of high-risk and medium-risk items.
6. The **Improvements** list shows recommended actions sorted by pillar and risk level.

### Using Best Practices Scan Mode

1. Select a region.
2. Click **Run Scan**. A progress indicator shows the current pillar being evaluated.
3. Results appear as a **Best Practices Scan Overview** showing checks performed and issues found per pillar.

### Exporting Well-Architected Data

Click **Export CSV** to download improvement plan items with their risk level, pillar, question, and recommendation.

---

## 16. Assessment Reports

Navigate to **Assessment** in the sidebar. This page is AWS-only.

An Assessment is a multi-domain health check that produces an overall letter grade (A through F) with a numeric score out of 100.

### Configuring an Assessment

The configuration form appears when no assessment has been run for the selected profile.

1. The **AWS Profile** field shows the currently selected profile from the top bar.
2. Select a **Region** from the dropdown.
3. Choose one or more **Assessment Domains**:
   - **Cost Optimization**: Queries Cost Explorer for spending trends and savings opportunities.
   - **Security**: Runs a security best practices scan (equivalent to the Security page's Best Practices mode).
   - **Well-Architected**: Runs best-practices checks across all 6 Well-Architected pillars.
   - **Resource Inventory**: Scans tags and resource distribution.
4. If **Cost Optimization** is selected, choose a **Cost Lookback Period** (7, 30, or 90 days).
5. If **Resource Inventory** is selected, optionally check **Run resource scan for inventory**. This adds approximately 1-2 minutes to the assessment duration.
6. Click **Run Assessment**.

A progress indicator shows the current domain being evaluated.

### Reading Assessment Results

After completion, the dashboard shows:

- **Overall Grade**: A letter grade (A = excellent, F = failing) with a numeric score.
- **Domain Cards**: Individual grade and score for each domain that was assessed.
- **Recommendations**: Prioritized list of findings grouped by severity (Critical, High, Medium, Low).

The assessment result for the active profile is automatically loaded when you return to this page.

### Generating an Assessment PDF Report

From the Assessment page, click **Generate PDF Report** and select a directory. The report is saved to that directory and a toast notification shows the file path.

You can also generate PDF reports from **History** by clicking **PDF** on any assessment row in the Assessments tab.

---

## 17. Tag Governance

Navigate to **Tag Governance** in the sidebar. This page is AWS-only.

Tag Governance checks resources from a completed scan against a set of required tags that you define.

### Defining Required Tags

The **Required Tags Configuration** card lists your defined tags. Add a tag:

1. Enter the tag key name (e.g., `Environment`, `Owner`, `CostCenter`).
2. Optionally add allowed values (e.g., `prod`, `staging`, `dev`). If values are specified, any resource that has the tag but uses a value not in the list is counted as non-compliant.
3. Click **Save**.

### Running a Tag Compliance Check

1. Select a completed scan from the **Run Compliance Check** dropdown. The dropdown lists scans ordered by recency with profile name, date, and resource count.
2. Click **Run Compliance Check**. The button is disabled until at least one required tag is configured.

### Reading Results

After the check runs:

- **Tag Compliance Report**: Summary showing the percentage of resources that have all required tags, with breakdowns by service type.
- **Tag Coverage Heatmap**: Visual grid showing coverage per service across required tags.
- **Untagged Resources List**: Table of all resources missing one or more required tags, with columns for resource name, type, region, and which tags are missing.

### Exporting Tag Governance Data

Click **Export CSV** on the untagged resources list to download the findings.

---

## 18. Architecture Diagrams

Navigate to **Architecture** in the sidebar.

Architecture diagrams visualize relationships between scanned resources. The page works for both AWS and GCP scans.

### Selecting a Scan

Use the **Scan** dropdown to select which completed scan to visualize. You can also navigate directly to a specific scan's topology from the **History** page using the **Topology** button.

### View Modes

Use the view mode buttons in the header to switch between four diagram types:

- **Network**: Shows VPCs, subnets, security groups, and the EC2/RDS/Lambda resources placed within them. For GCP, shows VPC networks with subnets and compute resources.
- **Application**: Shows services, load balancers, compute (EC2, ECS, Lambda, GKE, Cloud Run), databases, and how they are connected.
- **Data**: Shows data services — S3, RDS, DynamoDB, Redshift, ElastiCache, BigQuery, Cloud SQL — and their relationships to compute.
- **Full Topology**: A force-directed D3 graph of all resources and their relationships. This view can handle large resource sets. Drag nodes to reposition them. Scroll to zoom.

### Interacting with Diagrams

- **Network, Application, Data views**: These use React Flow with dagre auto-layout. Drag nodes to reposition. Scroll to zoom. Collapse or expand groups by clicking them.
- **Full Topology**: D3 force-directed graph. Drag nodes to pin them. Click a node to highlight its connections. Use mouse scroll or pinch to zoom.

For GCP scans, a **Project filter** dropdown is available to filter the diagram by a specific GCP project (relevant for shared VPC setups where resources span host and service projects).

---

## 19. Scan Scheduling

Navigate to **Schedules** in the sidebar. This page is AWS-only.

Schedules run scans automatically at a defined frequency while the app is running.

### Creating a Schedule

1. Enter a **Schedule Name** (e.g., "Nightly Full Scan").
2. The **AWS Profile** field displays the currently selected profile from the top bar. Select a profile in the top bar before creating the schedule.
3. Choose a **Frequency**: Hourly, Daily, or Weekly.
4. Select the **Regions** to scan from the list of 10 common regions.
5. Select the **Services** to scan from the list of 16 common services.
6. Optionally check **Auto-assess after scan** to trigger a full assessment automatically when the scheduled scan completes.
7. Click **Create Schedule**.

### Managing Schedules

The schedule list shows all created schedules with their name, profile, frequency, regions, and services. Each schedule has:

- **Enable / Disable toggle**: Pause a schedule without deleting it.
- **Delete**: Remove the schedule permanently.

Schedules only run while the app is open. If the app is closed during a scheduled run time, the scan does not execute until the next scheduled interval after the app reopens.

---

## 20. Scan History and Comparison

### Scan History

Navigate to **History** in the sidebar.

The History page has two tabs:

**Scans tab**: Lists all scans for the selected profile or GCP project. Each row shows:

- Date and time (with a provider badge: orange `AWS`, blue `GCP`)
- Profile name
- Number of regions scanned (hover to see the full region list)
- Number of services scanned (hover to see the full service list)
- Resource count
- Duration
- Status (Completed, Running, Failed, Cancelled)

Filter by status using the filter buttons above the table. Sort by any column by clicking the header.

From a completed scan row:
- Click **Resources** to navigate to the Resources page filtered to that scan.
- Click **Topology** to open the Architecture Diagram for that scan.
- Click **Delete** (then **Confirm**) to permanently remove the scan and its resource data.

**Assessments tab**: Lists all assessments for the selected profile. Each row shows date, profile, region, letter grade (shown as a colored circle), numeric score, recommendation counts by severity, and duration. Actions:

- **View**: Load the assessment into the Assessment page.
- **PDF**: Generate a PDF report and save to a directory you choose.
- **Delete**: Permanently remove the assessment.

### Scan Comparison

Navigate to **Comparison** in the sidebar. This page is AWS-only.

Scan Comparison performs a diff between two completed scans from the same profile.

1. Select the **Before** scan from the first dropdown.
2. Select the **After** scan from the second dropdown.
3. Click **Compare**.

Results appear across four tabs:

- **Summary**: Totals for added, removed, and changed resources.
- **Added**: Resources present in the After scan but not in the Before scan.
- **Removed**: Resources present in the Before scan but not in the After scan.
- **Changed**: Resources present in both scans but with field-level differences. Click a changed resource row to expand it and view a before/after table of changed fields.

Each tab shows export buttons for CSV download.

---

## 21. Report Exports

Navigate to **Reports** in the sidebar.

Reports generate structured files from a completed scan's resource data. These are distinct from the PDF exports on the Costs, Assessment, and GKE pages.

### Selecting a Scan

Use the **Select Scan** dropdown to pick a completed scan. Only scans for the active profile or GCP project are shown.

### Choosing Format and Sections

**Format** (select one):

| Format | Extension | Best for |
|--------|-----------|----------|
| PDF | `.pdf` | Sharing and printing |
| Excel | `.xlsx` | Analysis and filtering |
| CSV | `.csv` | Multiple CSV files for data processing |
| JSON | `.json` | Programmatic use of raw resource data |

**Sections** (check one or more):

- **Summary**: Resource counts by service and region.
- **Resources**: Full list of all discovered resources.
- **Relationships**: Resource dependencies and connection data.
- **Security Groups**: Analysis of security group rules.

### Choosing Output Directory

Click **Browse** and select a directory on your machine. The output path is shown in the field.

### Generating the Report

Click **Generate Report**. A progress bar shows the current stage. When complete, a success message shows the full file path. For CSV format, multiple files may be created in the selected directory (one per section).

---

## 22. AI Chat Assistant

The AI Chat Assistant is available from two entry points:

- **Chat bubble button** (bottom-right corner of every page): Opens a slide-out chat panel without leaving the current page.
- **AI Chat** in the sidebar navigation: Opens the full-screen chat interface.

### Configuring Bedrock

The AI Chat uses AWS Bedrock. Before your first conversation, configure the Bedrock connection:

1. Open the full-screen chat page (AI Chat in the sidebar).
2. Click the **Settings** (gear) icon in the conversation list header.
3. Configure:
   - **Model**: Choose from Amazon Nova Pro, Nova Lite, Nova Micro, Claude Sonnet 4, Claude Haiku 4.5, or Claude 3.5 Sonnet v2.
   - **Region**: Choose the AWS region where Bedrock is enabled (us-east-1, us-west-2, eu-west-1, ap-northeast-1).
   - **Access Key ID**: An AWS access key with `bedrock:InvokeModel` and `bedrock:InvokeModelWithResponseStream` permissions.
   - **Secret Access Key**: The corresponding secret.
4. Click **Save Settings**.

These credentials are stored separately from your scan profiles and are used only for Bedrock API calls.

### Starting a Conversation

Click the **+** (new chat) button to create a new conversation. Type a message and press Enter or click Send.

Suggested prompts on the empty chat screen:
- "How many resources did my last scan find?"
- "Show me my latest assessment grades"
- "What are my top cost drivers?"

### What the AI Can Answer

The assistant has access to:

- **Local scan data**: Resource counts, resource details, tag compliance, idle resource findings, and scan comparison results from the app's local database.
- **AWS live queries**: EC2 instance details, cost analysis with period comparison, cost optimization recommendations, and security best-practices checks covering EC2, S3, IAM, RDS, CloudTrail, KMS, and VPC.
- **GCP live queries**: Compute instance listing, GCP Recommender cost recommendations (13+ recommender types), stopped VM analysis, and GCP security best-practices checks.

The assistant performs read-only operations only. It does not create, modify, or delete any cloud resources.

### Managing Conversations

The left sidebar lists all saved conversations. Click any conversation to load its history. Click the trash icon on a conversation to delete it permanently. Conversations persist across app restarts.

### Choosing an AI Provider

At the bottom of the conversations sidebar, a provider dropdown shows **AWS Bedrock** as the active (and only currently enabled) option. Anthropic, OpenAI, and Vertex AI entries are shown but disabled.

---

## 23. Network Analysis

Network analysis is accessible from the **Security** page by clicking the **Network Reachability** tab. This tab only appears when the active provider is AWS.

Network Reachability analyzes whether your EC2 instances and RDS databases are reachable from the internet based on your VPC security group rules and Network ACLs (NACLs).

### Running the Analysis

1. Navigate to **Security**.
2. Click the **Network Reachability** tab.
3. Select a region from the Region dropdown.
4. Click **Analyze Network**.

The analysis inspects security groups and NACLs in the selected region and determines which resources have inbound paths from `0.0.0.0/0` (the public internet).

### Reading Results

The results show a list of resources categorized by reachability:

- **Publicly Reachable**: Resources that have an inbound path from the internet (based on security groups allowing inbound traffic from any source and the resource being in a subnet with an internet gateway route).
- **Privately Accessible**: Resources reachable only from within the VPC or via VPN/Direct Connect.
- **Port Summary**: Which ports are exposed on each resource and via which security group rules.

This analysis helps identify unintentionally exposed resources such as RDS instances with public inbound rules or EC2 instances with overly permissive security groups.

---

## 24. Troubleshooting

### The app shows "Electron API not available" on startup

This error occurs when the renderer process cannot communicate with the Electron main process. Restart the app. If the error persists, check that you are running the packaged application and not the development build with a misconfigured preload script.

### AWS profile validation fails with "InvalidClientTokenId" or "ExpiredToken"

Your AWS credentials have expired or are invalid. For IAM key profiles, update the access key and secret in Manage Profiles. For SSO profiles, log in again using `aws sso login --profile <name>` in your terminal, then retry the scan.

### Security Hub returns "not enabled" error

AWS Security Hub must be manually enabled in each region. Click the link in the error message to go to the Security Hub console, or switch the Security page mode to **Best Practices Scan** which does not require Security Hub.

### GCP login fails or "Login with gcloud" does nothing

Ensure the `gcloud` CLI is installed and on your PATH. Run `gcloud auth application-default login` in a terminal and complete the browser authentication flow. Then retry the login in the app.

### GCP projects list is empty after login

If you are authenticated but see no projects, click the **Retry** button that appears next to the project dropdown. If your account belongs to an organization, select the org from the Org dropdown first — this can trigger a broader project list load. The error message shown on hover indicates the specific API failure.

### BigQuery cost queries fail with "Cannot parse as CloudRegion"

Set the **BigQuery Dataset Region** explicitly in Settings. Choose the region that matches where your billing export dataset was created (e.g., `US` for multi-region US, or `us-central1` for Iowa).

### Scans complete but resources show as 0

This typically means the selected profile lacks read permissions for the scanned services. Verify the profile has at least the `ReadOnlyAccess` managed policy or equivalent service-specific read policies. Check that the correct regions were selected — a resource may exist in a region not included in the scan.

### The topology diagram is blank or shows only a loading spinner

Topology requires at least one completed scan for the selected profile and provider. Navigate to History and confirm a scan shows `completed` status. If a scan is completed but the diagram is empty, the scan may not have discovered any resources with relationships — try scanning additional services or regions.

### Touch ID stops working after a system update

macOS may revoke Touch ID access after OS updates. Go to **Settings** and toggle Touch ID off and on again to re-enroll. If the Enable button is greyed out, restart the app.

### Assessment fails with "No scan data available for inventory domain"

The inventory domain requires a completed scan before it can run. Run a resource scan first, then start the assessment with the inventory domain enabled.

### Session timeout while running a long scan

The session timer is reset by mouse movement, keyboard input, and clicks — all tracked with a 60-second throttle. During long scans where the app is left unattended, move the mouse periodically to keep the session active, or increase the session timeout by reducing idle time through normal use. The session timeout is fixed at 15 minutes and is not configurable.

### "Failed to save settings" toast appears after clicking Save Settings

SQLite write operations can occasionally fail if another operation is in progress. Wait a moment and try saving again. If the issue persists, check that the app has write access to its data directory (`~/Library/Application Support/fournine-cloud-analyzer/` on macOS).

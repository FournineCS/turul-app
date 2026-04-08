// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React, { useState, useRef, useEffect } from 'react';
import '../styles/help.css';

interface Section {
  id: string;
  title: string;
  content: React.ReactNode;
}

const TipBox: React.FC<{ type?: 'tip' | 'warning' | 'note'; children: React.ReactNode }> = ({ type = 'tip', children }) => (
  <div className={`help-callout help-callout-${type}`}>
    <span className="help-callout-icon">
      {type === 'tip' && '\u{1f4a1}'}
      {type === 'warning' && '\u{26a0}\u{fe0f}'}
      {type === 'note' && '\u{1f4dd}'}
    </span>
    <div>{children}</div>
  </div>
);

const KeyBadge: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <kbd className="help-kbd">{children}</kbd>
);

const SECTIONS: Section[] = [
  {
    id: 'getting-started',
    title: 'Getting Started',
    content: (
      <>
        <h3>Installation</h3>
        <p>Download the installer for your platform from the GitHub Releases page:</p>
        <ul>
          <li><strong>macOS</strong>: <code>.dmg</code> file (Intel x64 or Apple Silicon arm64)</li>
          <li><strong>Linux</strong>: <code>.zip</code> archive (x64 or arm64)</li>
        </ul>
        <p>On macOS, drag the app to Applications. On first launch, right-click and choose <strong>Open</strong> to bypass Gatekeeper.</p>

        <h3>First Launch</h3>
        <p>The app requires a password to protect access and encrypt stored credentials. You will see a <strong>Set Up Password</strong> screen on first launch.</p>
        <ol>
          <li>Enter a password (minimum 12 characters).</li>
          <li>Re-enter to confirm.</li>
          <li>Click <strong>Create Password</strong>.</li>
        </ol>
        <TipBox>Your password derives the AES-256-GCM encryption key for stored credentials. It cannot be recovered if lost.</TipBox>
      </>
    ),
  },
  {
    id: 'authentication',
    title: 'Authentication',
    content: (
      <>
        <h3>Logging In</h3>
        <p>On subsequent launches you will see the <strong>Welcome Back</strong> screen:</p>
        <ul>
          <li><strong>Touch ID</strong> (macOS): If enabled, biometric auth is attempted automatically after 300ms. You can also click the fingerprint button.</li>
          <li><strong>Password</strong>: Enter your password and click <strong>Unlock</strong>.</li>
        </ul>
        <TipBox type="warning">After 5 failed password attempts, a progressive lockout applies (up to 600 seconds).</TipBox>

        <h3>Session Timeout</h3>
        <p>The app locks after <strong>15 minutes</strong> of inactivity. Activity (mouse, keyboard, clicks) is checked every 60 seconds.</p>

        <h3>Change Password</h3>
        <p>Click <strong>Change Password</strong> in the sidebar footer. Enter your current password, then the new one, and confirm. Press <KeyBadge>Escape</KeyBadge> to cancel.</p>

        <h3>Touch ID</h3>
        <p>Go to <strong>Settings</strong> and find the <strong>Security</strong> card to enable or disable Touch ID.</p>
      </>
    ),
  },
  {
    id: 'settings',
    title: 'App Settings',
    content: (
      <>
        <p>Access via the <strong>Settings</strong> link in the sidebar footer.</p>

        <h3>Appearance</h3>
        <p>Toggle between <strong>Dark Mode</strong> and <strong>Light Mode</strong>.</p>

        <h3>Default Scan Configuration (AWS)</h3>
        <p>When AWS is active, configure defaults that pre-populate the Scan page:</p>
        <ul>
          <li><strong>Default Profile</strong>: Auto-selected on startup.</li>
          <li><strong>Default Regions</strong>: Pre-checked on the Scan page.</li>
          <li><strong>Default Services</strong>: Pre-checked on the Scan page.</li>
        </ul>

        <h3>GCP Configuration</h3>
        <p>When GCP is active, configure your BigQuery billing export:</p>
        <ul>
          <li><strong>BigQuery Billing Project</strong>: Project ID containing your billing dataset.</li>
          <li><strong>BigQuery Dataset</strong>: Dataset name (default: <code>billing_export</code>).</li>
          <li><strong>BigQuery Dataset Region</strong>: Set explicitly if you get "Cannot parse as CloudRegion" errors.</li>
        </ul>

        <h3>Data Retention</h3>
        <p>Choose how long scan data is kept: 30, 60, 90, 180 days, 1 year, or forever.</p>

        <h3>Environment Health</h3>
        <p>Shows whether required tools (AWS CLI, gcloud CLI, Node.js) are installed. Click <strong>Re-check</strong> to refresh.</p>
      </>
    ),
  },
  {
    id: 'aws-profiles',
    title: 'Adding AWS Profiles',
    content: (
      <>
        <p>The app reads AWS profiles from two sources:</p>
        <ul>
          <li><strong>System profiles</strong>: From <code>~/.aws/credentials</code> and <code>~/.aws/config</code>. Read-only.</li>
          <li><strong>App profiles</strong>: Created in the app (shown with <code>[App]</code> prefix). Encrypted in the local database.</li>
        </ul>

        <h3>Managing Profiles</h3>
        <p>Click <strong>Manage Profiles</strong> in the sidebar footer (AWS mode only).</p>

        <h3>Credential Types</h3>
        <div className="help-table-wrap">
          <table className="help-table">
            <thead>
              <tr><th>Type</th><th>Fields</th><th>Use Case</th></tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>IAM Keys</strong></td>
                <td>Profile Name, Region, Access Key ID, Secret Access Key, Session Token (optional)</td>
                <td>Direct IAM user credentials</td>
              </tr>
              <tr>
                <td><strong>SSO Config</strong></td>
                <td>SSO Start URL, SSO Region, SSO Account ID, SSO Role Name</td>
                <td>AWS IAM Identity Center (SSO)</td>
              </tr>
              <tr>
                <td><strong>Assume Role</strong></td>
                <td>Role ARN, External ID (optional), Source Profile</td>
                <td>Cross-account role assumption</td>
              </tr>
            </tbody>
          </table>
        </div>

        <h3>Selecting the Active Profile</h3>
        <p>Use the <strong>Profile</strong> dropdown in the top bar. All pages use the active profile.</p>

        <TipBox type="note">When editing an app profile, leave key fields blank to keep existing values. Profile names cannot be changed after creation.</TipBox>
      </>
    ),
  },
  {
    id: 'gcp-connection',
    title: 'Connecting GCP',
    content: (
      <>
        <p>GCP uses your existing <code>gcloud</code> CLI session (OAuth 2.0 application default credentials).</p>

        <h3>Prerequisites</h3>
        <p>Install and authenticate the gcloud CLI:</p>
        <pre className="help-code"><code>gcloud auth application-default login</code></pre>

        <h3>Logging In</h3>
        <ol>
          <li>Switch to GCP mode using the <strong>GCP</strong> toggle in the sidebar.</li>
          <li>Click <strong>Login with gcloud</strong> in the top bar.</li>
          <li>After login, accessible GCP projects load in the top bar.</li>
        </ol>

        <h3>Selecting Projects and Organizations</h3>
        <ul>
          <li>Use the <strong>Project</strong> dropdown to select the working project.</li>
          <li>If available, the <strong>Org</strong> dropdown enables organization-level views.</li>
        </ul>

        <h3>Switching Accounts</h3>
        <p>Click <strong>Switch Account</strong> to log out and immediately re-authenticate with a different Google account.</p>
      </>
    ),
  },
  {
    id: 'provider-switching',
    title: 'Switching Providers',
    content: (
      <>
        <p>The <strong>AWS / GCP</strong> toggle is at the top of the sidebar, below the logo.</p>
        <ul>
          <li><strong>AWS</strong>: Shows all AWS-specific pages (Comparison, Well-Architected, Tag Governance, IAM Analysis, Compliance, Schedules).</li>
          <li><strong>GCP</strong>: Shows GCP-specific pages (GCP Optimization, GKE Costs). AWS-only pages are hidden.</li>
        </ul>
        <TipBox>If you switch to GCP while on an AWS-only page, the app redirects to the Dashboard. Your provider selection is saved across restarts.</TipBox>
      </>
    ),
  },
  {
    id: 'resource-scans',
    title: 'Running Resource Scans',
    content: (
      <>
        <p>Navigate to <strong>Scan</strong> in the sidebar.</p>

        <h3>AWS Scan</h3>
        <ol>
          <li>Select an AWS profile from the top bar.</li>
          <li><strong>(Optional) Smart Scan</strong>: Click <strong>Discover Services by Cost (Last 30 Days)</strong> to auto-select services with active spend. Requires <code>ce:GetCostAndUsage</code> permission.</li>
          <li><strong>Select Regions</strong>: 4 popular regions shown by default. Click <strong>Show All Regions</strong> to see all 27.</li>
          <li><strong>Select Services</strong>: Grouped by category (Compute, Storage, Database, Networking, etc.). Toggle categories or individual services.</li>
          <li>Click <strong>Start Scan</strong>.</li>
        </ol>
        <p>A progress card shows the current region, service, and resource count. The app navigates to the Dashboard when complete.</p>

        <h3>GCP Scan</h3>
        <ol>
          <li>Select a GCP project from the top bar.</li>
          <li><strong>(Optional) Smart Selection</strong>: Click <strong>Discover Active Services (Last 30 Days)</strong> if BigQuery billing is configured.</li>
          <li>Select services. Use <strong>Architecture Essentials</strong> for quick topology-ready scans (compute, networking, data services).</li>
          <li>Click <strong>Start Scan</strong>.</li>
        </ol>
        <TipBox type="note">GCP scans include networking services by default for architecture diagram support.</TipBox>
      </>
    ),
  },
  {
    id: 'security',
    title: 'Security Analysis',
    content: (
      <>
        <p>Navigate to <strong>Security</strong> in the sidebar.</p>

        <h3>Scan Modes</h3>
        <ul>
          <li><strong>Security Hub</strong> (AWS) / <strong>Security Command Center</strong> (GCP): Loads findings from the native security service.</li>
          <li><strong>Best Practices Scan</strong>: Direct resource checks without requiring Security Hub or SCC.</li>
        </ul>

        <h3>Results</h3>
        <ul>
          <li><strong>Security Overview</strong>: Summary by severity (Critical, High, Medium, Low, Informational).</li>
          <li><strong>Charts</strong>: Findings by severity and by source.</li>
          <li><strong>Compliance Status</strong> (AWS): Pass/fail rates across Security Hub standards.</li>
          <li><strong>Findings Table</strong>: Sortable, filterable. Click any row for detail modal with remediation guidance.</li>
        </ul>

        <h3>Filtering &amp; Export</h3>
        <p>Filter by severity and status. Click <strong>Export CSV</strong> to download findings.</p>
      </>
    ),
  },
  {
    id: 'compliance',
    title: 'CIS Compliance',
    content: (
      <>
        <p>Navigate to <strong>Compliance</strong> (AWS only). Runs CIS AWS Foundations Benchmark v3.0 Level 1 controls (120+ checks).</p>
        <ol>
          <li>Select an AWS profile and region.</li>
          <li>Click <strong>Run CIS Assessment</strong>.</li>
        </ol>

        <h3>Results</h3>
        <p>Collapsible section cards (IAM, Storage, Logging, etc.) each show a progress bar, pass rate, and pass/fail counts. Expand to see individual controls with status, level, and finding details.</p>
        <p>Click <strong>Export CSV</strong> for the full result set.</p>
      </>
    ),
  },
  {
    id: 'iam-analysis',
    title: 'IAM Analysis',
    content: (
      <>
        <p>Navigate to <strong>IAM Analysis</strong> (AWS only). Click <strong>Run IAM Analysis</strong>.</p>

        <h3>Four Analysis Tabs</h3>
        <div className="help-table-wrap">
          <table className="help-table">
            <thead>
              <tr><th>Tab</th><th>What It Checks</th></tr>
            </thead>
            <tbody>
              <tr><td><strong>Unused Roles</strong></td><td>Roles not used in 90+ days. Color-coded: orange (&gt;90d), red (&gt;180d).</td></tr>
              <tr><td><strong>Permissive Policies</strong></td><td>Policies with <code>*:*</code> wildcards or <code>iam:PassRole</code> without conditions.</td></tr>
              <tr><td><strong>Cross-Account Trusts</strong></td><td>Roles trusting external accounts. Trusts without conditions are flagged.</td></tr>
              <tr><td><strong>Password Policy</strong></td><td>Compliance score with individual checks (length, complexity, expiry, reuse).</td></tr>
            </tbody>
          </table>
        </div>
        <p>Each tab has its own <strong>Export CSV</strong> button.</p>
      </>
    ),
  },
  {
    id: 'costs',
    title: 'Cost Reports & Analysis',
    content: (
      <>
        <p>Navigate to <strong>Costs</strong> in the sidebar.</p>

        <h3>AWS Cost Analysis</h3>
        <ol>
          <li>Select an AWS profile.</li>
          <li>Choose a date range (7d, 30d, 3m, 6m, 12m, or custom).</li>
          <li>Click <strong>Refresh</strong>.</li>
        </ol>
        <p>Shows: cost overview with period comparison, daily trend chart, service breakdown (chart + table), and optimization recommendations.</p>

        <h3>GCP Cost Analysis</h3>
        <p>Requires BigQuery billing configured in Settings. Toggle between <strong>Project</strong> and <strong>Organization</strong> scope.</p>
        <ul>
          <li><strong>Refresh</strong>: Loads from cache or queries BigQuery.</li>
          <li><strong>Force Reload</strong>: Bypasses cache.</li>
          <li><strong>History</strong>: Browse previous data snapshots.</li>
        </ul>
        <p>GCP shows: cost overview, trend chart, service/SKU/resource breakdowns, and GCP Recommender recommendations. Filter by label, service, and region.</p>

        <h3>Export (GCP)</h3>
        <p><strong>PDF</strong> and <strong>Excel</strong> (multi-sheet workbook with service, region, SKU, and resource sheets).</p>
      </>
    ),
  },
  {
    id: 'gcp-optimization',
    title: 'GCP Cost Optimization',
    content: (
      <>
        <p>Navigate to <strong>GCP Optimization</strong> (GCP only).</p>
        <p>Toggle <strong>Project</strong> or <strong>Organization</strong> scope, then click <strong>Run Full Scan</strong>.</p>

        <h3>What It Scans</h3>
        <ul>
          <li><strong>GCP Recommender</strong>: 13+ recommendation types (right-sizing, idle VMs, unattached disks, etc.).</li>
          <li><strong>Resource Idle Analysis</strong>: Direct inspection for idle and oversized resources.</li>
        </ul>

        <h3>Tabs</h3>
        <ul>
          <li><strong>Live</strong>: Recommendations with estimated savings + idle resource findings.</li>
          <li><strong>Resources</strong>: Detailed findings from idle analysis.</li>
          <li><strong>History</strong>: Previously saved snapshots (click to reload).</li>
        </ul>
        <p>Export to <strong>Excel</strong> or <strong>PDF</strong>.</p>
      </>
    ),
  },
  {
    id: 'gke-costs',
    title: 'GKE Cost Analysis',
    content: (
      <>
        <p>Navigate to <strong>GKE Costs</strong> (GCP only). Requires BigQuery billing configured.</p>
        <ol>
          <li>Toggle <strong>Project</strong> or <strong>Organization</strong> scope.</li>
          <li>Select a date range.</li>
          <li>Click <strong>Refresh</strong>.</li>
        </ol>

        <h3>Drill-Down Hierarchy</h3>
        <p><strong>Cluster</strong> → <strong>Namespace</strong> → <strong>Workload</strong></p>
        <p>Summary cards show total GKE spend, top cluster, and average cost. Daily trend charts and color-coded bar charts by cluster.</p>

        <h3>Export</h3>
        <p><strong>CSV</strong>, <strong>Excel</strong> (multi-sheet: cluster, namespace, workload), or <strong>PDF</strong>.</p>
      </>
    ),
  },
  {
    id: 'well-architected',
    title: 'Well-Architected Reviews',
    content: (
      <>
        <p>Navigate to <strong>Well-Architected</strong> (AWS only).</p>

        <h3>Modes</h3>
        <ul>
          <li><strong>AWS Well-Architected Workloads</strong>: Connects to the Well-Architected Tool API for existing workload reviews.</li>
          <li><strong>Best Practices Scan</strong>: Direct checks without the Well-Architected Tool.</li>
        </ul>

        <h3>Workload Review</h3>
        <ol>
          <li>Select a region and click <strong>Refresh</strong>.</li>
          <li>Click a workload from the list.</li>
          <li>Review the 6-pillar breakdown: Operational Excellence, Security, Reliability, Performance Efficiency, Cost Optimization, Sustainability.</li>
        </ol>
        <p>Each pillar shows high-risk and medium-risk item counts, with an improvements list sorted by risk level.</p>
        <p>Click <strong>Export CSV</strong> to download improvement items.</p>
      </>
    ),
  },
  {
    id: 'assessment',
    title: 'Assessment Reports',
    content: (
      <>
        <p>Navigate to <strong>Assessment</strong> (AWS only). Produces an overall letter grade (A–F) with a score out of 100.</p>

        <h3>Configuration</h3>
        <ol>
          <li>Select a region.</li>
          <li>Choose domains: <strong>Cost Optimization</strong>, <strong>Security</strong>, <strong>Well-Architected</strong>, <strong>Resource Inventory</strong>.</li>
          <li>If Cost is selected, pick a lookback period (7, 30, or 90 days).</li>
          <li>Click <strong>Run Assessment</strong>.</li>
        </ol>

        <h3>Results</h3>
        <ul>
          <li><strong>Overall Grade</strong>: Letter grade with numeric score.</li>
          <li><strong>Domain Cards</strong>: Individual grades per domain.</li>
          <li><strong>Recommendations</strong>: Prioritized by severity (Critical, High, Medium, Low).</li>
        </ul>

        <h3>PDF Report</h3>
        <p>Click <strong>Generate PDF Report</strong> and choose a save directory. Also available from <strong>History → Assessments</strong> tab.</p>
      </>
    ),
  },
  {
    id: 'tag-governance',
    title: 'Tag Governance',
    content: (
      <>
        <p>Navigate to <strong>Tag Governance</strong> (AWS only). Checks scan results against required tags you define.</p>

        <h3>Define Required Tags</h3>
        <ol>
          <li>Enter a tag key (e.g., <code>Environment</code>, <code>Owner</code>).</li>
          <li>Optionally add allowed values (e.g., <code>prod</code>, <code>staging</code>, <code>dev</code>).</li>
          <li>Click <strong>Save</strong>.</li>
        </ol>

        <h3>Run Compliance Check</h3>
        <p>Select a completed scan from the dropdown and click <strong>Run Compliance Check</strong>.</p>

        <h3>Results</h3>
        <ul>
          <li><strong>Tag Compliance Report</strong>: Percentage of compliant resources by service.</li>
          <li><strong>Tag Coverage Heatmap</strong>: Visual grid of coverage per service and tag.</li>
          <li><strong>Untagged Resources List</strong>: Resources missing required tags (exportable to CSV).</li>
        </ul>
      </>
    ),
  },
  {
    id: 'architecture',
    title: 'Architecture Diagrams',
    content: (
      <>
        <p>Navigate to <strong>Architecture</strong>. Works for both AWS and GCP scans.</p>

        <h3>View Modes</h3>
        <div className="help-table-wrap">
          <table className="help-table">
            <thead>
              <tr><th>View</th><th>Shows</th></tr>
            </thead>
            <tbody>
              <tr><td><strong>Network</strong></td><td>VPCs, subnets, security groups, compute/DB resources within them.</td></tr>
              <tr><td><strong>Application</strong></td><td>Load balancers, compute (EC2, ECS, Lambda, GKE, Cloud Run), databases, connections.</td></tr>
              <tr><td><strong>Data</strong></td><td>S3, RDS, DynamoDB, BigQuery, Cloud SQL and their relationships to compute.</td></tr>
              <tr><td><strong>Full Topology</strong></td><td>D3 force-directed graph of all resources. Drag to pin, click to highlight connections.</td></tr>
            </tbody>
          </table>
        </div>

        <h3>Interaction</h3>
        <ul>
          <li><strong>Network/App/Data</strong>: React Flow with dagre auto-layout. Drag nodes, scroll to zoom, click groups to collapse/expand.</li>
          <li><strong>Full Topology</strong>: D3 force graph. Drag to pin nodes, scroll/pinch to zoom.</li>
        </ul>
        <TipBox type="note">For GCP shared VPC setups, a Project filter dropdown lets you filter by specific project.</TipBox>
      </>
    ),
  },
  {
    id: 'scheduling',
    title: 'Scan Scheduling',
    content: (
      <>
        <p>Navigate to <strong>Schedules</strong> (AWS only).</p>
        <ol>
          <li>Enter a <strong>Schedule Name</strong>.</li>
          <li>Choose <strong>Frequency</strong>: Hourly, Daily, or Weekly.</li>
          <li>Select regions and services.</li>
          <li>Optionally check <strong>Auto-assess after scan</strong>.</li>
          <li>Click <strong>Create Schedule</strong>.</li>
        </ol>
        <p>Manage schedules with enable/disable toggles and delete buttons.</p>
        <TipBox type="warning">Schedules only run while the app is open. Missed runs do not execute retroactively.</TipBox>
      </>
    ),
  },
  {
    id: 'history-comparison',
    title: 'History & Comparison',
    content: (
      <>
        <h3>Scan History</h3>
        <p>Navigate to <strong>History</strong>. Two tabs:</p>
        <ul>
          <li><strong>Scans</strong>: All scans for the active profile/project. Filter by status, sort by columns. Actions: <strong>Resources</strong>, <strong>Topology</strong>, <strong>Delete</strong>.</li>
          <li><strong>Assessments</strong>: All assessments with grade, score, and recommendation counts. Actions: <strong>View</strong>, <strong>PDF</strong>, <strong>Delete</strong>.</li>
        </ul>

        <h3>Scan Comparison</h3>
        <p>Navigate to <strong>Comparison</strong> (AWS only). Select a <strong>Before</strong> and <strong>After</strong> scan, then click <strong>Compare</strong>.</p>
        <p>Results show four tabs: <strong>Summary</strong>, <strong>Added</strong>, <strong>Removed</strong>, <strong>Changed</strong> (with field-level diffs). Each tab supports CSV export.</p>
      </>
    ),
  },
  {
    id: 'reports',
    title: 'Report Exports',
    content: (
      <>
        <p>Navigate to <strong>Reports</strong>. Generate structured files from a completed scan.</p>

        <h3>Formats</h3>
        <div className="help-table-wrap">
          <table className="help-table">
            <thead>
              <tr><th>Format</th><th>Extension</th><th>Best For</th></tr>
            </thead>
            <tbody>
              <tr><td>PDF</td><td><code>.pdf</code></td><td>Sharing and printing</td></tr>
              <tr><td>Excel</td><td><code>.xlsx</code></td><td>Analysis and filtering</td></tr>
              <tr><td>CSV</td><td><code>.csv</code></td><td>Data processing (multiple files)</td></tr>
              <tr><td>JSON</td><td><code>.json</code></td><td>Programmatic use</td></tr>
            </tbody>
          </table>
        </div>

        <h3>Sections</h3>
        <p>Choose one or more: <strong>Summary</strong>, <strong>Resources</strong>, <strong>Relationships</strong>, <strong>Security Groups</strong>.</p>

        <h3>Steps</h3>
        <ol>
          <li>Select a completed scan.</li>
          <li>Choose format and sections.</li>
          <li>Click <strong>Browse</strong> to select an output directory.</li>
          <li>Click <strong>Generate Report</strong>.</li>
        </ol>
      </>
    ),
  },
  {
    id: 'ai-chat',
    title: 'AI Chat Assistant',
    content: (
      <>
        <p>Available from the <strong>chat bubble</strong> (bottom-right corner) or <strong>AI Chat</strong> in the sidebar.</p>

        <h3>Configuring Bedrock</h3>
        <ol>
          <li>Open the full-screen AI Chat page.</li>
          <li>Click the <strong>Settings</strong> (gear) icon.</li>
          <li>Select a <strong>Model</strong>: Amazon Nova Pro, Nova Lite, Nova Micro, Claude Sonnet 4, Claude Haiku 4.5, or Claude 3.5 Sonnet v2.</li>
          <li>Choose a <strong>Region</strong>: us-east-1, us-west-2, eu-west-1, or ap-northeast-1.</li>
          <li>Enter your Bedrock <strong>Access Key ID</strong> and <strong>Secret Access Key</strong>.</li>
          <li>Click <strong>Save Settings</strong>.</li>
        </ol>

        <h3>What the AI Can Do</h3>
        <ul>
          <li><strong>Local data</strong>: Query scan results, resource counts, tags, idle findings, comparisons.</li>
          <li><strong>AWS live queries</strong>: EC2 details, Cost Explorer, optimization recommendations, security checks.</li>
          <li><strong>GCP live queries</strong>: Compute instances, Recommender costs, stopped VMs, security checks.</li>
        </ul>
        <TipBox>The AI performs <strong>read-only</strong> operations only. It never creates, modifies, or deletes cloud resources.</TipBox>

        <h3>Managing Conversations</h3>
        <p>Conversations are listed in the left sidebar. Click to load, trash icon to delete. Conversations persist across restarts.</p>
      </>
    ),
  },
  {
    id: 'network-analysis',
    title: 'Network Analysis',
    content: (
      <>
        <p>Access from the <strong>Security</strong> page → <strong>Network Reachability</strong> tab (AWS only).</p>
        <ol>
          <li>Select a region.</li>
          <li>Click <strong>Analyze Network</strong>.</li>
        </ol>

        <h3>Results</h3>
        <ul>
          <li><strong>Publicly Reachable</strong>: Resources with inbound paths from <code>0.0.0.0/0</code>.</li>
          <li><strong>Privately Accessible</strong>: VPC/VPN-only reachable resources.</li>
          <li><strong>Port Summary</strong>: Exposed ports per resource and their source security group rules.</li>
        </ul>
        <TipBox type="warning">This helps identify unintentionally exposed resources like RDS instances with public inbound rules.</TipBox>
      </>
    ),
  },
  {
    id: 'troubleshooting',
    title: 'Troubleshooting',
    content: (
      <>
        <div className="help-table-wrap">
          <table className="help-table">
            <thead>
              <tr><th>Issue</th><th>Solution</th></tr>
            </thead>
            <tbody>
              <tr>
                <td>"Electron API not available" on startup</td>
                <td>Restart the app. Ensure you're running the packaged application.</td>
              </tr>
              <tr>
                <td>AWS "InvalidClientTokenId" or "ExpiredToken"</td>
                <td>Update credentials in Manage Profiles, or run <code>aws sso login --profile &lt;name&gt;</code>.</td>
              </tr>
              <tr>
                <td>Security Hub "not enabled" error</td>
                <td>Enable Security Hub in the AWS console for that region, or switch to Best Practices mode.</td>
              </tr>
              <tr>
                <td>GCP login fails</td>
                <td>Ensure <code>gcloud</code> CLI is installed. Run <code>gcloud auth application-default login</code>.</td>
              </tr>
              <tr>
                <td>GCP projects list is empty</td>
                <td>Click <strong>Retry</strong>. Try selecting an Org first to trigger a broader project load.</td>
              </tr>
              <tr>
                <td>BigQuery "Cannot parse as CloudRegion"</td>
                <td>Set <strong>BigQuery Dataset Region</strong> explicitly in Settings.</td>
              </tr>
              <tr>
                <td>Scans complete but 0 resources</td>
                <td>Verify the profile has <code>ReadOnlyAccess</code> or equivalent. Check region selection.</td>
              </tr>
              <tr>
                <td>Topology diagram is blank</td>
                <td>Ensure a completed scan exists. Try scanning more services/regions.</td>
              </tr>
              <tr>
                <td>Touch ID stops working after OS update</td>
                <td>Go to Settings → toggle Touch ID off and on to re-enroll.</td>
              </tr>
              <tr>
                <td>Assessment "No scan data" error</td>
                <td>Run a resource scan first, then re-run the assessment with inventory domain.</td>
              </tr>
              <tr>
                <td>Session timeout during long scans</td>
                <td>Move the mouse periodically. The 15-minute timeout is not configurable.</td>
              </tr>
              <tr>
                <td>"Failed to save settings" toast</td>
                <td>Wait a moment and retry. Check write access to the app data directory.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </>
    ),
  },
];

const HelpPage: React.FC = () => {
  const [activeSection, setActiveSection] = useState(SECTIONS[0].id);
  const [searchQuery, setSearchQuery] = useState('');
  const contentRef = useRef<HTMLDivElement>(null);

  const filteredSections = searchQuery.trim()
    ? SECTIONS.filter(
        (s) =>
          s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          (typeof s.content === 'object' && s.id.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : SECTIONS;

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    const el = document.getElementById(`help-section-${id}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Track active section on scroll
  useEffect(() => {
    const container = contentRef.current;
    if (!container) return;

    const handleScroll = () => {
      const sections = container.querySelectorAll('[data-help-section]');
      let current = SECTIONS[0].id;
      for (const section of sections) {
        const rect = section.getBoundingClientRect();
        if (rect.top <= 180) {
          current = section.getAttribute('data-help-section') || current;
        }
      }
      setActiveSection(current);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <>
      <header className="page-header">
        <h1 className="page-title">Help &amp; User Guide</h1>
        <div className="help-search-wrap">
          <input
            type="text"
            className="form-input help-search-input"
            placeholder="Search help topics..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button className="help-search-clear" onClick={() => setSearchQuery('')}>
              &times;
            </button>
          )}
        </div>
      </header>

      <div className="help-layout">
        <nav className="help-toc">
          <div className="help-toc-title">Contents</div>
          {filteredSections.map((section) => (
            <button
              key={section.id}
              className={`help-toc-item ${activeSection === section.id ? 'active' : ''}`}
              onClick={() => scrollToSection(section.id)}
            >
              {section.title}
            </button>
          ))}
        </nav>

        <div className="help-content" ref={contentRef}>
          {filteredSections.map((section) => (
            <div
              key={section.id}
              id={`help-section-${section.id}`}
              data-help-section={section.id}
              className="help-section card"
            >
              <h2 className="help-section-title">{section.title}</h2>
              {section.content}
            </div>
          ))}

          {filteredSections.length === 0 && (
            <div className="help-empty">
              <p>No help topics match "<strong>{searchQuery}</strong>".</p>
              <button className="btn btn-secondary" onClick={() => setSearchQuery('')}>
                Clear Search
              </button>
            </div>
          )}

          <div className="help-footer">
            <p>Fournine Cloud Analyzer &mdash; Your DevOps Partner</p>
            <p className="text-secondary text-sm">
              For additional support, report issues at the project's GitHub repository.
            </p>
          </div>
        </div>
      </div>
    </>
  );
};

export default HelpPage;

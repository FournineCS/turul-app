# Changelog

All notable changes are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
follows [Semantic Versioning](https://semver.org/).

## [Unreleased]

### CI / Security
- Skip CodeQL on Dependabot PRs and forked-PR runs (downgraded `GITHUB_TOKEN`
  cannot write to `security-events`).
- Skip Claude Code Review on bot-authored PRs (`pull_request.user.type != 'User'`).
- Split Trivy SARIF upload into a dedicated `trivy.yml` workflow that runs on
  every push to `main`, every PR, weekly, and on demand. The release workflow
  keeps a table-format Trivy gate.
- Grant `security-events: write` to the `security-scan` job in `release.yml`.

## [0.9.3] — 2026-04-25

### Added
- **Comprehensive OSS hardening**: CodeQL (`security-extended`), OSSF Scorecard
  (weekly), Dependency Review on every PR, secret scanning + push protection,
  signed-tag releases, branch-protection on `main` (PR + 1 review + CODEOWNERS
  + 3 status checks + linear history + no force-push), tag protection on `v*`,
  CODEOWNERS, and SHA-pinned actions across all workflows.
- `RELEASING.md` documenting the trunk-based, tag-driven release flow.

### Changed
- Releases are now triggered by `v*` tag pushes, not by PR-merge events. Local
  flow: `npm version patch && git push --follow-tags`.
- `Create GitHub Release` step is idempotent — re-running with an existing
  release uploads assets with `--clobber` instead of failing.
- CodeQL drops the `security-and-quality` query pack to silence ~40 style
  findings; ESLint owns style.

### Fixed
- GCP project / org persistence errors are now logged via `console.error`
  instead of being silently swallowed.

## [0.9.2] — 2026-04-25

### Added
- Dashboard quick-assess card and full-assessment progress UI.
- Configurable Claude Code CLI path with auto-detection.

### Changed
- Refactored Claude Code provider into a dedicated MCP client manager.
- Pinned `actions/upload-artifact` to v4.4.3 and `actions/download-artifact`
  to v4.1.8 (v5+ broke the build-artifact merge flow).

### Fixed
- Re-authentication UX: detect expired Google sessions
  (`invalid_grant`, `invalid_rapt`, `UNAUTHENTICATED`, etc.) and surface a
  single **Re-authenticate** button instead of a noisy gRPC error.
- Account-switching no longer flashes the previous account's projects /
  organization while the new account loads. Persisted project / org
  selections are now namespaced per-account.
- Release-build path resolution for the bundled Claude Code CLI.

### Security
- `protobufjs` 7.5.4 → 7.5.5 (CRITICAL — RCE, GHSA on Aqua/Apr 2026)
- `@xmldom/xmldom` 0.8.12 → 0.8.13 (HIGH — three XML injection advisories)
- `hono` 4.12.12 → 4.12.15 (MEDIUM — JSX HTML injection)
- `follow-redirects` 1.15.11 → 1.16.0 (MEDIUM — auth header leak)
- `postcss` 8.5.8 → 8.5.10 (MEDIUM — XSS via stringify)
- `fast-xml-parser` override bumped to `^5.7.0` (MEDIUM — XML injection in
  `XMLBuilder`)

## [0.9.1] — 2026-04-11

### Added
- Multi-provider AI chat with Claude Code MCP integration.
- GCP account / profile management with multi-account support.

## [0.9.0] — 2026-04-09

### Added
- Initial open-source release.
- AWS scanning: 117 service scanners with multi-region, multi-account support.
- GCP scanning: 85 service scanners with multi-project support.
- Cost analysis: AWS Cost Explorer and GCP Billing — trends, forecasts,
  recommendations; GKE cluster/namespace/workload cost drill-down.
- Security: AWS Security Hub, GCP Security Command Center, AWS CIS v3
  (120+ controls), GCP CIS, AWS / GCP Best Practices.
- IAM analysis: AWS unused roles, overly permissive policies, cross-account
  trust, password policy; GCP unused service accounts, overly permissive
  bindings, service-account-key audit, cross-project bindings.
- Network analysis: AWS EC2/RDS reachability via security groups + NACLs;
  GCP VPC reachability and firewall rule analysis.
- Well-Architected: AWS 6-pillar workload reviews via the Well-Architected API
  with improvement recommendations; GCP-native 5-pillar checks.
- Multi-dimensional assessment scoring (Cost, Security, Reliability,
  Compliance, IAM) with A–F grades and persisted history.
- Architecture diagrams: Network, Application, Data views (React Flow + dagre)
  + Full Topology (D3).
- Tag (AWS) / Label (GCP) governance with a 9-layer async compliance pipeline.
- Scan management: hourly / daily / weekly schedules, multi-account, scan
  diff/comparison.
- Authentication: password-based with AES-256-GCM-encrypted credential
  storage; Touch ID on macOS; first-run onboarding tour.
- Reports: PDF, Excel, CSV export for assessments, costs, GKE costs, and
  GCP optimization.
- Cross-platform packaging: macOS (arm64, x64), Windows (x64, arm64), Linux
  (x64, arm64) — `.dmg` / `.exe` / `.AppImage` / `.deb`.

### Changed
- Relicensed to Apache 2.0.
- Rebranded to **Turul** — a mythological golden bird, drawing from the
  diversity of Turkic, Hungarian, and Indo-European traditions.

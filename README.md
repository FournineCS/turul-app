<div align="center">

# Turul

**A privacy-first, local-only desktop app for AWS and GCP cloud-resource analysis.**

[![CI](https://github.com/FournineCS/turul-app/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/FournineCS/turul-app/actions/workflows/ci.yml)
[![CodeQL](https://github.com/FournineCS/turul-app/actions/workflows/codeql.yml/badge.svg?branch=main)](https://github.com/FournineCS/turul-app/actions/workflows/codeql.yml)
[![OSSF Scorecard](https://api.scorecard.dev/projects/github.com/FournineCS/turul-app/badge)](https://scorecard.dev/viewer/?uri=github.com/FournineCS/turul-app)
[![Latest release](https://img.shields.io/github/v/release/FournineCS/turul-app)](https://github.com/FournineCS/turul-app/releases/latest)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

</div>

> Plug in your AWS profile or `gcloud` account, scan **200+ services** across
> cost, security posture, IAM, network reachability, CIS compliance, and
> Well-Architected — all without sending a single API key, scan result, or
> resource graph to a third-party SaaS. Your credentials stay in your OS
> keychain. The database stays on your laptop.

## Why Turul

| | Turul | SaaS CSPMs (Wiz, Prisma, …) | CLI tools (Steampipe, CloudQuery) |
|---|---|---|---|
| Where data lives | Local SQLite | Vendor cloud | Local DB / DW |
| Setup time | Install `.dmg` / `.exe`, point at AWS / `gcloud` | Org rollout, IAM cross-account roles | Install + write SQL |
| UI | Native desktop app | Web console | None — bring-your-own |
| Cost analysis | Cost Explorer + GCP Billing + GKE drill-down | Vendor pricing | DIY queries |
| Multi-cloud | AWS + GCP | Yes | Yes |
| Open source | Apache-2.0 | No | Apache-2.0 |
| Best for | Solo engineers, freelancers, small teams, regulated environments | Enterprises with cross-account scanning needs | Engineers who want SQL over cloud APIs |

## Install (end users)

Download the latest installer from the [**Releases**](https://github.com/FournineCS/turul-app/releases/latest) page:

| Platform | File |
|---|---|
| macOS — Apple Silicon | `Turul-X.Y.Z-mac-arm64.dmg` |
| macOS — Intel | `Turul-X.Y.Z-mac-x64.dmg` |
| Windows — x64 | `Turul-X.Y.Z-win-x64-setup.exe` |
| Windows — ARM64 | `Turul-X.Y.Z-win-arm64-setup.exe` |
| Linux — x64 | `Turul-X.Y.Z-linux-x64.AppImage` / `.deb` |
| Linux — ARM64 | `Turul-X.Y.Z-linux-arm64.AppImage` / `.deb` |

The macOS builds are not yet notarized — on first launch, right-click → **Open** to bypass Gatekeeper.

### Cloud access

Turul uses the credentials already on your machine. No new keys, no IAM role to deploy.

- **AWS** — any profile in `~/.aws/credentials` or `~/.aws/config`. SSO is supported.
- **GCP** — `gcloud auth application-default login`. Multi-account is supported via the in-app account manager.

## Features

- **AWS scanning** — 117 service scanners across multiple regions and accounts.
- **GCP scanning** — 85 service scanners across multiple projects.
- **Cost analysis** — AWS Cost Explorer + GCP Billing with trends, forecasts, recommendations, and GKE cluster/namespace/workload drill-down.
- **Security posture** — AWS Security Hub, GCP Security Command Center, AWS CIS v3 (120+ controls), GCP CIS, best-practice checks.
- **IAM analysis** — Unused roles, overly-permissive policies, cross-account / cross-project trust, service-account key audit, password policy.
- **Network reachability** — AWS EC2 / RDS via security groups + NACLs; GCP VPC firewall analysis.
- **Well-Architected** — AWS 6-pillar reviews via the Well-Architected API with improvement recommendations; GCP-native 5-pillar checks.
- **Assessment scoring** — Cost / Security / Reliability / Compliance / IAM A–F grades with persisted history.
- **Architecture diagrams** — Network, Application, Data views (React Flow + dagre) plus Full Topology (D3).
- **Tag / label governance** — 9-layer async compliance pipeline for AWS tags and GCP labels.
- **AI chat** — AWS Bedrock-powered assistant with tool calling; tools cover AWS, GCP, and the local SQLite DB.
- **Reports** — PDF, Excel, CSV export for assessments, costs, GKE costs, and GCP optimization.

## Privacy & security

- All credentials are stored locally, encrypted with AES-256-GCM, and protected by a master password (Touch ID supported on macOS).
- The local SQLite database never leaves your machine.
- Outbound network traffic is limited to AWS / GCP APIs (and AWS Bedrock if you opt into AI chat). There is no telemetry, analytics, or cloud sync.

## System requirements

- **macOS** 11 Big Sur or newer (arm64 or x64)
- **Windows** 10 or newer (x64 or arm64)
- **Linux** — Ubuntu 22.04+, Fedora 38+, or any glibc 2.28+ distro
- **AWS CLI** and / or **gcloud CLI** in `PATH` (for refreshing credentials)

## Build from source (developers)

```bash
git clone https://github.com/FournineCS/turul-app.git
cd turul-app
npm install              # requires Node.js 22+ — see .github/workflows/ci.yml
npm run dev:simple       # launches Vite + Electron

# Cross-platform packaging
npm run package:mac      # arm64 + x64
npm run package:win
npm run package:linux
```

Project layout, IPC bridge, scanner conventions, and other internals live in [`CLAUDE.md`](CLAUDE.md).

## Contributing

PRs welcome — see [CONTRIBUTING.md](CONTRIBUTING.md). The default branch is protected: every change merges via PR, with at least one approving review and green CI (typecheck, build, CodeQL, dependency review).

## Security

Vulnerabilities can be reported privately per the [security policy](.github/SECURITY.md). The repo runs CodeQL, Trivy, OSSF Scorecard, Dependency Review, secret-scanning push-protection, and Dependabot weekly. All third-party GitHub Actions are pinned to commit SHAs.

## License

[Apache License 2.0](LICENSE) © Fournine Cloud

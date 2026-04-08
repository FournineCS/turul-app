# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [1.2.0] - 2024-12-01

### Added
- IAM user analysis for AWS (unused roles, overly-permissive policies, cross-account trust, password policy)
- GCP label governance compliance pipeline
- Assessment history persistence for both AWS and GCP
- Release site for v1.2.0

### Changed
- Relicensed from MIT to Apache 2.0
- Bumped all dependencies to resolve 22 Dependabot vulnerability advisories

### Fixed
- Various dependency security vulnerabilities

## [1.1.0] - 2024-10-01

### Added
- GCP support: 85 service scanners, multi-project management
- GCP cost analysis via BigQuery billing export
- GCP Security Command Center integration
- GCP CIS compliance framework
- GCP Well-Architected 5-pillar checks
- GCP IAM analysis (service accounts, overly-permissive bindings)
- GKE cluster/namespace/workload cost drill-down
- AI Chat with AWS Bedrock integration (tool calling)
- Touch ID authentication on macOS
- Scan scheduling (hourly/daily/weekly)

### Changed
- Architecture diagram viewer now supports GCP topology
- Navigation sidebar filters by active cloud provider

## [1.0.0] - 2024-08-01

### Added
- Initial release
- AWS resource scanning (117 service scanners, multi-region, multi-account)
- AWS Cost Explorer integration
- AWS Security Hub, Best Practices checks
- AWS CIS compliance (120+ controls)
- AWS Well-Architected workload reviews
- AWS IAM analysis
- AWS network reachability analysis
- PDF, Excel, CSV report export
- Password-based authentication with AES-256-GCM encrypted credential storage
- Onboarding tour for first-time users

# Turul

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)

A desktop application for multi-cloud resource analysis, covering AWS and GCP. Built with Electron and React.

## Features

- **AWS Scanning** -- 117 service scanners with multi-region, multi-account support
- **GCP Scanning** -- 85 service scanners with multi-project support
- **Cost Analysis** -- AWS Cost Explorer and GCP Billing with trends, forecasts, and recommendations
- **Security** -- AWS Security Hub, GCP Security Command Center, CIS compliance frameworks
- **IAM Analysis** -- Unused roles, overly permissive policies, cross-account/cross-project trust
- **Network Analysis** -- VPC reachability, security group and firewall rule analysis
- **Well-Architected Reviews** -- AWS 6-pillar and GCP 5-pillar assessments
- **Assessment Scoring** -- Multi-dimensional A-F grading (Cost, Security, Reliability, Compliance, IAM)
- **Architecture Diagrams** -- Network, Application, Data views with topology visualization
- **Tag/Label Governance** -- AWS tag and GCP label compliance analysis
- **AI Chat** -- AWS Bedrock-powered assistant with tool calling
- **Reports** -- PDF, Excel, CSV export for assessments, costs, and optimization

## Getting Started

### Prerequisites

- Node.js 18+
- npm 9+
- AWS CLI and/or gcloud CLI (for cloud provider access)

### Installation

```bash
git clone https://github.com/FournineCS/turul-app.git
cd turul-app
npm install
```

### Development

```bash
npm run dev:simple
```

### Build

```bash
npm run build              # Compile Vite + Electron
npm run package            # Package for current platform
npm run package:mac        # macOS
npm run package:win        # Windows
npm run package:linux      # Linux
```

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Security

See [SECURITY.md](.github/SECURITY.md) for reporting vulnerabilities.

## License

Licensed under the Apache License, Version 2.0. See [LICENSE](LICENSE) for details.

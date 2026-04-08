# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| 1.2.x   | Yes       |
| < 1.2   | No        |

## Reporting a Vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Email us at **info@fourninecloud.com** with:

- A description of the vulnerability
- Steps to reproduce the issue
- Potential impact assessment
- Any proof-of-concept code (if applicable)

We will acknowledge receipt within **48 hours** and provide a status update within **7 days**.

## Disclosure Timeline

1. Report received and acknowledged within 48 hours
2. Vulnerability confirmed or rejected within 7 days
3. Fix developed and tested
4. Security advisory published and patched release issued
5. **90-day disclosure deadline** from initial report — after which the reporter may disclose publicly

## Scope

This project is an Electron desktop application that:
- Reads AWS and GCP credentials from local environment/config
- Stores encrypted credentials locally using AES-256-GCM
- Makes API calls to AWS and GCP on behalf of the authenticated user

Out of scope: social engineering, physical attacks, issues in third-party dependencies (report those upstream).

## Security Best Practices for Users

- Use IAM roles with least-privilege permissions
- Enable password protection in the app settings
- Do not share your local database file (`aws-analyzer.db`)
- Rotate AWS/GCP credentials regularly

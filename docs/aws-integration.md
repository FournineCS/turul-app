# AWS Integration

## Service Scanners

### Overview

AWS scanners live in `src/main/aws/scanners/`. Each scanner extends `BaseScanner` and implements a `scan()` method that returns discovered resources.

**Total**: 115 scanner files covering all major AWS services across 10 phases.

### Scanner Base Class

```typescript
// src/main/aws/scanners/base-scanner.ts
export abstract class BaseScanner {
  protected config: ScannerConfig;    // { profile, region, scanId }
  protected serviceType: ServiceType;  // e.g., 'ec2', 'lambda'
  protected serviceName: string;

  abstract scan(): Promise<ScanResult>;

  // Helpers available to all scanners:
  protected createResource(id, resourceType, name, data, tags?, createdAt?): Resource;
  protected createError(operation, error): ScanError;
  protected parseTags(tags): Record<string, string>;       // { Key, Value } format
  protected parseTagsLowercase(tags): Record<string, string>; // { key, value } format
  protected withRateLimit<T>(operation): Promise<T>;
}
```

### Scanner Phases

| Phase | Services | Count |
|-------|----------|-------|
| Original | EC2, Lambda, RDS, ALB, S3, DynamoDB, ElastiCache, SQS, Athena, Step Functions, Redshift, MWAA, API Gateway, Secrets Manager, KMS, CloudWatch, ECS, CloudFormation, EKS, Glue, SNS, EventBridge | 22 |
| 1A | CloudFront, EFS, Route53 | 3 |
| 1B | IAM, AutoScaling, CloudTrail, GuardDuty, AccessAnalyzer, Inspector | 6 |
| 2 | ECR, ACM, SSM, WAFv2, Cognito, Config, Backup, CodePipeline, CodeBuild, OpenSearch | 10 |
| 3 | Kinesis, Firehose, SES, AppSync, MSK, EMR, SageMaker, Transfer | 8 |
| 4 | Neptune, DocumentDB, MemoryDB, Timestream, Keyspaces, Transit Gateway, Global Accelerator, Direct Connect, Network Firewall, MQ | 10 |
| 5 | FSx, Storage Gateway, DMS, DataSync, DRS, Lake Formation, Elastic Beanstalk, App Runner, Batch, AppFlow | 10 |
| 6 | Macie, FMS, Shield, CloudHSM, Directory Service, Detective, Audit Manager, RAM, Organizations, Trusted Advisor | 10 |
| 7 | CodeDeploy, CodeArtifact, X-Ray, FIS, Image Builder, Service Catalog, License Manager, Compute Optimizer | 8 |
| 8 | Bedrock, Comprehend, Rekognition, Textract, Transcribe, Lex, Kendra, Amplify, Location, Lightsail | 10 |
| 9 | Kinesis Video, Flink, QuickSight, Pinpoint, Connect, IVS, MediaConvert, MediaLive | 8 |
| 10 | IoT, Forecast, Personalize, Fraud Detector, WorkSpaces, Verified Access, VPC Lattice, Elastic Transcoder, CloudSearch, HealthLake | 10 |

### Writing a Scanner

See [Adding a Scanner](./adding-a-scanner.md) for a complete walkthrough.

### Global Services

These services are not region-scoped and should only be scanned once:
- **CloudFront** - CDN distributions
- **Route53** - DNS hosted zones
- **IAM** - Users, roles, policies

The scan orchestrator tracks completed global scans and skips duplicates.

## Client Factory

`src/main/aws/client-factory.ts` manages SDK client lifecycle:

```typescript
const factory = getClientFactory();
factory.configure(profile, region);

// Get typed clients
const ec2 = factory.getEC2Client();
const s3 = factory.getS3Client();
const lambda = factory.getLambdaClient();
// ... ~60 getter methods
```

Clients are cached by `(profile, region)` to avoid recreation overhead.

## Rate Limiting

`src/main/aws/rate-limiter.ts` enforces per-service API rate limits defined in `src/shared/types/common.ts`:

```typescript
// Example rate limit config
ec2: { requestsPerSecond: 10, burstLimit: 50 }
s3:  { requestsPerSecond: 50, burstLimit: 200 }
rds: { requestsPerSecond: 5,  burstLimit: 20 }
```

Scanners call `this.withRateLimit(() => apiCall())` to respect these limits.

## Cost Analysis

`src/main/aws/discovery/cost-explorer.ts`

- **Cost breakdown** by service, region (daily/monthly granularity)
- **Trend analysis** over configurable date ranges (7d, 30d, 90d, 12m)
- **Cost forecasting** using AWS Cost Explorer forecast API
- **Service discovery by cost** - identifies active services based on billing data

`src/main/aws/discovery/cost-resource-checks.ts`

- Best practice checks for cost optimization
- Identifies unused/underutilized resources (idle RDS, unattached EBS, etc.)

### Required Permissions

```
ce:GetCostAndUsage
ce:GetCostForecast
ce:GetDimensionValues
```

## Security Analysis

### Security Hub Integration

`src/main/aws/security/` - Fetches findings from:
- AWS Security Hub
- GuardDuty
- Inspector
- Access Analyzer
- AWS Config

### Best Practices Scanner

`src/main/aws/security/best-practices/`

| File | Checks |
|------|--------|
| `ec2-checks.ts` | Open security groups, public IPs, unencrypted volumes |
| `s3-checks.ts` | Public buckets, missing encryption, no versioning |
| `iam-checks.ts` | Root account usage, MFA, access key rotation |
| `rds-checks.ts` | Public accessibility, encryption, backup retention |
| `cloudtrail-checks.ts` | Trail enabled, log validation, multi-region |
| `kms-checks.ts` | Key rotation, key policy review |
| `vpc-checks.ts` | Default VPC usage, flow logs, NACL rules |

Each check generates a finding with ID format `BP-<SERVICE>-<NUM>` (e.g., `BP-SG-001`).

### Compliance Framework

`src/main/aws/security/compliance/`

- **CIS AWS Foundations Benchmark v3** mapping
- Maps best practice check IDs to CIS control IDs
- Computes per-section and overall compliance scores
- 120+ controls across sections (IAM, Logging, Monitoring, Networking, Storage)

## IAM Deep Analysis

`src/main/aws/iam-analysis/`

| Module | Analysis |
|--------|----------|
| `unused-roles.ts` | Roles with no activity in CloudTrail |
| `overly-permissive.ts` | Policies with `*` actions/resources, dangerous statements |
| `cross-account-trust.ts` | Roles with external account trust relationships |
| `password-policy.ts` | Account password policy vs. CIS benchmarks |

Called via `runIAMAnalysis(profile, region)` which runs all four checks in parallel.

## Network Reachability

`src/main/aws/network-analysis/reachability.ts`

Analyzes network exposure by checking:
1. VPCs with internet gateways
2. Public subnets (route tables with 0.0.0.0/0 → IGW)
3. Security group rules allowing inbound from 0.0.0.0/0
4. NACL rules
5. EC2 instances and RDS instances in public subnets

Returns `ExposedResource[]` with severity ratings and full exposure paths.

## Well-Architected Integration

`src/main/aws/well-architected/`

- **Workload listing**: `ListWorkloads` with risk count summaries
- **Lens reviews**: Per-pillar risk assessment across 6 pillars
- **Improvements**: Actionable recommendations per question

### Six Pillars

1. Operational Excellence
2. Security
3. Reliability
4. Performance Efficiency
5. Cost Optimization
6. Sustainability

### Required Permissions

```
wellarchitected:ListWorkloads
wellarchitected:GetWorkload
wellarchitected:GetLensReview
wellarchitected:ListLensReviewImprovements
```

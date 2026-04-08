# Adding a New AWS Service Scanner

This guide walks through adding a new AWS service to the analyzer. We'll use a hypothetical "Amazon MQ" scanner as the example.

## Step 1: Add SDK Dependency

```bash
npm install @aws-sdk/client-mq
```

## Step 2: Add Service Type

In `src/shared/types/common.ts`, add the service type to the `ServiceType` union:

```typescript
export type ServiceType =
  // ... existing types
  | 'mq';
```

Add rate limit config in the `DEFAULT_SERVICE_RATE_LIMITS` object:

```typescript
mq: { service: 'mq', requestsPerSecond: 5, burstLimit: 20 },
```

## Step 3: Add Client to Factory

In `src/main/aws/client-factory.ts`:

```typescript
import { MqClient } from '@aws-sdk/client-mq';

// In the class:
getMqClient(): MqClient {
  return this.getOrCreate('mq', () => new MqClient({
    region: this.region,
    credentials: this.credentials,
  }));
}
```

## Step 4: Create the Scanner

Create `src/main/aws/scanners/mq-scanner.ts`:

```typescript
import { ListBrokersCommand, DescribeBrokerCommand } from '@aws-sdk/client-mq';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class MQScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'mq', 'mq');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];

    try {
      const client = getClientFactory().getMqClient();

      const listResult = await this.withRateLimit(() =>
        client.send(new ListBrokersCommand({}))
      );

      for (const broker of listResult.BrokerSummaries || []) {
        // Fetch detailed info if needed
        const detail = await this.withRateLimit(() =>
          client.send(new DescribeBrokerCommand({
            BrokerId: broker.BrokerId,
          }))
        );

        resources.push(this.createResource(
          broker.BrokerArn || broker.BrokerId || 'unknown',
          'MQ::Broker',
          broker.BrokerName || 'unnamed',
          {
            brokerId: broker.BrokerId,
            engineType: broker.EngineType,
            engineVersion: detail.EngineVersion,
            deploymentMode: broker.DeploymentMode,
            hostInstanceType: broker.HostInstanceType,
            brokerState: detail.BrokerState,
          },
          this.parseTags(detail.Tags
            ? Object.entries(detail.Tags).map(([Key, Value]) => ({ Key, Value }))
            : []
          ),
          detail.Created?.toISOString(),
        ));
      }
    } catch (err) {
      errors.push(this.createError('ListBrokers', err));
    }

    return { resources, errors };
  }
}
```

## Step 5: Register in Scan Orchestrator

In `src/main/scanning/scan-orchestrator.ts`, import and register the scanner:

```typescript
import { MQScanner } from '../aws/scanners/mq-scanner';

// In the scanner map:
case 'mq':
  scanner = new MQScanner(scannerConfig);
  break;
```

## Step 6: Add Relationships (Optional)

In `src/main/scanning/relationship-builder.ts`, add relationship logic if this service connects to other resources:

```typescript
// Example: MQ broker in a VPC
if (resource.service === 'mq' && resource.data.subnetIds) {
  for (const subnetId of resource.data.subnetIds) {
    // Find subnet resource and create relationship
  }
}
```

## Step 7: Add IPC Handler (If New Operations)

If the scanner only provides resource discovery (no custom operations), no IPC changes are needed - the existing scan handlers cover it.

For custom operations, add to `src/main/ipc/aws-handlers.ts`.

## Step 8: Add HTTP Route (If New Operations)

For custom operations, add to `src/main/server/routes/` or extend existing route files.

## Step 9: Test

```bash
npm run dev:simple
```

1. Select an AWS profile
2. Choose the region(s) to scan
3. Select your new service from the service list
4. Run the scan
5. Check the Resources page for discovered resources

## Adding a GCP Scanner

The process is similar for GCP:

1. Add SDK: `npm install @google-cloud/service-name`
2. Add type to `GCPServiceType` in `src/shared/types/gcp.ts`
3. Add client to `src/main/gcp/client-factory.ts`
4. Create scanner in `src/main/gcp/scanners/`
5. Register in `src/main/scanning/gcp-scan-orchestrator.ts`
6. Add relationships in `src/main/scanning/gcp-relationship-builder.ts`

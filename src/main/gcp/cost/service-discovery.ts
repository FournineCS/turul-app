// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

/**
 * GCP Service Discovery via BigQuery Billing Export
 *
 * Queries the billing export table to find which GCP services have actual usage
 * (cost > 0) for a given project in the last N days, then maps them to
 * scannable GCPServiceType values.
 */

import { GoogleAuth } from 'google-auth-library';
import { detectBillingTable } from './billing-analysis';
import type { GCPServiceType } from '../../../shared/types';

/**
 * Maps GCP billing `service.description` strings to our internal GCPServiceType(s).
 * A single billing service can map to multiple scan service types (e.g. "Compute Engine"
 * maps to gce, gce-disks, gce-images, gce-snapshots, gce-instance-groups).
 */
const BILLING_TO_SCANNER_MAP: Record<string, GCPServiceType[]> = {
  'Compute Engine': ['gce', 'gce-disks', 'gce-images', 'gce-snapshots', 'gce-instance-groups'],
  'Kubernetes Engine': ['gke'],
  'Cloud Run': ['cloud-run'],
  'Cloud Functions': ['cloud-functions'],
  'App Engine': ['app-engine'],
  'Cloud Storage': ['gcs'],
  'Filestore': ['filestore'],
  'Cloud SQL': ['cloud-sql'],
  'Cloud Spanner': ['cloud-spanner'],
  'Cloud Firestore': ['firestore'],
  'Firestore': ['firestore'],
  'Cloud Bigtable': ['bigtable'],
  'Cloud Memorystore for Redis': ['memorystore'],
  'Memorystore': ['memorystore'],
  'AlloyDB': ['alloydb'],
  'AlloyDB for PostgreSQL': ['alloydb'],
  'Cloud Datastore': ['datastore'],
  'VPC Network': ['vpc-network', 'vpc-subnet', 'vpc-firewall', 'cloud-router', 'cloud-nat', 'cloud-address', 'vpc-peering'],
  'Cloud Networking': ['vpc-network', 'vpc-subnet', 'vpc-firewall', 'cloud-router', 'cloud-nat', 'cloud-address', 'vpc-peering'],
  'Networking': ['vpc-network', 'vpc-subnet', 'vpc-firewall', 'cloud-router', 'cloud-nat', 'cloud-address'],
  'Cloud DNS': ['cloud-dns'],
  'Cloud Load Balancing': ['gclb', 'gclb-url-maps'],
  'Cloud Armor': ['cloud-armor'],
  'Cloud CDN': ['cloud-cdn'],
  'Cloud Interconnect': ['cloud-interconnect'],
  'Service Directory': ['service-directory'],
  'Cloud Endpoints': ['cloud-endpoints'],
  'BigQuery': ['bigquery'],
  'BigQuery Reservation API': ['bigquery'],
  'BigQuery Storage API': ['bigquery'],
  'Dataflow': ['dataflow'],
  'Cloud Dataflow': ['dataflow'],
  'Cloud Dataproc': ['dataproc'],
  'Dataproc': ['dataproc'],
  'Cloud Composer': ['cloud-composer'],
  'Dataplex': ['dataplex'],
  'Data Catalog': ['data-catalog'],
  'Cloud Pub/Sub': ['pubsub'],
  'Cloud Tasks': ['cloud-tasks'],
  'Cloud Scheduler': ['cloud-scheduler'],
  'Workflows': ['cloud-workflows'],
  'Eventarc': ['eventarc'],
  'Cloud Key Management Service (KMS)': ['gcp-kms'],
  'Cloud KMS': ['gcp-kms'],
  'Secret Manager': ['secret-manager'],
  'Security Command Center': ['security-command-center'],
  'Cloud Data Loss Prevention': ['cloud-dlp'],
  'Cloud DLP': ['cloud-dlp'],
  'Certificate Authority Service': ['certificate-authority'],
  'Cloud Build': ['cloud-build'],
  'Cloud Deploy': ['cloud-deploy'],
  'Artifact Registry': ['artifact-registry'],
  'Cloud Source Repositories': ['cloud-source-repos'],
  'Vertex AI': ['vertex-ai'],
  'Cloud AI Platform': ['vertex-ai'],
  'Dialogflow': ['dialogflow'],
  'Document AI': ['document-ai'],
  'Cloud Vision API': ['vision-ai'],
  'Cloud Vision': ['vision-ai'],
  'Cloud Speech-to-Text': ['speech-ai'],
  'Cloud Natural Language': ['natural-language'],
  'Cloud Translation': ['translation-ai'],
  'Cloud Logging': ['cloud-logging'],
  'Cloud Monitoring': ['cloud-monitoring'],
  'Stackdriver Logging': ['cloud-logging'],
  'Stackdriver Monitoring': ['cloud-monitoring'],
  'Cloud Trace': ['cloud-trace'],
  'Cloud Error Reporting': ['error-reporting'],
  'Cloud Batch': ['cloud-batch'],
  'API Gateway': ['api-gateway'],
  'Cloud Data Fusion': ['data-fusion'],
  'Datastream': ['datastream'],
  'Managed Service for Apache Kafka': ['managed-kafka'],
  'Cloud Workstations': ['cloud-workstations'],
  'VMware Engine': ['vmware-engine'],
  'Backup and DR Service': ['backup-dr'],
  'Storage Transfer Service': ['storage-transfer'],
  'Database Migration Service': ['database-migration'],
  'Apigee': ['apigee'],
  'Apigee API Management': ['apigee'],
  'Cloud Deployment Manager': ['deployment-manager'],
  'Application Integration': ['application-integration'],
  'Network Intelligence Center': ['network-intelligence'],
  'Identity Platform': ['identity-platform'],
  'Looker': ['looker'],
  'Firebase': ['firebase'],
  'IAM': ['gcp-iam'],
};

export interface GCPServiceDiscoveryResult {
  /** GCPServiceType IDs that have billing usage and are scannable */
  activeServices: GCPServiceType[];
  /** Raw billing services with cost — for display in the UI */
  billingServices: Array<{
    service: string;
    cost: number;
    currency: string;
    /** Mapped scanner types (empty if no scanner maps to this billing service) */
    scannerTypes: GCPServiceType[];
  }>;
  /** Query period */
  startDate: string;
  endDate: string;
  /** Total cost across all services */
  totalCost: number;
  currency: string;
}

/**
 * Query BigQuery billing export to discover which services have actual usage
 * for a specific project in the last N days.
 */
export async function discoverGCPServicesByBilling(
  projectId: string,
  days: number,
  bqProject: string,
  bqDataset?: string,
  bqRegion?: string
): Promise<GCPServiceDiscoveryResult> {
  const { BigQuery } = require('@google-cloud/bigquery');

  const billingDataset = bqDataset || 'billing_export';
  const region = bqRegion?.trim() || undefined;


  const bqOptions: Record<string, string> = { projectId: bqProject };
  if (region) bqOptions.location = region;
  const bigquery = new BigQuery(bqOptions);

  const tableName = await detectBillingTable(bigquery, bqProject, billingDataset, region);
  const fqTable = `\`${bqProject}.${billingDataset}.${tableName}\``;

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  const startStr = startDate.toISOString().split('T')[0];
  const endStr = endDate.toISOString().split('T')[0];

  const query = `
    SELECT
      service.description AS service_name,
      SUM(cost) + SUM(IFNULL((SELECT SUM(c.amount) FROM UNNEST(credits) c), 0)) AS net_cost,
      currency
    FROM ${fqTable}
    WHERE
      project.id = @projectId
      AND usage_start_time >= TIMESTAMP(@startDate)
      AND usage_start_time < TIMESTAMP(@endDate)
    GROUP BY service.description, currency
    HAVING net_cost > 0
    ORDER BY net_cost DESC
  `;

  const queryOpts: Record<string, unknown> = {
    query,
    params: { projectId, startDate: startStr, endDate: endStr },
  };
  if (region) queryOpts.location = region;

  const [rows] = await bigquery.query(queryOpts);

  // Map billing services to scanner types
  const activeServicesSet = new Set<GCPServiceType>();
  let totalCost = 0;
  const currency = (rows as Array<{ currency: string }>)[0]?.currency || 'USD';

  const billingServices = (rows as Array<{ service_name: string; net_cost: number; currency: string }>).map((row) => {
    const cost = Number(row.net_cost) || 0;
    totalCost += cost;

    const scannerTypes = BILLING_TO_SCANNER_MAP[row.service_name] || [];
    for (const st of scannerTypes) {
      activeServicesSet.add(st);
    }

    return {
      service: row.service_name,
      cost,
      currency: row.currency || currency,
      scannerTypes,
    };
  });

  return {
    activeServices: Array.from(activeServicesSet),
    billingServices,
    startDate: startStr,
    endDate: endStr,
    totalCost,
    currency,
  };
}

// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

// GCP service icon labels, colors, and tier logic — completely separate from AWS serviceIcons.ts
import React from 'react';
import { GCP_ICON_MAP } from './gcpIcons';

// GCP Service Labels — maps GCP resourceType to display label
export const GCP_SERVICE_LABELS: Record<string, string> = {
  // Compute
  instance: 'GCE',
  'instance-group': 'IG',
  disk: 'Disk',
  image: 'Image',
  snapshot: 'Snapshot',
  // Containers
  cluster: 'GKE',
  service: 'Cloud Run',
  function: 'Function',
  'app-engine-version': 'App Engine',
  // Network
  network: 'VPC',
  subnet: 'Subnet',
  'firewall-rule': 'Firewall',
  router: 'Router',
  'nat-gateway': 'Cloud NAT',
  'url-map': 'URL Map',
  trigger: 'Eventarc',
  'forwarding-rule': 'LB Rule',
  'backend-service': 'Backend',
  'health-check': 'Health Chk',
  address: 'IP',
  'dns-zone': 'DNS',
  // Databases
  'sql-instance': 'Cloud SQL',
  'spanner-instance': 'Spanner',
  'bigtable-instance': 'Bigtable',
  'redis-instance': 'Memorystore',
  'alloydb-cluster': 'AlloyDB',
  'datastore-index': 'Datastore',
  'firestore-database': 'Firestore',
  'filestore-instance': 'Filestore',
  'spanner-database': 'Spanner DB',
  // Storage
  bucket: 'GCS',
  // Analytics / Data
  dataset: 'BQ Dataset',
  table: 'BQ Table',
  job: 'Dataflow',
  'dataproc-cluster': 'Dataproc',
  environment: 'Composer',
  // Messaging
  topic: 'Pub/Sub',
  subscription: 'Sub',
  // Security
  secret: 'Secret',
  key: 'KMS Key',
  'security-policy': 'WAF Policy',
  // DevOps
  pipeline: 'Build',
  repository: 'AR Repo',
  // AI
  'notebook-instance': 'Vertex AI',
  model: 'Vertex Model',
  endpoint: 'Vertex EP',
  'training-pipeline': 'Training',
  // Monitoring
  'alert-policy': 'Alert',
};

// GCP Node Colors — Google brand color scheme, completely separate from AWS
export const GCP_NODE_COLORS: Record<string, Record<string, string>> = {
  network: {
    network: '#4285f4', // Google Blue
    subnet: '#34a853', // Google Green
    'firewall-rule': '#ea4335', // Google Red
    instance: '#4285f4',
    'instance-group': '#4285f4',
    router: '#fbbc04', // Google Yellow
    'nat-gateway': '#9334e6',
    'url-map': '#ff6d01',
    trigger: '#fbbc04',
    'forwarding-rule': '#ff6d01',
    'backend-service': '#ff6d01',
    'health-check': '#ff6d01',
    address: '#a142f4',
    'dns-zone': '#4285f4',
    'security-policy': '#ea4335',
  },
  application: {
    ingress: '#ff6d01',
    compute: '#4285f4',
    messaging: '#fbbc04',
    orchestration: '#34a853',
    'ai-ml': '#9334e6',
    other: '#9aa0a6',
  },
  data: {
    ingestion: '#4285f4',
    database: '#ea4335',
    storage: '#34a853',
    processing: '#fbbc04',
    analytics: '#9334e6',
    other: '#9aa0a6',
  },
  full: {
    default: '#5f6368',
  },
};

// GCP Tier Labels (for application/data view group headers)
export const GCP_TIER_LABELS: Record<string, string> = {
  // Network tiers
  gateway: 'Gateways & LB',
  network: 'VPC Networks',
  subnet: 'Subnets & Routing',
  compute: 'Compute',
  security: 'Security',
  // Application tiers
  ingress: 'Ingress / Load Balancing',
  messaging: 'Messaging',
  orchestration: 'Orchestration',
  // Data tiers
  ingestion: 'Ingestion / Streaming',
  database: 'Databases',
  storage: 'Storage',
  processing: 'Processing / ETL',
  analytics: 'Analytics',
  // AI
  'ai-ml': 'AI / Machine Learning',
  // Generic
  other: 'Other',
};

export function getGCPNodeColor(
  viewMode: string,
  resourceType: string,
  tier?: string
): string {
  const colorMap = GCP_NODE_COLORS[viewMode];
  if (!colorMap) return '#5f6368';

  if (viewMode === 'network') {
    return colorMap[resourceType] || '#5f6368';
  }

  return colorMap[tier || 'other'] || '#5f6368';
}

export function getGCPNodeLabel(resourceType: string): string {
  return GCP_SERVICE_LABELS[resourceType] || resourceType;
}

// GCP service icon lookup — returns React SVG component or null for fallback to text abbreviation
export function getGCPServiceIcon(
  resourceType: string
): React.ComponentType<{ size?: string }> | null {
  return GCP_ICON_MAP[resourceType] || null;
}

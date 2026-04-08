// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

// Inline SVG React components for GCP service icons
// Simplified versions inspired by official Google Cloud architecture icons

import React from 'react';

interface IconProps {
  size?: string;
}

// Compute Engine (VM)
export const GCEIcon: React.FC<IconProps> = ({ size = '24' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="18" height="18" rx="2" fill="#4285F4" />
    <rect x="7" y="7" width="10" height="10" rx="1" fill="white" />
    <rect x="9" y="9" width="6" height="6" rx="0.5" fill="#4285F4" />
  </svg>
);

// GKE (Kubernetes)
export const GKEIcon: React.FC<IconProps> = ({ size = '24' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M12 2L3 7v10l9 5 9-5V7l-9-5z" fill="#4285F4" />
    <path d="M12 6l-4.5 2.5v5L12 16l4.5-2.5v-5L12 6z" fill="white" />
    <circle cx="12" cy="11" r="2" fill="#4285F4" />
  </svg>
);

// Cloud Run
export const CloudRunIcon: React.FC<IconProps> = ({ size = '24' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M4 4h16v16H4V4z" fill="#4285F4" />
    <path d="M8 8l4-2 4 2v8l-4 2-4-2V8z" fill="white" />
    <path d="M12 6v12M8 8l4 2 4-2M8 16l4-2 4 2" stroke="#4285F4" strokeWidth="0.8" />
  </svg>
);

// Cloud Functions
export const CloudFunctionsIcon: React.FC<IconProps> = ({ size = '24' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M4 4h16v16H4V4z" fill="#4285F4" />
    <path d="M9 8l3 4-3 4M15 8l-3 4 3 4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// VPC Network
export const VPCIcon: React.FC<IconProps> = ({ size = '24' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" fill="#4285F4" />
    <circle cx="12" cy="8" r="2" fill="white" />
    <circle cx="8" cy="15" r="2" fill="white" />
    <circle cx="16" cy="15" r="2" fill="white" />
    <line x1="12" y1="10" x2="8" y2="13" stroke="white" strokeWidth="1.2" />
    <line x1="12" y1="10" x2="16" y2="13" stroke="white" strokeWidth="1.2" />
    <line x1="8" y1="15" x2="16" y2="15" stroke="white" strokeWidth="1.2" />
  </svg>
);

// Subnet
export const SubnetIcon: React.FC<IconProps> = ({ size = '24' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="18" height="18" rx="3" fill="#34A853" />
    <rect x="6" y="8" width="12" height="3" rx="1" fill="white" />
    <rect x="6" y="13" width="12" height="3" rx="1" fill="white" />
  </svg>
);

// Firewall
export const FirewallIcon: React.FC<IconProps> = ({ size = '24' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="18" height="18" rx="2" fill="#EA4335" />
    <rect x="5" y="6" width="6" height="5" rx="1" fill="white" />
    <rect x="13" y="6" width="6" height="5" rx="1" fill="white" />
    <rect x="5" y="13" width="6" height="5" rx="1" fill="white" />
    <rect x="13" y="13" width="6" height="5" rx="1" fill="white" />
  </svg>
);

// Cloud Router
export const RouterIcon: React.FC<IconProps> = ({ size = '24' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="18" height="18" rx="2" fill="#FBBC04" />
    <circle cx="12" cy="12" r="3" fill="white" />
    <line x1="12" y1="5" x2="12" y2="9" stroke="white" strokeWidth="1.5" />
    <line x1="12" y1="15" x2="12" y2="19" stroke="white" strokeWidth="1.5" />
    <line x1="5" y1="12" x2="9" y2="12" stroke="white" strokeWidth="1.5" />
    <line x1="15" y1="12" x2="19" y2="12" stroke="white" strokeWidth="1.5" />
  </svg>
);

// Cloud NAT
export const NATIcon: React.FC<IconProps> = ({ size = '24' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="18" height="18" rx="2" fill="#9334E6" />
    <path d="M7 12h4l-2-3v6l2-3M13 12h4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="18" cy="12" r="1.5" fill="white" />
  </svg>
);

// Load Balancer / Forwarding Rule
export const LoadBalancerIcon: React.FC<IconProps> = ({ size = '24' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="18" height="18" rx="2" fill="#FF6D01" />
    <circle cx="12" cy="7" r="2" fill="white" />
    <circle cx="7" cy="17" r="2" fill="white" />
    <circle cx="17" cy="17" r="2" fill="white" />
    <line x1="12" y1="9" x2="7" y2="15" stroke="white" strokeWidth="1.2" />
    <line x1="12" y1="9" x2="17" y2="15" stroke="white" strokeWidth="1.2" />
  </svg>
);

// Backend Service
export const BackendServiceIcon: React.FC<IconProps> = ({ size = '24' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="18" height="18" rx="2" fill="#FF6D01" />
    <rect x="6" y="6" width="12" height="4" rx="1" fill="white" />
    <rect x="6" y="12" width="12" height="4" rx="1" fill="white" />
    <circle cx="9" cy="8" r="1" fill="#FF6D01" />
    <circle cx="9" cy="14" r="1" fill="#FF6D01" />
  </svg>
);

// URL Map
export const URLMapIcon: React.FC<IconProps> = ({ size = '24' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="18" height="18" rx="2" fill="#FF6D01" />
    <path d="M7 8h10M7 12h10M7 16h6" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="17" cy="16" r="2" fill="white" />
  </svg>
);

// Cloud SQL
export const CloudSQLIcon: React.FC<IconProps> = ({ size = '24' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="18" height="18" rx="2" fill="#4285F4" />
    <ellipse cx="12" cy="8" rx="6" ry="2.5" fill="white" />
    <path d="M6 8v8c0 1.38 2.69 2.5 6 2.5s6-1.12 6-2.5V8" stroke="white" strokeWidth="1.2" fill="none" />
    <ellipse cx="12" cy="12" rx="6" ry="2.5" fill="none" stroke="white" strokeWidth="0.8" />
  </svg>
);

// Cloud Spanner
export const SpannerIcon: React.FC<IconProps> = ({ size = '24' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="18" height="18" rx="2" fill="#4285F4" />
    <circle cx="8" cy="8" r="2" fill="white" />
    <circle cx="16" cy="8" r="2" fill="white" />
    <circle cx="8" cy="16" r="2" fill="white" />
    <circle cx="16" cy="16" r="2" fill="white" />
    <line x1="10" y1="8" x2="14" y2="8" stroke="white" strokeWidth="1" />
    <line x1="10" y1="16" x2="14" y2="16" stroke="white" strokeWidth="1" />
    <line x1="8" y1="10" x2="8" y2="14" stroke="white" strokeWidth="1" />
    <line x1="16" y1="10" x2="16" y2="14" stroke="white" strokeWidth="1" />
  </svg>
);

// Firestore
export const FirestoreIcon: React.FC<IconProps> = ({ size = '24' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="18" height="18" rx="2" fill="#FBBC04" />
    <path d="M8 6l4 6-4 6h8l-4-6 4-6H8z" fill="white" />
  </svg>
);

// BigQuery
export const BigQueryIcon: React.FC<IconProps> = ({ size = '24' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="18" height="18" rx="2" fill="#4285F4" />
    <rect x="7" y="13" width="3" height="5" rx="0.5" fill="white" />
    <rect x="11" y="9" width="3" height="9" rx="0.5" fill="white" />
    <rect x="15" y="6" width="3" height="12" rx="0.5" fill="white" />
  </svg>
);

// GCS (Cloud Storage)
export const GCSIcon: React.FC<IconProps> = ({ size = '24' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="18" height="18" rx="2" fill="#34A853" />
    <path d="M7 9h10v2H7V9zM7 13h10v2H7v-2z" fill="white" />
    <circle cx="16" cy="10" r="1" fill="#34A853" />
    <circle cx="16" cy="14" r="1" fill="#34A853" />
  </svg>
);

// Pub/Sub
export const PubSubIcon: React.FC<IconProps> = ({ size = '24' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="18" height="18" rx="2" fill="#4285F4" />
    <circle cx="12" cy="12" r="3" fill="white" />
    <circle cx="6" cy="8" r="1.5" fill="white" />
    <circle cx="18" cy="8" r="1.5" fill="white" />
    <circle cx="6" cy="16" r="1.5" fill="white" />
    <circle cx="18" cy="16" r="1.5" fill="white" />
    <line x1="9.5" y1="10.5" x2="7" y2="9" stroke="white" strokeWidth="0.8" />
    <line x1="14.5" y1="10.5" x2="17" y2="9" stroke="white" strokeWidth="0.8" />
    <line x1="9.5" y1="13.5" x2="7" y2="15" stroke="white" strokeWidth="0.8" />
    <line x1="14.5" y1="13.5" x2="17" y2="15" stroke="white" strokeWidth="0.8" />
  </svg>
);

// KMS (Key Management)
export const KMSIcon: React.FC<IconProps> = ({ size = '24' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="18" height="18" rx="2" fill="#EA4335" />
    <circle cx="12" cy="10" r="4" fill="none" stroke="white" strokeWidth="1.5" />
    <line x1="12" y1="14" x2="12" y2="19" stroke="white" strokeWidth="1.5" />
    <line x1="10" y1="17" x2="14" y2="17" stroke="white" strokeWidth="1.5" />
  </svg>
);

// Secret Manager
export const SecretManagerIcon: React.FC<IconProps> = ({ size = '24' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="18" height="18" rx="2" fill="#EA4335" />
    <rect x="7" y="10" width="10" height="8" rx="1" fill="white" />
    <path d="M9 10V8a3 3 0 0 1 6 0v2" stroke="white" strokeWidth="1.5" fill="none" />
    <circle cx="12" cy="14" r="1.5" fill="#EA4335" />
  </svg>
);

// Cloud Build
export const CloudBuildIcon: React.FC<IconProps> = ({ size = '24' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="18" height="18" rx="2" fill="#4285F4" />
    <path d="M8 12l3 3 5-6" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// Artifact Registry
export const ArtifactRegistryIcon: React.FC<IconProps> = ({ size = '24' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="18" height="18" rx="2" fill="#4285F4" />
    <rect x="6" y="6" width="5" height="5" rx="1" fill="white" />
    <rect x="13" y="6" width="5" height="5" rx="1" fill="white" />
    <rect x="6" y="13" width="5" height="5" rx="1" fill="white" />
    <rect x="13" y="13" width="5" height="5" rx="1" fill="white" />
  </svg>
);

// Health Check
export const HealthCheckIcon: React.FC<IconProps> = ({ size = '24' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="18" height="18" rx="2" fill="#34A853" />
    <path d="M7 12h3l2-4 2 8 2-4h3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// Eventarc / Trigger
export const EventarcIcon: React.FC<IconProps> = ({ size = '24' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="18" height="18" rx="2" fill="#FBBC04" />
    <path d="M13 5l-5 8h4l-1 6 5-8h-4l1-6z" fill="white" />
  </svg>
);

// Disk
export const DiskIcon: React.FC<IconProps> = ({ size = '24' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="18" height="18" rx="2" fill="#4285F4" />
    <circle cx="12" cy="12" r="6" fill="none" stroke="white" strokeWidth="1.5" />
    <circle cx="12" cy="12" r="2" fill="white" />
  </svg>
);

// Instance Group
export const InstanceGroupIcon: React.FC<IconProps> = ({ size = '24' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="18" height="18" rx="2" fill="#4285F4" />
    <rect x="6" y="6" width="5" height="5" rx="1" fill="white" />
    <rect x="13" y="6" width="5" height="5" rx="1" fill="white" />
    <rect x="9.5" y="13" width="5" height="5" rx="1" fill="white" />
  </svg>
);

// IP Address
export const AddressIcon: React.FC<IconProps> = ({ size = '24' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="18" height="18" rx="2" fill="#A142F4" />
    <circle cx="12" cy="10" r="4" fill="none" stroke="white" strokeWidth="1.5" />
    <circle cx="12" cy="10" r="1.5" fill="white" />
    <line x1="12" y1="14" x2="12" y2="18" stroke="white" strokeWidth="1.5" />
    <line x1="9" y1="18" x2="15" y2="18" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

// VM Image
export const ImageIcon: React.FC<IconProps> = ({ size = '24' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="18" height="18" rx="2" fill="#4285F4" />
    <rect x="6" y="6" width="12" height="12" rx="1" fill="white" />
    <circle cx="10" cy="10" r="2" fill="#4285F4" />
    <path d="M6 16l4-4 3 3 2-2 3 3v2H6v-2z" fill="#4285F4" />
  </svg>
);

// Disk Snapshot
export const SnapshotIcon: React.FC<IconProps> = ({ size = '24' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="18" height="18" rx="2" fill="#4285F4" />
    <circle cx="12" cy="12" r="6" fill="none" stroke="white" strokeWidth="1.5" />
    <circle cx="12" cy="12" r="2" fill="white" />
    <path d="M12 6v2M12 16v2M6 12h2M16 12h2" stroke="white" strokeWidth="1" strokeLinecap="round" />
  </svg>
);

// DNS Zone
export const DNSIcon: React.FC<IconProps> = ({ size = '24' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="18" height="18" rx="2" fill="#4285F4" />
    <circle cx="12" cy="12" r="6" fill="none" stroke="white" strokeWidth="1.2" />
    <ellipse cx="12" cy="12" rx="3" ry="6" fill="none" stroke="white" strokeWidth="1" />
    <line x1="6" y1="12" x2="18" y2="12" stroke="white" strokeWidth="1" />
    <line x1="7" y1="9" x2="17" y2="9" stroke="white" strokeWidth="0.7" />
    <line x1="7" y1="15" x2="17" y2="15" stroke="white" strokeWidth="0.7" />
  </svg>
);

// Security Policy
export const SecurityPolicyIcon: React.FC<IconProps> = ({ size = '24' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="18" height="18" rx="2" fill="#EA4335" />
    <path d="M12 5L6 8v4c0 4 2.5 7 6 8.5 3.5-1.5 6-4.5 6-8.5V8l-6-3z" fill="white" />
    <path d="M10 12l2 2 4-4" stroke="#EA4335" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// App Engine
export const AppEngineIcon: React.FC<IconProps> = ({ size = '24' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="18" height="18" rx="2" fill="#4285F4" />
    <path d="M12 5l7 12H5L12 5z" fill="white" />
    <circle cx="12" cy="13" r="2" fill="#4285F4" />
  </svg>
);

// Memorystore (Redis)
export const MemorystoreIcon: React.FC<IconProps> = ({ size = '24' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="18" height="18" rx="2" fill="#EA4335" />
    <rect x="6" y="6" width="12" height="4" rx="1" fill="white" />
    <rect x="6" y="11" width="12" height="4" rx="1" fill="white" />
    <circle cx="9" cy="8" r="1" fill="#EA4335" />
    <circle cx="9" cy="13" r="1" fill="#EA4335" />
    <line x1="12" y1="7" x2="16" y2="7" stroke="#EA4335" strokeWidth="0.8" />
    <line x1="12" y1="9" x2="16" y2="9" stroke="#EA4335" strokeWidth="0.8" />
    <line x1="12" y1="12" x2="16" y2="12" stroke="#EA4335" strokeWidth="0.8" />
    <line x1="12" y1="14" x2="16" y2="14" stroke="#EA4335" strokeWidth="0.8" />
    <rect x="8" y="16" width="8" height="2" rx="0.5" fill="white" />
  </svg>
);

// Bigtable
export const BigtableIcon: React.FC<IconProps> = ({ size = '24' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="18" height="18" rx="2" fill="#4285F4" />
    <rect x="6" y="6" width="12" height="3" rx="0.5" fill="white" />
    <rect x="6" y="10.5" width="12" height="3" rx="0.5" fill="white" />
    <rect x="6" y="15" width="12" height="3" rx="0.5" fill="white" />
    <line x1="10" y1="6" x2="10" y2="18" stroke="#4285F4" strokeWidth="0.8" />
    <line x1="14" y1="6" x2="14" y2="18" stroke="#4285F4" strokeWidth="0.8" />
  </svg>
);

// AlloyDB
export const AlloyDBIcon: React.FC<IconProps> = ({ size = '24' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="18" height="18" rx="2" fill="#4285F4" />
    <ellipse cx="12" cy="8" rx="5" ry="2" fill="white" />
    <path d="M7 8v8c0 1.1 2.24 2 5 2s5-.9 5-2V8" stroke="white" strokeWidth="1.2" fill="none" />
    <ellipse cx="12" cy="12" rx="5" ry="2" fill="none" stroke="white" strokeWidth="0.8" />
    <path d="M10 8l2 2 2-2" stroke="#4285F4" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// Datastore
export const DatastoreIcon: React.FC<IconProps> = ({ size = '24' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="18" height="18" rx="2" fill="#FBBC04" />
    <ellipse cx="12" cy="8" rx="6" ry="2.5" fill="white" />
    <path d="M6 8v8c0 1.38 2.69 2.5 6 2.5s6-1.12 6-2.5V8" stroke="white" strokeWidth="1.2" fill="none" />
    <ellipse cx="12" cy="12" rx="6" ry="2.5" fill="none" stroke="white" strokeWidth="0.8" />
  </svg>
);

// Vertex AI Model
export const VertexModelIcon: React.FC<IconProps> = ({ size = '24' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="18" height="18" rx="2" fill="#9334E6" />
    <circle cx="12" cy="8" r="2.5" fill="white" />
    <circle cx="7" cy="16" r="2" fill="white" />
    <circle cx="17" cy="16" r="2" fill="white" />
    <line x1="10" y1="10" x2="8" y2="14" stroke="white" strokeWidth="1.2" />
    <line x1="14" y1="10" x2="16" y2="14" stroke="white" strokeWidth="1.2" />
    <line x1="9" y1="16" x2="15" y2="16" stroke="white" strokeWidth="1.2" />
  </svg>
);

// Vertex AI Endpoint
export const VertexEndpointIcon: React.FC<IconProps> = ({ size = '24' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="18" height="18" rx="2" fill="#9334E6" />
    <circle cx="12" cy="12" r="4" fill="none" stroke="white" strokeWidth="1.5" />
    <circle cx="12" cy="12" r="1.5" fill="white" />
    <path d="M12 5v3M12 16v3M5 12h3M16 12h3" stroke="white" strokeWidth="1.2" strokeLinecap="round" />
  </svg>
);

// Dataflow Job
export const DataflowIcon: React.FC<IconProps> = ({ size = '24' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="18" height="18" rx="2" fill="#4285F4" />
    <circle cx="6.5" cy="9" r="1.5" fill="white" />
    <circle cx="6.5" cy="15" r="1.5" fill="white" />
    <circle cx="12" cy="12" r="2" fill="white" />
    <circle cx="17.5" cy="9" r="1.5" fill="white" />
    <circle cx="17.5" cy="15" r="1.5" fill="white" />
    <line x1="8" y1="9.5" x2="10" y2="11.5" stroke="white" strokeWidth="1" />
    <line x1="8" y1="14.5" x2="10" y2="12.5" stroke="white" strokeWidth="1" />
    <line x1="14" y1="11" x2="16" y2="9.5" stroke="white" strokeWidth="1" />
    <line x1="14" y1="13" x2="16" y2="14.5" stroke="white" strokeWidth="1" />
  </svg>
);

// Dataproc Cluster
export const DataprocIcon: React.FC<IconProps> = ({ size = '24' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="18" height="18" rx="2" fill="#FBBC04" />
    <circle cx="12" cy="8" r="3" fill="white" />
    <circle cx="7" cy="16" r="2.5" fill="white" />
    <circle cx="17" cy="16" r="2.5" fill="white" />
    <line x1="10" y1="10.5" x2="8.5" y2="13.5" stroke="white" strokeWidth="1.5" />
    <line x1="14" y1="10.5" x2="15.5" y2="13.5" stroke="white" strokeWidth="1.5" />
  </svg>
);

// Cloud Composer
export const ComposerIcon: React.FC<IconProps> = ({ size = '24' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <rect x="3" y="3" width="18" height="18" rx="2" fill="#34A853" />
    <circle cx="8" cy="8" r="2" fill="white" />
    <circle cx="16" cy="8" r="2" fill="white" />
    <circle cx="12" cy="15" r="2" fill="white" />
    <path d="M10 8h4" stroke="white" strokeWidth="1.2" />
    <path d="M8.5 10l3 3" stroke="white" strokeWidth="1.2" />
    <path d="M15.5 10l-3 3" stroke="white" strokeWidth="1.2" />
  </svg>
);

// Map of resourceType → icon component
export const GCP_ICON_MAP: Record<string, React.ComponentType<IconProps>> = {
  instance: GCEIcon,
  'instance-group': InstanceGroupIcon,
  disk: DiskIcon,
  cluster: GKEIcon,
  service: CloudRunIcon,
  function: CloudFunctionsIcon,
  network: VPCIcon,
  subnet: SubnetIcon,
  'firewall-rule': FirewallIcon,
  router: RouterIcon,
  'nat-gateway': NATIcon,
  'forwarding-rule': LoadBalancerIcon,
  'backend-service': BackendServiceIcon,
  'url-map': URLMapIcon,
  'health-check': HealthCheckIcon,
  'sql-instance': CloudSQLIcon,
  'spanner-instance': SpannerIcon,
  'firestore-database': FirestoreIcon,
  dataset: BigQueryIcon,
  table: BigQueryIcon,
  bucket: GCSIcon,
  topic: PubSubIcon,
  subscription: PubSubIcon,
  'crypto-key': KMSIcon,
  'key-ring': KMSIcon,
  secret: SecretManagerIcon,
  'build-trigger': CloudBuildIcon,
  pipeline: CloudBuildIcon,
  repository: ArtifactRegistryIcon,
  trigger: EventarcIcon,
  address: AddressIcon,
  image: ImageIcon,
  snapshot: SnapshotIcon,
  'dns-zone': DNSIcon,
  'security-policy': SecurityPolicyIcon,
  'app-engine-version': AppEngineIcon,
  'redis-instance': MemorystoreIcon,
  'bigtable-instance': BigtableIcon,
  'alloydb-cluster': AlloyDBIcon,
  'datastore-index': DatastoreIcon,
  model: VertexModelIcon,
  endpoint: VertexEndpointIcon,
  job: DataflowIcon,
  'dataproc-cluster': DataprocIcon,
  environment: ComposerIcon,
};

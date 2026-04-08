// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

export interface ExposurePathStep {
  type: 'igw' | 'route_table' | 'subnet' | 'nacl' | 'security_group' | 'instance';
  id: string;
  name?: string;
  detail: string;
}

export interface ExposedResource {
  resourceId: string;
  resourceType: string; // 'EC2 Instance' | 'RDS Instance' | 'ELB'
  name?: string;
  vpcId: string;
  subnetId: string;
  publicIp?: string;
  openPorts: ExposedPort[];
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  exposurePath: ExposurePathStep[];
}

export interface ExposedPort {
  protocol: string;
  fromPort: number;
  toPort: number;
  source: string; // CIDR
}

export interface NetworkReachabilityResult {
  vpcCount: number;
  subnetCount: number;
  publicSubnetCount: number;
  exposedResources: ExposedResource[];
  criticalCount: number;
  highCount: number;
  mediumCount: number;
  lowCount: number;
  analyzedAt: string;
}

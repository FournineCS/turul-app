// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  DescribeVpcsCommand,
  DescribeSubnetsCommand,
  DescribeRouteTablesCommand,
  DescribeInternetGatewaysCommand,
  DescribeNetworkAclsCommand,
  DescribeSecurityGroupsCommand,
  DescribeInstancesCommand,
  type Subnet,
  type RouteTable,
  type SecurityGroup,
  type NetworkAcl,
} from '@aws-sdk/client-ec2';
import { getClientFactory } from '../client-factory';
import type {
  NetworkReachabilityResult,
  ExposedResource,
  ExposedPort,
  ExposurePathStep,
} from './types';

// Ports that indicate critical exposure
const CRITICAL_PORTS = new Set([22, 3389]); // SSH, RDP
const HIGH_PORTS = new Set([3306, 5432, 1433, 27017, 6379]); // DB ports
const MEDIUM_PORTS = new Set([80, 443, 8080, 8443]); // Web

function getPortSeverity(port: number): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' {
  if (CRITICAL_PORTS.has(port)) return 'CRITICAL';
  if (HIGH_PORTS.has(port)) return 'HIGH';
  if (MEDIUM_PORTS.has(port)) return 'MEDIUM';
  return 'LOW';
}

function isPublicCidr(cidr: string): boolean {
  return cidr === '0.0.0.0/0' || cidr === '::/0';
}

export async function analyzeNetworkReachability(
  profile: string,
  region: string
): Promise<NetworkReachabilityResult> {
  const ec2 = getClientFactory().getEC2Client({ profile, region });

  // Fetch all data in parallel
  const [
    vpcsRes,
    subnetsRes,
    routeTablesRes,
    igwsRes,
    naclsRes,
    sgsRes,
    instancesRes,
  ] = await Promise.all([
    ec2.send(new DescribeVpcsCommand({})),
    ec2.send(new DescribeSubnetsCommand({})),
    ec2.send(new DescribeRouteTablesCommand({})),
    ec2.send(new DescribeInternetGatewaysCommand({})),
    ec2.send(new DescribeNetworkAclsCommand({})),
    ec2.send(new DescribeSecurityGroupsCommand({})),
    ec2.send(new DescribeInstancesCommand({
      Filters: [{ Name: 'instance-state-name', Values: ['running'] }],
    })),
  ]);

  const vpcs = vpcsRes.Vpcs || [];
  const subnets = subnetsRes.Subnets || [];
  const routeTables = routeTablesRes.RouteTables || [];
  const igws = igwsRes.InternetGateways || [];
  const nacls = naclsRes.NetworkAcls || [];
  const sgs = sgsRes.SecurityGroups || [];

  // Build lookup maps
  const igwByVpc = new Map<string, string>();
  for (const igw of igws) {
    for (const attachment of igw.Attachments || []) {
      if (attachment.VpcId && igw.InternetGatewayId) {
        igwByVpc.set(attachment.VpcId, igw.InternetGatewayId);
      }
    }
  }

  const sgById = new Map<string, SecurityGroup>();
  for (const sg of sgs) {
    if (sg.GroupId) sgById.set(sg.GroupId, sg);
  }

  const naclBySubnet = new Map<string, NetworkAcl>();
  for (const nacl of nacls) {
    for (const assoc of nacl.Associations || []) {
      if (assoc.SubnetId) naclBySubnet.set(assoc.SubnetId, nacl);
    }
  }

  // Determine public subnets: subnets whose route table has 0.0.0.0/0 -> igw-*
  const publicSubnetIds = new Set<string>();
  const subnetRouteTable = new Map<string, RouteTable>();

  for (const rt of routeTables) {
    const hasIgwRoute = (rt.Routes || []).some(
      (r) => r.DestinationCidrBlock === '0.0.0.0/0' && r.GatewayId?.startsWith('igw-')
    );
    if (!hasIgwRoute) continue;

    for (const assoc of rt.Associations || []) {
      if (assoc.SubnetId) {
        publicSubnetIds.add(assoc.SubnetId);
        subnetRouteTable.set(assoc.SubnetId, rt);
      }
      // Main route table applies to subnets without explicit association
      if (assoc.Main) {
        const vpcId = rt.VpcId;
        for (const subnet of subnets) {
          if (subnet.VpcId === vpcId && subnet.SubnetId && !subnetRouteTable.has(subnet.SubnetId)) {
            publicSubnetIds.add(subnet.SubnetId);
            subnetRouteTable.set(subnet.SubnetId, rt);
          }
        }
      }
    }
  }

  // Find exposed instances
  const exposedResources: ExposedResource[] = [];

  for (const reservation of instancesRes.Reservations || []) {
    for (const instance of reservation.Instances || []) {
      if (!instance.InstanceId || !instance.SubnetId) continue;
      if (!publicSubnetIds.has(instance.SubnetId)) continue;

      // Check security groups for public inbound rules
      const instanceSgIds = (instance.SecurityGroups || []).map((sg) => sg.GroupId).filter(Boolean) as string[];
      const openPorts: ExposedPort[] = [];

      for (const sgId of instanceSgIds) {
        const sg = sgById.get(sgId);
        if (!sg) continue;

        for (const rule of sg.IpPermissions || []) {
          const fromPort = rule.FromPort ?? 0;
          const toPort = rule.ToPort ?? 65535;

          for (const ipRange of rule.IpRanges || []) {
            if (ipRange.CidrIp && isPublicCidr(ipRange.CidrIp)) {
              openPorts.push({
                protocol: rule.IpProtocol || 'tcp',
                fromPort,
                toPort,
                source: ipRange.CidrIp,
              });
            }
          }

          for (const ipv6Range of rule.Ipv6Ranges || []) {
            if (ipv6Range.CidrIpv6 && isPublicCidr(ipv6Range.CidrIpv6)) {
              openPorts.push({
                protocol: rule.IpProtocol || 'tcp',
                fromPort,
                toPort,
                source: ipv6Range.CidrIpv6,
              });
            }
          }
        }
      }

      if (openPorts.length === 0) continue;

      // Determine severity based on worst port
      const severityRank: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      let worstRank = 3; // LOW
      for (const port of openPorts) {
        for (let p = port.fromPort; p <= Math.min(port.toPort, port.fromPort + 100); p++) {
          const ps = getPortSeverity(p);
          const rank = severityRank[ps];
          if (rank < worstRank) worstRank = rank;
          if (worstRank === 0) break;
        }
        if (worstRank === 0) break;
      }
      const rankToSeverity = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;
      const severity = rankToSeverity[worstRank];

      // Build exposure path
      const exposurePath: ExposurePathStep[] = [];
      const vpcId = instance.VpcId || '';
      const igwId = igwByVpc.get(vpcId);

      if (igwId) {
        exposurePath.push({
          type: 'igw', id: igwId, detail: 'Internet Gateway attached to VPC',
        });
      }

      const rt = subnetRouteTable.get(instance.SubnetId);
      if (rt?.RouteTableId) {
        exposurePath.push({
          type: 'route_table', id: rt.RouteTableId,
          detail: '0.0.0.0/0 routes to Internet Gateway',
        });
      }

      exposurePath.push({
        type: 'subnet', id: instance.SubnetId,
        detail: 'Public subnet (has IGW route)',
      });

      const nacl = naclBySubnet.get(instance.SubnetId);
      if (nacl?.NetworkAclId) {
        const allowsInbound = (nacl.Entries || []).some(
          (e) => !e.Egress && e.RuleAction === 'allow' && e.CidrBlock === '0.0.0.0/0'
        );
        exposurePath.push({
          type: 'nacl', id: nacl.NetworkAclId,
          detail: allowsInbound ? 'NACL allows inbound from 0.0.0.0/0' : 'NACL may restrict access',
        });
      }

      for (const sgId of instanceSgIds) {
        const sg = sgById.get(sgId);
        if (sg) {
          const publicRules = (sg.IpPermissions || []).filter((r) =>
            (r.IpRanges || []).some((ip) => isPublicCidr(ip.CidrIp || ''))
          );
          if (publicRules.length > 0) {
            exposurePath.push({
              type: 'security_group', id: sgId,
              name: sg.GroupName,
              detail: `${publicRules.length} rule(s) open to 0.0.0.0/0`,
            });
          }
        }
      }

      const nameTag = instance.Tags?.find((t) => t.Key === 'Name')?.Value;

      exposedResources.push({
        resourceId: instance.InstanceId,
        resourceType: 'EC2 Instance',
        name: nameTag || instance.InstanceId,
        vpcId,
        subnetId: instance.SubnetId,
        publicIp: instance.PublicIpAddress,
        openPorts,
        severity,
        exposurePath,
      });
    }
  }

  // Sort by severity
  const severityOrder: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  exposedResources.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return {
    vpcCount: vpcs.length,
    subnetCount: subnets.length,
    publicSubnetCount: publicSubnetIds.size,
    exposedResources,
    criticalCount: exposedResources.filter((r) => r.severity === 'CRITICAL').length,
    highCount: exposedResources.filter((r) => r.severity === 'HIGH').length,
    mediumCount: exposedResources.filter((r) => r.severity === 'MEDIUM').length,
    lowCount: exposedResources.filter((r) => r.severity === 'LOW').length,
    analyzedAt: new Date().toISOString(),
  };
}

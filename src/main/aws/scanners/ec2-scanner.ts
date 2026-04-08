// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  DescribeVpcsCommand,
  DescribeSubnetsCommand,
  DescribeSecurityGroupsCommand,
  DescribeInstancesCommand,
  DescribeNatGatewaysCommand,
  DescribeInternetGatewaysCommand,
  DescribeRouteTablesCommand,
  DescribeNetworkInterfacesCommand,
  DescribeVolumesCommand,
  DescribeSnapshotsCommand,
  type Vpc,
  type Subnet,
  type SecurityGroup,
  type Instance,
  type NatGateway,
  type InternetGateway,
  type RouteTable,
  type NetworkInterface,
  type Volume,
  type Snapshot,
} from '@aws-sdk/client-ec2';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class EC2Scanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'ec2', 'ec2');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];

    // Scan all EC2-related resources in parallel
    const [
      vpcResult,
      subnetResult,
      securityGroupResult,
      instanceResult,
      natGatewayResult,
      igwResult,
      routeTableResult,
      eniResult,
      volumeResult,
      snapshotResult,
    ] = await Promise.allSettled([
      this.scanVpcs(),
      this.scanSubnets(),
      this.scanSecurityGroups(),
      this.scanInstances(),
      this.scanNatGateways(),
      this.scanInternetGateways(),
      this.scanRouteTables(),
      this.scanNetworkInterfaces(),
      this.scanVolumes(),
      this.scanSnapshots(),
    ]);

    // Collect results
    if (vpcResult.status === 'fulfilled') {
      resources.push(...vpcResult.value.resources);
      errors.push(...vpcResult.value.errors);
    } else {
      errors.push(this.createError('DescribeVpcs', vpcResult.reason));
    }

    if (subnetResult.status === 'fulfilled') {
      resources.push(...subnetResult.value.resources);
      errors.push(...subnetResult.value.errors);
    } else {
      errors.push(this.createError('DescribeSubnets', subnetResult.reason));
    }

    if (securityGroupResult.status === 'fulfilled') {
      resources.push(...securityGroupResult.value.resources);
      errors.push(...securityGroupResult.value.errors);
    } else {
      errors.push(this.createError('DescribeSecurityGroups', securityGroupResult.reason));
    }

    if (instanceResult.status === 'fulfilled') {
      resources.push(...instanceResult.value.resources);
      errors.push(...instanceResult.value.errors);
    } else {
      errors.push(this.createError('DescribeInstances', instanceResult.reason));
    }

    if (natGatewayResult.status === 'fulfilled') {
      resources.push(...natGatewayResult.value.resources);
      errors.push(...natGatewayResult.value.errors);
    } else {
      errors.push(this.createError('DescribeNatGateways', natGatewayResult.reason));
    }

    if (igwResult.status === 'fulfilled') {
      resources.push(...igwResult.value.resources);
      errors.push(...igwResult.value.errors);
    } else {
      errors.push(this.createError('DescribeInternetGateways', igwResult.reason));
    }

    if (routeTableResult.status === 'fulfilled') {
      resources.push(...routeTableResult.value.resources);
      errors.push(...routeTableResult.value.errors);
    } else {
      errors.push(this.createError('DescribeRouteTables', routeTableResult.reason));
    }

    if (eniResult.status === 'fulfilled') {
      resources.push(...eniResult.value.resources);
      errors.push(...eniResult.value.errors);
    } else {
      errors.push(this.createError('DescribeNetworkInterfaces', eniResult.reason));
    }

    if (volumeResult.status === 'fulfilled') {
      resources.push(...volumeResult.value.resources);
      errors.push(...volumeResult.value.errors);
    } else {
      errors.push(this.createError('DescribeVolumes', volumeResult.reason));
    }

    if (snapshotResult.status === 'fulfilled') {
      resources.push(...snapshotResult.value.resources);
      errors.push(...snapshotResult.value.errors);
    } else {
      errors.push(this.createError('DescribeSnapshots', snapshotResult.reason));
    }

    return { resources, errors };
  }

  private async scanVpcs(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getEC2Client({
      profile: this.config.profile,
      region: this.config.region,
    });

    try {
      let nextToken: string | undefined;

      do {
        const response = await this.withRateLimit(() =>
          client.send(new DescribeVpcsCommand({ NextToken: nextToken }))
        );

        if (response.Vpcs) {
          for (const vpc of response.Vpcs) {
            resources.push(this.mapVpc(vpc));
          }
        }

        nextToken = response.NextToken;
      } while (nextToken);
    } catch (error) {
      errors.push(this.createError('DescribeVpcs', error));
    }

    return { resources, errors };
  }

  private async scanSubnets(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getEC2Client({
      profile: this.config.profile,
      region: this.config.region,
    });

    try {
      let nextToken: string | undefined;

      do {
        const response = await this.withRateLimit(() =>
          client.send(new DescribeSubnetsCommand({ NextToken: nextToken }))
        );

        if (response.Subnets) {
          for (const subnet of response.Subnets) {
            resources.push(this.mapSubnet(subnet));
          }
        }

        nextToken = response.NextToken;
      } while (nextToken);
    } catch (error) {
      errors.push(this.createError('DescribeSubnets', error));
    }

    return { resources, errors };
  }

  private async scanSecurityGroups(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getEC2Client({
      profile: this.config.profile,
      region: this.config.region,
    });

    try {
      let nextToken: string | undefined;

      do {
        const response = await this.withRateLimit(() =>
          client.send(new DescribeSecurityGroupsCommand({ NextToken: nextToken }))
        );

        if (response.SecurityGroups) {
          for (const sg of response.SecurityGroups) {
            resources.push(this.mapSecurityGroup(sg));
          }
        }

        nextToken = response.NextToken;
      } while (nextToken);
    } catch (error) {
      errors.push(this.createError('DescribeSecurityGroups', error));
    }

    return { resources, errors };
  }

  private async scanInstances(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getEC2Client({
      profile: this.config.profile,
      region: this.config.region,
    });

    try {
      let nextToken: string | undefined;

      do {
        const response = await this.withRateLimit(() =>
          client.send(new DescribeInstancesCommand({ NextToken: nextToken }))
        );

        if (response.Reservations) {
          for (const reservation of response.Reservations) {
            if (reservation.Instances) {
              for (const instance of reservation.Instances) {
                resources.push(this.mapInstance(instance));
              }
            }
          }
        }

        nextToken = response.NextToken;
      } while (nextToken);
    } catch (error) {
      errors.push(this.createError('DescribeInstances', error));
    }

    return { resources, errors };
  }

  private async scanNatGateways(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getEC2Client({
      profile: this.config.profile,
      region: this.config.region,
    });

    try {
      let nextToken: string | undefined;

      do {
        const response = await this.withRateLimit(() =>
          client.send(new DescribeNatGatewaysCommand({ NextToken: nextToken }))
        );

        if (response.NatGateways) {
          for (const natGateway of response.NatGateways) {
            resources.push(this.mapNatGateway(natGateway));
          }
        }

        nextToken = response.NextToken;
      } while (nextToken);
    } catch (error) {
      errors.push(this.createError('DescribeNatGateways', error));
    }

    return { resources, errors };
  }

  private async scanInternetGateways(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getEC2Client({
      profile: this.config.profile,
      region: this.config.region,
    });

    try {
      let nextToken: string | undefined;

      do {
        const response = await this.withRateLimit(() =>
          client.send(new DescribeInternetGatewaysCommand({ NextToken: nextToken }))
        );

        if (response.InternetGateways) {
          for (const igw of response.InternetGateways) {
            resources.push(this.mapInternetGateway(igw));
          }
        }

        nextToken = response.NextToken;
      } while (nextToken);
    } catch (error) {
      errors.push(this.createError('DescribeInternetGateways', error));
    }

    return { resources, errors };
  }

  private async scanRouteTables(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getEC2Client({
      profile: this.config.profile,
      region: this.config.region,
    });

    try {
      let nextToken: string | undefined;

      do {
        const response = await this.withRateLimit(() =>
          client.send(new DescribeRouteTablesCommand({ NextToken: nextToken }))
        );

        if (response.RouteTables) {
          for (const rt of response.RouteTables) {
            resources.push(this.mapRouteTable(rt));
          }
        }

        nextToken = response.NextToken;
      } while (nextToken);
    } catch (error) {
      errors.push(this.createError('DescribeRouteTables', error));
    }

    return { resources, errors };
  }

  private async scanNetworkInterfaces(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getEC2Client({
      profile: this.config.profile,
      region: this.config.region,
    });

    try {
      let nextToken: string | undefined;

      do {
        const response = await this.withRateLimit(() =>
          client.send(new DescribeNetworkInterfacesCommand({ NextToken: nextToken }))
        );

        if (response.NetworkInterfaces) {
          for (const eni of response.NetworkInterfaces) {
            resources.push(this.mapNetworkInterface(eni));
          }
        }

        nextToken = response.NextToken;
      } while (nextToken);
    } catch (error) {
      errors.push(this.createError('DescribeNetworkInterfaces', error));
    }

    return { resources, errors };
  }

  private async scanVolumes(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getEC2Client({
      profile: this.config.profile,
      region: this.config.region,
    });

    try {
      let nextToken: string | undefined;

      do {
        const response = await this.withRateLimit(() =>
          client.send(new DescribeVolumesCommand({ NextToken: nextToken }))
        );

        if (response.Volumes) {
          for (const volume of response.Volumes) {
            resources.push(this.mapVolume(volume));
          }
        }

        nextToken = response.NextToken;
      } while (nextToken);
    } catch (error) {
      errors.push(this.createError('DescribeVolumes', error));
    }

    return { resources, errors };
  }

  private async scanSnapshots(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getEC2Client({
      profile: this.config.profile,
      region: this.config.region,
    });

    try {
      let nextToken: string | undefined;

      do {
        const response = await this.withRateLimit(() =>
          client.send(new DescribeSnapshotsCommand({
            OwnerIds: ['self'],
            NextToken: nextToken,
          }))
        );

        if (response.Snapshots) {
          for (const snapshot of response.Snapshots) {
            resources.push(this.mapSnapshot(snapshot));
          }
        }

        nextToken = response.NextToken;
      } while (nextToken);
    } catch (error) {
      errors.push(this.createError('DescribeSnapshots', error));
    }

    return { resources, errors };
  }

  private mapVolume(volume: Volume): Resource {
    const tags = this.parseTags(volume.Tags);
    const arn = `arn:aws:ec2:${this.config.region}::volume/${volume.VolumeId}`;

    return this.createResource(
      arn,
      'volume',
      this.getNameFromTags(tags) || volume.VolumeId || '',
      {
        volumeId: volume.VolumeId,
        volumeType: volume.VolumeType,
        size: volume.Size,
        state: volume.State,
        availabilityZone: volume.AvailabilityZone,
        encrypted: volume.Encrypted,
        kmsKeyId: volume.KmsKeyId,
        iops: volume.Iops,
        throughput: volume.Throughput,
        snapshotId: volume.SnapshotId,
        attachments: volume.Attachments?.map((att) => ({
          instanceId: att.InstanceId,
          device: att.Device,
          state: att.State,
          deleteOnTermination: att.DeleteOnTermination,
        })),
        multiAttachEnabled: volume.MultiAttachEnabled,
      },
      tags,
      volume.CreateTime?.toISOString()
    );
  }

  private mapSnapshot(snapshot: Snapshot): Resource {
    const tags = this.parseTags(snapshot.Tags);
    const arn = `arn:aws:ec2:${this.config.region}::snapshot/${snapshot.SnapshotId}`;

    return this.createResource(
      arn,
      'snapshot',
      this.getNameFromTags(tags) || snapshot.SnapshotId || '',
      {
        snapshotId: snapshot.SnapshotId,
        volumeId: snapshot.VolumeId,
        state: snapshot.State,
        volumeSize: snapshot.VolumeSize,
        description: snapshot.Description,
        encrypted: snapshot.Encrypted,
        kmsKeyId: snapshot.KmsKeyId,
        ownerId: snapshot.OwnerId,
        progress: snapshot.Progress,
        storageTier: snapshot.StorageTier,
      },
      tags,
      snapshot.StartTime?.toISOString()
    );
  }

  // Mappers
  private mapVpc(vpc: Vpc): Resource {
    const tags = this.parseTags(vpc.Tags);
    const arn = `arn:aws:ec2:${this.config.region}::vpc/${vpc.VpcId}`;

    return this.createResource(arn, 'vpc', this.getNameFromTags(tags) || vpc.VpcId || '', {
      vpcId: vpc.VpcId,
      cidrBlock: vpc.CidrBlock,
      state: vpc.State,
      isDefault: vpc.IsDefault,
      dhcpOptionsId: vpc.DhcpOptionsId,
      instanceTenancy: vpc.InstanceTenancy,
    }, tags);
  }

  private mapSubnet(subnet: Subnet): Resource {
    const tags = this.parseTags(subnet.Tags);
    const arn = `arn:aws:ec2:${this.config.region}::subnet/${subnet.SubnetId}`;

    return this.createResource(arn, 'subnet', this.getNameFromTags(tags) || subnet.SubnetId || '', {
      subnetId: subnet.SubnetId,
      vpcId: subnet.VpcId,
      cidrBlock: subnet.CidrBlock,
      availabilityZone: subnet.AvailabilityZone,
      availabilityZoneId: subnet.AvailabilityZoneId,
      state: subnet.State,
      availableIpAddressCount: subnet.AvailableIpAddressCount,
      mapPublicIpOnLaunch: subnet.MapPublicIpOnLaunch,
      defaultForAz: subnet.DefaultForAz,
    }, tags);
  }

  private mapSecurityGroup(sg: SecurityGroup): Resource {
    const tags = this.parseTags(sg.Tags);
    const arn = `arn:aws:ec2:${this.config.region}::security-group/${sg.GroupId}`;

    return this.createResource(arn, 'security-group', sg.GroupName || sg.GroupId || '', {
      groupId: sg.GroupId,
      groupName: sg.GroupName,
      description: sg.Description,
      vpcId: sg.VpcId,
      inboundRules: sg.IpPermissions?.map((rule) => ({
        protocol: rule.IpProtocol,
        fromPort: rule.FromPort,
        toPort: rule.ToPort,
        ipRanges: rule.IpRanges?.map((r) => r.CidrIp),
        securityGroups: rule.UserIdGroupPairs?.map((g) => g.GroupId),
      })),
      outboundRules: sg.IpPermissionsEgress?.map((rule) => ({
        protocol: rule.IpProtocol,
        fromPort: rule.FromPort,
        toPort: rule.ToPort,
        ipRanges: rule.IpRanges?.map((r) => r.CidrIp),
        securityGroups: rule.UserIdGroupPairs?.map((g) => g.GroupId),
      })),
    }, tags);
  }

  private mapInstance(instance: Instance): Resource {
    const tags = this.parseTags(instance.Tags);
    const arn = `arn:aws:ec2:${this.config.region}::instance/${instance.InstanceId}`;

    return this.createResource(
      arn,
      'instance',
      this.getNameFromTags(tags) || instance.InstanceId || '',
      {
        instanceId: instance.InstanceId,
        instanceType: instance.InstanceType,
        state: instance.State?.Name,
        privateIpAddress: instance.PrivateIpAddress,
        publicIpAddress: instance.PublicIpAddress,
        vpcId: instance.VpcId,
        subnetId: instance.SubnetId,
        securityGroups: instance.SecurityGroups?.map((sg) => ({
          groupId: sg.GroupId,
          groupName: sg.GroupName,
        })),
        iamInstanceProfile: instance.IamInstanceProfile?.Arn,
        imageId: instance.ImageId,
        keyName: instance.KeyName,
        platform: instance.Platform || 'linux',
        architecture: instance.Architecture,
        rootDeviceType: instance.RootDeviceType,
        virtualizationType: instance.VirtualizationType,
      },
      tags,
      instance.LaunchTime?.toISOString()
    );
  }

  private mapNatGateway(natGateway: NatGateway): Resource {
    const tags = this.parseTags(natGateway.Tags);
    const arn = `arn:aws:ec2:${this.config.region}::natgateway/${natGateway.NatGatewayId}`;

    return this.createResource(
      arn,
      'nat-gateway',
      this.getNameFromTags(tags) || natGateway.NatGatewayId || '',
      {
        natGatewayId: natGateway.NatGatewayId,
        state: natGateway.State,
        subnetId: natGateway.SubnetId,
        vpcId: natGateway.VpcId,
        connectivityType: natGateway.ConnectivityType,
        natGatewayAddresses: natGateway.NatGatewayAddresses?.map((addr) => ({
          allocationId: addr.AllocationId,
          networkInterfaceId: addr.NetworkInterfaceId,
          privateIp: addr.PrivateIp,
          publicIp: addr.PublicIp,
        })),
      },
      tags,
      natGateway.CreateTime?.toISOString()
    );
  }

  private mapInternetGateway(igw: InternetGateway): Resource {
    const tags = this.parseTags(igw.Tags);
    const arn = `arn:aws:ec2:${this.config.region}::internet-gateway/${igw.InternetGatewayId}`;

    return this.createResource(
      arn,
      'internet-gateway',
      this.getNameFromTags(tags) || igw.InternetGatewayId || '',
      {
        internetGatewayId: igw.InternetGatewayId,
        attachments: igw.Attachments?.map((att) => ({
          vpcId: att.VpcId,
          state: att.State,
        })),
      },
      tags
    );
  }

  private mapRouteTable(rt: RouteTable): Resource {
    const tags = this.parseTags(rt.Tags);
    const arn = `arn:aws:ec2:${this.config.region}::route-table/${rt.RouteTableId}`;

    return this.createResource(
      arn,
      'route-table',
      this.getNameFromTags(tags) || rt.RouteTableId || '',
      {
        routeTableId: rt.RouteTableId,
        vpcId: rt.VpcId,
        routes: rt.Routes?.map((route) => ({
          destinationCidrBlock: route.DestinationCidrBlock,
          destinationIpv6CidrBlock: route.DestinationIpv6CidrBlock,
          gatewayId: route.GatewayId,
          natGatewayId: route.NatGatewayId,
          instanceId: route.InstanceId,
          networkInterfaceId: route.NetworkInterfaceId,
          vpcPeeringConnectionId: route.VpcPeeringConnectionId,
          state: route.State,
        })),
        associations: rt.Associations?.map((assoc) => ({
          associationId: assoc.RouteTableAssociationId,
          subnetId: assoc.SubnetId,
          gatewayId: assoc.GatewayId,
          main: assoc.Main,
        })),
      },
      tags
    );
  }

  private mapNetworkInterface(eni: NetworkInterface): Resource {
    const tags = this.parseTags(eni.TagSet);
    const arn = `arn:aws:ec2:${this.config.region}::network-interface/${eni.NetworkInterfaceId}`;

    return this.createResource(
      arn,
      'network-interface',
      this.getNameFromTags(tags) || eni.Description || eni.NetworkInterfaceId || '',
      {
        networkInterfaceId: eni.NetworkInterfaceId,
        description: eni.Description,
        status: eni.Status,
        macAddress: eni.MacAddress,
        privateIpAddress: eni.PrivateIpAddress,
        privateDnsName: eni.PrivateDnsName,
        vpcId: eni.VpcId,
        subnetId: eni.SubnetId,
        availabilityZone: eni.AvailabilityZone,
        interfaceType: eni.InterfaceType,
        groups: eni.Groups?.map((g) => ({
          groupId: g.GroupId,
          groupName: g.GroupName,
        })),
        attachment: eni.Attachment
          ? {
              attachmentId: eni.Attachment.AttachmentId,
              instanceId: eni.Attachment.InstanceId,
              status: eni.Attachment.Status,
              deleteOnTermination: eni.Attachment.DeleteOnTermination,
            }
          : undefined,
      },
      tags
    );
  }
}

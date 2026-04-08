// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  GetResourcesCommand,
  GetResourcesCommandOutput,
  ResourceGroupsTaggingAPIClient,
} from '@aws-sdk/client-resource-groups-tagging-api';
import { getClientFactory } from '../client-factory';
import { withRateLimit } from '../rate-limiter';
import type { DiscoveredResource, ServiceType } from '../../../shared/types';

// Mapping of AWS service prefixes to our service types
const SERVICE_PREFIX_MAP: Record<string, ServiceType> = {
  'ec2:instance': 'ec2',
  'ec2:vpc': 'vpc',
  'ec2:subnet': 'subnet',
  'ec2:security-group': 'securityGroup',
  'ec2:volume': 'ec2',
  'ec2:network-interface': 'ec2',
  'ec2:elastic-ip': 'ec2',
  'ec2:nat-gateway': 'ec2',
  'ec2:internet-gateway': 'ec2',
  'ec2:route-table': 'ec2',
  lambda: 'lambda',
  's3:bucket': 's3',
  rds: 'rds',
  dynamodb: 'dynamodb',
  ecs: 'ecs',
  eks: 'eks',
  elasticache: 'elasticache',
  elasticfilesystem: 'efs',
  'elasticloadbalancing:loadbalancer': 'alb',
  'elasticloadbalancing:targetgroup': 'alb',
  cloudfront: 'cloudfront',
  route53: 'route53',
};

// Resource type filters for the Tagging API
const RESOURCE_TYPE_FILTERS = [
  'ec2:instance',
  'ec2:vpc',
  'ec2:subnet',
  'ec2:security-group',
  'ec2:volume',
  'ec2:network-interface',
  'ec2:elastic-ip',
  'ec2:nat-gateway',
  'ec2:internet-gateway',
  'ec2:route-table',
  'lambda:function',
  's3:bucket',
  'rds:db',
  'rds:cluster',
  'dynamodb:table',
  'ecs:cluster',
  'ecs:service',
  'ecs:task',
  'eks:cluster',
  'elasticache:cluster',
  'elasticfilesystem:file-system',
  'elasticloadbalancing:loadbalancer',
  'elasticloadbalancing:targetgroup',
  'cloudfront:distribution',
  'route53:hostedzone',
];

export interface TaggingApiOptions {
  profile: string;
  region: string;
  serviceFilter?: ServiceType[];
}

export async function discoverResourcesWithTaggingApi(
  options: TaggingApiOptions
): Promise<DiscoveredResource[]> {
  const { profile, region, serviceFilter } = options;
  const clientFactory = getClientFactory();
  const client = clientFactory.getTaggingClient({ profile, region });

  const resources: DiscoveredResource[] = [];
  let paginationToken: string | undefined;

  // Filter resource types based on requested services
  let resourceTypeFilters = RESOURCE_TYPE_FILTERS;
  if (serviceFilter && serviceFilter.length > 0) {
    resourceTypeFilters = RESOURCE_TYPE_FILTERS.filter((resourceType) => {
      const service = getServiceTypeFromResourceType(resourceType);
      return service && serviceFilter.includes(service);
    });
  }

  // If no relevant resource types, return empty
  if (resourceTypeFilters.length === 0) {
    return resources;
  }

  do {
    const response = await withRateLimit('tagging', region, () =>
      client.send(
        new GetResourcesCommand({
          ResourceTypeFilters: resourceTypeFilters,
          PaginationToken: paginationToken,
          ResourcesPerPage: 100,
        })
      )
    );

    if (response.ResourceTagMappingList) {
      for (const resource of response.ResourceTagMappingList) {
        if (resource.ResourceARN) {
          const parsed = parseArn(resource.ResourceARN);
          if (parsed) {
            const serviceType = getServiceTypeFromArn(resource.ResourceARN);
            if (serviceType) {
              resources.push({
                arn: resource.ResourceARN,
                service: parsed.service,
                resourceType: parsed.resourceType,
                region: parsed.region || region,
                tags: parseTags(resource.Tags),
              });
            }
          }
        }
      }
    }

    paginationToken = response.PaginationToken;
  } while (paginationToken);

  return resources;
}

function getServiceTypeFromResourceType(resourceType: string): ServiceType | null {
  // Check exact match first
  if (SERVICE_PREFIX_MAP[resourceType]) {
    return SERVICE_PREFIX_MAP[resourceType];
  }

  // Check prefix match
  const prefix = resourceType.split(':')[0];
  if (SERVICE_PREFIX_MAP[prefix]) {
    return SERVICE_PREFIX_MAP[prefix];
  }

  return null;
}

function getServiceTypeFromArn(arn: string): ServiceType | null {
  const parsed = parseArn(arn);
  if (!parsed) return null;

  const fullKey = `${parsed.service}:${parsed.resourceType}`;
  if (SERVICE_PREFIX_MAP[fullKey]) {
    return SERVICE_PREFIX_MAP[fullKey];
  }

  if (SERVICE_PREFIX_MAP[parsed.service]) {
    return SERVICE_PREFIX_MAP[parsed.service];
  }

  return null;
}

interface ParsedArn {
  partition: string;
  service: string;
  region: string;
  account: string;
  resourceType: string;
  resourceId: string;
}

function parseArn(arn: string): ParsedArn | null {
  // ARN format: arn:partition:service:region:account:resource
  const parts = arn.split(':');
  if (parts.length < 6) return null;

  const [, partition, service, region, account, ...resourceParts] = parts;
  const resourceString = resourceParts.join(':');

  // Parse resource part - can be resource-type/resource-id or resource-type:resource-id
  let resourceType = '';
  let resourceId = resourceString;

  if (resourceString.includes('/')) {
    const slashIndex = resourceString.indexOf('/');
    resourceType = resourceString.substring(0, slashIndex);
    resourceId = resourceString.substring(slashIndex + 1);
  } else if (resourceString.includes(':')) {
    const colonIndex = resourceString.indexOf(':');
    resourceType = resourceString.substring(0, colonIndex);
    resourceId = resourceString.substring(colonIndex + 1);
  }

  return {
    partition,
    service,
    region,
    account,
    resourceType,
    resourceId,
  };
}

function parseTags(
  tags?: { Key?: string; Value?: string }[]
): Record<string, string> {
  const result: Record<string, string> = {};

  if (tags) {
    for (const tag of tags) {
      if (tag.Key) {
        result[tag.Key] = tag.Value || '';
      }
    }
  }

  return result;
}

export { parseArn, getServiceTypeFromArn };

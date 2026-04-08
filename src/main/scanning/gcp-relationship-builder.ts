// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import type {
  Resource,
  Relationship,
  RelationshipType,
  TopologyGraph,
  TopologyNode,
  TopologyLink,
  DiagramGraph,
  DiagramNode,
  DiagramEdge,
  DiagramViewMode,
} from '../../shared/types';

interface RelationshipRule {
  sourceType: string;
  targetType: string;
  relationshipType: RelationshipType;
  extractor: (source: Resource, allResources: Resource[]) => string[];
}

export class GCPRelationshipBuilder {
  /**
   * Check if a resource's selfLink or ID matches a reference that could be
   * either a full selfLink URL or a bare name (e.g., GKE stores bare network names).
   */
  private matchesSelfLinkOrName(resourceId: string, reference: string): boolean {
    if (resourceId === reference) return true;
    // reference might be a bare name like "default" while resourceId is a full selfLink
    if (resourceId.endsWith(`/${reference}`)) return true;
    // resourceId might be a bare name while reference is a full selfLink
    if (reference.endsWith(`/${resourceId}`)) return true;
    return false;
  }

  private rules: RelationshipRule[] = [
    // VPC Network contains Subnets
    {
      sourceType: 'network',
      targetType: 'subnet',
      relationshipType: 'contains',
      extractor: (source, allResources) => {
        const networkSelfLink = source.id;
        return allResources
          .filter(
            (r) =>
              r.resourceType === 'subnet' &&
              this.matchesSelfLinkOrName(r.data.network as string || '', networkSelfLink)
          )
          .map((r) => r.id);
      },
    },
    // Subnet contains Instances (via networkInterfaces)
    {
      sourceType: 'subnet',
      targetType: 'instance',
      relationshipType: 'contains',
      extractor: (source, allResources) => {
        const subnetSelfLink = source.id;
        return allResources
          .filter((r) => {
            if (r.resourceType !== 'instance') return false;
            const interfaces = r.data.networkInterfaces as
              | { subnetwork?: string }[]
              | undefined;
            return interfaces?.some((ni) => ni.subnetwork && this.matchesSelfLinkOrName(ni.subnetwork, subnetSelfLink)) ?? false;
          })
          .map((r) => r.id);
      },
    },
    // Firewall rule applies to Network
    {
      sourceType: 'firewall-rule',
      targetType: 'network',
      relationshipType: 'attached_to',
      extractor: (source, allResources) => {
        const network = source.data.network as string | undefined;
        if (!network) return [];
        return allResources
          .filter((r) => r.resourceType === 'network' && this.matchesSelfLinkOrName(r.id, network))
          .map((r) => r.id);
      },
    },
    // Cloud Router uses Network
    {
      sourceType: 'router',
      targetType: 'network',
      relationshipType: 'uses',
      extractor: (source, allResources) => {
        const network = source.data.network as string | undefined;
        if (!network) return [];
        return allResources
          .filter((r) => r.resourceType === 'network' && this.matchesSelfLinkOrName(r.id, network))
          .map((r) => r.id);
      },
    },
    // Cloud NAT uses Router
    {
      sourceType: 'nat-gateway',
      targetType: 'router',
      relationshipType: 'uses',
      extractor: (source, allResources) => {
        const router = source.data.router as string | undefined;
        if (!router) return [];
        return allResources
          .filter((r) => r.resourceType === 'router' && this.matchesSelfLinkOrName(r.id, router))
          .map((r) => r.id);
      },
    },
    // GKE Cluster uses Network
    {
      sourceType: 'cluster',
      targetType: 'network',
      relationshipType: 'uses',
      extractor: (source, allResources) => {
        if (source.service !== 'gke') return [];
        const network = source.data.network as string | undefined;
        if (!network) return [];
        return allResources
          .filter((r) => r.resourceType === 'network' && this.matchesSelfLinkOrName(r.id, network))
          .map((r) => r.id);
      },
    },
    // GKE Cluster uses Subnet
    {
      sourceType: 'cluster',
      targetType: 'subnet',
      relationshipType: 'uses',
      extractor: (source, allResources) => {
        if (source.service !== 'gke') return [];
        const subnetwork = source.data.subnetwork as string | undefined;
        if (!subnetwork) return [];
        return allResources
          .filter((r) => r.resourceType === 'subnet' && this.matchesSelfLinkOrName(r.id, subnetwork))
          .map((r) => r.id);
      },
    },
    // Cloud SQL uses Network (private IP)
    {
      sourceType: 'sql-instance',
      targetType: 'network',
      relationshipType: 'uses',
      extractor: (source, allResources) => {
        const settings = source.data.settings as
          | { ipConfiguration?: { privateNetwork?: string } }
          | undefined;
        const privateNetwork = settings?.ipConfiguration?.privateNetwork;
        if (!privateNetwork) return [];
        return allResources
          .filter((r) => r.resourceType === 'network' && this.matchesSelfLinkOrName(r.id, privateNetwork))
          .map((r) => r.id);
      },
    },
    // Forwarding Rule targets Backend Service
    {
      sourceType: 'forwarding-rule',
      targetType: 'backend-service',
      relationshipType: 'targets',
      extractor: (source, allResources) => {
        const backendService = source.data.backendService as string | undefined;
        if (!backendService) return [];
        return allResources
          .filter(
            (r) => r.resourceType === 'backend-service' && this.matchesSelfLinkOrName(r.id, backendService)
          )
          .map((r) => r.id);
      },
    },
    // Forwarding Rule uses Network
    {
      sourceType: 'forwarding-rule',
      targetType: 'network',
      relationshipType: 'uses',
      extractor: (source, allResources) => {
        const network = source.data.network as string | undefined;
        if (!network) return [];
        return allResources
          .filter((r) => r.resourceType === 'network' && this.matchesSelfLinkOrName(r.id, network))
          .map((r) => r.id);
      },
    },
    // Pub/Sub Subscription references Topic
    {
      sourceType: 'subscription',
      targetType: 'topic',
      relationshipType: 'depends_on',
      extractor: (source, allResources) => {
        const topicRef = source.data.topic as string | undefined;
        if (!topicRef) return [];
        return allResources
          .filter((r) => r.resourceType === 'topic' && this.matchesSelfLinkOrName(r.id, topicRef))
          .map((r) => r.id);
      },
    },
    // BigQuery Table belongs to Dataset
    {
      sourceType: 'table',
      targetType: 'dataset',
      relationshipType: 'member_of',
      extractor: (source, allResources) => {
        if (source.service !== 'bigquery') return [];
        const datasetId = source.data.datasetId as string | undefined;
        if (!datasetId) return [];
        return allResources
          .filter(
            (r) =>
              r.service === 'bigquery' &&
              r.resourceType === 'dataset' &&
              r.data.datasetId === datasetId
          )
          .map((r) => r.id);
      },
    },
    // Disk attached to Instance
    {
      sourceType: 'disk',
      targetType: 'instance',
      relationshipType: 'attached_to',
      extractor: (source, allResources) => {
        const users = source.data.users as string[] | undefined;
        if (!users || users.length === 0) return [];
        return allResources
          .filter(
            (r) => r.resourceType === 'instance' && users.some(ref => this.matchesSelfLinkOrName(r.id, ref))
          )
          .map((r) => r.id);
      },
    },
    // Instance uses Network (via networkInterfaces)
    {
      sourceType: 'instance',
      targetType: 'network',
      relationshipType: 'uses',
      extractor: (source, allResources) => {
        const interfaces = source.data.networkInterfaces as
          | { network?: string }[]
          | undefined;
        if (!interfaces) return [];
        const networkLinks = [
          ...new Set(interfaces.map((ni) => ni.network).filter(Boolean) as string[]),
        ];
        return allResources
          .filter(
            (r) => r.resourceType === 'network' && networkLinks.some(ref => this.matchesSelfLinkOrName(r.id, ref))
          )
          .map((r) => r.id);
      },
    },
    // Address used by resources
    {
      sourceType: 'address',
      targetType: 'instance',
      relationshipType: 'attached_to',
      extractor: (source, allResources) => {
        const users = source.data.users as string[] | undefined;
        if (!users || users.length === 0) return [];
        return allResources
          .filter(
            (r) => r.resourceType === 'instance' && users.some(ref => this.matchesSelfLinkOrName(r.id, ref))
          )
          .map((r) => r.id);
      },
    },

    // --- Network: Instance Group relationships ---
    // Instance Group uses Network
    {
      sourceType: 'instance-group',
      targetType: 'network',
      relationshipType: 'uses',
      extractor: (source, allResources) => {
        const network = source.data.network as string | undefined;
        if (!network) return [];
        return allResources
          .filter((r) => r.resourceType === 'network' && this.matchesSelfLinkOrName(r.id, network))
          .map((r) => r.id);
      },
    },
    // Instance Group uses Subnet
    {
      sourceType: 'instance-group',
      targetType: 'subnet',
      relationshipType: 'uses',
      extractor: (source, allResources) => {
        const subnetwork = source.data.subnetwork as string | undefined;
        if (!subnetwork) return [];
        return allResources
          .filter((r) => r.resourceType === 'subnet' && this.matchesSelfLinkOrName(r.id, subnetwork))
          .map((r) => r.id);
      },
    },
    // Forwarding Rule uses Subnet
    {
      sourceType: 'forwarding-rule',
      targetType: 'subnet',
      relationshipType: 'uses',
      extractor: (source, allResources) => {
        const subnetwork = source.data.subnetwork as string | undefined;
        if (!subnetwork) return [];
        return allResources
          .filter((r) => r.resourceType === 'subnet' && this.matchesSelfLinkOrName(r.id, subnetwork))
          .map((r) => r.id);
      },
    },
    // Backend Service uses Health Check
    {
      sourceType: 'backend-service',
      targetType: 'health-check',
      relationshipType: 'uses',
      extractor: (source, allResources) => {
        const healthChecks = source.data.healthChecks as string[] | undefined;
        if (!healthChecks || healthChecks.length === 0) return [];
        return allResources
          .filter((r) => r.resourceType === 'health-check' && healthChecks.some(
            (hc) => this.matchesSelfLinkOrName(r.id, hc)
          ))
          .map((r) => r.id);
      },
    },

    // --- Load Balancer chain ---
    // URL Map targets Backend Service (via defaultService)
    {
      sourceType: 'url-map',
      targetType: 'backend-service',
      relationshipType: 'targets',
      extractor: (source, allResources) => {
        const defaultService = source.data.defaultService as string | undefined;
        if (!defaultService) return [];
        return allResources
          .filter((r) => r.resourceType === 'backend-service' && this.matchesSelfLinkOrName(r.id, defaultService))
          .map((r) => r.id);
      },
    },
    // Forwarding Rule targets URL Map (via target)
    {
      sourceType: 'forwarding-rule',
      targetType: 'url-map',
      relationshipType: 'targets',
      extractor: (source, allResources) => {
        const target = source.data.target as string | undefined;
        if (!target) return [];
        return allResources
          .filter((r) => r.resourceType === 'url-map' && this.matchesSelfLinkOrName(r.id, target))
          .map((r) => r.id);
      },
    },
    // Backend Service targets Instance Group (via backends[].group)
    {
      sourceType: 'backend-service',
      targetType: 'instance-group',
      relationshipType: 'targets',
      extractor: (source, allResources) => {
        const backends = source.data.backends as { group?: string }[] | undefined;
        if (!backends || backends.length === 0) return [];
        const groups = backends.map((b) => b.group).filter(Boolean) as string[];
        if (groups.length === 0) return [];
        return allResources
          .filter((r) => r.resourceType === 'instance-group' && groups.some(
            (g) => this.matchesSelfLinkOrName(r.id, g)
          ))
          .map((r) => r.id);
      },
    },

    // --- Application relationships ---
    // Cloud Function uses VPC (via vpcConnector)
    {
      sourceType: 'function',
      targetType: 'network',
      relationshipType: 'uses',
      extractor: (source, allResources) => {
        const serviceConfig = source.data.serviceConfig as { vpcConnector?: string } | undefined;
        const vpcConnector = serviceConfig?.vpcConnector;
        if (!vpcConnector) return [];
        // VPC connector references a network; find networks in same project
        return allResources
          .filter((r) => r.resourceType === 'network' && this.matchesSelfLinkOrName(r.id, vpcConnector))
          .map((r) => r.id);
      },
    },
    // Cloud Function triggered by Pub/Sub topic (via eventTrigger in data)
    {
      sourceType: 'function',
      targetType: 'topic',
      relationshipType: 'depends_on',
      extractor: (source, allResources) => {
        // v2 functions may store event trigger info
        const serviceConfig = source.data.serviceConfig as Record<string, unknown> | undefined;
        const envVars = serviceConfig?.environmentVariables as Record<string, string> | undefined;
        if (!envVars) return [];
        // Check env vars for topic references
        const topicRefs = Object.values(envVars).filter((v) =>
          typeof v === 'string' && v.includes('/topics/')
        );
        if (topicRefs.length === 0) return [];
        return allResources
          .filter((r) => r.resourceType === 'topic' && topicRefs.some(
            (ref) => this.matchesSelfLinkOrName(r.id, ref)
          ))
          .map((r) => r.id);
      },
    },
    // Eventarc Trigger targets Cloud Run service or Function (via destination)
    {
      sourceType: 'trigger',
      targetType: 'service',
      relationshipType: 'targets',
      extractor: (source, allResources) => {
        const destination = source.data.destination as { cloudRun?: { service?: string } } | undefined;
        const serviceName = destination?.cloudRun?.service;
        if (!serviceName) return [];
        return allResources
          .filter((r) =>
            r.resourceType === 'service' &&
            r.service === 'cloud-run' &&
            (r.name === serviceName || this.matchesSelfLinkOrName(r.id, serviceName))
          )
          .map((r) => r.id);
      },
    },
    // Eventarc Trigger depends on Pub/Sub topic (via transport)
    {
      sourceType: 'trigger',
      targetType: 'topic',
      relationshipType: 'depends_on',
      extractor: (source, allResources) => {
        const transport = source.data.transport as { pubsub?: { topic?: string } } | undefined;
        const topicRef = transport?.pubsub?.topic;
        if (!topicRef) return [];
        return allResources
          .filter((r) => r.resourceType === 'topic' && this.matchesSelfLinkOrName(r.id, topicRef))
          .map((r) => r.id);
      },
    },

    // --- Data relationships ---
    // GKE Cluster contains Instance Groups (node pools create instance groups)
    {
      sourceType: 'cluster',
      targetType: 'instance-group',
      relationshipType: 'contains',
      extractor: (source, allResources) => {
        if (source.service !== 'gke') return [];
        // GKE node pools create instance groups in the same zones
        const clusterName = source.name;
        return allResources
          .filter((r) =>
            r.resourceType === 'instance-group' &&
            r.name.includes(clusterName)
          )
          .map((r) => r.id);
      },
    },

    // --- Vertex AI relationships ---
    // Endpoint uses Model (via deployedModels)
    {
      sourceType: 'endpoint',
      targetType: 'model',
      relationshipType: 'uses',
      extractor: (source, allResources) => {
        if (source.service !== 'vertex-ai') return [];
        const deployedModels = source.data.deployedModels as { model?: string }[] | undefined;
        if (!deployedModels) return [];
        const modelRefs = deployedModels.map(dm => dm.model).filter(Boolean) as string[];
        return allResources
          .filter((r) =>
            r.resourceType === 'model' &&
            r.service === 'vertex-ai' &&
            modelRefs.some(ref => r.id === ref || r.id.endsWith(`/${ref}`) || ref.endsWith(`/${r.name}`))
          )
          .map((r) => r.id);
      },
    },
    // Training Pipeline uses Dataset (via inputDataConfig.datasetId)
    {
      sourceType: 'training-pipeline',
      targetType: 'dataset',
      relationshipType: 'uses',
      extractor: (source, allResources) => {
        if (source.service !== 'vertex-ai') return [];
        const inputDataConfig = source.data.inputDataConfig as { datasetId?: string } | undefined;
        const datasetId = inputDataConfig?.datasetId;
        if (!datasetId) return [];
        return allResources
          .filter((r) =>
            r.resourceType === 'dataset' &&
            r.service === 'vertex-ai' &&
            r.id.includes(datasetId)
          )
          .map((r) => r.id);
      },
    },
    // Training Pipeline produces Model (via modelToUpload)
    {
      sourceType: 'training-pipeline',
      targetType: 'model',
      relationshipType: 'produces',
      extractor: (source, allResources) => {
        if (source.service !== 'vertex-ai') return [];
        const modelToUpload = source.data.modelToUpload as { name?: string; displayName?: string } | undefined;
        if (!modelToUpload?.displayName) return [];
        return allResources
          .filter((r) =>
            r.resourceType === 'model' &&
            r.service === 'vertex-ai' &&
            (r.name === modelToUpload.displayName || (modelToUpload.name && r.id === modelToUpload.name))
          )
          .map((r) => r.id);
      },
    },
    // Data Fusion instances connect to GCS buckets (via data pipelines)
    {
      sourceType: 'instance',
      targetType: 'bucket',
      relationshipType: 'depends_on',
      extractor: (source, allResources) => {
        if (source.service !== 'data-fusion') return [];
        return [];
      },
    },
    // Datastream streams connect to Cloud SQL (as source/destination)
    {
      sourceType: 'stream',
      targetType: 'instance',
      relationshipType: 'depends_on',
      extractor: (source, allResources) => {
        if (source.service !== 'datastream') return [];
        return [];
      },
    },
    // Managed Kafka clusters run in VPC networks
    {
      sourceType: 'cluster',
      targetType: 'network',
      relationshipType: 'attached_to',
      extractor: (source, allResources) => {
        if (source.service !== 'managed-kafka') return [];
        const gcpConfig = source.data.gcpConfig as { accessConfig?: { networkConfigs?: { subnet?: string }[] } } | undefined;
        if (!gcpConfig?.accessConfig?.networkConfigs) return [];
        const subnetRefs = gcpConfig.accessConfig.networkConfigs
          .map((nc: { subnet?: string }) => nc.subnet)
          .filter(Boolean) as string[];
        return allResources
          .filter((r) => r.resourceType === 'subnet' && subnetRefs.some((ref) => r.id.includes(ref) || ref.includes(r.id)))
          .map((r) => r.id);
      },
    },
    // Workstation clusters run in VPC networks
    {
      sourceType: 'workstation-cluster',
      targetType: 'network',
      relationshipType: 'attached_to',
      extractor: (source, allResources) => {
        if (source.service !== 'cloud-workstations') return [];
        const network = source.data.network as string | undefined;
        if (!network) return [];
        return allResources
          .filter((r) => r.resourceType === 'network' && (r.id === network || r.id.endsWith(`/${network}`) || network.endsWith(`/${r.name}`)))
          .map((r) => r.id);
      },
    },
    // VMware Engine private clouds contain clusters
    {
      sourceType: 'private-cloud',
      targetType: 'cluster',
      relationshipType: 'contains',
      extractor: (source, allResources) => {
        if (source.service !== 'vmware-engine') return [];
        return allResources
          .filter((r) => r.resourceType === 'cluster' && r.service === 'vmware-engine' && r.id.startsWith(source.id))
          .map((r) => r.id);
      },
    },
    // Database Migration jobs connect to Cloud SQL destinations
    {
      sourceType: 'migration-job',
      targetType: 'instance',
      relationshipType: 'depends_on',
      extractor: (source, allResources) => {
        if (source.service !== 'database-migration') return [];
        const destination = source.data.destination as string | undefined;
        if (!destination) return [];
        return allResources
          .filter((r) => r.service === 'cloud-sql' && r.resourceType === 'instance' && destination.includes(r.name))
          .map((r) => r.id);
      },
    },
    // Backup DR backup plans protect Compute Engine instances
    {
      sourceType: 'backup-plan',
      targetType: 'instance',
      relationshipType: 'targets',
      extractor: (source, allResources) => {
        if (source.service !== 'backup-dr') return [];
        const resourceType = source.data.resourceType as string | undefined;
        if (resourceType !== 'compute.googleapis.com/Instance') return [];
        return [];
      },
    },

    // --- Phase 2a: Additional relationship rules ---

    // Instance Group contains Instances
    {
      sourceType: 'instance-group',
      targetType: 'instance',
      relationshipType: 'contains',
      extractor: (source, allResources) => {
        const instances = source.data.instances as string[] | undefined;
        if (!instances || instances.length === 0) return [];
        return allResources
          .filter((r) => r.resourceType === 'instance' && instances.some(
            (ref) => this.matchesSelfLinkOrName(r.id, ref)
          ))
          .map((r) => r.id);
      },
    },
    // Cloud Run service uses VPC (via VPC access connector or direct VPC egress)
    {
      sourceType: 'service',
      targetType: 'network',
      relationshipType: 'uses',
      extractor: (source, allResources) => {
        if (source.service !== 'cloud-run') return [];
        const template = source.data.template as {
          vpcAccess?: {
            connector?: string;
            networkInterfaces?: { network?: string }[];
          };
        } | undefined;
        if (!template?.vpcAccess) return [];
        // Direct VPC egress via networkInterfaces
        const networkRefs: string[] = [];
        if (template.vpcAccess.networkInterfaces) {
          for (const ni of template.vpcAccess.networkInterfaces) {
            if (ni.network) networkRefs.push(ni.network);
          }
        }
        if (networkRefs.length === 0) return [];
        return allResources
          .filter((r) => r.resourceType === 'network' && networkRefs.some(
            (ref) => this.matchesSelfLinkOrName(r.id, ref)
          ))
          .map((r) => r.id);
      },
    },
    // Memorystore (Redis) uses Network
    {
      sourceType: 'redis-instance',
      targetType: 'network',
      relationshipType: 'uses',
      extractor: (source, allResources) => {
        const authorizedNetwork = source.data.authorizedNetwork as string | undefined;
        if (!authorizedNetwork) return [];
        return allResources
          .filter((r) => r.resourceType === 'network' && this.matchesSelfLinkOrName(r.id, authorizedNetwork))
          .map((r) => r.id);
      },
    },
    // Filestore uses Network
    {
      sourceType: 'filestore-instance',
      targetType: 'network',
      relationshipType: 'uses',
      extractor: (source, allResources) => {
        const networks = source.data.networks as { network?: string }[] | undefined;
        if (!networks || networks.length === 0) return [];
        const networkRefs = networks.map((n) => n.network).filter(Boolean) as string[];
        if (networkRefs.length === 0) return [];
        return allResources
          .filter((r) => r.resourceType === 'network' && networkRefs.some(
            (ref) => this.matchesSelfLinkOrName(r.id, ref)
          ))
          .map((r) => r.id);
      },
    },
    // Cloud DNS zone uses Network (private zones)
    {
      sourceType: 'dns-zone',
      targetType: 'network',
      relationshipType: 'uses',
      extractor: (source, allResources) => {
        const pvConfig = source.data.privateVisibilityConfig as {
          networks?: { networkUrl?: string }[];
        } | undefined;
        if (!pvConfig?.networks) return [];
        const networkRefs = pvConfig.networks.map((n) => n.networkUrl).filter(Boolean) as string[];
        if (networkRefs.length === 0) return [];
        return allResources
          .filter((r) => r.resourceType === 'network' && networkRefs.some(
            (ref) => this.matchesSelfLinkOrName(r.id, ref)
          ))
          .map((r) => r.id);
      },
    },
    // Security Policy protects Backend Service (reverse lookup)
    {
      sourceType: 'security-policy',
      targetType: 'backend-service',
      relationshipType: 'attached_to',
      extractor: (source, allResources) => {
        return allResources
          .filter((r) => {
            if (r.resourceType !== 'backend-service') return false;
            const secPolicy = r.data.securityPolicy as string | undefined;
            return secPolicy ? this.matchesSelfLinkOrName(source.id, secPolicy) : false;
          })
          .map((r) => r.id);
      },
    },
    // AlloyDB Cluster uses Network
    {
      sourceType: 'alloydb-cluster',
      targetType: 'network',
      relationshipType: 'uses',
      extractor: (source, allResources) => {
        const network = source.data.network as string | undefined;
        if (!network) return [];
        return allResources
          .filter((r) => r.resourceType === 'network' && this.matchesSelfLinkOrName(r.id, network))
          .map((r) => r.id);
      },
    },
    // Cloud Spanner instance contains databases
    {
      sourceType: 'spanner-instance',
      targetType: 'spanner-database',
      relationshipType: 'contains',
      extractor: (source, allResources) => {
        return allResources
          .filter((r) =>
            r.resourceType === 'spanner-database' &&
            r.service === 'cloud-spanner' &&
            r.id.includes(source.name)
          )
          .map((r) => r.id);
      },
    },
  ];

  buildRelationships(
    scanId: string,
    resources: Resource[]
  ): Omit<Relationship, 'id'>[] {
    const relationships: Omit<Relationship, 'id'>[] = [];

    for (const resource of resources) {
      for (const rule of this.rules) {
        if (resource.resourceType === rule.sourceType) {
          const targetIds = rule.extractor(resource, resources);
          for (const targetId of targetIds) {
            relationships.push({
              scanId,
              sourceArn: resource.id,
              targetArn: targetId,
              relationshipType: rule.relationshipType,
            });
          }
        }
      }
    }

    // Log relationship stats for diagnostics
    if (relationships.length > 0) {
      const typeCounts: Record<string, number> = {};
      for (const rel of relationships) {
        typeCounts[rel.relationshipType] = (typeCounts[rel.relationshipType] || 0) + 1;
      }
      console.log(`[GCP Relationships] Total: ${relationships.length} | ${Object.entries(typeCounts).map(([k, v]) => `${k}: ${v}`).join(', ')}`);
    } else {
      console.warn('[GCP Relationships] No relationships found — check that scanned services include related resource types');
    }

    // Log resources with no relationships (potential gaps)
    const connectedIds = new Set<string>();
    for (const rel of relationships) {
      connectedIds.add(rel.sourceArn);
      connectedIds.add(rel.targetArn);
    }
    const orphanCount = resources.filter(r => !connectedIds.has(r.id)).length;
    if (orphanCount > 0) {
      console.log(`[GCP Relationships] ${orphanCount} of ${resources.length} resources have no relationships`);
    }

    return relationships;
  }

  buildTopologyGraph(
    resources: Resource[],
    relationships: Relationship[]
  ): TopologyGraph {
    const nodes: TopologyNode[] = resources.map((resource) => ({
      id: resource.id,
      type: resource.resourceType,
      service: resource.service,
      name: resource.name,
      region: resource.region,
      data: resource.data,
      cloudProvider: 'gcp' as const,
    }));

    const nodeIds = new Set(nodes.map((n) => n.id));
    const links: TopologyLink[] = relationships
      .filter((rel) => nodeIds.has(rel.sourceArn) && nodeIds.has(rel.targetArn))
      .map((rel) => ({
        source: rel.sourceArn,
        target: rel.targetArn,
        type: rel.relationshipType,
      }));

    return { nodes, links };
  }

  buildNetworkTopology(
    resources: Resource[],
    relationships: Relationship[]
  ): TopologyGraph {
    const networkTypes = new Set([
      'network',
      'subnet',
      'firewall-rule',
      'instance',
      'router',
      'nat-gateway',
      'url-map',
      'instance-group',
      'forwarding-rule',
      'backend-service',
      'address',
      'health-check',
    ]);

    const networkResources = resources.filter((r) =>
      networkTypes.has(r.resourceType)
    );
    const networkResourceIds = new Set(networkResources.map((r) => r.id));
    const networkRelationships = relationships.filter(
      (rel) =>
        networkResourceIds.has(rel.sourceArn) &&
        networkResourceIds.has(rel.targetArn)
    );

    return this.buildTopologyGraph(networkResources, networkRelationships);
  }

  buildDiagramGraph(
    resources: Resource[],
    relationships: Relationship[],
    viewMode: DiagramViewMode
  ): DiagramGraph {
    switch (viewMode) {
      case 'network':
        return this.buildNetworkDiagram(resources, relationships);
      case 'application':
        return this.buildApplicationDiagram(resources, relationships);
      case 'data':
        return this.buildDataDiagram(resources, relationships);
      case 'full':
      default:
        return this.buildFullDiagram(resources, relationships);
    }
  }

  private buildNetworkDiagram(
    resources: Resource[],
    relationships: Relationship[]
  ): DiagramGraph {
    const networkTypes = new Set([
      'network',
      'subnet',
      'firewall-rule',
      'instance',
      'router',
      'nat-gateway',
      'url-map',
      'instance-group',
      'forwarding-rule',
      'backend-service',
      'address',
      'health-check',
    ]);

    const filtered = resources.filter((r) => networkTypes.has(r.resourceType));
    const filteredIds = new Set(filtered.map((r) => r.id));

    const nodes: DiagramNode[] = filtered.map((r) => ({
      id: r.id,
      type: r.resourceType,
      service: r.service,
      name: r.name,
      region: r.region,
      group: this.getNetworkGroup(r),
      tier: this.getNetworkTier(r),
      data: r.data,
      cloudProvider: 'gcp' as const,
    }));

    const edges: DiagramEdge[] = relationships
      .filter(
        (rel) => filteredIds.has(rel.sourceArn) && filteredIds.has(rel.targetArn)
      )
      .map((rel) => ({
        id: `${rel.sourceArn}-${rel.targetArn}`,
        source: rel.sourceArn,
        target: rel.targetArn,
        type: rel.relationshipType,
        label: rel.relationshipType,
      }));

    const grouped = this.applySmartGrouping(nodes, edges, 15);
    return { nodes: grouped.nodes, edges: grouped.edges, viewMode: 'network' };
  }

  private buildApplicationDiagram(
    resources: Resource[],
    relationships: Relationship[]
  ): DiagramGraph {
    const appTypes = new Set([
      'instance',
      'cluster',
      'service',
      'function',
      'forwarding-rule',
      'backend-service',
      'topic',
      'subscription',
      'instance-group',
      'trigger',
    ]);

    const appServices = new Set([
      'gce',
      'gke',
      'cloud-run',
      'cloud-functions',
      'app-engine',
      'gclb',
      'pubsub',
      'cloud-tasks',
      'cloud-scheduler',
      'cloud-workflows',
      'eventarc',
      'vertex-ai',
    ]);

    const filtered = resources.filter(
      (r) => appTypes.has(r.resourceType) || appServices.has(r.service)
    );
    const filteredIds = new Set(filtered.map((r) => r.id));

    const nodes: DiagramNode[] = filtered.map((r) => ({
      id: r.id,
      type: r.resourceType,
      service: r.service,
      name: r.name,
      region: r.region,
      tier: this.getApplicationTier(r),
      data: r.data,
      cloudProvider: 'gcp' as const,
    }));

    const edges: DiagramEdge[] = relationships
      .filter(
        (rel) => filteredIds.has(rel.sourceArn) && filteredIds.has(rel.targetArn)
      )
      .map((rel) => ({
        id: `${rel.sourceArn}-${rel.targetArn}`,
        source: rel.sourceArn,
        target: rel.targetArn,
        type: rel.relationshipType,
        label: rel.relationshipType,
      }));

    const grouped = this.applySmartGrouping(nodes, edges, 10);
    return { nodes: grouped.nodes, edges: grouped.edges, viewMode: 'application' };
  }

  private buildDataDiagram(
    resources: Resource[],
    relationships: Relationship[]
  ): DiagramGraph {
    const dataTypes = new Set([
      'sql-instance',
      'dataset',
      'table',
      'bucket',
      'topic',
      'subscription',
      'cluster',
    ]);

    const dataServices = new Set([
      'cloud-sql',
      'cloud-spanner',
      'firestore',
      'bigtable',
      'memorystore',
      'alloydb',
      'bigquery',
      'gcs',
      'filestore',
      'dataflow',
      'dataproc',
      'cloud-composer',
      'pubsub',
    ]);

    const filtered = resources.filter(
      (r) => dataTypes.has(r.resourceType) || dataServices.has(r.service)
    );
    const filteredIds = new Set(filtered.map((r) => r.id));

    const nodes: DiagramNode[] = filtered.map((r) => ({
      id: r.id,
      type: r.resourceType,
      service: r.service,
      name: r.name,
      region: r.region,
      tier: this.getDataTier(r),
      data: r.data,
      cloudProvider: 'gcp' as const,
    }));

    const edges: DiagramEdge[] = relationships
      .filter(
        (rel) => filteredIds.has(rel.sourceArn) && filteredIds.has(rel.targetArn)
      )
      .map((rel) => ({
        id: `${rel.sourceArn}-${rel.targetArn}`,
        source: rel.sourceArn,
        target: rel.targetArn,
        type: rel.relationshipType,
        label: rel.relationshipType,
      }));

    const grouped = this.applySmartGrouping(nodes, edges, 10);
    return { nodes: grouped.nodes, edges: grouped.edges, viewMode: 'data' };
  }

  private buildFullDiagram(
    resources: Resource[],
    relationships: Relationship[]
  ): DiagramGraph {
    const nodeIds = new Set(resources.map((r) => r.id));

    const nodes: DiagramNode[] = resources.map((r) => ({
      id: r.id,
      type: r.resourceType,
      service: r.service,
      name: r.name,
      region: r.region,
      data: r.data,
      cloudProvider: 'gcp' as const,
    }));

    const edges: DiagramEdge[] = relationships
      .filter(
        (rel) => nodeIds.has(rel.sourceArn) && nodeIds.has(rel.targetArn)
      )
      .map((rel) => ({
        id: `${rel.sourceArn}-${rel.targetArn}`,
        source: rel.sourceArn,
        target: rel.targetArn,
        type: rel.relationshipType,
        label: rel.relationshipType,
      }));

    const grouped = this.applySmartGrouping(nodes, edges, 10);
    return { nodes: grouped.nodes, edges: grouped.edges, viewMode: 'full' };
  }

  private getNetworkGroup(resource: Resource): string | undefined {
    // Group by VPC network selfLink
    if (resource.resourceType === 'network') return resource.id;

    // Direct network reference (subnet, firewall-rule, router, forwarding-rule, instance-group, address)
    const network = resource.data.network as string | undefined;
    if (network) return network;

    // Derive network from subnetwork reference (forwarding-rule, instance-group, address)
    const subnetwork = resource.data.subnetwork as string | undefined;
    if (subnetwork) {
      // subnetwork selfLink: .../subnetworks/{name} → need to find network from subnet
      // For grouping purposes, use the subnetwork ref as-is (will group with subnet's network)
      return subnetwork;
    }

    // Instances reference network via networkInterfaces
    const interfaces = resource.data.networkInterfaces as
      | { network?: string }[]
      | undefined;
    if (interfaces?.[0]?.network) return interfaces[0].network;

    // backend-service: derive from backends → instance-group → network (check data.network on backends)
    if (resource.resourceType === 'backend-service') {
      const backends = resource.data.backends as { group?: string }[] | undefined;
      if (backends?.[0]?.group) {
        // Use the backend group reference; the instance-group will also be in this VPC
        return undefined; // Will be placed via relationship edges
      }
    }

    // health-check and url-map: no direct network reference, grouped via relationships
    return undefined;
  }

  /**
   * Auto-collapse large sets of same-type resources into summary nodes.
   * Replaces individual nodes with a single summary node and rewires edges.
   */
  private applySmartGrouping(
    nodes: DiagramNode[],
    edges: DiagramEdge[],
    threshold: number
  ): { nodes: DiagramNode[]; edges: DiagramEdge[] } {
    // Count resources by type
    const typeCounts = new Map<string, number>();
    for (const node of nodes) {
      typeCounts.set(node.type, (typeCounts.get(node.type) || 0) + 1);
    }

    // Find types that exceed threshold
    const collapsibleTypes = new Set<string>();
    for (const [type, count] of typeCounts) {
      if (count > threshold) collapsibleTypes.add(type);
    }

    if (collapsibleTypes.size === 0) return { nodes, edges };

    const collapsedNodeIds = new Set<string>();
    const summaryNodes: DiagramNode[] = [];
    const remainingNodes: DiagramNode[] = [];

    for (const node of nodes) {
      if (collapsibleTypes.has(node.type)) {
        collapsedNodeIds.add(node.id);
      } else {
        remainingNodes.push(node);
      }
    }

    // Create one summary node per collapsed type
    const summaryIdMap = new Map<string, string>();
    for (const type of collapsibleTypes) {
      const count = typeCounts.get(type)!;
      const sampleNode = nodes.find(n => n.type === type)!;
      const summaryId = `summary-${type}`;
      summaryIdMap.set(type, summaryId);
      summaryNodes.push({
        id: summaryId,
        type: sampleNode.type,
        service: sampleNode.service,
        name: `${count} ${sampleNode.type}s`,
        region: '',
        group: sampleNode.group,
        tier: sampleNode.tier,
        data: { _isSummaryNode: true, _count: count },
        cloudProvider: sampleNode.cloudProvider,
      });
    }

    // Rewire edges: replace collapsed node refs with summary node refs
    const rewiredEdges: DiagramEdge[] = [];
    const seenEdgeKeys = new Set<string>();
    for (const edge of edges) {
      const srcCollapsed = collapsedNodeIds.has(edge.source);
      const tgtCollapsed = collapsedNodeIds.has(edge.target);

      // Skip internal edges between collapsed nodes of same type
      if (srcCollapsed && tgtCollapsed) {
        const srcType = nodes.find(n => n.id === edge.source)?.type;
        const tgtType = nodes.find(n => n.id === edge.target)?.type;
        if (srcType === tgtType) continue;
      }

      const newSource = srcCollapsed
        ? summaryIdMap.get(nodes.find(n => n.id === edge.source)!.type)!
        : edge.source;
      const newTarget = tgtCollapsed
        ? summaryIdMap.get(nodes.find(n => n.id === edge.target)!.type)!
        : edge.target;

      const edgeKey = `${newSource}-${newTarget}-${edge.type}`;
      if (!seenEdgeKeys.has(edgeKey)) {
        seenEdgeKeys.add(edgeKey);
        rewiredEdges.push({
          ...edge,
          id: edgeKey,
          source: newSource,
          target: newTarget,
        });
      }
    }

    return { nodes: [...remainingNodes, ...summaryNodes], edges: rewiredEdges };
  }

  private getNetworkTier(resource: Resource): string {
    switch (resource.resourceType) {
      case 'forwarding-rule':
      case 'backend-service':
      case 'health-check':
      case 'url-map':
        return 'gateway';
      case 'network':
        return 'network';
      case 'subnet':
      case 'router':
      case 'nat-gateway':
        return 'subnet';
      case 'instance':
      case 'instance-group':
        return 'compute';
      case 'firewall-rule':
        return 'security';
      case 'address':
        return 'network';
      default:
        return 'other';
    }
  }

  private getApplicationTier(resource: Resource): string {
    switch (resource.service) {
      case 'gclb':
        return 'ingress';
      case 'gce':
      case 'gke':
      case 'cloud-run':
      case 'cloud-functions':
      case 'app-engine':
        return 'compute';
      case 'pubsub':
      case 'cloud-tasks':
      case 'eventarc':
        return 'messaging';
      case 'cloud-workflows':
      case 'cloud-scheduler':
        return 'orchestration';
      case 'vertex-ai':
        return 'ai-ml';
      default:
        return 'other';
    }
  }

  private getDataTier(resource: Resource): string {
    switch (resource.service) {
      case 'pubsub':
      case 'dataflow':
        return 'ingestion';
      case 'cloud-sql':
      case 'cloud-spanner':
      case 'firestore':
      case 'bigtable':
      case 'memorystore':
      case 'alloydb':
        return 'database';
      case 'gcs':
      case 'filestore':
        return 'storage';
      case 'dataproc':
      case 'cloud-composer':
        return 'processing';
      case 'bigquery':
        return 'analytics';
      default:
        return 'other';
    }
  }
}

// Singleton instance
let gcpRelationshipBuilder: GCPRelationshipBuilder | null = null;

export function getGCPRelationshipBuilder(): GCPRelationshipBuilder {
  if (!gcpRelationshipBuilder) {
    gcpRelationshipBuilder = new GCPRelationshipBuilder();
  }
  return gcpRelationshipBuilder;
}

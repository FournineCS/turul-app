// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import type { Resource, Relationship, RelationshipType, TopologyGraph, TopologyNode, TopologyLink, DiagramGraph, DiagramNode, DiagramEdge, DiagramViewMode } from '../../shared/types';

interface RelationshipRule {
  sourceType: string;
  targetType: string;
  relationshipType: RelationshipType;
  extractor: (source: Resource, allResources: Resource[]) => string[];
}

export class RelationshipBuilder {
  private rules: RelationshipRule[] = [
    // VPC contains Subnets
    {
      sourceType: 'vpc',
      targetType: 'subnet',
      relationshipType: 'contains',
      extractor: (source, allResources) => {
        const vpcId = source.data.vpcId as string;
        return allResources
          .filter((r) => r.resourceType === 'subnet' && r.data.vpcId === vpcId)
          .map((r) => r.id);
      },
    },
    // VPC contains Security Groups
    {
      sourceType: 'vpc',
      targetType: 'security-group',
      relationshipType: 'contains',
      extractor: (source, allResources) => {
        const vpcId = source.data.vpcId as string;
        return allResources
          .filter((r) => r.resourceType === 'security-group' && r.data.vpcId === vpcId)
          .map((r) => r.id);
      },
    },
    // Subnet contains Instances
    {
      sourceType: 'subnet',
      targetType: 'instance',
      relationshipType: 'contains',
      extractor: (source, allResources) => {
        const subnetId = source.data.subnetId as string;
        return allResources
          .filter((r) => r.resourceType === 'instance' && r.data.subnetId === subnetId)
          .map((r) => r.id);
      },
    },
    // Subnet contains NAT Gateway
    {
      sourceType: 'subnet',
      targetType: 'nat-gateway',
      relationshipType: 'contains',
      extractor: (source, allResources) => {
        const subnetId = source.data.subnetId as string;
        return allResources
          .filter((r) => r.resourceType === 'nat-gateway' && r.data.subnetId === subnetId)
          .map((r) => r.id);
      },
    },
    // Instance member_of Security Group
    {
      sourceType: 'instance',
      targetType: 'security-group',
      relationshipType: 'member_of',
      extractor: (source, allResources) => {
        const securityGroups = source.data.securityGroups as { groupId: string }[] | undefined;
        if (!securityGroups) return [];

        const sgIds = securityGroups.map((sg) => sg.groupId);
        return allResources
          .filter((r) => r.resourceType === 'security-group' && sgIds.includes(r.data.groupId as string))
          .map((r) => r.id);
      },
    },
    // Lambda uses VPC
    {
      sourceType: 'function',
      targetType: 'vpc',
      relationshipType: 'uses',
      extractor: (source, allResources) => {
        const vpcConfig = source.data.vpcConfig as { vpcId?: string } | undefined;
        if (!vpcConfig?.vpcId) return [];

        return allResources
          .filter((r) => r.resourceType === 'vpc' && r.data.vpcId === vpcConfig.vpcId)
          .map((r) => r.id);
      },
    },
    // Lambda uses Security Group
    {
      sourceType: 'function',
      targetType: 'security-group',
      relationshipType: 'member_of',
      extractor: (source, allResources) => {
        const vpcConfig = source.data.vpcConfig as { securityGroupIds?: string[] } | undefined;
        if (!vpcConfig?.securityGroupIds) return [];

        return allResources
          .filter(
            (r) =>
              r.resourceType === 'security-group' &&
              vpcConfig.securityGroupIds!.includes(r.data.groupId as string)
          )
          .map((r) => r.id);
      },
    },
    // Lambda uses Subnet
    {
      sourceType: 'function',
      targetType: 'subnet',
      relationshipType: 'uses',
      extractor: (source, allResources) => {
        const vpcConfig = source.data.vpcConfig as { subnetIds?: string[] } | undefined;
        if (!vpcConfig?.subnetIds) return [];

        return allResources
          .filter(
            (r) =>
              r.resourceType === 'subnet' &&
              vpcConfig.subnetIds!.includes(r.data.subnetId as string)
          )
          .map((r) => r.id);
      },
    },
    // RDS Instance uses Security Group
    {
      sourceType: 'db-instance',
      targetType: 'security-group',
      relationshipType: 'member_of',
      extractor: (source, allResources) => {
        const vpcSecurityGroups = source.data.vpcSecurityGroups as { vpcSecurityGroupId: string }[] | undefined;
        if (!vpcSecurityGroups) return [];

        const sgIds = vpcSecurityGroups.map((sg) => sg.vpcSecurityGroupId);
        return allResources
          .filter(
            (r) => r.resourceType === 'security-group' && sgIds.includes(r.data.groupId as string)
          )
          .map((r) => r.id);
      },
    },
    // RDS Instance uses Subnet Group
    {
      sourceType: 'db-instance',
      targetType: 'db-subnet-group',
      relationshipType: 'uses',
      extractor: (source, allResources) => {
        const subnetGroup = source.data.dbSubnetGroup as string | undefined;
        if (!subnetGroup) return [];

        return allResources
          .filter(
            (r) =>
              r.resourceType === 'db-subnet-group' &&
              r.data.dbSubnetGroupName === subnetGroup
          )
          .map((r) => r.id);
      },
    },
    // Load Balancer uses Security Group
    {
      sourceType: 'load-balancer',
      targetType: 'security-group',
      relationshipType: 'member_of',
      extractor: (source, allResources) => {
        const securityGroups = source.data.securityGroups as string[] | undefined;
        if (!securityGroups) return [];

        return allResources
          .filter(
            (r) =>
              r.resourceType === 'security-group' &&
              securityGroups.includes(r.data.groupId as string)
          )
          .map((r) => r.id);
      },
    },
    // Load Balancer uses VPC
    {
      sourceType: 'load-balancer',
      targetType: 'vpc',
      relationshipType: 'uses',
      extractor: (source, allResources) => {
        const vpcId = source.data.vpcId as string | undefined;
        if (!vpcId) return [];

        return allResources
          .filter((r) => r.resourceType === 'vpc' && r.data.vpcId === vpcId)
          .map((r) => r.id);
      },
    },
    // Target Group targets Load Balancer
    {
      sourceType: 'load-balancer',
      targetType: 'target-group',
      relationshipType: 'targets',
      extractor: (source, allResources) => {
        const lbArn = source.id;
        return allResources
          .filter((r) => {
            const lbArns = r.data.loadBalancerArns as string[] | undefined;
            return r.resourceType === 'target-group' && lbArns?.includes(lbArn);
          })
          .map((r) => r.id);
      },
    },
    // Internet Gateway attached_to VPC
    {
      sourceType: 'internet-gateway',
      targetType: 'vpc',
      relationshipType: 'attached_to',
      extractor: (source, allResources) => {
        const attachments = source.data.attachments as { vpcId: string }[] | undefined;
        if (!attachments) return [];

        const vpcIds = attachments.map((a) => a.vpcId);
        return allResources
          .filter((r) => r.resourceType === 'vpc' && vpcIds.includes(r.data.vpcId as string))
          .map((r) => r.id);
      },
    },
    // Route Table contains routes to NAT Gateway
    {
      sourceType: 'route-table',
      targetType: 'nat-gateway',
      relationshipType: 'routes_to',
      extractor: (source, allResources) => {
        const routes = source.data.routes as { natGatewayId?: string }[] | undefined;
        if (!routes) return [];

        const natGatewayIds = routes
          .filter((r) => r.natGatewayId)
          .map((r) => r.natGatewayId!);

        return allResources
          .filter(
            (r) =>
              r.resourceType === 'nat-gateway' &&
              natGatewayIds.includes(r.data.natGatewayId as string)
          )
          .map((r) => r.id);
      },
    },
    // Route Table routes_to Internet Gateway
    {
      sourceType: 'route-table',
      targetType: 'internet-gateway',
      relationshipType: 'routes_to',
      extractor: (source, allResources) => {
        const routes = source.data.routes as { gatewayId?: string }[] | undefined;
        if (!routes) return [];

        const gatewayIds = routes
          .filter((r) => r.gatewayId && r.gatewayId.startsWith('igw-'))
          .map((r) => r.gatewayId!);

        return allResources
          .filter(
            (r) =>
              r.resourceType === 'internet-gateway' &&
              gatewayIds.includes(r.data.internetGatewayId as string)
          )
          .map((r) => r.id);
      },
    },
    // ECS cluster contains services
    {
      sourceType: 'cluster',
      targetType: 'service',
      relationshipType: 'contains',
      extractor: (source, allResources) => {
        if (source.service !== 'ecs') return [];
        const clusterArn = source.id;
        return allResources
          .filter(
            (r) =>
              r.service === 'ecs' &&
              r.resourceType === 'service' &&
              r.data.clusterArn === clusterArn
          )
          .map((r) => r.id);
      },
    },
    // ECS service uses task definition
    {
      sourceType: 'service',
      targetType: 'task-definition',
      relationshipType: 'uses',
      extractor: (source, allResources) => {
        if (source.service !== 'ecs') return [];
        const taskDefinition = source.data.taskDefinition as string | undefined;
        if (!taskDefinition) return [];

        // Extract family:revision pattern
        const taskDefFamily = taskDefinition.split('/').pop()?.split(':')[0];
        if (!taskDefFamily) return [];

        return allResources
          .filter(
            (r) =>
              r.service === 'ecs' &&
              r.resourceType === 'task-definition' &&
              r.data.family === taskDefFamily
          )
          .map((r) => r.id);
      },
    },
    // ECS service uses target group (load balancer)
    {
      sourceType: 'service',
      targetType: 'target-group',
      relationshipType: 'targets',
      extractor: (source, allResources) => {
        if (source.service !== 'ecs') return [];
        const loadBalancers = source.data.loadBalancers as { targetGroupArn?: string }[] | undefined;
        if (!loadBalancers) return [];

        const targetGroupArns = loadBalancers
          .filter((lb) => lb.targetGroupArn)
          .map((lb) => lb.targetGroupArn!);

        return allResources
          .filter(
            (r) =>
              r.resourceType === 'target-group' &&
              targetGroupArns.includes(r.id)
          )
          .map((r) => r.id);
      },
    },
    // EKS cluster contains node groups
    {
      sourceType: 'cluster',
      targetType: 'nodegroup',
      relationshipType: 'contains',
      extractor: (source, allResources) => {
        if (source.service !== 'eks') return [];
        const clusterName = source.data.name as string | undefined;
        if (!clusterName) return [];

        return allResources
          .filter(
            (r) =>
              r.service === 'eks' &&
              r.resourceType === 'nodegroup' &&
              r.data.clusterName === clusterName
          )
          .map((r) => r.id);
      },
    },
    // EKS cluster contains Fargate profiles
    {
      sourceType: 'cluster',
      targetType: 'fargate-profile',
      relationshipType: 'contains',
      extractor: (source, allResources) => {
        if (source.service !== 'eks') return [];
        const clusterName = source.data.name as string | undefined;
        if (!clusterName) return [];

        return allResources
          .filter(
            (r) =>
              r.service === 'eks' &&
              r.resourceType === 'fargate-profile' &&
              r.data.clusterName === clusterName
          )
          .map((r) => r.id);
      },
    },
    // CloudFormation stack contains resources
    {
      sourceType: 'stack',
      targetType: 'stack-resource',
      relationshipType: 'contains',
      extractor: (source, allResources) => {
        if (source.service !== 'cloudformation') return [];
        const stackId = source.id;

        return allResources
          .filter(
            (r) =>
              r.service === 'cloudformation' &&
              r.resourceType === 'stack-resource' &&
              r.data.stackId === stackId
          )
          .map((r) => r.id);
      },
    },
    // Step Functions invokes Lambda
    {
      sourceType: 'state-machine',
      targetType: 'function',
      relationshipType: 'uses',
      extractor: (source, allResources) => {
        if (source.service !== 'stepfunctions') return [];
        const lambdaFunctions = source.data.lambdaFunctions as string[] | undefined;
        if (!lambdaFunctions) return [];

        return allResources
          .filter(
            (r) =>
              r.service === 'lambda' &&
              r.resourceType === 'function' &&
              lambdaFunctions.includes(r.id)
          )
          .map((r) => r.id);
      },
    },
    // API Gateway integrates with Lambda
    {
      sourceType: 'rest-api',
      targetType: 'function',
      relationshipType: 'uses',
      extractor: (source, allResources) => {
        // REST APIs don't directly store Lambda ARNs in list output
        // This would need integration details for accurate mapping
        return [];
      },
    },
    // HTTP API integrates with Lambda
    {
      sourceType: 'http-api',
      targetType: 'function',
      relationshipType: 'uses',
      extractor: (source, allResources) => {
        if (source.service !== 'apigateway') return [];
        const integrations = source.data.integrations as { integrationUri?: string }[] | undefined;
        if (!integrations) return [];

        const lambdaArns = integrations
          .filter((i) => i.integrationUri?.includes(':lambda:'))
          .map((i) => i.integrationUri!)
          .filter((uri) => uri.startsWith('arn:aws:lambda:'));

        return allResources
          .filter(
            (r) =>
              r.service === 'lambda' &&
              r.resourceType === 'function' &&
              lambdaArns.some((arn) => r.id.includes(arn) || arn.includes(r.id))
          )
          .map((r) => r.id);
      },
    },
    // EventBridge rule targets Lambda
    {
      sourceType: 'rule',
      targetType: 'function',
      relationshipType: 'targets',
      extractor: (source, allResources) => {
        if (source.service !== 'eventbridge') return [];
        const targets = source.data.targets as { arn?: string }[] | undefined;
        if (!targets) return [];

        const lambdaArns = targets
          .filter((t) => t.arn?.includes(':lambda:'))
          .map((t) => t.arn!);

        return allResources
          .filter(
            (r) =>
              r.service === 'lambda' &&
              r.resourceType === 'function' &&
              lambdaArns.includes(r.id)
          )
          .map((r) => r.id);
      },
    },
    // EventBridge rule targets SQS
    {
      sourceType: 'rule',
      targetType: 'queue',
      relationshipType: 'targets',
      extractor: (source, allResources) => {
        if (source.service !== 'eventbridge') return [];
        const targets = source.data.targets as { arn?: string }[] | undefined;
        if (!targets) return [];

        const sqsArns = targets
          .filter((t) => t.arn?.includes(':sqs:'))
          .map((t) => t.arn!);

        return allResources
          .filter(
            (r) =>
              r.service === 'sqs' &&
              r.resourceType === 'queue' &&
              sqsArns.includes(r.id)
          )
          .map((r) => r.id);
      },
    },
    // SNS topic has SQS subscriptions
    {
      sourceType: 'topic',
      targetType: 'queue',
      relationshipType: 'targets',
      extractor: (source, allResources) => {
        if (source.service !== 'sns') return [];
        const subscriptions = source.data.subscriptions as { endpoint?: string; protocol?: string }[] | undefined;
        if (!subscriptions) return [];

        const sqsEndpoints = subscriptions
          .filter((s) => s.protocol === 'sqs' && s.endpoint)
          .map((s) => s.endpoint!);

        return allResources
          .filter(
            (r) =>
              r.service === 'sqs' &&
              r.resourceType === 'queue' &&
              sqsEndpoints.includes(r.id)
          )
          .map((r) => r.id);
      },
    },
    // SNS topic has Lambda subscriptions
    {
      sourceType: 'topic',
      targetType: 'function',
      relationshipType: 'targets',
      extractor: (source, allResources) => {
        if (source.service !== 'sns') return [];
        const subscriptions = source.data.subscriptions as { endpoint?: string; protocol?: string }[] | undefined;
        if (!subscriptions) return [];

        const lambdaEndpoints = subscriptions
          .filter((s) => s.protocol === 'lambda' && s.endpoint)
          .map((s) => s.endpoint!);

        return allResources
          .filter(
            (r) =>
              r.service === 'lambda' &&
              r.resourceType === 'function' &&
              lambdaEndpoints.includes(r.id)
          )
          .map((r) => r.id);
      },
    },
    // CloudWatch alarm monitors EC2
    {
      sourceType: 'metric-alarm',
      targetType: 'instance',
      relationshipType: 'targets',
      extractor: (source, allResources) => {
        if (source.service !== 'cloudwatch') return [];
        const dimensions = source.data.dimensions as { name?: string; value?: string }[] | undefined;
        if (!dimensions) return [];

        const instanceIds = dimensions
          .filter((d) => d.name === 'InstanceId' && d.value)
          .map((d) => d.value!);

        return allResources
          .filter(
            (r) =>
              r.service === 'ec2' &&
              r.resourceType === 'instance' &&
              instanceIds.includes(r.data.instanceId as string)
          )
          .map((r) => r.id);
      },
    },
    // CloudWatch alarm monitors RDS
    {
      sourceType: 'metric-alarm',
      targetType: 'db-instance',
      relationshipType: 'targets',
      extractor: (source, allResources) => {
        if (source.service !== 'cloudwatch') return [];
        const dimensions = source.data.dimensions as { name?: string; value?: string }[] | undefined;
        if (!dimensions) return [];

        const dbInstanceIds = dimensions
          .filter((d) => d.name === 'DBInstanceIdentifier' && d.value)
          .map((d) => d.value!);

        return allResources
          .filter(
            (r) =>
              r.service === 'rds' &&
              r.resourceType === 'db-instance' &&
              dbInstanceIds.includes(r.data.dbInstanceIdentifier as string)
          )
          .map((r) => r.id);
      },
    },
    // Secrets Manager secret uses KMS key
    {
      sourceType: 'secret',
      targetType: 'key',
      relationshipType: 'uses',
      extractor: (source, allResources) => {
        if (source.service !== 'secretsmanager') return [];
        const kmsKeyId = source.data.kmsKeyId as string | undefined;
        if (!kmsKeyId) return [];

        return allResources
          .filter(
            (r) =>
              r.service === 'kms' &&
              r.resourceType === 'key' &&
              (r.id === kmsKeyId || r.data.keyId === kmsKeyId)
          )
          .map((r) => r.id);
      },
    },
    // MWAA environment uses S3 bucket
    {
      sourceType: 'environment',
      targetType: 'bucket',
      relationshipType: 'uses',
      extractor: (source, allResources) => {
        if (source.service !== 'mwaa') return [];
        const sourceBucketArn = source.data.sourceBucketArn as string | undefined;
        if (!sourceBucketArn) return [];

        return allResources
          .filter(
            (r) =>
              r.service === 's3' &&
              r.resourceType === 'bucket' &&
              r.id === sourceBucketArn
          )
          .map((r) => r.id);
      },
    },
    // Glue job references Glue database
    {
      sourceType: 'job',
      targetType: 'database',
      relationshipType: 'uses',
      extractor: (source, allResources) => {
        // Glue jobs may reference databases but this requires parsing the script
        return [];
      },
    },
    // Glue crawler populates Glue database
    {
      sourceType: 'crawler',
      targetType: 'database',
      relationshipType: 'targets',
      extractor: (source, allResources) => {
        if (source.service !== 'glue') return [];
        const databaseName = source.data.databaseName as string | undefined;
        if (!databaseName) return [];

        return allResources
          .filter(
            (r) =>
              r.service === 'glue' &&
              r.resourceType === 'database' &&
              r.data.name === databaseName
          )
          .map((r) => r.id);
      },
    },
    // Auto Scaling Group targets EC2 Instances
    {
      sourceType: 'auto-scaling-group',
      targetType: 'instance',
      relationshipType: 'contains',
      extractor: (source, allResources) => {
        if (source.service !== 'autoscaling') return [];
        const instances = source.data.instances as { instanceId?: string }[] | undefined;
        if (!instances) return [];
        const instanceIds = instances.map(i => i.instanceId).filter(Boolean) as string[];
        return allResources
          .filter(r => r.service === 'ec2' && r.resourceType === 'instance' && instanceIds.includes(r.data.instanceId as string))
          .map(r => r.id);
      },
    },
    // Auto Scaling Group uses Target Group
    {
      sourceType: 'auto-scaling-group',
      targetType: 'target-group',
      relationshipType: 'targets',
      extractor: (source, allResources) => {
        if (source.service !== 'autoscaling') return [];
        const targetGroupARNs = source.data.targetGroupARNs as string[] | undefined;
        if (!targetGroupARNs) return [];
        return allResources
          .filter(r => r.resourceType === 'target-group' && targetGroupARNs.includes(r.id))
          .map(r => r.id);
      },
    },
    // EBS Volume attached_to EC2 Instance
    {
      sourceType: 'volume',
      targetType: 'instance',
      relationshipType: 'attached_to',
      extractor: (source, allResources) => {
        if (source.service !== 'ec2' || source.resourceType !== 'volume') return [];
        const attachments = source.data.attachments as { instanceId?: string }[] | undefined;
        if (!attachments) return [];
        const instanceIds = attachments.map(a => a.instanceId).filter(Boolean) as string[];
        return allResources
          .filter(r => r.service === 'ec2' && r.resourceType === 'instance' && instanceIds.includes(r.data.instanceId as string))
          .map(r => r.id);
      },
    },
    // EBS Snapshot from Volume
    {
      sourceType: 'snapshot',
      targetType: 'volume',
      relationshipType: 'depends_on',
      extractor: (source, allResources) => {
        if (source.service !== 'ec2' || source.resourceType !== 'snapshot') return [];
        const volumeId = source.data.volumeId as string | undefined;
        if (!volumeId) return [];
        return allResources
          .filter(r => r.service === 'ec2' && r.resourceType === 'volume' && r.data.volumeId === volumeId)
          .map(r => r.id);
      },
    },
    // CodePipeline uses CodeBuild Projects
    {
      sourceType: 'pipeline',
      targetType: 'build-project',
      relationshipType: 'uses',
      extractor: (source, allResources) => {
        if (source.service !== 'codepipeline') return [];
        const stages = source.data.stages as { actions?: { actionTypeId?: { provider?: string }; name?: string }[] }[] | undefined;
        if (!stages) return [];
        const buildProjectNames: string[] = [];
        for (const stage of stages) {
          if (stage.actions) {
            for (const action of stage.actions) {
              if (action.actionTypeId?.provider === 'CodeBuild' && action.name) {
                buildProjectNames.push(action.name);
              }
            }
          }
        }
        if (buildProjectNames.length === 0) return [];
        return allResources
          .filter(r => r.service === 'codebuild' && r.resourceType === 'build-project' && buildProjectNames.includes(r.data.projectName as string))
          .map(r => r.id);
      },
    },
    // CloudFront uses ACM Certificate
    {
      sourceType: 'distribution',
      targetType: 'certificate',
      relationshipType: 'uses',
      extractor: (source, allResources) => {
        if (source.service !== 'cloudfront') return [];
        const viewerCert = source.data.viewerCertificate as { acmCertificateArn?: string } | undefined;
        if (!viewerCert?.acmCertificateArn) return [];
        return allResources
          .filter(r => r.service === 'acm' && r.resourceType === 'certificate' && r.id === viewerCert.acmCertificateArn)
          .map(r => r.id);
      },
    },
    // WAF Web ACL protects ALB
    {
      sourceType: 'load-balancer',
      targetType: 'web-acl',
      relationshipType: 'uses',
      extractor: (source, allResources) => {
        // ALBs don't store WAF association in their data; WAF association is one-way
        return [];
      },
    },
    // Kinesis Data Stream used by Firehose
    {
      sourceType: 'delivery-stream',
      targetType: 'data-stream',
      relationshipType: 'depends_on',
      extractor: (source, allResources) => {
        if (source.service !== 'firehose') return [];
        const kinesisSource = source.data.source as { kinesisStreamARN?: string } | undefined;
        if (!kinesisSource?.kinesisStreamARN) return [];
        return allResources
          .filter(r => r.service === 'kinesis' && r.resourceType === 'data-stream' && r.id === kinesisSource.kinesisStreamARN)
          .map(r => r.id);
      },
    },
    // EFS Mount Target uses Subnet
    {
      sourceType: 'file-system',
      targetType: 'subnet',
      relationshipType: 'uses',
      extractor: (source, allResources) => {
        if (source.service !== 'efs') return [];
        const mountTargets = source.data.mountTargets as { subnetId?: string }[] | undefined;
        if (!mountTargets) return [];
        const subnetIds = mountTargets.map(mt => mt.subnetId).filter(Boolean) as string[];
        return allResources
          .filter(r => r.resourceType === 'subnet' && subnetIds.includes(r.data.subnetId as string))
          .map(r => r.id);
      },
    },
  ];

  buildRelationships(scanId: string, resources: Resource[]): Omit<Relationship, 'id'>[] {
    const relationships: Omit<Relationship, 'id'>[] = [];

    for (const resource of resources) {
      for (const rule of this.rules) {
        if (resource.resourceType === rule.sourceType) {
          const targetArns = rule.extractor(resource, resources);
          for (const targetArn of targetArns) {
            relationships.push({
              scanId,
              sourceArn: resource.id,
              targetArn,
              relationshipType: rule.relationshipType,
            });
          }
        }
      }
    }

    return relationships;
  }

  buildTopologyGraph(resources: Resource[], relationships: Relationship[]): TopologyGraph {
    // Build nodes
    const nodes: TopologyNode[] = resources.map((resource) => ({
      id: resource.id,
      type: resource.resourceType,
      service: resource.service,
      name: resource.name,
      region: resource.region,
      data: resource.data,
    }));

    // Build links
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

  // Get network-specific topology (VPCs, Subnets, Instances, Security Groups, etc.)
  buildNetworkTopology(resources: Resource[], relationships: Relationship[]): TopologyGraph {
    const networkTypes = new Set([
      'vpc',
      'subnet',
      'security-group',
      'instance',
      'nat-gateway',
      'internet-gateway',
      'route-table',
      'network-interface',
      'load-balancer',
      'target-group',
    ]);

    const networkResources = resources.filter((r) => networkTypes.has(r.resourceType));
    const networkResourceIds = new Set(networkResources.map((r) => r.id));

    const networkRelationships = relationships.filter(
      (rel) => networkResourceIds.has(rel.sourceArn) && networkResourceIds.has(rel.targetArn)
    );

    return this.buildTopologyGraph(networkResources, networkRelationships);
  }

  // Build diagram graph for a specific view mode
  buildDiagramGraph(resources: Resource[], relationships: Relationship[], viewMode: DiagramViewMode): DiagramGraph {
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

  private buildNetworkDiagram(resources: Resource[], relationships: Relationship[]): DiagramGraph {
    const networkTypes = new Set([
      'vpc', 'subnet', 'security-group', 'instance', 'nat-gateway',
      'internet-gateway', 'route-table', 'network-interface',
      'load-balancer', 'target-group',
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
    }));

    const edges: DiagramEdge[] = relationships
      .filter((rel) => filteredIds.has(rel.sourceArn) && filteredIds.has(rel.targetArn))
      .map((rel) => ({
        id: `${rel.sourceArn}-${rel.targetArn}`,
        source: rel.sourceArn,
        target: rel.targetArn,
        type: rel.relationshipType,
        label: rel.relationshipType,
      }));

    return { nodes, edges, viewMode: 'network' };
  }

  private buildApplicationDiagram(resources: Resource[], relationships: Relationship[]): DiagramGraph {
    const appResourceTypes = new Set([
      'function', 'cluster', 'service', 'task-definition',
      'nodegroup', 'fargate-profile',
      'rest-api', 'http-api', 'distribution',
      'load-balancer', 'target-group',
      'queue', 'topic', 'rule', 'state-machine',
      'graphql-api',
    ]);

    const appServices = new Set([
      'lambda', 'ecs', 'eks', 'apigateway', 'cloudfront',
      'alb', 'sqs', 'sns', 'eventbridge', 'stepfunctions', 'appsync',
    ]);

    const filtered = resources.filter(
      (r) => appResourceTypes.has(r.resourceType) && appServices.has(r.service)
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
    }));

    const edges: DiagramEdge[] = relationships
      .filter((rel) => filteredIds.has(rel.sourceArn) && filteredIds.has(rel.targetArn))
      .map((rel) => ({
        id: `${rel.sourceArn}-${rel.targetArn}`,
        source: rel.sourceArn,
        target: rel.targetArn,
        type: rel.relationshipType,
        label: rel.relationshipType,
      }));

    return { nodes, edges, viewMode: 'application' };
  }

  private buildDataDiagram(resources: Resource[], relationships: Relationship[]): DiagramGraph {
    const dataResourceTypes = new Set([
      'db-instance', 'db-cluster', 'table', 'replication-group', 'cache-cluster',
      'cluster', 'domain', 'bucket',
      'job', 'crawler', 'database',
      'work-group', 'data-stream', 'delivery-stream',
      'emr-cluster',
    ]);

    const dataServices = new Set([
      'rds', 'dynamodb', 'elasticache', 'redshift', 'opensearch',
      's3', 'glue', 'athena', 'kinesis', 'firehose', 'msk', 'emr',
    ]);

    const filtered = resources.filter(
      (r) => dataResourceTypes.has(r.resourceType) || dataServices.has(r.service)
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
    }));

    const edges: DiagramEdge[] = relationships
      .filter((rel) => filteredIds.has(rel.sourceArn) && filteredIds.has(rel.targetArn))
      .map((rel) => ({
        id: `${rel.sourceArn}-${rel.targetArn}`,
        source: rel.sourceArn,
        target: rel.targetArn,
        type: rel.relationshipType,
        label: rel.relationshipType,
      }));

    return { nodes, edges, viewMode: 'data' };
  }

  private buildFullDiagram(resources: Resource[], relationships: Relationship[]): DiagramGraph {
    const nodeIds = new Set(resources.map((r) => r.id));

    const nodes: DiagramNode[] = resources.map((r) => ({
      id: r.id,
      type: r.resourceType,
      service: r.service,
      name: r.name,
      region: r.region,
      data: r.data,
    }));

    const edges: DiagramEdge[] = relationships
      .filter((rel) => nodeIds.has(rel.sourceArn) && nodeIds.has(rel.targetArn))
      .map((rel) => ({
        id: `${rel.sourceArn}-${rel.targetArn}`,
        source: rel.sourceArn,
        target: rel.targetArn,
        type: rel.relationshipType,
        label: rel.relationshipType,
      }));

    return { nodes, edges, viewMode: 'full' };
  }

  private getNetworkGroup(resource: Resource): string | undefined {
    const vpcId = resource.data.vpcId as string | undefined;
    if (resource.resourceType === 'vpc') return resource.data.vpcId as string;
    if (vpcId) return vpcId;
    return undefined;
  }

  private getNetworkTier(resource: Resource): string {
    switch (resource.resourceType) {
      case 'internet-gateway':
      case 'nat-gateway':
        return 'gateway';
      case 'vpc':
        return 'vpc';
      case 'subnet':
      case 'route-table':
        return 'subnet';
      case 'load-balancer':
      case 'target-group':
        return 'loadbalancer';
      case 'instance':
      case 'network-interface':
        return 'compute';
      case 'security-group':
        return 'security';
      default:
        return 'other';
    }
  }

  private getApplicationTier(resource: Resource): string {
    switch (resource.service) {
      case 'cloudfront':
      case 'apigateway':
      case 'appsync':
        return 'ingress';
      case 'alb':
        return 'loadbalancer';
      case 'lambda':
      case 'ecs':
      case 'eks':
        return 'compute';
      case 'sqs':
      case 'sns':
      case 'eventbridge':
        return 'messaging';
      case 'stepfunctions':
        return 'orchestration';
      default:
        return 'other';
    }
  }

  private getDataTier(resource: Resource): string {
    switch (resource.service) {
      case 'kinesis':
      case 'firehose':
      case 'msk':
        return 'ingestion';
      case 'rds':
      case 'dynamodb':
      case 'elasticache':
      case 'redshift':
      case 'opensearch':
        return 'database';
      case 's3':
        return 'storage';
      case 'glue':
      case 'emr':
        return 'processing';
      case 'athena':
        return 'analytics';
      default:
        return 'other';
    }
  }
}

// Singleton instance
let relationshipBuilder: RelationshipBuilder | null = null;

export function getRelationshipBuilder(): RelationshipBuilder {
  if (!relationshipBuilder) {
    relationshipBuilder = new RelationshipBuilder();
  }
  return relationshipBuilder;
}

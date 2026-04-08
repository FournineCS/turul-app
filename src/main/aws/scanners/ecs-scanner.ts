// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  ListClustersCommand,
  DescribeClustersCommand,
  ListServicesCommand,
  DescribeServicesCommand,
  ListTasksCommand,
  DescribeTasksCommand,
  ListTaskDefinitionsCommand,
  DescribeTaskDefinitionCommand,
  type Cluster,
  type Service,
  type Task,
  type TaskDefinition,
  type ListClustersCommandOutput,
  type DescribeClustersCommandOutput,
  type ListServicesCommandOutput,
  type DescribeServicesCommandOutput,
  type ListTasksCommandOutput,
  type DescribeTasksCommandOutput,
  type ListTaskDefinitionsCommandOutput,
  type DescribeTaskDefinitionCommandOutput,
} from '@aws-sdk/client-ecs';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class ECSScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'ecs', 'ecs');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getECSClient({
      profile: this.config.profile,
      region: this.config.region,
    });

    // Scan clusters
    try {
      const clusterArns: string[] = [];
      let nextToken: string | undefined;

      do {
        const response: ListClustersCommandOutput = await this.withRateLimit(() =>
          client.send(new ListClustersCommand({ nextToken }))
        );

        if (response.clusterArns) {
          clusterArns.push(...response.clusterArns);
        }

        nextToken = response.nextToken;
      } while (nextToken);

      // Describe clusters in batches of 100
      for (let i = 0; i < clusterArns.length; i += 100) {
        const batch = clusterArns.slice(i, i + 100);
        const describeResponse: DescribeClustersCommandOutput = await this.withRateLimit(() =>
          client.send(
            new DescribeClustersCommand({
              clusters: batch,
              include: ['TAGS', 'SETTINGS', 'CONFIGURATIONS', 'STATISTICS'],
            })
          )
        );

        if (describeResponse.clusters) {
          for (const cluster of describeResponse.clusters) {
            resources.push(this.mapCluster(cluster));

            // Get services for this cluster
            const services = await this.getClusterServices(client, cluster.clusterArn!);
            resources.push(...services);

            // Get running tasks for this cluster
            const tasks = await this.getClusterTasks(client, cluster.clusterArn!);
            resources.push(...tasks);
          }
        }
      }
    } catch (error) {
      errors.push(this.createError('ListClusters', error));
    }

    // Scan task definitions
    try {
      const taskDefinitions = await this.getTaskDefinitions(client);
      resources.push(...taskDefinitions);
    } catch (error) {
      errors.push(this.createError('ListTaskDefinitions', error));
    }

    return { resources, errors };
  }

  private async getClusterServices(
    client: ReturnType<typeof getClientFactory.prototype.getECSClient>,
    clusterArn: string
  ): Promise<Resource[]> {
    const resources: Resource[] = [];
    const serviceArns: string[] = [];

    try {
      let nextToken: string | undefined;

      do {
        const response: ListServicesCommandOutput = await this.withRateLimit(() =>
          client.send(
            new ListServicesCommand({
              cluster: clusterArn,
              nextToken,
            })
          )
        );

        if (response.serviceArns) {
          serviceArns.push(...response.serviceArns);
        }

        nextToken = response.nextToken;
      } while (nextToken);

      // Describe services in batches of 10
      for (let i = 0; i < serviceArns.length; i += 10) {
        const batch = serviceArns.slice(i, i + 10);
        const describeResponse: DescribeServicesCommandOutput = await this.withRateLimit(() =>
          client.send(
            new DescribeServicesCommand({
              cluster: clusterArn,
              services: batch,
              include: ['TAGS'],
            })
          )
        );

        if (describeResponse.services) {
          for (const service of describeResponse.services) {
            resources.push(this.mapService(service));
          }
        }
      }
    } catch {
      // Ignore errors getting services
    }

    return resources;
  }

  private async getClusterTasks(
    client: ReturnType<typeof getClientFactory.prototype.getECSClient>,
    clusterArn: string
  ): Promise<Resource[]> {
    const resources: Resource[] = [];
    const taskArns: string[] = [];

    try {
      let nextToken: string | undefined;

      do {
        const response: ListTasksCommandOutput = await this.withRateLimit(() =>
          client.send(
            new ListTasksCommand({
              cluster: clusterArn,
              nextToken,
            })
          )
        );

        if (response.taskArns) {
          taskArns.push(...response.taskArns);
        }

        nextToken = response.nextToken;
      } while (nextToken);

      // Describe tasks in batches of 100
      for (let i = 0; i < taskArns.length; i += 100) {
        const batch = taskArns.slice(i, i + 100);
        const describeResponse: DescribeTasksCommandOutput = await this.withRateLimit(() =>
          client.send(
            new DescribeTasksCommand({
              cluster: clusterArn,
              tasks: batch,
              include: ['TAGS'],
            })
          )
        );

        if (describeResponse.tasks) {
          for (const task of describeResponse.tasks) {
            resources.push(this.mapTask(task));
          }
        }
      }
    } catch {
      // Ignore errors getting tasks
    }

    return resources;
  }

  private async getTaskDefinitions(
    client: ReturnType<typeof getClientFactory.prototype.getECSClient>
  ): Promise<Resource[]> {
    const resources: Resource[] = [];
    const taskDefinitionArns: string[] = [];

    try {
      let nextToken: string | undefined;

      do {
        const response: ListTaskDefinitionsCommandOutput = await this.withRateLimit(() =>
          client.send(
            new ListTaskDefinitionsCommand({
              status: 'ACTIVE',
              nextToken,
            })
          )
        );

        if (response.taskDefinitionArns) {
          taskDefinitionArns.push(...response.taskDefinitionArns);
        }

        nextToken = response.nextToken;
      } while (nextToken);

      // Get unique task definition families (latest revision only)
      const familyMap = new Map<string, string>();
      for (const arn of taskDefinitionArns) {
        const family = arn.split('/').pop()?.split(':')[0];
        if (family) {
          familyMap.set(family, arn);
        }
      }

      // Describe each task definition
      for (const arn of familyMap.values()) {
        try {
          const response: DescribeTaskDefinitionCommandOutput = await this.withRateLimit(() =>
            client.send(
              new DescribeTaskDefinitionCommand({
                taskDefinition: arn,
                include: ['TAGS'],
              })
            )
          );

          if (response.taskDefinition) {
            resources.push(this.mapTaskDefinition(response.taskDefinition, response.tags || []));
          }
        } catch {
          // Ignore errors getting individual task definitions
        }
      }
    } catch {
      // Ignore errors listing task definitions
    }

    return resources;
  }

  private mapCluster(cluster: Cluster): Resource {
    const tags = this.parseTagsLowercase(cluster.tags);

    return this.createResource(
      cluster.clusterArn || '',
      'cluster',
      cluster.clusterName || '',
      {
        clusterName: cluster.clusterName,
        clusterArn: cluster.clusterArn,
        status: cluster.status,
        registeredContainerInstancesCount: cluster.registeredContainerInstancesCount,
        runningTasksCount: cluster.runningTasksCount,
        pendingTasksCount: cluster.pendingTasksCount,
        activeServicesCount: cluster.activeServicesCount,
        capacityProviders: cluster.capacityProviders,
        defaultCapacityProviderStrategy: cluster.defaultCapacityProviderStrategy,
        settings: cluster.settings,
        statistics: cluster.statistics,
      },
      tags
    );
  }

  private mapService(service: Service): Resource {
    const tags = this.parseTagsLowercase(service.tags);

    return this.createResource(
      service.serviceArn || '',
      'service',
      service.serviceName || '',
      {
        serviceName: service.serviceName,
        serviceArn: service.serviceArn,
        clusterArn: service.clusterArn,
        status: service.status,
        desiredCount: service.desiredCount,
        runningCount: service.runningCount,
        pendingCount: service.pendingCount,
        launchType: service.launchType,
        capacityProviderStrategy: service.capacityProviderStrategy,
        taskDefinition: service.taskDefinition,
        deploymentConfiguration: service.deploymentConfiguration,
        loadBalancers: service.loadBalancers?.map((lb) => ({
          targetGroupArn: lb.targetGroupArn,
          loadBalancerName: lb.loadBalancerName,
          containerName: lb.containerName,
          containerPort: lb.containerPort,
        })),
        networkConfiguration: service.networkConfiguration?.awsvpcConfiguration
          ? {
              subnets: service.networkConfiguration.awsvpcConfiguration.subnets,
              securityGroups: service.networkConfiguration.awsvpcConfiguration.securityGroups,
              assignPublicIp: service.networkConfiguration.awsvpcConfiguration.assignPublicIp,
            }
          : undefined,
        roleArn: service.roleArn,
        createdAt: service.createdAt?.toISOString(),
        schedulingStrategy: service.schedulingStrategy,
        deploymentController: service.deploymentController?.type,
        platformVersion: service.platformVersion,
        platformFamily: service.platformFamily,
      },
      tags,
      service.createdAt?.toISOString()
    );
  }

  private mapTask(task: Task): Resource {
    const tags = this.parseTagsLowercase(task.tags);

    return this.createResource(
      task.taskArn || '',
      'task',
      task.taskArn?.split('/').pop() || '',
      {
        taskArn: task.taskArn,
        clusterArn: task.clusterArn,
        taskDefinitionArn: task.taskDefinitionArn,
        containerInstanceArn: task.containerInstanceArn,
        lastStatus: task.lastStatus,
        desiredStatus: task.desiredStatus,
        healthStatus: task.healthStatus,
        launchType: task.launchType,
        capacityProviderName: task.capacityProviderName,
        cpu: task.cpu,
        memory: task.memory,
        group: task.group,
        startedBy: task.startedBy,
        startedAt: task.startedAt?.toISOString(),
        stoppedAt: task.stoppedAt?.toISOString(),
        stoppedReason: task.stoppedReason,
        stopCode: task.stopCode,
        connectivity: task.connectivity,
        platformVersion: task.platformVersion,
        platformFamily: task.platformFamily,
        containers: task.containers?.map((c) => ({
          name: c.name,
          image: c.image,
          lastStatus: c.lastStatus,
          healthStatus: c.healthStatus,
          cpu: c.cpu,
          memory: c.memory,
        })),
      },
      tags,
      task.startedAt?.toISOString()
    );
  }

  private mapTaskDefinition(
    taskDef: TaskDefinition,
    tags: { key?: string; value?: string }[]
  ): Resource {
    const parsedTags = this.parseTagsLowercase(tags);

    return this.createResource(
      taskDef.taskDefinitionArn || '',
      'task-definition',
      `${taskDef.family}:${taskDef.revision}`,
      {
        family: taskDef.family,
        taskDefinitionArn: taskDef.taskDefinitionArn,
        revision: taskDef.revision,
        status: taskDef.status,
        compatibilities: taskDef.compatibilities,
        requiresCompatibilities: taskDef.requiresCompatibilities,
        cpu: taskDef.cpu,
        memory: taskDef.memory,
        networkMode: taskDef.networkMode,
        executionRoleArn: taskDef.executionRoleArn,
        taskRoleArn: taskDef.taskRoleArn,
        containerDefinitions: taskDef.containerDefinitions?.map((c) => ({
          name: c.name,
          image: c.image,
          cpu: c.cpu,
          memory: c.memory,
          memoryReservation: c.memoryReservation,
          essential: c.essential,
          portMappings: c.portMappings,
        })),
        volumes: taskDef.volumes?.map((v) => ({
          name: v.name,
          host: v.host,
          efsVolumeConfiguration: v.efsVolumeConfiguration
            ? {
                fileSystemId: v.efsVolumeConfiguration.fileSystemId,
                rootDirectory: v.efsVolumeConfiguration.rootDirectory,
              }
            : undefined,
        })),
        runtimePlatform: taskDef.runtimePlatform,
        registeredAt: taskDef.registeredAt?.toISOString(),
      },
      parsedTags,
      taskDef.registeredAt?.toISOString()
    );
  }
}

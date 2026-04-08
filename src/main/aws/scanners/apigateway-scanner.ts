// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  GetRestApisCommand,
  GetResourcesCommand,
  type RestApi,
} from '@aws-sdk/client-api-gateway';
import {
  GetApisCommand,
  GetRoutesCommand,
  GetIntegrationsCommand,
  type Api,
} from '@aws-sdk/client-apigatewayv2';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class APIGatewayScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'apigateway', 'apigateway');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];

    // Scan REST APIs (API Gateway v1)
    try {
      const restApis = await this.scanRestApis();
      resources.push(...restApis);
    } catch (error) {
      errors.push(this.createError('GetRestApis', error));
    }

    // Scan HTTP/WebSocket APIs (API Gateway v2)
    try {
      const httpApis = await this.scanHttpApis();
      resources.push(...httpApis);
    } catch (error) {
      errors.push(this.createError('GetApis', error));
    }

    return { resources, errors };
  }

  private async scanRestApis(): Promise<Resource[]> {
    const resources: Resource[] = [];
    const client = getClientFactory().getAPIGatewayClient({
      profile: this.config.profile,
      region: this.config.region,
    });

    let position: string | undefined;

    do {
      const response = await this.withRateLimit(() =>
        client.send(new GetRestApisCommand({ position }))
      );

      if (response.items) {
        for (const api of response.items) {
          // Get resources for this API
          let apiResources: unknown[] = [];
          try {
            const resourcesResponse = await this.withRateLimit(() =>
              client.send(
                new GetResourcesCommand({
                  restApiId: api.id,
                })
              )
            );
            apiResources = resourcesResponse.items || [];
          } catch {
            // Ignore errors getting resources
          }

          resources.push(this.mapRestApi(api, apiResources));
        }
      }

      position = response.position;
    } while (position);

    return resources;
  }

  private async scanHttpApis(): Promise<Resource[]> {
    const resources: Resource[] = [];
    const client = getClientFactory().getAPIGatewayV2Client({
      profile: this.config.profile,
      region: this.config.region,
    });

    let nextToken: string | undefined;

    do {
      const response = await this.withRateLimit(() =>
        client.send(new GetApisCommand({ NextToken: nextToken }))
      );

      if (response.Items) {
        for (const api of response.Items) {
          // Get routes for this API
          let routes: unknown[] = [];
          try {
            const routesResponse = await this.withRateLimit(() =>
              client.send(new GetRoutesCommand({ ApiId: api.ApiId }))
            );
            routes = routesResponse.Items || [];
          } catch {
            // Ignore errors getting routes
          }

          // Get integrations for this API
          let integrations: unknown[] = [];
          try {
            const integrationsResponse = await this.withRateLimit(() =>
              client.send(new GetIntegrationsCommand({ ApiId: api.ApiId }))
            );
            integrations = integrationsResponse.Items || [];
          } catch {
            // Ignore errors getting integrations
          }

          resources.push(this.mapHttpApi(api, routes, integrations));
        }
      }

      nextToken = response.NextToken;
    } while (nextToken);

    return resources;
  }

  private mapRestApi(api: RestApi, apiResources: unknown[]): Resource {
    const arn = `arn:aws:apigateway:${this.config.region}::/restapis/${api.id}`;
    const tags = api.tags || {};

    return this.createResource(
      arn,
      'rest-api',
      api.name || '',
      {
        id: api.id,
        name: api.name,
        description: api.description,
        createdDate: api.createdDate?.toISOString(),
        version: api.version,
        apiKeySource: api.apiKeySource,
        endpointConfiguration: api.endpointConfiguration
          ? {
              types: api.endpointConfiguration.types,
              vpcEndpointIds: api.endpointConfiguration.vpcEndpointIds,
            }
          : undefined,
        policy: api.policy,
        minimumCompressionSize: api.minimumCompressionSize,
        disableExecuteApiEndpoint: api.disableExecuteApiEndpoint,
        resourceCount: apiResources.length,
        resources: (apiResources as Array<{ path?: string; id?: string }>).map((r) => ({
          path: r.path,
          id: r.id,
        })),
      },
      tags as Record<string, string>,
      api.createdDate?.toISOString()
    );
  }

  private mapHttpApi(
    api: Api,
    routes: unknown[],
    integrations: unknown[]
  ): Resource {
    const arn = `arn:aws:apigateway:${this.config.region}::/apis/${api.ApiId}`;
    const tags = api.Tags || {};

    return this.createResource(
      arn,
      'http-api',
      api.Name || '',
      {
        apiId: api.ApiId,
        name: api.Name,
        description: api.Description,
        apiEndpoint: api.ApiEndpoint,
        apiGatewayManaged: api.ApiGatewayManaged,
        apiKeySelectionExpression: api.ApiKeySelectionExpression,
        corsConfiguration: api.CorsConfiguration
          ? {
              allowCredentials: api.CorsConfiguration.AllowCredentials,
              allowHeaders: api.CorsConfiguration.AllowHeaders,
              allowMethods: api.CorsConfiguration.AllowMethods,
              allowOrigins: api.CorsConfiguration.AllowOrigins,
              exposeHeaders: api.CorsConfiguration.ExposeHeaders,
              maxAge: api.CorsConfiguration.MaxAge,
            }
          : undefined,
        createdDate: api.CreatedDate?.toISOString(),
        disableExecuteApiEndpoint: api.DisableExecuteApiEndpoint,
        disableSchemaValidation: api.DisableSchemaValidation,
        protocolType: api.ProtocolType,
        routeSelectionExpression: api.RouteSelectionExpression,
        version: api.Version,
        routeCount: routes.length,
        routes: (routes as Array<{ RouteKey?: string; RouteId?: string; Target?: string }>).map((r) => ({
          routeKey: r.RouteKey,
          routeId: r.RouteId,
          target: r.Target,
        })),
        integrationCount: integrations.length,
        integrations: (integrations as Array<{
          IntegrationId?: string;
          IntegrationType?: string;
          IntegrationUri?: string;
        }>).map((i) => ({
          integrationId: i.IntegrationId,
          integrationType: i.IntegrationType,
          integrationUri: i.IntegrationUri,
        })),
      },
      tags as Record<string, string>,
      api.CreatedDate?.toISOString()
    );
  }
}

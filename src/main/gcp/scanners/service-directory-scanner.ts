// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GCPBaseScanner, GCPScannerConfig, GCPScanResult } from './base-scanner';
import { getGCPClientFactory } from '../client-factory';

export class ServiceDirectoryScanner extends GCPBaseScanner {
  constructor(config: GCPScannerConfig) {
    super(config, 'service-directory', 'Service Directory');
  }

  async scan(): Promise<GCPScanResult> {
    const resources: GCPScanResult['resources'] = [];
    const errors: GCPScanResult['errors'] = [];
    const factory = getGCPClientFactory(this.config.projectId);
    const client = factory.getServiceDirectoryClient();

    try {
      // List namespaces across all locations using the wildcard location "-"
      const parent = `projects/${this.config.projectId}/locations/-`;
      const [namespaces] = await client.listNamespaces({ parent });

      for (const ns of namespaces) {
        const nsName = ns.name || '';
        // Extract region from namespace name: projects/{project}/locations/{location}/namespaces/{ns}
        const locationMatch = nsName.match(/\/locations\/([^/]+)/);
        const region = locationMatch ? locationMatch[1] : 'global';

        resources.push(this.createResource(
          nsName,
          'namespace',
          nsName.split('/').pop() || '',
          region,
          {
            name: nsName,
            labels: ns.labels,
          },
          this.parseLabels(ns.labels as Record<string, string>),
        ));

        // List services within this namespace
        try {
          const [services] = await client.listServices({ parent: nsName });

          for (const svc of services) {
            const svcName = svc.name || '';
            const svcShortName = svcName.split('/').pop() || '';

            // List endpoints for this service
            let endpoints: unknown[] = [];
            try {
              const [eps] = await client.listEndpoints({ parent: svcName });
              endpoints = eps.map((ep) => ({
                name: ep.name,
                address: ep.address,
                port: ep.port,
                annotations: ep.annotations,
              }));
            } catch (epErr) {
              errors.push(this.createError(`listEndpoints:${svcShortName}`, epErr));
            }

            resources.push(this.createResource(
              svcName,
              'service',
              svcShortName,
              region,
              {
                name: svcName,
                endpoints,
                annotations: svc.annotations,
              },
              this.parseLabels(svc.annotations as Record<string, string>),
            ));
          }
        } catch (svcErr) {
          if (!this.isApiNotEnabled(svcErr)) {
            errors.push(this.createError(`listServices:${nsName}`, svcErr));
          }
        }
      }
    } catch (error) {
      if (!this.isApiNotEnabled(error)) {
        errors.push(this.createError('listNamespaces', error));
      }
    }

    return { resources, errors };
  }
}

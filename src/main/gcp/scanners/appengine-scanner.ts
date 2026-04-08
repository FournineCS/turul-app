// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GCPBaseScanner, GCPScannerConfig, GCPScanResult } from './base-scanner';
import { google } from 'googleapis';

export class AppEngineScanner extends GCPBaseScanner {
  constructor(config: GCPScannerConfig) {
    super(config, 'app-engine', 'App Engine');
  }

  async scan(): Promise<GCPScanResult> {
    const resources: GCPScanResult['resources'] = [];
    const errors: GCPScanResult['errors'] = [];

    try {
      const auth = new google.auth.GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      });
      const appengine = google.appengine({ version: 'v1', auth });
      const projectId = this.config.projectId;

      // List App Engine services
      const servicesResponse = await appengine.apps.services.list({
        appsId: projectId,
      });

      const services = servicesResponse.data.services || [];

      for (const service of services) {
        const serviceName = service.name || '';
        // Service name format: apps/{app}/services/{service}
        const serviceId = service.id || serviceName.split('/').pop() || '';

        resources.push(this.createResource(
          serviceName || `apps/${projectId}/services/${serviceId}`,
          'service',
          serviceId,
          'global',
          {
            name: serviceId,
            id: service.id,
            split: service.split,
          },
          {},
        ));

        // List versions for each service
        try {
          const versionsResponse = await appengine.apps.services.versions.list({
            appsId: projectId,
            servicesId: serviceId,
          });

          const versions = versionsResponse.data.versions || [];

          for (const version of versions) {
            const versionName = version.name || '';
            // Version name format: apps/{app}/services/{service}/versions/{version}
            const versionId = version.id || versionName.split('/').pop() || '';

            resources.push(this.createResource(
              versionName || `apps/${projectId}/services/${serviceId}/versions/${versionId}`,
              'version',
              `${serviceId}/${versionId}`,
              'global',
              {
                name: versionId,
                id: version.id,
                servingStatus: version.servingStatus,
                runtime: version.runtime,
                env: version.env,
                instanceClass: version.instanceClass,
                threadsafe: version.threadsafe,
                versionUrl: version.versionUrl,
                createTime: version.createTime,
                diskUsageBytes: version.diskUsageBytes,
                automaticScaling: version.automaticScaling,
                basicScaling: version.basicScaling,
                manualScaling: version.manualScaling,
              },
              {},
              this.parseTimestamp(version.createTime as string),
            ));
          }
        } catch (versionError) {
          if (!this.isApiNotEnabled(versionError)) {
            errors.push(this.createError(`listVersions:${serviceId}`, versionError));
          }
        }
      }
    } catch (error) {
      if (!this.isApiNotEnabled(error)) {
        errors.push(this.createError('listServices', error));
      }
    }

    return { resources, errors };
  }
}

// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { GCPBaseScanner, GCPScannerConfig, GCPScanResult } from './base-scanner';
import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';

export class FirebaseScanner extends GCPBaseScanner {
  constructor(config: GCPScannerConfig) {
    super(config, 'firebase', 'Firebase');
  }

  async scan(): Promise<GCPScanResult> {
    const resources: GCPScanResult['resources'] = [];
    const errors: GCPScanResult['errors'] = [];

    try {
      const auth = new GoogleAuth({
        scopes: ['https://www.googleapis.com/auth/cloud-platform'],
      });
      const authClient = await auth.getClient();
      const firebase = google.firebase({ version: 'v1beta1', auth: authClient as any });
      const projectId = this.config.projectId;

      // Get Firebase project
      try {
        const projectResponse = await firebase.projects.get({
          name: `projects/${projectId}`,
        });

        if (projectResponse.data) {
          const project = projectResponse.data;
          resources.push(this.createResource(
            `projects/${projectId}`,
            'project',
            project.displayName || projectId,
            'global',
            {
              projectId: project.projectId,
              displayName: project.displayName,
              projectNumber: project.projectNumber,
              state: project.state,
              resources: project.resources,
            },
            {},
          ));
        }
      } catch (error) {
        if (!this.isApiNotEnabled(error)) {
          errors.push(this.createError('projects.get', error));
        }
      }

      // List web apps
      try {
        const webResponse = await firebase.projects.webApps.list({
          parent: `projects/${projectId}`,
        });

        const webApps = webResponse.data.apps || [];

        for (const app of webApps) {
          const appName = app.name || '';
          const nameParts = appName.split('/');
          const shortName = nameParts[nameParts.length - 1] || appName;

          resources.push(this.createResource(
            appName,
            'web-app',
            app.displayName || shortName,
            'global',
            {
              name: appName,
              displayName: app.displayName,
              appId: app.appId,
              appUrls: app.appUrls,
              state: app.state,
            },
            {},
          ));
        }
      } catch (error) {
        if (!this.isApiNotEnabled(error)) {
          errors.push(this.createError('projects.webApps.list', error));
        }
      }

      // List Android apps
      try {
        const androidResponse = await firebase.projects.androidApps.list({
          parent: `projects/${projectId}`,
        });

        const androidApps = androidResponse.data.apps || [];

        for (const app of androidApps) {
          const appName = app.name || '';
          const nameParts = appName.split('/');
          const shortName = nameParts[nameParts.length - 1] || appName;

          resources.push(this.createResource(
            appName,
            'android-app',
            app.displayName || shortName,
            'global',
            {
              name: appName,
              displayName: app.displayName,
              appId: app.appId,
              packageName: app.packageName,
              state: app.state,
            },
            {},
          ));
        }
      } catch (error) {
        if (!this.isApiNotEnabled(error)) {
          errors.push(this.createError('projects.androidApps.list', error));
        }
      }

      // List iOS apps
      try {
        const iosResponse = await firebase.projects.iosApps.list({
          parent: `projects/${projectId}`,
        });

        const iosApps = iosResponse.data.apps || [];

        for (const app of iosApps) {
          const appName = app.name || '';
          const nameParts = appName.split('/');
          const shortName = nameParts[nameParts.length - 1] || appName;

          resources.push(this.createResource(
            appName,
            'ios-app',
            app.displayName || shortName,
            'global',
            {
              name: appName,
              displayName: app.displayName,
              appId: app.appId,
              bundleId: app.bundleId,
              state: app.state,
            },
            {},
          ));
        }
      } catch (error) {
        if (!this.isApiNotEnabled(error)) {
          errors.push(this.createError('projects.iosApps.list', error));
        }
      }
    } catch (error) {
      if (!this.isApiNotEnabled(error)) {
        errors.push(this.createError('auth', error));
      }
    }

    return { resources, errors };
  }
}

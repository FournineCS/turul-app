// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';
import { GCPCrossProjectBinding } from './types';

export async function findCrossProjectBindings(projectId: string): Promise<GCPCrossProjectBinding[]> {
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  const crm = google.cloudresourcemanager({ version: 'v1', auth });

  const response = await crm.projects.getIamPolicy({
    resource: projectId,
    requestBody: {},
  });

  const bindings = response.data.bindings || [];
  const results: GCPCrossProjectBinding[] = [];

  for (const binding of bindings) {
    for (const member of binding.members || []) {
      // Check service accounts from other projects
      // SA emails follow pattern: name@PROJECT_ID.iam.gserviceaccount.com
      if (member.startsWith('serviceAccount:')) {
        const email = member.replace('serviceAccount:', '');
        const match = email.match(/@(.+)\.iam\.gserviceaccount\.com$/);

        if (match) {
          const memberProjectId = match[1];
          if (memberProjectId !== projectId) {
            results.push({
              sourceProjectId: projectId,
              member,
              memberProjectId,
              role: binding.role || '',
              isExternalProject: true,
            });
          }
        }
      }
    }
  }

  return results;
}

// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';
import { GCPOverlyPermissiveBinding } from './types';

// Primitive roles that grant overly broad access
const PRIMITIVE_ROLES = ['roles/owner', 'roles/editor'];

// Predefined roles that grant admin-level access to sensitive services
const BROAD_PREDEFINED_ROLES = [
  'roles/iam.securityAdmin',
  'roles/iam.serviceAccountAdmin',
  'roles/iam.serviceAccountKeyAdmin',
  'roles/storage.admin',
  'roles/compute.admin',
  'roles/cloudsql.admin',
  'roles/bigquery.admin',
];

export async function findOverlyPermissiveBindings(projectId: string): Promise<GCPOverlyPermissiveBinding[]> {
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  const crm = google.cloudresourcemanager({ version: 'v1', auth });

  const response = await crm.projects.getIamPolicy({
    resource: projectId,
    requestBody: {},
  });

  const bindings = response.data.bindings || [];
  const results: GCPOverlyPermissiveBinding[] = [];

  for (const binding of bindings) {
    const role = binding.role || '';
    const isPrimitive = PRIMITIVE_ROLES.includes(role);
    const isBroad = BROAD_PREDEFINED_ROLES.includes(role);

    if (!isPrimitive && !isBroad) continue;

    for (const member of binding.members || []) {
      const memberType = getMemberType(member);
      const reason = isPrimitive
        ? `Primitive role ${role} grants broad access to all project resources`
        : `Predefined role ${role} grants admin-level access`;

      results.push({
        member,
        memberType,
        role,
        roleType: isPrimitive ? 'primitive' : 'predefined',
        projectId,
        isOrgLevel: false,
        reason,
      });
    }
  }

  return results;
}

function getMemberType(member: string): 'serviceAccount' | 'user' | 'group' | 'domain' {
  if (member.startsWith('serviceAccount:')) return 'serviceAccount';
  if (member.startsWith('group:')) return 'group';
  if (member.startsWith('domain:')) return 'domain';
  return 'user';
}

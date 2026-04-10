// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { ProjectsClient, OrganizationsClient } from '@google-cloud/resource-manager';
import { CloudBillingClient } from '@google-cloud/billing';
import type { GCPProject, GCPOrganization } from '../../shared/types';
import { getGCPAuthManager } from './auth-manager';

function chunkArr<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

let projectManagerInstance: GCPProjectManager | null = null;

export class GCPProjectManager {
  private client: ProjectsClient;

  constructor() {
    this.client = new ProjectsClient();
  }

  async getProjects(): Promise<GCPProject[]> {
    const projects: GCPProject[] = [];

    try {
      const [projectsResponse] = await this.client.searchProjects();

      for (const project of projectsResponse) {
        if (project.projectId && project.state === 'ACTIVE') {
          // Skip system-generated projects (e.g., "Untitled project (sys-...)")
          if (project.projectId.startsWith('sys-')) continue;
          projects.push({
            projectId: project.projectId,
            projectName: project.displayName || project.projectId,
            projectNumber: project.name?.replace('projects/', '') || undefined,
            state: project.state != null ? String(project.state) : undefined,
            labels: (project.labels as Record<string, string>) || undefined,
          });
        }
      }
    } catch (error) {
      if (this.isApiNotEnabledError(error)) {
        console.warn('[project-manager] Cloud Resource Manager API not enabled on quota project, falling back to REST API');
        return this.getProjectsViaRest();
      }
      console.error('Error listing GCP projects:', error);
      throw error;
    }

    return projects.sort((a, b) => a.projectName.localeCompare(b.projectName));
  }

  private isApiNotEnabledError(error: unknown): boolean {
    const msg = error instanceof Error ? error.message : String(error);
    return (
      msg.includes('PERMISSION_DENIED') &&
      (msg.includes('has not been used') || msg.includes('is disabled'))
    );
  }

  /**
   * Fallback: list projects via the v1 REST API using ADC token directly.
   * This avoids the quota-project issue that the SDK's searchProjects() hits.
   */
  private async getProjectsViaRest(): Promise<GCPProject[]> {
    const auth = getGCPAuthManager().getAuth();
    const client = await auth.getClient();
    const projects: GCPProject[] = [];
    let pageToken: string | undefined;

    do {
      const url = new URL('https://cloudresourcemanager.googleapis.com/v1/projects');
      url.searchParams.set('filter', 'lifecycleState:ACTIVE');
      if (pageToken) url.searchParams.set('pageToken', pageToken);

      const { token } = await client.getAccessToken();
      const res = await fetch(url.toString(), {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (!res.ok) {
        throw new Error(`REST API error ${res.status}: ${await res.text()}`);
      }
      const data = await res.json() as {
        projects?: Array<{
          projectId?: string;
          name?: string;
          projectNumber?: string;
          lifecycleState?: string;
          labels?: Record<string, string>;
        }>;
        nextPageToken?: string;
      };

      for (const p of data.projects || []) {
        if (p.projectId && !p.projectId.startsWith('sys-')) {
          projects.push({
            projectId: p.projectId,
            projectName: p.name || p.projectId,
            projectNumber: p.projectNumber || undefined,
            state: p.lifecycleState || undefined,
            labels: p.labels || undefined,
          });
        }
      }

      pageToken = data.nextPageToken;
    } while (pageToken);

    return projects.sort((a, b) => a.projectName.localeCompare(b.projectName));
  }

  async getProjectsWithBillingEnabled(): Promise<GCPProject[]> {
    const all = await this.getProjects();
    const billingClient = new CloudBillingClient();
    const CONCURRENCY = 10;

    const enabled: GCPProject[] = [];
    for (const batch of chunkArr(all, CONCURRENCY)) {
      const results = await Promise.allSettled(
        batch.map(async (p) => {
          const [info] = await billingClient.getProjectBillingInfo({ name: `projects/${p.projectId}` });
          return { project: p, billingEnabled: !!info.billingEnabled };
        })
      );
      results.forEach((r, i) => {
        if (r.status === 'fulfilled' && r.value.billingEnabled) {
          enabled.push(r.value.project);
        } else if (r.status === 'rejected') {
          // Fail open: include the project if billing check fails (e.g. missing IAM)
          console.warn(`[billing-filter] Failed to check billing for ${batch[i].projectId}, including it anyway:`, r.reason);
          enabled.push(batch[i]);
        }
      });
    }

    console.log(`[billing-filter] ${enabled.length} projects with billing enabled (filtered from ${all.length} total)`);
    return enabled;
  }

  async getOrganizations(): Promise<GCPOrganization[]> {
    const orgs: GCPOrganization[] = [];
    try {
      const orgClient = new OrganizationsClient();
      const [response] = await orgClient.searchOrganizations();
      for (const org of response) {
        orgs.push({
          organizationId: org.name?.replace('organizations/', '') || '',
          displayName: org.displayName || org.name || '',
        });
      }
    } catch (error) {
      if (this.isApiNotEnabledError(error)) {
        console.warn('[project-manager] CRM API not enabled on quota project for orgs, falling back to REST');
        return this.getOrganizationsViaRest();
      }
      // User may not have org-level access — return empty list
    }
    return orgs;
  }

  private async getOrganizationsViaRest(): Promise<GCPOrganization[]> {
    const auth = getGCPAuthManager().getAuth();
    const client = await auth.getClient();
    const { token } = await client.getAccessToken();
    const orgs: GCPOrganization[] = [];

    try {
      const url = 'https://cloudresourcemanager.googleapis.com/v1/organizations:search';
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        throw new Error(`REST API error ${res.status}: ${await res.text()}`);
      }
      const data = await res.json() as {
        organizations?: Array<{
          name?: string;
          displayName?: string;
        }>;
      };

      for (const org of data.organizations || []) {
        orgs.push({
          organizationId: org.name?.replace('organizations/', '') || '',
          displayName: org.displayName || org.name || '',
        });
      }
    } catch {
      // User may not have org-level access — return empty list
    }

    return orgs;
  }

  async validateProject(projectId: string): Promise<GCPProject | null> {
    try {
      const [project] = await this.client.getProject({
        name: `projects/${projectId}`,
      });

      if (project && project.projectId) {
        return {
          projectId: project.projectId,
          projectName: project.displayName || project.projectId,
          projectNumber: project.name?.replace('projects/', '') || undefined,
          state: project.state != null ? String(project.state) : undefined,
          labels: (project.labels as Record<string, string>) || undefined,
        };
      }
      return null;
    } catch (error) {
      console.error(`Error validating project ${projectId}:`, error);
      return null;
    }
  }
}

export function getGCPProjectManager(): GCPProjectManager {
  if (!projectManagerInstance) {
    projectManagerInstance = new GCPProjectManager();
  }
  return projectManagerInstance;
}

/** Reset the singleton so a fresh client (with updated credentials) is created on next use */
export function resetGCPProjectManager(): void {
  projectManagerInstance = null;
}

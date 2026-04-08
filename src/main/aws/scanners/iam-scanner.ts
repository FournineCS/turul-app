// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  ListUsersCommand,
  ListRolesCommand,
  ListPoliciesCommand,
  ListGroupsCommand,
  ListMFADevicesCommand,
  ListAttachedRolePoliciesCommand,
  ListAttachedUserPoliciesCommand,
} from '@aws-sdk/client-iam';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class IAMScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'iam', 'iam');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];

    const [usersResult, rolesResult, policiesResult, groupsResult] = await Promise.allSettled([
      this.scanUsers(),
      this.scanRoles(),
      this.scanPolicies(),
      this.scanGroups(),
    ]);

    if (usersResult.status === 'fulfilled') {
      resources.push(...usersResult.value.resources);
      errors.push(...usersResult.value.errors);
    } else {
      errors.push(this.createError('ListUsers', usersResult.reason));
    }

    if (rolesResult.status === 'fulfilled') {
      resources.push(...rolesResult.value.resources);
      errors.push(...rolesResult.value.errors);
    } else {
      errors.push(this.createError('ListRoles', rolesResult.reason));
    }

    if (policiesResult.status === 'fulfilled') {
      resources.push(...policiesResult.value.resources);
      errors.push(...policiesResult.value.errors);
    } else {
      errors.push(this.createError('ListPolicies', policiesResult.reason));
    }

    if (groupsResult.status === 'fulfilled') {
      resources.push(...groupsResult.value.resources);
      errors.push(...groupsResult.value.errors);
    } else {
      errors.push(this.createError('ListGroups', groupsResult.reason));
    }

    return { resources, errors };
  }

  private async scanUsers(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getIAMClient({
      profile: this.config.profile,
      region: this.config.region,
    });

    try {
      let marker: string | undefined;

      do {
        const response = await this.withRateLimit(() =>
          client.send(new ListUsersCommand({ Marker: marker }))
        );

        if (response.Users) {
          for (const user of response.Users) {
            if (!user.Arn) continue;

            let hasMFA = false;
            try {
              const mfaResponse = await this.withRateLimit(() =>
                client.send(new ListMFADevicesCommand({ UserName: user.UserName }))
              );
              hasMFA = (mfaResponse.MFADevices?.length || 0) > 0;
            } catch {
              // Ignore MFA check errors
            }

            let attachedPolicies: string[] = [];
            try {
              const policiesResp = await this.withRateLimit(() =>
                client.send(new ListAttachedUserPoliciesCommand({ UserName: user.UserName }))
              );
              attachedPolicies = (policiesResp.AttachedPolicies || []).map(p => p.PolicyName || '');
            } catch {
              // Ignore attached policy errors
            }

            resources.push(this.createResource(
              user.Arn,
              'user',
              user.UserName || '',
              {
                userName: user.UserName,
                userId: user.UserId,
                path: user.Path,
                hasMFA,
                attachedPolicies,
                passwordLastUsed: user.PasswordLastUsed?.toISOString(),
              },
              {},
              user.CreateDate?.toISOString()
            ));
          }
        }

        marker = response.IsTruncated ? response.Marker : undefined;
      } while (marker);
    } catch (error) {
      errors.push(this.createError('ListUsers', error));
    }

    return { resources, errors };
  }

  private async scanRoles(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getIAMClient({
      profile: this.config.profile,
      region: this.config.region,
    });

    try {
      let marker: string | undefined;

      do {
        const response = await this.withRateLimit(() =>
          client.send(new ListRolesCommand({ Marker: marker }))
        );

        if (response.Roles) {
          for (const role of response.Roles) {
            if (!role.Arn) continue;

            // Skip AWS-managed service-linked roles
            if (role.Path?.startsWith('/aws-service-role/')) continue;

            let attachedPolicies: string[] = [];
            try {
              const policiesResp = await this.withRateLimit(() =>
                client.send(new ListAttachedRolePoliciesCommand({ RoleName: role.RoleName }))
              );
              attachedPolicies = (policiesResp.AttachedPolicies || []).map(p => p.PolicyName || '');
            } catch {
              // Ignore attached policy errors
            }

            let assumeRolePolicy: unknown;
            try {
              if (role.AssumeRolePolicyDocument) {
                assumeRolePolicy = JSON.parse(decodeURIComponent(role.AssumeRolePolicyDocument));
              }
            } catch {
              // Ignore parse errors
            }

            resources.push(this.createResource(
              role.Arn,
              'role',
              role.RoleName || '',
              {
                roleName: role.RoleName,
                roleId: role.RoleId,
                path: role.Path,
                description: role.Description,
                maxSessionDuration: role.MaxSessionDuration,
                attachedPolicies,
                assumeRolePolicy,
              },
              {},
              role.CreateDate?.toISOString()
            ));
          }
        }

        marker = response.IsTruncated ? response.Marker : undefined;
      } while (marker);
    } catch (error) {
      errors.push(this.createError('ListRoles', error));
    }

    return { resources, errors };
  }

  private async scanPolicies(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getIAMClient({
      profile: this.config.profile,
      region: this.config.region,
    });

    try {
      let marker: string | undefined;

      do {
        const response = await this.withRateLimit(() =>
          client.send(new ListPoliciesCommand({ Scope: 'Local', Marker: marker }))
        );

        if (response.Policies) {
          for (const policy of response.Policies) {
            if (!policy.Arn) continue;

            // Skip AWS-managed policies (extra safety — Scope:'Local' should already exclude them)
            if (policy.Arn.startsWith('arn:aws:iam::aws:policy/')) continue;

            resources.push(this.createResource(
              policy.Arn,
              'policy',
              policy.PolicyName || '',
              {
                policyName: policy.PolicyName,
                policyId: policy.PolicyId,
                path: policy.Path,
                description: policy.Description,
                attachmentCount: policy.AttachmentCount,
                isAttachable: policy.IsAttachable,
                defaultVersionId: policy.DefaultVersionId,
              },
              {},
              policy.CreateDate?.toISOString()
            ));
          }
        }

        marker = response.IsTruncated ? response.Marker : undefined;
      } while (marker);
    } catch (error) {
      errors.push(this.createError('ListPolicies', error));
    }

    return { resources, errors };
  }

  private async scanGroups(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getIAMClient({
      profile: this.config.profile,
      region: this.config.region,
    });

    try {
      let marker: string | undefined;

      do {
        const response = await this.withRateLimit(() =>
          client.send(new ListGroupsCommand({ Marker: marker }))
        );

        if (response.Groups) {
          for (const group of response.Groups) {
            if (!group.Arn) continue;

            resources.push(this.createResource(
              group.Arn,
              'group',
              group.GroupName || '',
              {
                groupName: group.GroupName,
                groupId: group.GroupId,
                path: group.Path,
              },
              {},
              group.CreateDate?.toISOString()
            ));
          }
        }

        marker = response.IsTruncated ? response.Marker : undefined;
      } while (marker);
    } catch (error) {
      errors.push(this.createError('ListGroups', error));
    }

    return { resources, errors };
  }
}

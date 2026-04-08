// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  ListPoliciesCommand,
  GetPolicyCommand,
  ListComplianceStatusCommand,
} from '@aws-sdk/client-fms';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class FMSScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'fms', 'fms');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getFMSClient({
      profile: this.config.profile,
      region: this.config.region,
    });

    try {
      let nextToken: string | undefined;

      do {
        const response = await this.withRateLimit(() =>
          client.send(new ListPoliciesCommand({ NextToken: nextToken }))
        );

        if (response.PolicyList) {
          for (const policySummary of response.PolicyList) {
            if (!policySummary.PolicyArn || !policySummary.PolicyId) continue;

            let details: Record<string, unknown> = {
              policyId: policySummary.PolicyId,
              policyName: policySummary.PolicyName,
              resourceType: policySummary.ResourceType,
              securityServiceType: policySummary.SecurityServiceType,
              remediationEnabled: policySummary.RemediationEnabled,
              deleteUnusedFMManagedResources: policySummary.DeleteUnusedFMManagedResources,
            };

            // Get full policy details
            try {
              const policyResp = await this.withRateLimit(() =>
                client.send(new GetPolicyCommand({ PolicyId: policySummary.PolicyId }))
              );

              if (policyResp.Policy) {
                const policy = policyResp.Policy;
                details = {
                  ...details,
                  policyName: policy.PolicyName,
                  resourceType: policy.ResourceType,
                  resourceTypeList: policy.ResourceTypeList,
                  securityServiceType: policy.SecurityServicePolicyData?.Type,
                  remediationEnabled: policy.RemediationEnabled,
                  deleteUnusedFMManagedResources: policy.DeleteUnusedFMManagedResources,
                  excludeResourceTags: policy.ExcludeResourceTags,
                  includeMap: policy.IncludeMap,
                  excludeMap: policy.ExcludeMap,
                  policyDescription: policy.PolicyDescription,
                };
              }
            } catch (error) {
              errors.push(this.createError(`GetPolicy:${policySummary.PolicyId}`, error));
            }

            // Get compliance status for this policy
            try {
              const complianceMembers: Record<string, unknown>[] = [];
              let complianceNextToken: string | undefined;

              do {
                const complianceResp = await this.withRateLimit(() =>
                  client.send(new ListComplianceStatusCommand({
                    PolicyId: policySummary.PolicyId,
                    NextToken: complianceNextToken,
                  }))
                );

                if (complianceResp.PolicyComplianceStatusList) {
                  for (const status of complianceResp.PolicyComplianceStatusList) {
                    complianceMembers.push({
                      memberAccount: status.MemberAccount,
                      complianceStatus: status.EvaluationResults?.map(r => ({
                        complianceStatus: r.ComplianceStatus,
                        violatorCount: r.ViolatorCount,
                        evaluationLimitExceeded: r.EvaluationLimitExceeded,
                      })),
                      lastUpdated: status.LastUpdated?.toISOString(),
                    });
                  }
                }

                complianceNextToken = complianceResp.NextToken;
              } while (complianceNextToken);

              details.complianceStatus = complianceMembers;
              details.complianceMemberCount = complianceMembers.length;
            } catch (error) {
              errors.push(this.createError(`ListComplianceStatus:${policySummary.PolicyId}`, error));
            }

            resources.push(this.createResource(
              policySummary.PolicyArn,
              'policy',
              policySummary.PolicyName || policySummary.PolicyId,
              details,
            ));
          }
        }

        nextToken = response.NextToken;
      } while (nextToken);
    } catch (error) {
      // Handle not being FMS administrator gracefully
      const errorMessage = error instanceof Error ? error.message : String(error);
      if (
        errorMessage.includes('not currently delegated') ||
        errorMessage.includes('AccessDeniedException') ||
        errorMessage.includes('not the Firewall Manager administrator')
      ) {
        errors.push(this.createError('ListPolicies', new Error(
          `FMS scan skipped: this account is not the Firewall Manager administrator. ${errorMessage}`
        )));
      } else {
        errors.push(this.createError('ListPolicies', error));
      }
    }

    return { resources, errors };
  }
}

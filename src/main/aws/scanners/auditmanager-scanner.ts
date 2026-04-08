// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import {
  ListAssessmentsCommand,
  GetAssessmentCommand,
} from '@aws-sdk/client-auditmanager';
import { getClientFactory } from '../client-factory';
import { BaseScanner, type ScannerConfig, type ScanResult } from './base-scanner';
import type { Resource } from '../../../shared/types';

export class AuditManagerScanner extends BaseScanner {
  constructor(config: ScannerConfig) {
    super(config, 'auditmanager', 'auditmanager');
  }

  async scan(): Promise<ScanResult> {
    const resources: Resource[] = [];
    const errors: ScanResult['errors'] = [];
    const client = getClientFactory().getAuditManagerClient({
      profile: this.config.profile,
      region: this.config.region,
    });

    try {
      let nextToken: string | undefined;

      do {
        const response = await this.withRateLimit(() =>
          client.send(new ListAssessmentsCommand({ nextToken }))
        );

        if (response.assessmentMetadata) {
          for (const metadata of response.assessmentMetadata) {
            if (!metadata.id) continue;

            const assessmentId = metadata.id;
            const arn = `arn:aws:auditmanager:${this.config.region}::assessment/${assessmentId}`;

            let details: Record<string, unknown> = {};
            try {
              const assessmentResp = await this.withRateLimit(() =>
                client.send(new GetAssessmentCommand({ assessmentId }))
              );

              const assessment = assessmentResp.assessment;
              if (assessment) {
                details = {
                  assessmentName: assessment.metadata?.name,
                  status: assessment.metadata?.status,
                  frameworkId: assessment.framework?.id,
                  scope: assessment.metadata?.scope ? {
                    awsAccounts: assessment.metadata.scope.awsAccounts?.map(a => ({
                      id: a.id,
                      emailAddress: a.emailAddress,
                      name: a.name,
                    })),
                    awsServices: assessment.metadata.scope.awsServices?.map(s => ({
                      serviceName: s.serviceName,
                    })),
                  } : undefined,
                  roles: assessment.metadata?.roles?.map(r => ({
                    roleType: r.roleType,
                    roleArn: r.roleArn,
                  })),
                  description: assessment.metadata?.description,
                  complianceType: assessment.metadata?.complianceType,
                  assessmentReportsDestination: assessment.metadata?.assessmentReportsDestination ? {
                    destinationType: assessment.metadata.assessmentReportsDestination.destinationType,
                    destination: assessment.metadata.assessmentReportsDestination.destination,
                  } : undefined,
                  frameworkName: assessment.framework?.metadata?.name,
                };
              }
            } catch { /* ignore detail fetch errors */ }

            const name = metadata.name || assessmentId;

            resources.push(this.createResource(
              arn,
              'assessment',
              name,
              {
                assessmentId,
                assessmentName: metadata.name,
                status: metadata.status,
                complianceType: metadata.complianceType,
                creationTime: metadata.creationTime?.toISOString(),
                lastUpdated: metadata.lastUpdated?.toISOString(),
                delegations: metadata.delegations?.map(d => ({
                  id: d.id,
                  assessmentName: d.assessmentName,
                  status: d.status,
                  roleType: d.roleType,
                  roleArn: d.roleArn,
                  controlSetId: d.controlSetId,
                  creationTime: d.creationTime?.toISOString(),
                  lastUpdated: d.lastUpdated?.toISOString(),
                })),
                roles: metadata.roles?.map(r => ({
                  roleType: r.roleType,
                  roleArn: r.roleArn,
                })),
                ...details,
              },
              {},
              metadata.creationTime?.toISOString()
            ));
          }
        }

        nextToken = response.nextToken;
      } while (nextToken);
    } catch (error: unknown) {
      // Gracefully handle when Audit Manager is not enabled in the account/region
      if (this.isServiceNotEnabledException(error)) {
        return { resources, errors };
      }
      errors.push(this.createError('ListAssessments', error));
    }

    return { resources, errors };
  }

  private isServiceNotEnabledException(error: unknown): boolean {
    if (error instanceof Error) {
      return error.name === 'AccessDeniedException'
        || error.message.includes('AWS Audit Manager is not enabled')
        || error.message.includes('not enabled');
    }
    return false;
  }
}

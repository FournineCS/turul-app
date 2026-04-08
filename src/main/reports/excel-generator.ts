// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import ExcelJS from 'exceljs';
import path from 'path';
import type { Scan, Resource, Relationship, ReportConfig } from '../../shared/types';

type ProgressCallback = (progress: { percent: number; stage: string }) => void;

export async function generateExcelReport(
  outputPath: string,
  scan: Scan,
  resources: Resource[],
  relationships: Relationship[],
  config: ReportConfig,
  onProgress: ProgressCallback
): Promise<string> {
  const safeScanId = path.basename(scan.id);
  const filePath = path.join(outputPath, `aws-scan-${safeScanId}.xlsx`);
  const workbook = new ExcelJS.Workbook();

  workbook.creator = 'AWS Resource Analyzer';
  workbook.created = new Date();

  onProgress({ percent: 10, stage: 'Creating workbook' });

  // Summary sheet
  if (config.sections.includes('summary')) {
    const summarySheet = workbook.addWorksheet('Summary');

    // Scan info
    summarySheet.addRow(['AWS Resource Analyzer - Scan Report']);
    summarySheet.addRow([]);
    summarySheet.addRow(['Scan Information']);
    summarySheet.addRow(['Profile', scan.profile]);
    summarySheet.addRow(['Regions', scan.regions.join(', ')]);
    summarySheet.addRow(['Services', scan.services.join(', ')]);
    summarySheet.addRow(['Started', new Date(scan.startedAt).toLocaleString()]);
    summarySheet.addRow(['Completed', scan.completedAt ? new Date(scan.completedAt).toLocaleString() : 'N/A']);
    summarySheet.addRow(['Status', scan.status]);
    summarySheet.addRow(['Total Resources', scan.resourceCount]);
    summarySheet.addRow([]);

    // Resources by service
    summarySheet.addRow(['Resources by Service']);
    const byService = new Map<string, number>();
    for (const resource of resources) {
      const count = byService.get(resource.service) || 0;
      byService.set(resource.service, count + 1);
    }
    for (const [service, count] of byService.entries()) {
      summarySheet.addRow([service, count]);
    }
    summarySheet.addRow([]);

    // Resources by region
    summarySheet.addRow(['Resources by Region']);
    const byRegion = new Map<string, number>();
    for (const resource of resources) {
      const count = byRegion.get(resource.region) || 0;
      byRegion.set(resource.region, count + 1);
    }
    for (const [region, count] of byRegion.entries()) {
      summarySheet.addRow([region, count]);
    }

    // Style the header
    summarySheet.getRow(1).font = { bold: true, size: 16 };
    summarySheet.getRow(3).font = { bold: true };
    summarySheet.getColumn(1).width = 20;
    summarySheet.getColumn(2).width = 50;
  }

  onProgress({ percent: 30, stage: 'Adding resources sheet' });

  // Resources sheet
  if (config.sections.includes('resources')) {
    const resourcesSheet = workbook.addWorksheet('Resources');

    // Header row
    resourcesSheet.addRow([
      'ARN',
      'Name',
      'Service',
      'Type',
      'Region',
      'Created At',
      'Tags',
    ]);

    // Style header
    const headerRow = resourcesSheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' },
    };
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };

    // Add resources
    for (const resource of resources) {
      // Format tags as key=value pairs instead of raw JSON
      const tagsStr = resource.tags
        ? Object.entries(resource.tags).map(([k, v]) => `${k}=${v}`).join('; ')
        : '';
      resourcesSheet.addRow([
        resource.id ?? '',
        resource.name ?? '',
        resource.service ?? '',
        resource.resourceType ?? '',
        resource.region ?? '',
        resource.createdAt ?? '',
        tagsStr,
      ]);
    }

    // Auto-fit columns
    resourcesSheet.columns.forEach((column) => {
      column.width = 25;
    });
    resourcesSheet.getColumn(1).width = 60; // ARN
    resourcesSheet.getColumn(7).width = 60; // Tags

    // Add filters
    resourcesSheet.autoFilter = {
      from: { row: 1, column: 1 },
      to: { row: resources.length + 1, column: 7 },
    };
  }

  onProgress({ percent: 50, stage: 'Adding relationships sheet' });

  // Relationships sheet
  if (config.sections.includes('relationships')) {
    const relSheet = workbook.addWorksheet('Relationships');

    relSheet.addRow(['Source ARN', 'Target ARN', 'Relationship Type']);

    const headerRow = relSheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' },
    };
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };

    for (const rel of relationships) {
      relSheet.addRow([rel.sourceArn, rel.targetArn, rel.relationshipType]);
    }

    relSheet.getColumn(1).width = 60;
    relSheet.getColumn(2).width = 60;
    relSheet.getColumn(3).width = 20;
  }

  onProgress({ percent: 70, stage: 'Adding security groups sheet' });

  // Security Groups sheet
  if (config.sections.includes('security_groups')) {
    const sgSheet = workbook.addWorksheet('Security Groups');
    const securityGroups = resources.filter((r) => r.resourceType === 'security-group');

    sgSheet.addRow([
      'Group ID',
      'Name',
      'VPC ID',
      'Description',
      'Inbound Rules',
      'Outbound Rules',
    ]);

    const headerRow = sgSheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' },
    };
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };

    for (const sg of securityGroups) {
      const inboundRules = sg.data.inboundRules as unknown[];
      const outboundRules = sg.data.outboundRules as unknown[];

      sgSheet.addRow([
        sg.data.groupId as string,
        sg.name,
        sg.data.vpcId as string || '',
        sg.data.description as string || '',
        formatSecurityRules(inboundRules || []),
        formatSecurityRules(outboundRules || []),
      ]);
    }

    sgSheet.getColumn(1).width = 25;
    sgSheet.getColumn(2).width = 25;
    sgSheet.getColumn(3).width = 25;
    sgSheet.getColumn(4).width = 40;
    sgSheet.getColumn(5).width = 50;
    sgSheet.getColumn(6).width = 50;
  }

  onProgress({ percent: 85, stage: 'Adding service-specific sheets' });

  // EC2 Instances sheet
  const instances = resources.filter((r) => r.resourceType === 'instance');
  if (instances.length > 0) {
    const ec2Sheet = workbook.addWorksheet('EC2 Instances');

    ec2Sheet.addRow([
      'Instance ID',
      'Name',
      'State',
      'Type',
      'Region',
      'VPC ID',
      'Subnet ID',
      'Private IP',
      'Public IP',
    ]);

    const headerRow = ec2Sheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' },
    };
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };

    for (const instance of instances) {
      ec2Sheet.addRow([
        instance.data.instanceId as string,
        instance.name,
        instance.data.state as string,
        instance.data.instanceType as string,
        instance.region,
        instance.data.vpcId as string || '',
        instance.data.subnetId as string || '',
        instance.data.privateIpAddress as string || '',
        instance.data.publicIpAddress as string || '',
      ]);
    }

    ec2Sheet.columns.forEach((column) => {
      column.width = 20;
    });
  }

  // VPCs sheet
  const vpcs = resources.filter((r) => r.resourceType === 'vpc');
  if (vpcs.length > 0) {
    const vpcSheet = workbook.addWorksheet('VPCs');

    vpcSheet.addRow(['VPC ID', 'Name', 'CIDR Block', 'State', 'Region', 'Is Default']);

    const headerRow = vpcSheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' },
    };
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };

    for (const vpc of vpcs) {
      vpcSheet.addRow([
        vpc.data.vpcId as string,
        vpc.name,
        vpc.data.cidrBlock as string,
        vpc.data.state as string,
        vpc.region,
        vpc.data.isDefault ? 'Yes' : 'No',
      ]);
    }

    vpcSheet.columns.forEach((column) => {
      column.width = 20;
    });
  }

  onProgress({ percent: 95, stage: 'Saving workbook' });

  await workbook.xlsx.writeFile(filePath);

  onProgress({ percent: 100, stage: 'Complete' });

  return filePath;
}

function formatSecurityRules(rules: unknown[]): string {
  return rules
    .slice(0, 5)
    .map((rule: unknown) => {
      const r = rule as { protocol: string; fromPort: number; toPort: number; ipRanges?: string[] };
      const ports = r.fromPort === r.toPort ? r.fromPort : `${r.fromPort}-${r.toPort}`;
      const sources = r.ipRanges?.join(', ') || 'All';
      return `${r.protocol} ${ports} (${sources})`;
    })
    .join('\n');
}

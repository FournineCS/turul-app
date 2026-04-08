// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import type { Scan, Resource, ReportConfig } from '../../shared/types';

type ProgressCallback = (progress: { percent: number; stage: string }) => void;

export async function generateCsvReport(
  outputPath: string,
  scan: Scan,
  resources: Resource[],
  config: ReportConfig,
  onProgress: ProgressCallback
): Promise<string> {
  // Validate scan.id to prevent path traversal
  const safeScanId = path.basename(scan.id);
  const scanDir = path.join(outputPath, `aws-scan-${safeScanId}`);

  // Create output directory
  await mkdir(scanDir, { recursive: true });

  onProgress({ percent: 10, stage: 'Creating CSV files' });

  const files: string[] = [];

  // Summary CSV
  if (config.sections.includes('summary')) {
    const summaryPath = path.join(scanDir, 'summary.csv');
    const summaryRows: string[][] = [
      ['AWS Resource Analyzer - Scan Summary'],
      [],
      ['Property', 'Value'],
      ['Profile', scan.profile],
      ['Regions', scan.regions.join('; ')],
      ['Services', scan.services.join('; ')],
      ['Started', new Date(scan.startedAt).toISOString()],
      ['Completed', scan.completedAt ? new Date(scan.completedAt).toISOString() : 'N/A'],
      ['Status', scan.status],
      ['Total Resources', String(scan.resourceCount)],
      [],
      ['Resources by Service'],
      ['Service', 'Count'],
    ];

    // Group by service
    const byService = new Map<string, number>();
    for (const resource of resources) {
      const count = byService.get(resource.service) || 0;
      byService.set(resource.service, count + 1);
    }
    for (const [service, count] of byService.entries()) {
      summaryRows.push([service, String(count)]);
    }

    summaryRows.push([], ['Resources by Region'], ['Region', 'Count']);

    // Group by region
    const byRegion = new Map<string, number>();
    for (const resource of resources) {
      const count = byRegion.get(resource.region) || 0;
      byRegion.set(resource.region, count + 1);
    }
    for (const [region, count] of byRegion.entries()) {
      summaryRows.push([region, String(count)]);
    }

    await writeFile(summaryPath, toCsv(summaryRows), 'utf-8');
    files.push(summaryPath);
  }

  onProgress({ percent: 30, stage: 'Writing resources CSV' });

  // All resources CSV
  if (config.sections.includes('resources')) {
    const resourcesPath = path.join(scanDir, 'resources.csv');
    const resourceRows: string[][] = [
      ['ARN', 'Name', 'Service', 'Type', 'Region', 'Created At', 'Tags'],
    ];

    for (const resource of resources) {
      resourceRows.push([
        resource.id,
        resource.name,
        resource.service,
        resource.resourceType,
        resource.region,
        resource.createdAt || '',
        JSON.stringify(resource.tags),
      ]);
    }

    await writeFile(resourcesPath, toCsv(resourceRows), 'utf-8');
    files.push(resourcesPath);
  }

  onProgress({ percent: 50, stage: 'Writing security groups CSV' });

  // Security Groups CSV
  if (config.sections.includes('security_groups')) {
    const securityGroups = resources.filter((r) => r.resourceType === 'security-group');

    if (securityGroups.length > 0) {
      const sgPath = path.join(scanDir, 'security-groups.csv');
      const sgRows: string[][] = [
        ['Group ID', 'Name', 'VPC ID', 'Description', 'Region', 'Inbound Rules', 'Outbound Rules'],
      ];

      for (const sg of securityGroups) {
        const inboundRules = formatRules(sg.data.inboundRules as unknown[]);
        const outboundRules = formatRules(sg.data.outboundRules as unknown[]);

        sgRows.push([
          sg.data.groupId as string,
          sg.name,
          (sg.data.vpcId as string) || '',
          (sg.data.description as string) || '',
          sg.region,
          inboundRules,
          outboundRules,
        ]);
      }

      await writeFile(sgPath, toCsv(sgRows), 'utf-8');
      files.push(sgPath);
    }
  }

  onProgress({ percent: 70, stage: 'Writing EC2 instances CSV' });

  // EC2 Instances CSV
  const instances = resources.filter((r) => r.resourceType === 'instance');
  if (instances.length > 0) {
    const ec2Path = path.join(scanDir, 'ec2-instances.csv');
    const ec2Rows: string[][] = [
      ['Instance ID', 'Name', 'State', 'Type', 'Region', 'VPC ID', 'Subnet ID', 'Private IP', 'Public IP', 'Platform'],
    ];

    for (const instance of instances) {
      ec2Rows.push([
        instance.data.instanceId as string,
        instance.name,
        instance.data.state as string,
        instance.data.instanceType as string,
        instance.region,
        (instance.data.vpcId as string) || '',
        (instance.data.subnetId as string) || '',
        (instance.data.privateIpAddress as string) || '',
        (instance.data.publicIpAddress as string) || '',
        (instance.data.platform as string) || 'linux',
      ]);
    }

    await writeFile(ec2Path, toCsv(ec2Rows), 'utf-8');
    files.push(ec2Path);
  }

  onProgress({ percent: 85, stage: 'Writing VPCs CSV' });

  // VPCs CSV
  const vpcs = resources.filter((r) => r.resourceType === 'vpc');
  if (vpcs.length > 0) {
    const vpcPath = path.join(scanDir, 'vpcs.csv');
    const vpcRows: string[][] = [
      ['VPC ID', 'Name', 'CIDR Block', 'State', 'Region', 'Is Default'],
    ];

    for (const vpc of vpcs) {
      vpcRows.push([
        vpc.data.vpcId as string,
        vpc.name,
        vpc.data.cidrBlock as string,
        vpc.data.state as string,
        vpc.region,
        vpc.data.isDefault ? 'Yes' : 'No',
      ]);
    }

    await writeFile(vpcPath, toCsv(vpcRows), 'utf-8');
    files.push(vpcPath);
  }

  // Lambda Functions CSV
  const functions = resources.filter((r) => r.resourceType === 'function');
  if (functions.length > 0) {
    const lambdaPath = path.join(scanDir, 'lambda-functions.csv');
    const lambdaRows: string[][] = [
      ['Function Name', 'Runtime', 'Memory (MB)', 'Timeout (s)', 'Region', 'State', 'Last Modified'],
    ];

    for (const func of functions) {
      lambdaRows.push([
        func.data.functionName as string,
        (func.data.runtime as string) || '',
        String(func.data.memorySize || ''),
        String(func.data.timeout || ''),
        func.region,
        (func.data.state as string) || '',
        (func.data.lastModified as string) || '',
      ]);
    }

    await writeFile(lambdaPath, toCsv(lambdaRows), 'utf-8');
    files.push(lambdaPath);
  }

  onProgress({ percent: 95, stage: 'Creating index file' });

  // Create index file listing all CSVs
  const indexPath = path.join(scanDir, 'index.txt');
  const indexContent = [
    `AWS Resource Analyzer - CSV Export`,
    `Scan ID: ${scan.id}`,
    `Generated: ${new Date().toISOString()}`,
    ``,
    `Files:`,
    ...files.map((f) => `  - ${path.basename(f)}`),
  ].join('\n');

  await writeFile(indexPath, indexContent, 'utf-8');

  onProgress({ percent: 100, stage: 'Complete' });

  return scanDir;
}

function sanitizeCell(cell: string | null | undefined): string {
  if (cell == null) return '';
  // Remove null bytes
  cell = cell.replace(/\0/g, '');
  // Prevent CSV formula injection: prefix dangerous leading characters with a single quote
  if (cell.length > 0 && /^[=+\-@\t\r]/.test(cell)) {
    cell = "'" + cell;
  }
  // Escape quotes and wrap in quotes if necessary
  if (cell.includes(',') || cell.includes('"') || cell.includes('\n') || cell.includes("'")) {
    return `"${cell.replace(/"/g, '""')}"`;
  }
  return cell;
}

function toCsv(rows: string[][]): string {
  return rows
    .map((row) => row.map(sanitizeCell).join(','))
    .join('\n');
}

function formatRules(rules: unknown[] | undefined): string {
  if (!rules || rules.length === 0) return '';

  return rules
    .slice(0, 5)
    .map((rule: unknown) => {
      const r = rule as { protocol: string; fromPort: number; toPort: number };
      const ports = r.fromPort === r.toPort ? String(r.fromPort) : `${r.fromPort}-${r.toPort}`;
      return `${r.protocol}:${ports}`;
    })
    .join('; ');
}

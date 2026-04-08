// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import ExcelJS from 'exceljs';
import path from 'path';
import type {
  GCPExpandedRecommendationsResult,
  StoppedVMResult,
  ResourceIdleAnalysisResult,
} from '../../shared/types';

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF1E293B' },
};
const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFE2E8F0' }, size: 11 };
const SUBHEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FF94A3B8' }, size: 10 };

function styleHeaderRow(row: ExcelJS.Row, cols: number) {
  row.font = HEADER_FONT;
  row.fill = HEADER_FILL;
  row.alignment = { vertical: 'middle', horizontal: 'left' };
  row.height = 22;
  for (let i = 1; i <= cols; i++) {
    row.getCell(i).border = {
      bottom: { style: 'thin', color: { argb: 'FF334155' } },
    };
  }
}

export async function generateOptimizationExcel(
  recs: GCPExpandedRecommendationsResult | null,
  vms: StoppedVMResult | null,
  idle: ResourceIdleAnalysisResult | null,
  outputPath: string,
  label: string,
): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Turul - Optimization Export';
  workbook.created = new Date();

  const filePath = path.join(outputPath, `gcp-optimization-${label}-${new Date().toISOString().split('T')[0]}.xlsx`);

  // ── Sheet 1: Summary ──────────────────────────────────────────────────────
  const summary = workbook.addWorksheet('Summary');
  summary.columns = [
    { key: 'label', width: 30 },
    { key: 'value', width: 35 },
  ];

  const titleRow = summary.addRow(['GCP Optimization Export']);
  titleRow.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
  titleRow.fill = HEADER_FILL;
  titleRow.height = 28;
  summary.mergeCells('A1:B1');

  const totalSavings =
    (recs?.totalPotentialSavings ?? 0) +
    (vms?.totalEstimatedMonthlyCost ?? 0) +
    (idle?.estimatedMonthlySavings ?? 0);

  summary.addRow([]);
  summary.addRow(['Scope', label]);
  summary.addRow(['Generated', new Date().toLocaleString()]);
  summary.addRow(['Total Est. Monthly Savings', `$${totalSavings.toFixed(2)}`]);
  summary.addRow(['Recommendations', recs?.recommendations?.length ?? 0]);
  summary.addRow(['Stopped VMs', vms?.vms?.length ?? 0]);
  summary.addRow(['Idle Resources', idle?.findings?.length ?? 0]);

  for (let r = 3; r <= 8; r++) {
    const row = summary.getRow(r);
    row.getCell(1).font = SUBHEADER_FONT;
    row.getCell(2).font = { bold: true, color: { argb: 'FFE2E8F0' } };
    row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: r % 2 === 0 ? 'FF0F172A' : 'FF1E293B' } };
    row.height = 20;
  }

  // ── Sheet 2: Recommendations ──────────────────────────────────────────────
  const recSheet = workbook.addWorksheet('Recommendations');
  recSheet.columns = [
    { key: 'category', header: 'Category', width: 22 },
    { key: 'severity', header: 'Severity', width: 12 },
    { key: 'service', header: 'Service', width: 25 },
    { key: 'description', header: 'Description', width: 55 },
    { key: 'resource', header: 'Resource', width: 35 },
    { key: 'region', header: 'Region', width: 18 },
    { key: 'savings', header: 'Est. Monthly Savings', width: 22 },
    { key: 'action', header: 'Action Required', width: 45 },
  ];
  styleHeaderRow(recSheet.getRow(1), 8);

  for (const r of (recs?.recommendations ?? [])) {
    recSheet.addRow({
      category: r.category ?? r.type,
      severity: r.severity,
      service: r.service,
      description: r.description,
      resource: r.resourceId ?? '',
      region: r.region ?? '',
      savings: r.estimatedMonthlySavings,
      action: r.actionRequired,
    });
  }
  recSheet.getColumn('savings').numFmt = '"$"#,##0.00';

  // ── Sheet 3: Stopped VMs ──────────────────────────────────────────────────
  const vmSheet = workbook.addWorksheet('Stopped VMs');
  vmSheet.columns = [
    { key: 'name', header: 'Name', width: 30 },
    { key: 'project', header: 'Project', width: 25 },
    { key: 'zone', header: 'Zone', width: 25 },
    { key: 'machineType', header: 'Machine Type', width: 22 },
    { key: 'status', header: 'Status', width: 14 },
    { key: 'stoppedSince', header: 'Stopped Since', width: 22 },
    { key: 'diskCount', header: 'Disk Count', width: 12 },
    { key: 'diskSizeGb', header: 'Disk Size GB', width: 14 },
    { key: 'diskCost', header: 'Disk Cost', width: 14 },
    { key: 'ipCost', header: 'Static IP Cost', width: 14 },
    { key: 'totalCost', header: 'Total Monthly Cost', width: 18 },
  ];
  styleHeaderRow(vmSheet.getRow(1), 11);

  for (const vm of (vms?.vms ?? [])) {
    vmSheet.addRow({
      name: vm.name,
      project: vm.projectId ?? '',
      zone: vm.zone,
      machineType: vm.machineType,
      status: vm.status,
      stoppedSince: vm.stoppedSince ?? 'Unknown',
      diskCount: vm.attachedDiskCount,
      diskSizeGb: vm.totalDiskSizeGb,
      diskCost: vm.estimatedDiskMonthlyCost,
      ipCost: vm.staticIpMonthlyCost,
      totalCost: vm.totalMonthlyCost,
    });
  }
  vmSheet.getColumn('diskCost').numFmt = '"$"#,##0.00';
  vmSheet.getColumn('ipCost').numFmt = '"$"#,##0.00';
  vmSheet.getColumn('totalCost').numFmt = '"$"#,##0.00';

  // ── Sheet 4: Idle Resources ───────────────────────────────────────────────
  const idleSheet = workbook.addWorksheet('Idle Resources');
  idleSheet.columns = [
    { key: 'issueType', header: 'Issue Type', width: 20 },
    { key: 'resourceName', header: 'Resource Name', width: 35 },
    { key: 'service', header: 'Service', width: 22 },
    { key: 'resourceType', header: 'Resource Type', width: 22 },
    { key: 'region', header: 'Region', width: 20 },
    { key: 'project', header: 'Project', width: 25 },
    { key: 'description', header: 'Description', width: 50 },
    { key: 'savings', header: 'Est. Monthly Savings', width: 22 },
  ];
  styleHeaderRow(idleSheet.getRow(1), 8);

  for (const f of (idle?.findings ?? [])) {
    idleSheet.addRow({
      issueType: f.issueType,
      resourceName: f.resourceName,
      service: f.service,
      resourceType: f.resourceType,
      region: f.region,
      project: f.projectId ?? '',
      description: f.description,
      savings: f.estimatedMonthlySavings,
    });
  }
  idleSheet.getColumn('savings').numFmt = '"$"#,##0.00';

  await workbook.xlsx.writeFile(filePath);
  return filePath;
}

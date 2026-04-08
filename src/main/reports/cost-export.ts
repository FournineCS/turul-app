// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import ExcelJS from 'exceljs';
import path from 'path';
import type { CostAnalysisResult } from '../../shared/types';

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF1E293B' },
};
const HEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FFE2E8F0' }, size: 11 };
const SUBHEADER_FONT: Partial<ExcelJS.Font> = { bold: true, color: { argb: 'FF94A3B8' }, size: 10 };

function currencyFmt(value: number): string {
  return `$${value.toFixed(2)}`;
}

function pct(part: number, total: number): string {
  if (total === 0) return '0.0%';
  return `${((part / total) * 100).toFixed(1)}%`;
}

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

export async function generateCostExcel(
  analysis: CostAnalysisResult,
  outputPath: string,
  label: string
): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Turul - Cost Analyzer';
  workbook.created = new Date();

  const filePath = path.join(outputPath, `cost-export-${label}-${new Date().toISOString().split('T')[0]}.xlsx`);

  // ── Sheet 1: Summary ──────────────────────────────────────────────────────
  const summary = workbook.addWorksheet('Summary');
  summary.columns = [
    { key: 'label', width: 28 },
    { key: 'value', width: 30 },
  ];

  const titleRow = summary.addRow(['Cost Dashboard Export']);
  titleRow.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
  titleRow.fill = HEADER_FILL;
  titleRow.height = 28;
  summary.mergeCells('A1:B1');

  summary.addRow([]);
  summary.addRow(['Period', `${analysis.startDate}  →  ${analysis.endDate}`]);
  summary.addRow(['Total Cost', currencyFmt(analysis.totalCost)]);
  summary.addRow(['Previous Period', currencyFmt(analysis.previousPeriodTotalCost)]);
  const changeRow = summary.addRow(['Change', `${analysis.percentChange >= 0 ? '+' : ''}${analysis.percentChange.toFixed(1)}%`]);
  changeRow.getCell(2).font = {
    bold: true,
    color: { argb: analysis.percentChange < 0 ? 'FF22C55E' : 'FFEF4444' },
  };
  summary.addRow(['Currency', analysis.currency]);
  summary.addRow(['Active Services', analysis.byService?.length ?? 0]);
  summary.addRow(['Active Regions', analysis.byRegion?.length ?? 0]);

  for (let r = 3; r <= 9; r++) {
    const row = summary.getRow(r);
    row.getCell(1).font = SUBHEADER_FONT;
    row.getCell(2).font = { bold: true, color: { argb: 'FFE2E8F0' } };
    row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: r % 2 === 0 ? 'FF0F172A' : 'FF1E293B' } };
    row.height = 20;
  }

  // ── Sheet 2: By Service ───────────────────────────────────────────────────
  const svcSheet = workbook.addWorksheet('By Service');
  svcSheet.columns = [
    { key: 'service', header: 'Service', width: 35 },
    { key: 'cost', header: 'Cost', width: 18 },
    { key: 'pct', header: '% of Total', width: 14 },
    { key: 'currency', header: 'Currency', width: 12 },
  ];
  styleHeaderRow(svcSheet.getRow(1), 4);
  for (const row of (analysis.byService || [])) {
    svcSheet.addRow({
      service: row.service,
      cost: row.cost,
      pct: pct(row.cost, analysis.totalCost),
      currency: row.currency,
    });
  }
  svcSheet.getColumn('cost').numFmt = '"$"#,##0.00';

  // ── Sheet 3: By Region ────────────────────────────────────────────────────
  const regionSheet = workbook.addWorksheet('By Region');
  regionSheet.columns = [
    { key: 'region', header: 'Region', width: 28 },
    { key: 'cost', header: 'Cost', width: 18 },
    { key: 'pct', header: '% of Total', width: 14 },
    { key: 'currency', header: 'Currency', width: 12 },
  ];
  styleHeaderRow(regionSheet.getRow(1), 4);
  for (const row of (analysis.byRegion || [])) {
    regionSheet.addRow({
      region: row.region,
      cost: row.cost,
      pct: pct(row.cost, analysis.totalCost),
      currency: row.currency,
    });
  }
  regionSheet.getColumn('cost').numFmt = '"$"#,##0.00';

  // ── Sheet 4: By Project (optional) ────────────────────────────────────────
  if (analysis.byProject && analysis.byProject.length > 0) {
    const projSheet = workbook.addWorksheet('By Project');
    projSheet.columns = [
      { key: 'projectId', header: 'Project ID', width: 35 },
      { key: 'projectName', header: 'Project Name', width: 35 },
      { key: 'cost', header: 'Cost', width: 18 },
      { key: 'pct', header: '% of Total', width: 14 },
      { key: 'currency', header: 'Currency', width: 12 },
    ];
    styleHeaderRow(projSheet.getRow(1), 5);
    for (const row of analysis.byProject) {
      projSheet.addRow({
        projectId: row.projectId,
        projectName: row.projectName,
        cost: row.cost,
        pct: pct(row.cost, analysis.totalCost),
        currency: row.currency,
      });
    }
    projSheet.getColumn('cost').numFmt = '"$"#,##0.00';
  }

  // ── Sheet 5: By SKU ───────────────────────────────────────────────────────
  if (analysis.bySku && analysis.bySku.length > 0) {
    const skuSheet = workbook.addWorksheet('By SKU');
    skuSheet.columns = [
      { key: 'service', header: 'Service', width: 35 },
      { key: 'sku', header: 'SKU Description', width: 60 },
      { key: 'cost', header: 'Cost', width: 18 },
      { key: 'pct', header: '% of Total', width: 14 },
      { key: 'currency', header: 'Currency', width: 12 },
    ];
    styleHeaderRow(skuSheet.getRow(1), 5);
    for (const row of analysis.bySku) {
      skuSheet.addRow({
        service: row.service,
        sku: row.sku,
        cost: row.cost,
        pct: pct(row.cost, analysis.totalCost),
        currency: row.currency,
      });
    }
    skuSheet.getColumn('cost').numFmt = '"$"#,##0.00';
  }

  // ── Sheet 6: By Resource (consolidated + SKU breakdown rows) ─────────────
  if (analysis.byResource && analysis.byResource.length > 0) {
    const resSheet = workbook.addWorksheet('By Resource');
    resSheet.columns = [
      { key: 'type', header: 'Type', width: 12 },
      { key: 'resource', header: 'Resource', width: 40 },
      { key: 'service', header: 'Service', width: 30 },
      { key: 'sku', header: 'SKU', width: 55 },
      { key: 'region', header: 'Region', width: 18 },
      { key: 'project', header: 'Project', width: 30 },
      { key: 'cost', header: 'Cost', width: 18 },
      { key: 'pct', header: '% of Total', width: 14 },
      { key: 'currency', header: 'Currency', width: 12 },
    ];
    styleHeaderRow(resSheet.getRow(1), 9);

    const resourceTotal = analysis.byResource.reduce((s, r) => s + r.cost, 0);

    for (const res of analysis.byResource) {
      // Resource summary row
      const resRow = resSheet.addRow({
        type: 'Resource',
        resource: res.shortName,
        service: res.service,
        sku: res.skuBreakdown ? `${res.skuBreakdown.length} SKUs` : (res.sku ?? ''),
        region: res.region,
        project: res.projectId ?? '',
        cost: res.cost,
        pct: pct(res.cost, resourceTotal),
        currency: res.currency,
      });
      resRow.font = { bold: true, color: { argb: 'FFE2E8F0' } };
      resRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      resRow.getCell('resource').note = res.resourceName; // full name as tooltip

      // SKU breakdown rows (indented)
      if (res.skuBreakdown && res.skuBreakdown.length > 0) {
        for (const sku of res.skuBreakdown) {
          const skuRow = resSheet.addRow({
            type: '  SKU',
            resource: `  └ ${res.shortName}`,
            service: res.service,
            sku: sku.sku,
            region: res.region,
            project: res.projectId ?? '',
            cost: sku.cost,
            pct: pct(sku.cost, res.cost),
            currency: res.currency,
          });
          skuRow.font = { color: { argb: 'FF94A3B8' }, size: 10 };
          skuRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } };
        }
      }
    }

    resSheet.getColumn('cost').numFmt = '"$"#,##0.00';

    // Freeze header row
    resSheet.views = [{ state: 'frozen', xSplit: 0, ySplit: 1 }];
  }

  await workbook.xlsx.writeFile(filePath);
  return filePath;
}

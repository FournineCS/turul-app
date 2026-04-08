// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import ExcelJS from 'exceljs';
import path from 'path';
import type { GKECostAnalysis } from '../../shared/types';

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

export async function generateGKECostExcel(
  analysis: GKECostAnalysis,
  outputPath: string,
  label: string,
): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Fournine Cloud - GKE Cost Export';
  workbook.created = new Date();

  const filePath = path.join(outputPath, `gke-costs-${label}-${new Date().toISOString().split('T')[0]}.xlsx`);

  // ── Sheet 1: Summary ──
  const summary = workbook.addWorksheet('Summary');
  summary.columns = [
    { key: 'label', width: 30 },
    { key: 'value', width: 35 },
  ];

  const titleRow = summary.addRow(['GKE Cost Export']);
  titleRow.font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
  titleRow.fill = HEADER_FILL;
  titleRow.height = 28;
  summary.mergeCells('A1:B1');

  summary.addRow([]);
  summary.addRow(['Scope', label]);
  summary.addRow(['Generated', new Date().toLocaleString()]);
  summary.addRow(['Total GKE Spend', `$${analysis.totalCost.toFixed(2)}`]);
  summary.addRow(['Currency', analysis.currency]);
  summary.addRow(['Clusters', analysis.byCluster.length]);
  summary.addRow(['Namespaces', analysis.byNamespace.length]);
  summary.addRow(['Workloads', analysis.byWorkload.length]);
  summary.addRow(['SKU Categories', analysis.bySku.length]);

  for (let r = 3; r <= 10; r++) {
    const row = summary.getRow(r);
    row.getCell(1).font = SUBHEADER_FONT;
    row.getCell(2).font = { bold: true, color: { argb: 'FFE2E8F0' } };
    row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: r % 2 === 0 ? 'FF0F172A' : 'FF1E293B' } };
    row.height = 20;
  }

  // ── Sheet 2: Clusters ──
  const clusterSheet = workbook.addWorksheet('Clusters');
  clusterSheet.columns = [
    { key: 'cluster', header: 'Cluster', width: 40 },
    { key: 'namespaces', header: 'Namespaces', width: 14 },
    { key: 'cost', header: 'Cost', width: 18 },
    { key: 'percent', header: '% of Total', width: 14 },
  ];
  styleHeaderRow(clusterSheet.getRow(1), 4);

  for (const c of analysis.byCluster) {
    clusterSheet.addRow({
      cluster: c.cluster,
      namespaces: c.namespaceCount ?? 0,
      cost: c.cost,
      percent: analysis.totalCost > 0 ? c.cost / analysis.totalCost : 0,
    });
  }
  clusterSheet.getColumn('cost').numFmt = '"$"#,##0.00';
  clusterSheet.getColumn('percent').numFmt = '0.0%';

  // ── Sheet 3: Namespaces ──
  const nsSheet = workbook.addWorksheet('Namespaces');
  nsSheet.columns = [
    { key: 'namespace', header: 'Namespace', width: 35 },
    { key: 'cluster', header: 'Cluster', width: 35 },
    { key: 'cost', header: 'Cost', width: 18 },
    { key: 'percent', header: '% of Total', width: 14 },
  ];
  styleHeaderRow(nsSheet.getRow(1), 4);

  const sortedNS = [...analysis.byNamespace].sort((a, b) => b.cost - a.cost);
  for (const n of sortedNS) {
    nsSheet.addRow({
      namespace: n.namespace,
      cluster: n.cluster,
      cost: n.cost,
      percent: analysis.totalCost > 0 ? n.cost / analysis.totalCost : 0,
    });
  }
  nsSheet.getColumn('cost').numFmt = '"$"#,##0.00';
  nsSheet.getColumn('percent').numFmt = '0.0%';

  // ── Sheet 4: Workloads ──
  const wlSheet = workbook.addWorksheet('Workloads');
  wlSheet.columns = [
    { key: 'workload', header: 'Workload', width: 40 },
    { key: 'type', header: 'Type', width: 18 },
    { key: 'namespace', header: 'Namespace', width: 30 },
    { key: 'cluster', header: 'Cluster', width: 30 },
    { key: 'cost', header: 'Cost', width: 18 },
    { key: 'percent', header: '% of Total', width: 14 },
  ];
  styleHeaderRow(wlSheet.getRow(1), 6);

  const sortedWL = [...analysis.byWorkload].sort((a, b) => b.cost - a.cost);
  for (const w of sortedWL) {
    wlSheet.addRow({
      workload: w.workload,
      type: w.workloadType,
      namespace: w.namespace,
      cluster: w.cluster,
      cost: w.cost,
      percent: analysis.totalCost > 0 ? w.cost / analysis.totalCost : 0,
    });
  }
  wlSheet.getColumn('cost').numFmt = '"$"#,##0.00';
  wlSheet.getColumn('percent').numFmt = '0.0%';

  // ── Sheet 5: SKUs ──
  const skuSheet = workbook.addWorksheet('SKU Breakdown');
  skuSheet.columns = [
    { key: 'sku', header: 'SKU Description', width: 55 },
    { key: 'cost', header: 'Cost', width: 18 },
    { key: 'percent', header: '% of Total', width: 14 },
  ];
  styleHeaderRow(skuSheet.getRow(1), 3);

  const sortedSKU = [...analysis.bySku].sort((a, b) => b.cost - a.cost);
  for (const s of sortedSKU) {
    skuSheet.addRow({
      sku: s.sku,
      cost: s.cost,
      percent: analysis.totalCost > 0 ? s.cost / analysis.totalCost : 0,
    });
  }
  skuSheet.getColumn('cost').numFmt = '"$"#,##0.00';
  skuSheet.getColumn('percent').numFmt = '0.0%';

  // ── Sheet 6: Daily Trend ──
  if (analysis.trend.length > 0) {
    const trendSheet = workbook.addWorksheet('Daily Trend');
    trendSheet.columns = [
      { key: 'date', header: 'Date', width: 14 },
      { key: 'cluster', header: 'Cluster', width: 35 },
      { key: 'cost', header: 'Cost', width: 18 },
    ];
    styleHeaderRow(trendSheet.getRow(1), 3);

    const sortedTrend = [...analysis.trend].sort((a, b) => a.date.localeCompare(b.date));
    for (const t of sortedTrend) {
      trendSheet.addRow({
        date: t.date,
        cluster: t.cluster ?? 'All',
        cost: t.cost,
      });
    }
    trendSheet.getColumn('cost').numFmt = '"$"#,##0.00';
  }

  await workbook.xlsx.writeFile(filePath);
  return filePath;
}

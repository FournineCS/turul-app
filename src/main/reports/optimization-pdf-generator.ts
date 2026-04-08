// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import PDFDocument from 'pdfkit';
import { createWriteStream } from 'fs';
import path from 'path';
import type {
  GCPExpandedRecommendationsResult,
  StoppedVMResult,
  ResourceIdleAnalysisResult,
} from '../../shared/types';
import {
  drawSectionHeader,
  drawHorizontalBarChart,
  drawDonutChart,
  drawTable,
  drawStatBoxes,
} from './pdf-chart-helpers';

const COLORS = {
  primary:   '#1e3a5f',
  secondary: '#2563eb',
  accent:    '#0ea5e9',
  text:      '#1f2937',
  textLight: '#6b7280',
  border:    '#e5e7eb',
  bgLight:   '#f8fafc',
};

const PALETTE = [
  '#2563eb', '#16a34a', '#d97706', '#dc2626', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
  '#14b8a6', '#f43f5e', '#a855f7', '#eab308', '#0891b2',
];

function fmtCost(v: number): string {
  return `$${v.toFixed(2)}`;
}

function fmtCostShort(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

function addPageFooter(doc: PDFKit.PDFDocument, pageNum: number, label: string): void {
  const savedX = doc.x;
  const savedY = doc.y;
  const pageW  = doc.page.width;
  const bottom = doc.page.height - 30;
  const footerText = `GCP Optimization Report  ·  ${label}  ·  Page ${pageNum}`;

  doc.moveTo(50, bottom - 10)
     .lineTo(pageW - 50, bottom - 10)
     .strokeColor(COLORS.border)
     .lineWidth(0.5)
     .stroke();

  doc.fontSize(7).fillColor(COLORS.textLight);
  const textW = doc.widthOfString(footerText);
  const tx = (pageW - textW) / 2;
  doc.text(footerText, tx, bottom - 4, { lineBreak: false });

  doc.x = savedX;
  doc.y = savedY;
}

function newPage(doc: PDFKit.PDFDocument, pageNum: number, label: string): number {
  doc.addPage();
  const n = pageNum + 1;
  addPageFooter(doc, n, label);
  return n;
}

function needsNewPage(doc: PDFKit.PDFDocument, needed: number): boolean {
  return doc.y + needed > doc.page.height - 65;
}

// ─── Cover Page ──────────────────────────────────────────────────────────────

function drawCoverPage(
  doc: PDFKit.PDFDocument,
  recs: GCPExpandedRecommendationsResult | null,
  vms: StoppedVMResult | null,
  idle: ResourceIdleAnalysisResult | null,
  label: string,
): void {
  const pageW = doc.page.width;
  const contentW = pageW - 100;

  const totalSavings =
    (recs?.totalPotentialSavings ?? 0) +
    (vms?.totalEstimatedMonthlyCost ?? 0) +
    (idle?.estimatedMonthlySavings ?? 0);

  // Header band
  doc.rect(0, 0, pageW, 118).fill(COLORS.primary);
  doc.rect(0, 114, pageW, 4).fill(COLORS.accent);
  doc.fontSize(24).fillColor('#ffffff')
     .text('GCP Optimization Report', 50, 26, { width: pageW - 100 });
  doc.fontSize(11).fillColor('#93c5fd')
     .text(label, 50, 66, { width: pageW - 100 });
  doc.fontSize(9.5).fillColor('#7dd3fc')
     .text(`Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, 50, 88, { width: pageW - 100 });

  doc.y = 136;

  // Stat boxes
  drawStatBoxes(doc, [
    { label: 'Total Savings',    value: fmtCostShort(totalSavings), color: '#fee2e2' },
    { label: 'Recommendations',  value: String(recs?.recommendations?.length ?? 0), color: '#dbeafe' },
    { label: 'Stopped VMs',      value: String(vms?.vms?.length ?? 0), color: '#fef9c3' },
    { label: 'Idle Resources',   value: String(idle?.findings?.length ?? 0), color: '#e0f2fe' },
  ], { x: 50, y: doc.y, totalWidth: contentW });

  doc.y += 14;

  // Donut chart — savings by category
  const slices: { label: string; value: number; color: string }[] = [];
  if (recs && recs.byCategory) {
    let i = 0;
    for (const [cat, data] of Object.entries(recs.byCategory)) {
      if (data.savings > 0) {
        slices.push({ label: cat, value: data.savings, color: PALETTE[i % PALETTE.length] });
        i++;
      }
    }
  }
  if (vms && vms.totalEstimatedMonthlyCost > 0) {
    slices.push({ label: 'Stopped VMs', value: vms.totalEstimatedMonthlyCost, color: '#f97316' });
  }
  if (idle && idle.estimatedMonthlySavings > 0) {
    slices.push({ label: 'Idle Resources', value: idle.estimatedMonthlySavings, color: '#06b6d4' });
  }

  if (slices.length > 0) {
    const donutCY = doc.y + 65;
    drawDonutChart(doc, slices, {
      cx: 125, cy: donutCY,
      outerRadius: 58, innerRadius: 34,
      legendX: 210, legendY: doc.y + 4,
      centerLabel: 'Savings',
      centerValue: fmtCostShort(totalSavings),
    });
    doc.x = 50;
    doc.y = donutCY + 62;
  }

  // Footer band
  const footerY = doc.page.height - 52;
  doc.rect(0, footerY, pageW, 52).fill('#f1f5f9');
  doc.moveTo(0, footerY).lineTo(pageW, footerY).strokeColor(COLORS.accent).lineWidth(2).stroke();
  const genLine = `Prepared by Turul  ·  Generated ${new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })}  ·  CONFIDENTIAL`;
  doc.fontSize(8).fillColor(COLORS.textLight);
  const tw = doc.widthOfString(genLine);
  doc.text(genLine, (pageW - tw) / 2, footerY + 16, { lineBreak: false });
}

// ─── Main Export ─────────────────────────────────────────────────────────────

export async function generateOptimizationPdf(
  recs: GCPExpandedRecommendationsResult | null,
  vms: StoppedVMResult | null,
  idle: ResourceIdleAnalysisResult | null,
  outputDir: string,
  label: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const timestamp = new Date().toISOString().split('T')[0];
      const filePath = path.join(outputDir, `gcp-optimization-${label}-${timestamp}.pdf`);

      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 45, bottom: 50, left: 50, right: 50 },
        info: {
          Title:   `GCP Optimization Report — ${label}`,
          Author:  'Turul',
          Subject: 'GCP Cost Optimization',
        },
      });

      const stream = createWriteStream(filePath);
      doc.pipe(stream);

      let pageNum = 1;
      const contentW = (doc.page.width as number) - 100;

      // ── Page 1: Cover ───────────────────────────────────────────────────
      drawCoverPage(doc, recs, vms, idle, label);

      // ── Page 2: Recommendations ─────────────────────────────────────────
      if (recs && recs.recommendations.length > 0) {
        pageNum = newPage(doc, pageNum, label);
        drawSectionHeader(doc, 'Cost Recommendations', `${recs.recommendations.length} recommendations`);
        doc.moveDown(0.3);

        // Top 10 by savings bar chart
        const top10 = [...recs.recommendations]
          .sort((a, b) => b.estimatedMonthlySavings - a.estimatedMonthlySavings)
          .slice(0, 10);

        if (top10.length > 0 && top10[0].estimatedMonthlySavings > 0) {
          drawHorizontalBarChart(doc, top10.map((r, i) => ({
            label: r.description.slice(0, 50),
            value: r.estimatedMonthlySavings,
            color: PALETTE[i % PALETTE.length],
          })), {
            x: 50, y: doc.y, width: contentW,
            height: Math.min(200, top10.length * 20 + 8),
            valueFormatter: (v) => fmtCost(v),
            maxLabelWidth: 200,
          });
          doc.moveDown(0.4);
        }

        // Table
        const severityColor = (v: string) => {
          if (v === 'high') return '#dc2626';
          if (v === 'medium') return '#d97706';
          return '#6b7280';
        };

        drawTable(doc, [
          { header: 'Severity',    width: 55, colorFn: severityColor },
          { header: 'Service',     width: 85 },
          { header: 'Description', width: 210 },
          { header: 'Savings',     width: 75, align: 'right' },
          { header: 'Action',      width: 70 },
        ], recs.recommendations.map(r => ({
          'Severity':    r.severity,
          'Service':     r.service,
          'Description': r.description,
          'Savings':     fmtCost(r.estimatedMonthlySavings),
          'Action':      r.actionRequired.slice(0, 30),
        })), { x: 50, y: doc.y, fontSize: 7, rowAlternateBg: COLORS.bgLight });
        addPageFooter(doc, pageNum, label);
      }

      // ── Page 3: Stopped VMs ─────────────────────────────────────────────
      if (vms && vms.vms.length > 0) {
        pageNum = newPage(doc, pageNum, label);
        drawSectionHeader(doc, 'Stopped VMs', `${vms.vms.length} VMs · ${fmtCost(vms.totalEstimatedMonthlyCost)}/mo waste`);
        doc.moveDown(0.3);

        const sortedVMs = [...vms.vms].sort((a, b) => b.totalMonthlyCost - a.totalMonthlyCost);

        drawTable(doc, [
          { header: 'Name',      width: 110 },
          { header: 'Project',   width: 85 },
          { header: 'Zone',      width: 80 },
          { header: 'Type',      width: 75 },
          { header: 'Status',    width: 65 },
          { header: 'Cost/mo',   width: 80, align: 'right' },
        ], sortedVMs.map(vm => ({
          'Name':    vm.name,
          'Project': vm.projectId ?? '',
          'Zone':    vm.zone,
          'Type':    vm.machineType,
          'Status':  vm.status,
          'Cost/mo': fmtCost(vm.totalMonthlyCost),
        })), { x: 50, y: doc.y, fontSize: 7, rowAlternateBg: COLORS.bgLight });
        addPageFooter(doc, pageNum, label);
      }

      // ── Page 4: Idle Resources ──────────────────────────────────────────
      if (idle && idle.findings.length > 0) {
        pageNum = newPage(doc, pageNum, label);
        drawSectionHeader(doc, 'Idle Resources', `${idle.findings.length} findings · ${fmtCost(idle.estimatedMonthlySavings)}/mo waste`);
        doc.moveDown(0.3);

        // Donut by issue type
        const byType = idle.byType;
        const typeSlices = Object.entries(byType)
          .filter(([, count]) => count > 0)
          .map(([type, count], i) => ({
            label: type.replace(/_/g, ' '),
            value: count,
            color: PALETTE[i % PALETTE.length],
          }));

        if (typeSlices.length > 0) {
          const donutY = doc.y;
          drawDonutChart(doc, typeSlices, {
            cx: 115, cy: donutY + 54,
            outerRadius: 48, innerRadius: 28,
            legendX: 195, legendY: donutY + 4,
            centerLabel: 'Findings',
            centerValue: String(idle.totalFindings),
          });
          doc.x = 50;
          doc.y = donutY + 54 + 52;
          doc.moveDown(0.4);
        }

        drawTable(doc, [
          { header: 'Issue Type', width: 80 },
          { header: 'Resource',   width: 120 },
          { header: 'Service',    width: 75 },
          { header: 'Region',     width: 75 },
          { header: 'Project',    width: 75 },
          { header: 'Savings',    width: 70, align: 'right' },
        ], idle.findings.map(f => ({
          'Issue Type': f.issueType.replace(/_/g, ' '),
          'Resource':   f.resourceName,
          'Service':    f.service,
          'Region':     f.region,
          'Project':    f.projectId ?? '',
          'Savings':    fmtCost(f.estimatedMonthlySavings),
        })), { x: 50, y: doc.y, fontSize: 7, rowAlternateBg: COLORS.bgLight });
        addPageFooter(doc, pageNum, label);
      }

      doc.end();
      stream.on('finish', () => resolve(filePath));
      stream.on('error', reject);
    } catch (err) {
      reject(err);
    }
  });
}

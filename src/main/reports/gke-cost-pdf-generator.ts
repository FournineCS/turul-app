// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import PDFDocument from 'pdfkit';
import { createWriteStream } from 'fs';
import path from 'path';
import type { GKECostAnalysis } from '../../shared/types';
import {
  drawSectionHeader,
  drawHorizontalBarChart,
  drawDonutChart,
  drawTable,
  drawStatBoxes,
  drawLineChart,
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
  const footerText = `GKE Cost Report  ·  ${label}  ·  Page ${pageNum}`;

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

// ─── Cover Page ──────────────────────────────────────────────────────────────

function drawCoverPage(
  doc: PDFKit.PDFDocument,
  analysis: GKECostAnalysis,
  label: string,
): void {
  const pageW = doc.page.width;
  const contentW = pageW - 100;

  // Header band
  doc.rect(0, 0, pageW, 118).fill(COLORS.primary);
  doc.rect(0, 114, pageW, 4).fill(COLORS.accent);
  doc.fontSize(24).fillColor('#ffffff')
     .text('GKE Cost Report', 50, 26, { width: pageW - 100 });
  doc.fontSize(11).fillColor('#93c5fd')
     .text(label, 50, 66, { width: pageW - 100 });
  doc.fontSize(9.5).fillColor('#7dd3fc')
     .text(`Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`, 50, 88, { width: pageW - 100 });

  doc.y = 136;

  // Stat boxes
  drawStatBoxes(doc, [
    { label: 'Total GKE Spend',  value: fmtCostShort(analysis.totalCost), color: '#dbeafe' },
    { label: 'Clusters',         value: String(analysis.byCluster.length), color: '#e0f2fe' },
    { label: 'Namespaces',       value: String(analysis.byNamespace.length), color: '#fef9c3' },
    { label: 'Workloads',        value: String(analysis.byWorkload.length), color: '#fee2e2' },
  ], { x: 50, y: doc.y, totalWidth: contentW });

  doc.y += 14;

  // Donut chart — cost by cluster
  const slices = analysis.byCluster
    .sort((a, b) => b.cost - a.cost)
    .slice(0, 10)
    .map((c, i) => ({
      label: c.cluster,
      value: c.cost,
      color: PALETTE[i % PALETTE.length],
    }));

  if (slices.length > 0) {
    const donutCY = doc.y + 65;
    drawDonutChart(doc, slices, {
      cx: 125, cy: donutCY,
      outerRadius: 58, innerRadius: 34,
      legendX: 210, legendY: doc.y + 4,
      centerLabel: 'Total',
      centerValue: fmtCostShort(analysis.totalCost),
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

export async function generateGKECostPdf(
  analysis: GKECostAnalysis,
  outputDir: string,
  label: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const timestamp = new Date().toISOString().split('T')[0];
      const filePath = path.join(outputDir, `gke-costs-${label}-${timestamp}.pdf`);

      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 45, bottom: 50, left: 50, right: 50 },
        info: {
          Title:   `GKE Cost Report — ${label}`,
          Author:  'Turul',
          Subject: 'GKE Cost Analysis',
        },
      });

      const stream = createWriteStream(filePath);
      doc.pipe(stream);

      let pageNum = 1;
      const contentW = (doc.page.width as number) - 100;

      // ── Page 1: Cover ──
      drawCoverPage(doc, analysis, label);

      // ── Page 2: Cluster Breakdown ──
      if (analysis.byCluster.length > 0) {
        pageNum = newPage(doc, pageNum, label);
        drawSectionHeader(doc, 'Cluster Cost Breakdown', `${analysis.byCluster.length} clusters`);
        doc.moveDown(0.3);

        const sortedClusters = [...analysis.byCluster].sort((a, b) => b.cost - a.cost).slice(0, 15);

        if (sortedClusters.length > 0) {
          drawHorizontalBarChart(doc, sortedClusters.map((c, i) => ({
            label: c.cluster.length > 40 ? c.cluster.slice(0, 40) + '...' : c.cluster,
            value: c.cost,
            color: PALETTE[i % PALETTE.length],
          })), {
            x: 50, y: doc.y, width: contentW,
            height: Math.min(220, sortedClusters.length * 20 + 8),
            valueFormatter: (v) => fmtCost(v),
            maxLabelWidth: 200,
          });
          doc.moveDown(0.4);
        }

        drawTable(doc, [
          { header: 'Cluster',    width: 200 },
          { header: 'Namespaces', width: 70, align: 'right' },
          { header: 'Cost',       width: 100, align: 'right' },
          { header: '% of Total', width: 80, align: 'right' },
        ], analysis.byCluster.map(c => ({
          'Cluster':    c.cluster,
          'Namespaces': String(c.namespaceCount ?? 0),
          'Cost':       fmtCost(c.cost),
          '% of Total': analysis.totalCost > 0 ? `${((c.cost / analysis.totalCost) * 100).toFixed(1)}%` : '-',
        })), { x: 50, y: doc.y, fontSize: 7.5, rowAlternateBg: COLORS.bgLight });
        addPageFooter(doc, pageNum, label);
      }

      // ── Page 3: Cost Trend ──
      if (analysis.trend.length > 0) {
        pageNum = newPage(doc, pageNum, label);
        drawSectionHeader(doc, 'Daily Cost Trend', `${analysis.trend.length} data points`);
        doc.moveDown(0.3);

        // Aggregate trend by date
        const trendMap = new Map<string, number>();
        for (const t of analysis.trend) {
          trendMap.set(t.date, (trendMap.get(t.date) || 0) + t.cost);
        }
        const trendPoints = Array.from(trendMap.entries())
          .sort((a, b) => a[0].localeCompare(b[0]))
          .map(([date, cost]) => ({ label: date.slice(5), value: cost }));

        if (trendPoints.length > 1) {
          drawLineChart(doc, trendPoints, {
            x: 50, y: doc.y, width: contentW, height: 180,
            valueFormatter: (v) => fmtCostShort(v),
            lineColor: COLORS.secondary,
            fillColor: '#dbeafe',
          });
          doc.moveDown(0.6);
        }
        addPageFooter(doc, pageNum, label);
      }

      // ── Page 4: Top Namespaces ──
      if (analysis.byNamespace.length > 0) {
        pageNum = newPage(doc, pageNum, label);
        drawSectionHeader(doc, 'Namespace Cost Breakdown', `${analysis.byNamespace.length} namespaces`);
        doc.moveDown(0.3);

        const topNS = [...analysis.byNamespace].sort((a, b) => b.cost - a.cost).slice(0, 10);
        if (topNS.length > 0) {
          drawHorizontalBarChart(doc, topNS.map((n, i) => ({
            label: `${n.namespace} (${n.cluster.split('/').pop()})`.slice(0, 50),
            value: n.cost,
            color: PALETTE[i % PALETTE.length],
          })), {
            x: 50, y: doc.y, width: contentW,
            height: Math.min(200, topNS.length * 20 + 8),
            valueFormatter: (v) => fmtCost(v),
            maxLabelWidth: 200,
          });
          doc.moveDown(0.4);
        }

        drawTable(doc, [
          { header: 'Namespace', width: 170 },
          { header: 'Cluster',   width: 170 },
          { header: 'Cost',      width: 90, align: 'right' },
          { header: '% Total',   width: 65, align: 'right' },
        ], [...analysis.byNamespace].sort((a, b) => b.cost - a.cost).slice(0, 50).map(n => ({
          'Namespace': n.namespace,
          'Cluster':   n.cluster,
          'Cost':      fmtCost(n.cost),
          '% Total':   analysis.totalCost > 0 ? `${((n.cost / analysis.totalCost) * 100).toFixed(1)}%` : '-',
        })), { x: 50, y: doc.y, fontSize: 7, rowAlternateBg: COLORS.bgLight });
        addPageFooter(doc, pageNum, label);
      }

      // ── Page 5: Top Workloads ──
      if (analysis.byWorkload.length > 0) {
        pageNum = newPage(doc, pageNum, label);
        drawSectionHeader(doc, 'Top Workloads by Cost', `${analysis.byWorkload.length} workloads`);
        doc.moveDown(0.3);

        drawTable(doc, [
          { header: 'Workload',  width: 140 },
          { header: 'Type',      width: 65 },
          { header: 'Namespace', width: 110 },
          { header: 'Cluster',   width: 90 },
          { header: 'Cost',      width: 90, align: 'right' },
        ], [...analysis.byWorkload].sort((a, b) => b.cost - a.cost).slice(0, 80).map(w => ({
          'Workload':  w.workload.slice(0, 40),
          'Type':      w.workloadType || '-',
          'Namespace': w.namespace,
          'Cluster':   w.cluster.length > 25 ? w.cluster.slice(0, 25) + '...' : w.cluster,
          'Cost':      fmtCost(w.cost),
        })), { x: 50, y: doc.y, fontSize: 7, rowAlternateBg: COLORS.bgLight });
        addPageFooter(doc, pageNum, label);
      }

      // ── Page 6: SKU Breakdown ──
      if (analysis.bySku.length > 0) {
        pageNum = newPage(doc, pageNum, label);
        drawSectionHeader(doc, 'SKU Cost Breakdown', `${analysis.bySku.length} SKUs`);
        doc.moveDown(0.3);

        // SKU donut
        const skuSlices = [...analysis.bySku]
          .sort((a, b) => b.cost - a.cost)
          .slice(0, 8)
          .map((s, i) => ({
            label: s.sku.length > 35 ? s.sku.slice(0, 35) + '...' : s.sku,
            value: s.cost,
            color: PALETTE[i % PALETTE.length],
          }));

        if (skuSlices.length > 0) {
          const donutY = doc.y;
          drawDonutChart(doc, skuSlices, {
            cx: 115, cy: donutY + 54,
            outerRadius: 48, innerRadius: 28,
            legendX: 195, legendY: donutY + 4,
            centerLabel: 'SKUs',
            centerValue: String(analysis.bySku.length),
          });
          doc.x = 50;
          doc.y = donutY + 54 + 52;
          doc.moveDown(0.4);
        }

        drawTable(doc, [
          { header: 'SKU Description', width: 320 },
          { header: 'Cost',            width: 90, align: 'right' },
          { header: '% Total',         width: 85, align: 'right' },
        ], [...analysis.bySku].sort((a, b) => b.cost - a.cost).map(s => ({
          'SKU Description': s.sku,
          'Cost':            fmtCost(s.cost),
          '% Total':         analysis.totalCost > 0 ? `${((s.cost / analysis.totalCost) * 100).toFixed(1)}%` : '-',
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

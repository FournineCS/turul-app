// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import PDFDocument from 'pdfkit';
import { createWriteStream } from 'fs';
import path from 'path';
import type { CostAnalysisResult } from '../../shared/types';
import {
  drawSectionHeader,
  drawHorizontalBarChart,
  drawDonutChart,
  drawLineChart,
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
  positive:  '#16a34a',
  negative:  '#dc2626',
};

const PALETTE = [
  '#2563eb', '#16a34a', '#d97706', '#dc2626', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
  '#14b8a6', '#f43f5e', '#a855f7', '#eab308', '#0891b2',
];

function fmtCost(v: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency,
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }).format(v);
}

function fmtCostShort(v: number): string {
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000)     return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toFixed(0)}`;
}

function pct(part: number, total: number): string {
  if (total === 0) return '0.0%';
  return `${((part / total) * 100).toFixed(1)}%`;
}

/**
 * Draw the page footer using ONLY absolute-coordinate drawing, no doc.text()
 * at y positions near the bottom (which could trigger PDFKit's overflow/addPage).
 * Save/restore doc.x and doc.y manually since PDFKit save()/restore() only
 * preserves graphics state, not cursor position.
 */
function addPageFooter(doc: PDFKit.PDFDocument, pageNum: number, label: string): void {
  const savedX = doc.x;
  const savedY = doc.y;
  const pageW  = doc.page.width;
  const bottom = doc.page.height - 30;
  const footerText = `Cloud Cost Analysis  ·  ${label}  ·  Page ${pageNum}`;

  // Draw footer separator line
  doc.moveTo(50, bottom - 10)
     .lineTo(pageW - 50, bottom - 10)
     .strokeColor(COLORS.border)
     .lineWidth(0.5)
     .stroke();

  // Draw footer text — use string width to position manually, avoiding lineBreak auto-overflow
  doc.fontSize(7).fillColor(COLORS.textLight);
  const textW = doc.widthOfString(footerText);
  // Center the footer text
  const tx = (pageW - textW) / 2;
  doc.text(footerText, tx, bottom - 4, { lineBreak: false });

  // Restore cursor position
  doc.x = savedX;
  doc.y = savedY;
}

/** Add a new page, increment counter, draw footer. Returns updated pageNum. */
function newPage(doc: PDFKit.PDFDocument, pageNum: number, label: string): number {
  doc.addPage();
  const n = pageNum + 1;
  addPageFooter(doc, n, label);
  return n;
}

/** Returns true if < needed px remain before footer zone. */
function needsNewPage(doc: PDFKit.PDFDocument, needed: number): boolean {
  return doc.y + needed > doc.page.height - 65;
}

/** Section separator: new page if < minH remains, else thin rule. */
function sectionSep(
  doc: PDFKit.PDFDocument, pageNum: number, label: string, minH: number,
): number {
  if (needsNewPage(doc, minH)) {
    return newPage(doc, pageNum, label);
  }
  doc.moveDown(0.8);
  const ly = doc.y;
  doc.moveTo(50, ly).lineTo(doc.page.width - 50, ly)
     .strokeColor(COLORS.border).lineWidth(0.3).stroke();
  doc.y = ly + 8;
  return pageNum;
}

// ─── Cover page ──────────────────────────────────────────────────────────────

function drawCoverPage(doc: PDFKit.PDFDocument, analysis: CostAnalysisResult, label: string): void {
  const pageW    = doc.page.width;
  const contentW = pageW - 100;

  // Header band
  doc.rect(0, 0, pageW, 118).fill(COLORS.primary);
  doc.rect(0, 114, pageW, 4).fill(COLORS.accent);
  doc.fontSize(24).fillColor('#ffffff')
     .text('Cloud Cost Analysis Report', 50, 26, { width: pageW - 100 });
  doc.fontSize(11).fillColor('#93c5fd')
     .text(label, 50, 66, { width: pageW - 100 });
  doc.fontSize(9.5).fillColor('#7dd3fc')
     .text(`Period: ${analysis.startDate}  →  ${analysis.endDate}`, 50, 88, { width: pageW - 100 });

  doc.y = 136;

  // Stat boxes
  const change    = analysis.percentChange;
  const changeStr = `${change >= 0 ? '+' : ''}${change.toFixed(1)}%`;
  drawStatBoxes(doc, [
    { label: 'Total Cost',      value: fmtCost(analysis.totalCost, analysis.currency),               color: '#dbeafe' },
    { label: 'Previous Period', value: fmtCost(analysis.previousPeriodTotalCost, analysis.currency), color: '#e0f2fe' },
    { label: 'Period Change',   value: changeStr, color: change < 0 ? '#dcfce7' : '#fee2e2' },
    { label: 'Active Services', value: String(analysis.byService?.length ?? 0),                      color: '#fef9c3' },
  ], { x: 50, y: doc.y, totalWidth: contentW });

  doc.y += 14;

  // Service donut (compact)
  if (analysis.byService && analysis.byService.length > 0) {
    const top7  = analysis.byService.slice(0, 7);
    const other = analysis.byService.slice(7).reduce((s, r) => s + r.cost, 0);
    const slices = [
      ...top7.map((s, i) => ({ label: s.service, value: s.cost, color: PALETTE[i] })),
      ...(other > 0 ? [{ label: 'Others', value: other, color: '#9ca3af' }] : []),
    ];
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

  // Key metrics
  doc.y += 8;
  const metricsY = doc.y;
  const pairs = [
    { k: 'Period',   v: `${analysis.startDate}  to  ${analysis.endDate}` },
    { k: 'Regions',  v: String(analysis.byRegion?.length ?? 0) },
    { k: 'Services', v: String(analysis.byService?.length ?? 0) },
    { k: 'Currency', v: analysis.currency },
  ];
  for (let i = 0; i < pairs.length; i++) {
    const iy = metricsY + i * 16;
    doc.fontSize(8).fillColor(COLORS.textLight).text(pairs[i].k, 50, iy, { width: 115, lineBreak: false });
    doc.fontSize(8).fillColor(COLORS.text).text(pairs[i].v, 170, iy, { width: 220, lineBreak: false });
  }

  // Footer band — use absolute position, no overflow risk
  const footerY = doc.page.height - 52;
  doc.rect(0, footerY, pageW, 52).fill('#f1f5f9');
  doc.moveTo(0, footerY).lineTo(pageW, footerY).strokeColor(COLORS.accent).lineWidth(2).stroke();
  const genLine = `Prepared by Fournine Cloud Analyzer  ·  Generated ${new Date().toLocaleDateString('en-US', {
    year: 'numeric', month: 'long', day: 'numeric',
  })}  ·  CONFIDENTIAL`;
  doc.fontSize(8).fillColor(COLORS.textLight);
  const tw = doc.widthOfString(genLine);
  doc.text(genLine, (pageW - tw) / 2, footerY + 16, { lineBreak: false });
}

// ─── Main export ─────────────────────────────────────────────────────────────

export async function generateCostPdf(
  analysis: CostAnalysisResult,
  outputDir: string,
  label: string,
): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const timestamp = new Date().toISOString().split('T')[0];
      const filePath  = path.join(outputDir, `cost-analysis-${label}-${timestamp}.pdf`);

      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 45, bottom: 50, left: 50, right: 50 },
        info: {
          Title:   `Cloud Cost Analysis — ${label}`,
          Author:  'Fournine Cloud Analyzer',
          Subject: `Cost Report ${analysis.startDate} to ${analysis.endDate}`,
        },
      });

      const stream = createWriteStream(filePath);
      doc.pipe(stream);

      // IMPORTANT: Do NOT use doc.on('pageAdded') for drawing.
      // Calling doc.text() near the bottom of a page inside 'pageAdded' causes
      // PDFKit's overflow detection to call addPage() recursively → infinite loop.
      // Instead, track pageNum manually and call newPage() for every page transition.

      let pageNum = 1; // first page created by PDFDocument constructor
      const contentW = (doc.page.width as number) - 100;

      // ── Page 1: Cover ───────────────────────────────────────────────────
      drawCoverPage(doc, analysis, label);
      // Cover has its own footer band — no standard footer needed

      // ── Page 2: Cost Trend ──────────────────────────────────────────────
      if (analysis.trend && analysis.trend.length > 0) {
        pageNum = newPage(doc, pageNum, label);
        drawSectionHeader(doc, 'Cost Trend', `${analysis.startDate} → ${analysis.endDate}`);
        doc.moveDown(0.3);

        const trendPoints = analysis.trend.map(p => ({ label: p.date.slice(5), value: p.cost }));
        drawLineChart(doc, trendPoints, {
          x: 50, y: doc.y, width: contentW, height: 185,
          valueFormatter: fmtCostShort,
          lineColor: COLORS.secondary, fillColor: COLORS.secondary,
        });

        // Stat row
        const vals = trendPoints.map(p => p.value);
        const avg  = vals.reduce((s, v) => s + v, 0) / vals.length;
        if (!needsNewPage(doc, 48)) {
          doc.moveDown(0.8);
          const statY = doc.y;
          const sw    = contentW / 3;
          const stats = [
            { label: 'Average Daily', value: fmtCost(avg,              analysis.currency), color: PALETTE[0] },
            { label: 'Peak Day',      value: fmtCost(Math.max(...vals), analysis.currency), color: PALETTE[3] },
            { label: 'Lowest Day',    value: fmtCost(Math.min(...vals), analysis.currency), color: PALETTE[2] },
          ];
          for (let i = 0; i < 3; i++) {
            const sx = 50 + i * sw;
            doc.roundedRect(sx, statY, sw - 10, 36, 3).fill(COLORS.bgLight);
            doc.moveTo(sx, statY).lineTo(sx, statY + 36).strokeColor(stats[i].color).lineWidth(3).stroke();
            doc.fontSize(11).fillColor(COLORS.primary)
               .text(stats[i].value, sx + 8, statY + 4, { width: sw - 22, lineBreak: false });
            doc.fontSize(7.5).fillColor(COLORS.textLight)
               .text(stats[i].label, sx + 8, statY + 22, { width: sw - 22, lineBreak: false });
          }
          doc.y = statY + 46;
        }
      }

      // ── Services ────────────────────────────────────────────────────────
      if (analysis.byService && analysis.byService.length > 0) {
        pageNum = sectionSep(doc, pageNum, label, 200);
        drawSectionHeader(doc, 'Cost by Service', `${analysis.byService.length} services`);
        doc.moveDown(0.3);

        // Compact donut
        const top7svc = analysis.byService.slice(0, 7);
        const oth7    = analysis.byService.slice(7).reduce((s, r) => s + r.cost, 0);
        const svcSlices = [
          ...top7svc.map((s, i) => ({ label: s.service, value: s.cost, color: PALETTE[i] })),
          ...(oth7 > 0 ? [{ label: 'Others', value: oth7, color: '#9ca3af' }] : []),
        ];
        const donutSvcY = doc.y;
        drawDonutChart(doc, svcSlices, {
          cx: 125, cy: donutSvcY + 65,
          outerRadius: 58, innerRadius: 34,
          legendX: 210, legendY: donutSvcY + 4,
          centerLabel: 'Total',
          centerValue: fmtCostShort(analysis.totalCost),
        });
        doc.x = 50;
        doc.y = donutSvcY + 65 + 62;

        // Bar chart
        if (!needsNewPage(doc, 90)) {
          doc.moveDown(0.3);
          const top10 = analysis.byService.slice(0, 10);
          drawHorizontalBarChart(doc, top10.map((s, i) => ({
            label: s.service, value: s.cost,
            secondaryValue: s.previousPeriodCost > 0 ? s.previousPeriodCost : undefined,
            color: PALETTE[i],
          })), {
            x: 50, y: doc.y, width: contentW,
            height: Math.min(190, top10.length * 20 + 8),
            valueFormatter: (v) => fmtCost(v, analysis.currency),
            maxLabelWidth: 185,
          });
        }

        // Table (drawTable adds pages internally — we footer after it finishes)
        doc.moveDown(0.4);
        drawTable(doc, [
          { header: 'Service',        width: 220 },
          { header: 'Cost',           width: 110, align: 'right' },
          { header: '% of Total',     width:  80, align: 'right' },
          { header: 'vs Prev Period', width:  85, align: 'right',
            colorFn: (v) => v === '—' ? COLORS.textLight : v.startsWith('-') ? COLORS.positive : COLORS.negative },
        ], analysis.byService.map(s => ({
          'Service':        s.service,
          'Cost':           fmtCost(s.cost, analysis.currency),
          '% of Total':     pct(s.cost, analysis.totalCost),
          'vs Prev Period': s.previousPeriodCost > 0
            ? `${s.percentChange >= 0 ? '+' : ''}${s.percentChange.toFixed(1)}%` : '—',
        })), { x: 50, y: doc.y, fontSize: 8, rowAlternateBg: COLORS.bgLight });
        // Footer for last page of this section (drawTable may have added pages)
        addPageFooter(doc, pageNum, label);
      }

      // ── Regions ──────────────────────────────────────────────────────────
      if (analysis.byRegion && analysis.byRegion.length > 0) {
        pageNum = sectionSep(doc, pageNum, label, 170);
        drawSectionHeader(doc, 'Cost by Region', `${analysis.byRegion.length} regions`);
        doc.moveDown(0.3);

        // Compact donut
        const top6reg = analysis.byRegion.slice(0, 6);
        const othReg  = analysis.byRegion.slice(6).reduce((s, r) => s + r.cost, 0);
        const regSlices = [
          ...top6reg.map((r, i) => ({ label: r.region || 'global', value: r.cost, color: PALETTE[i] })),
          ...(othReg > 0 ? [{ label: 'Others', value: othReg, color: '#9ca3af' }] : []),
        ];
        const donutRegY = doc.y;
        drawDonutChart(doc, regSlices, {
          cx: 115, cy: donutRegY + 54,
          outerRadius: 48, innerRadius: 28,
          legendX: 195, legendY: donutRegY + 4,
          centerLabel: 'Regions',
          centerValue: String(analysis.byRegion.length),
        });
        doc.x = 50;
        doc.y = donutRegY + 54 + 52;

        // Bar chart
        if (!needsNewPage(doc, 70)) {
          doc.moveDown(0.3);
          drawHorizontalBarChart(doc, analysis.byRegion.map((r, i) => ({
            label: r.region || 'global', value: r.cost, color: PALETTE[i % PALETTE.length],
          })), {
            x: 50, y: doc.y, width: contentW,
            height: Math.min(170, analysis.byRegion.length * 20 + 8),
            valueFormatter: (v) => fmtCost(v, analysis.currency),
            maxLabelWidth: 155,
          });
        }

        doc.moveDown(0.4);
        drawTable(doc, [
          { header: 'Region',     width: 255 },
          { header: 'Cost',       width: 145, align: 'right' },
          { header: '% of Total', width:  95, align: 'right' },
        ], analysis.byRegion.map(r => ({
          'Region':     r.region || 'global',
          'Cost':       fmtCost(r.cost, analysis.currency),
          '% of Total': pct(r.cost, analysis.totalCost),
        })), { x: 50, y: doc.y, fontSize: 8, rowAlternateBg: COLORS.bgLight });
        addPageFooter(doc, pageNum, label);
      }

      // ── Projects ─────────────────────────────────────────────────────────
      if (analysis.byProject && analysis.byProject.length > 0) {
        pageNum = sectionSep(doc, pageNum, label, 150);
        drawSectionHeader(doc, 'Cost by Project', `${analysis.byProject.length} projects`);
        doc.moveDown(0.3);

        const top12 = analysis.byProject.slice(0, 12);
        drawHorizontalBarChart(doc, top12.map((p, i) => ({
          label: p.projectName || p.projectId, value: p.cost, color: PALETTE[i % PALETTE.length],
        })), {
          x: 50, y: doc.y, width: contentW,
          height: Math.min(210, top12.length * 20 + 8),
          valueFormatter: (v) => fmtCost(v, analysis.currency),
          maxLabelWidth: 195,
        });

        doc.moveDown(0.4);
        drawTable(doc, [
          { header: 'Project ID',   width: 155 },
          { header: 'Project Name', width: 155 },
          { header: 'Cost',         width: 110, align: 'right' },
          { header: '% of Total',   width:  75, align: 'right' },
        ], analysis.byProject.map(p => ({
          'Project ID':   p.projectId,
          'Project Name': p.projectName || '—',
          'Cost':         fmtCost(p.cost, analysis.currency),
          '% of Total':   pct(p.cost, analysis.totalCost),
        })), { x: 50, y: doc.y, fontSize: 8, rowAlternateBg: COLORS.bgLight });
        addPageFooter(doc, pageNum, label);
      }

      // ── Top Resources ────────────────────────────────────────────────────
      if (analysis.byResource && analysis.byResource.length > 0) {
        const top15 = analysis.byResource.slice(0, 15);
        pageNum = sectionSep(doc, pageNum, label, 150);
        drawSectionHeader(doc, 'Top Resources by Cost',
          `Top ${top15.length} of ${analysis.byResource.length} resources`);
        doc.moveDown(0.3);

        drawHorizontalBarChart(doc, top15.map((r, i) => ({
          label: r.shortName, value: r.cost, color: PALETTE[i % PALETTE.length],
        })), {
          x: 50, y: doc.y, width: contentW,
          height: Math.min(260, top15.length * 20 + 8),
          valueFormatter: (v) => fmtCost(v, analysis.currency),
          maxLabelWidth: 180,
        });

        doc.moveDown(0.4);
        drawTable(doc, [
          { header: 'Resource',   width: 145 },
          { header: 'Service',    width: 120 },
          { header: 'Region',     width:  80 },
          { header: 'Cost',       width: 105, align: 'right' },
          { header: '% of Total', width:  45, align: 'right' },
        ], top15.map(r => ({
          'Resource':   r.shortName,
          'Service':    r.service,
          'Region':     r.region || 'global',
          'Cost':       fmtCost(r.cost, analysis.currency),
          '% of Total': pct(r.cost, analysis.totalCost),
        })), { x: 50, y: doc.y, fontSize: 8, rowAlternateBg: COLORS.bgLight });

        if (!needsNewPage(doc, 22)) {
          doc.moveDown(0.6);
          doc.font('Helvetica-Oblique').fontSize(8).fillColor(COLORS.textLight)
             .text(
               'Note: See the accompanying Excel export for the complete resource list and full per-SKU breakdown.',
               50, doc.y, { width: contentW },
             );
        }
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

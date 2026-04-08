// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import PDFDocument from 'pdfkit';
import { createWriteStream } from 'fs';
import path from 'path';
import type { GCPAssessmentResult, GCPAssessmentRecommendation } from '../../shared/types';
import { getGradeColor } from '../assessment/scoring';
import {
  drawSectionHeader,
  drawHorizontalBarChart,
  drawDonutChart,
  drawTable,
  drawStatBoxes,
  drawGroupSubHeader,
  drawGradeBand,
} from './pdf-chart-helpers';

type ProgressCallback = (progress: { percent: number; stage: string }) => void;

const COLORS = {
  primary: '#1a73e8',
  secondary: '#2563eb',
  text: '#1f2937',
  textLight: '#6b7280',
  border: '#e5e7eb',
  bgLight: '#f9fafb',
  critical: '#dc2626',
  high: '#ea580c',
  medium: '#d97706',
  low: '#2563eb',
  info: '#6b7280',
  pass: '#16a34a',
  fail: '#dc2626',
};

function severityColor(severity: string): string {
  switch (severity.toLowerCase()) {
    case 'critical': return COLORS.critical;
    case 'high': return COLORS.high;
    case 'medium': return COLORS.medium;
    case 'low': return COLORS.low;
    default: return COLORS.info;
  }
}

function formatDuration(ms: number): string {
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  return `${minutes}m ${remaining}s`;
}

const DOMAIN_LABELS: Record<string, string> = {
  cost: 'Cost Optimization',
  security: 'Security',
  reliability: 'Reliability',
  compliance: 'Compliance',
  iam: 'IAM & Access',
};

function addPageFooter(doc: PDFKit.PDFDocument, pageNum: number): void {
  const bottom = doc.page.height - 40;
  doc
    .save()
    .fontSize(8)
    .fillColor(COLORS.textLight)
    .text('GCP Assessment Report', 50, bottom, { align: 'left', width: 300 })
    .text(`Page ${pageNum}`, 50, bottom, { align: 'right', width: doc.page.width - 100 })
    .restore();
}

function ensureSpace(doc: PDFKit.PDFDocument, needed: number): void {
  if (doc.y + needed > doc.page.height - 60) {
    doc.addPage();
  }
}

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low', 'info'];

function sortBySeverity(recs: GCPAssessmentRecommendation[]): GCPAssessmentRecommendation[] {
  return [...recs].sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity));
}

export async function generateGCPAssessmentPdf(
  outputDir: string,
  result: GCPAssessmentResult,
  onProgress?: ProgressCallback
): Promise<string> {
  return new Promise((resolve, reject) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filePath = path.join(outputDir, `gcp-assessment-${result.projectId}-${timestamp}.pdf`);
    const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
    const stream = createWriteStream(filePath);
    doc.pipe(stream);

    const pageNum = { value: 1 };

    onProgress?.({ percent: 5, stage: 'Creating cover page' });

    // ──────────────────────────────────────────────
    // Cover Page
    // ──────────────────────────────────────────────
    doc.rect(0, 0, doc.page.width, 180).fill(COLORS.primary);
    doc
      .fontSize(28)
      .fillColor('#ffffff')
      .text('GCP Assessment Report', 50, 60, { align: 'center' })
      .fontSize(14)
      .text('Health & Compliance Report', { align: 'center' });

    doc.moveDown(4);

    // Grade circle
    const gradeColor = getGradeColor(result.overallGrade);
    const cx = doc.page.width / 2;
    const cy = 280;
    doc.circle(cx, cy, 50).fill(gradeColor);
    doc
      .fontSize(40)
      .fillColor('#ffffff')
      .text(result.overallGrade, cx - 25, cy - 15, { width: 50, align: 'center' });

    doc
      .fontSize(16)
      .fillColor(COLORS.text)
      .text(`Overall Score: ${result.overallScore}/100`, 50, cy + 70, { align: 'center' });

    // Stat boxes below score
    drawStatBoxes(doc, [
      { label: 'Recommendations', value: String(result.totalRecommendations) },
      { label: 'Critical', value: String(result.criticalCount) },
      { label: 'High', value: String(result.highCount) },
      { label: 'Domains Assessed', value: String(result.domainScores.length) },
    ], { x: 50, y: cy + 100, totalWidth: 495 });

    doc.moveDown(1);
    doc.fontSize(12).fillColor(COLORS.text);
    const infoY = doc.y;
    doc.text(`Project: ${result.projectId}`, 100, infoY);
    doc.text(`Date: ${new Date(result.timestamp).toLocaleString()}`, 100);
    doc.text(`Duration: ${formatDuration(result.duration)}`, 100);
    doc.text(`Domains: ${result.domainScores.map(d => DOMAIN_LABELS[d.domain] || d.domain).join(', ')}`, 100);

    if (result.errors.length > 0) {
      doc.moveDown();
      doc.fontSize(10).fillColor(COLORS.medium);
      doc.text(`Note: ${result.errors.length} domain(s) encountered issues during assessment.`, 100);
    }

    onProgress?.({ percent: 15, stage: 'Writing executive summary' });

    // ──────────────────────────────────────────────
    // Executive Summary
    // ──────────────────────────────────────────────
    doc.addPage();
    drawSectionHeader(doc, 'Executive Summary');

    // Domain score cards
    doc.fontSize(12).fillColor(COLORS.text).text('Domain Scores', 50, doc.y);
    doc.moveDown(0.5);

    const cardWidth = Math.min(120, Math.floor((495 - (result.domainScores.length - 1) * 10) / result.domainScores.length));
    const cardHeight = 70;
    const cardGap = 10;
    const startX = 50;
    const cardsY = doc.y;

    for (let i = 0; i < result.domainScores.length; i++) {
      const ds = result.domainScores[i];
      const x = startX + i * (cardWidth + cardGap);

      const cardGradeColor = getGradeColor(ds.grade);
      doc.rect(x, cardsY, cardWidth, cardHeight).fill('#f3f4f6');
      doc.rect(x, cardsY, cardWidth, 4).fill(cardGradeColor);

      doc
        .fontSize(9)
        .fillColor(COLORS.textLight)
        .text(DOMAIN_LABELS[ds.domain] || ds.domain, x + 5, cardsY + 10, { width: cardWidth - 10 });

      doc
        .fontSize(22)
        .fillColor(cardGradeColor)
        .text(ds.grade, x + 5, cardsY + 28, { width: cardWidth - 10 });

      doc
        .fontSize(9)
        .fillColor(COLORS.text)
        .text(`${ds.score}/100 — ${ds.findings} findings`, x + 5, cardsY + 52, { width: cardWidth - 10 });
    }

    doc.x = 50;
    doc.y = cardsY + cardHeight + 20;

    // Domain scores bar chart
    ensureSpace(doc, 110);
    doc.fontSize(12).fillColor(COLORS.text).text('Domain Score Comparison', 50, doc.y);
    doc.moveDown(0.5);

    drawHorizontalBarChart(doc, result.domainScores.map(ds => ({
      label: DOMAIN_LABELS[ds.domain] || ds.domain,
      value: ds.score,
      color: getGradeColor(ds.grade),
    })), {
      x: 50, y: doc.y, width: 495, height: 90,
      valueFormatter: (v) => `${v}/100`,
      maxLabelWidth: 130,
    });

    doc.moveDown(0.5);

    // Severity donut chart
    ensureSpace(doc, 130);
    doc.fontSize(12).fillColor(COLORS.text).text('Finding Severity Distribution', 50, doc.y);
    doc.moveDown(0.5);

    const donutY = doc.y;
    const totalFindings = result.criticalCount + result.highCount + result.mediumCount + result.lowCount;

    drawDonutChart(doc, [
      { label: 'Critical', value: result.criticalCount, color: COLORS.critical },
      { label: 'High', value: result.highCount, color: COLORS.high },
      { label: 'Medium', value: result.mediumCount, color: COLORS.medium },
      { label: 'Low', value: result.lowCount, color: COLORS.low },
    ], {
      cx: 130, cy: donutY + 50,
      outerRadius: 45, innerRadius: 28,
      legendX: 210, legendY: donutY + 15,
      centerValue: String(totalFindings),
      centerLabel: 'total',
    });

    doc.y = donutY + 120;

    // Top-5 recs as table
    const topRecs = result.domainScores
      .flatMap(d => d.recommendations)
      .filter(r => r.severity === 'critical' || r.severity === 'high')
      .slice(0, 5);

    if (topRecs.length > 0) {
      ensureSpace(doc, 40 + topRecs.length * 22);
      doc.fontSize(12).fillColor(COLORS.text).text('Top Priority Recommendations', 50, doc.y);
      doc.moveDown(0.5);

      const topRecCols = [
        { header: 'Severity', width: 55, colorFn: (v: string) => severityColor(v) },
        { header: 'Title', width: 250 },
        { header: 'Description', width: 190 },
      ];
      const topRecRows = topRecs.map(r => ({
        Severity: r.severity.toUpperCase(),
        Title: r.title,
        Description: r.remediation || r.description,
      }));

      drawTable(doc, topRecCols, topRecRows, { x: 50, y: doc.y }, pageNum, addPageFooter);
    }

    onProgress?.({ percent: 40, stage: 'Writing domain details' });

    // ──────────────────────────────────────────────
    // Domain Details
    // ──────────────────────────────────────────────
    for (let di = 0; di < result.domainScores.length; di++) {
      const ds = result.domainScores[di];
      const domainLabel = DOMAIN_LABELS[ds.domain] || ds.domain;
      const pct = 40 + Math.round((di / result.domainScores.length) * 40);

      onProgress?.({ percent: pct, stage: `Writing ${domainLabel} details` });

      doc.addPage();
      drawSectionHeader(doc, domainLabel, `Score: ${ds.score}/100 — Grade: ${ds.grade}`);

      // Score bar
      doc.fontSize(11).fillColor(COLORS.text).text(`Weight: ${Math.round(ds.weight * 100)}%  |  Findings: ${ds.findings}  |  Recommendations: ${ds.recommendations.length}`, 50, doc.y);
      doc.moveDown();

      // Recommendations grouped by severity
      if (ds.recommendations.length > 0) {
        const sorted = sortBySeverity(ds.recommendations);
        const hasSavings = ds.domain === 'cost' && sorted.some(r => r.estimatedSavings);

        const sevGroups: [string, string][] = [
          ['critical', COLORS.critical],
          ['high', COLORS.high],
          ['medium', COLORS.medium],
          ['low', COLORS.low],
          ['info', COLORS.info],
        ];

        const recCols = hasSavings
          ? [
              { header: 'Severity', width: 45, colorFn: (v: string) => severityColor(v) },
              { header: 'Title', width: 140 },
              { header: 'Description', width: 150 },
              { header: 'Impact', width: 100 },
              { header: 'Savings', width: 60, align: 'right' as const },
            ]
          : [
              { header: 'Severity', width: 45, colorFn: (v: string) => severityColor(v) },
              { header: 'Title', width: 150 },
              { header: 'Description', width: 160 },
              { header: 'Impact', width: 140 },
            ];

        for (const [sev, sevColor] of sevGroups) {
          const group = sorted.filter(r => r.severity === sev);
          if (group.length === 0) continue;

          ensureSpace(doc, 50);
          drawGroupSubHeader(doc, sev.toUpperCase(), group.length, sevColor, 50);

          const recRows = group.map(r => {
            const base: Record<string, string> = {
              Severity: r.severity.toUpperCase(),
              Title: r.title,
              Description: r.description,
              Impact: r.impact || '',
            };
            if (hasSavings) {
              base.Savings = r.estimatedSavings
                ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(r.estimatedSavings)
                : '';
            }
            return base;
          });

          drawTable(doc, recCols, recRows, { x: 50, y: doc.y }, pageNum, addPageFooter);
          doc.moveDown(0.3);
        }
      } else {
        doc.fontSize(10).fillColor(COLORS.textLight).text('No recommendations for this domain.', 50, doc.y);
        doc.moveDown();
      }
    }

    onProgress?.({ percent: 85, stage: 'Writing methodology' });

    // ──────────────────────────────────────────────
    // Appendix — Methodology
    // ──────────────────────────────────────────────
    doc.addPage();
    drawSectionHeader(doc, 'Appendix: Methodology');

    // Scoring weights bar chart
    doc.fontSize(11).fillColor(COLORS.text).text('Scoring Weights', 50, doc.y);
    doc.moveDown(0.5);

    const weightItems = result.domainScores.map(ds => ({
      label: DOMAIN_LABELS[ds.domain] || ds.domain,
      value: Math.round(ds.weight * 100),
      color: getGradeColor(ds.grade),
    }));

    drawHorizontalBarChart(doc, weightItems, {
      x: 50, y: doc.y, width: 400, height: 90,
      valueFormatter: (v) => `${v}%`,
      maxLabelWidth: 140,
    });

    doc.moveDown();

    // Grade scale as color band
    doc.fontSize(11).fillColor(COLORS.text).text('Grade Scale', 50, doc.y);
    doc.moveDown(0.5);
    drawGradeBand(doc, 50, doc.y, 495);

    doc.moveDown();

    doc.fillColor(COLORS.text).fontSize(11).text('Data Sources:', 50, doc.y);
    doc.fontSize(10).fillColor(COLORS.textLight);
    doc.text('  Cost: GCP Billing / Recommender API', 50);
    doc.text('  Security: Security Command Center / Best Practices Scan');
    doc.text('  Reliability: Resource Configuration Analysis');
    doc.text('  Compliance: CIS GCP Benchmark / Best Practices');
    doc.text('  IAM: IAM Policy Analysis');
    doc.moveDown(0.5);

    doc.fillColor(COLORS.text).fontSize(10).text(`Assessment ID: ${result.id}`, 50);
    doc.text(`Generated: ${new Date().toISOString()}`);

    // Add footers to all pages in a single pass using buffered pages
    const totalPages = doc.bufferedPageRange().count;
    for (let i = 0; i < totalPages; i++) {
      doc.switchToPage(i);
      addPageFooter(doc, i + 1);
    }

    doc.end();

    stream.on('finish', () => {
      onProgress?.({ percent: 100, stage: 'Complete' });
      resolve(filePath);
    });

    stream.on('error', reject);
  });
}

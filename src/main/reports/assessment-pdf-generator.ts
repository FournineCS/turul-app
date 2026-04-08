// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import PDFDocument from 'pdfkit';
import { createWriteStream } from 'fs';
import path from 'path';
import type { AssessmentResult, AssessmentRecommendation } from '../../shared/types';
import { getGradeColor } from '../assessment/scoring';
import {
  drawSectionHeader,
  drawHorizontalBarChart,
  drawDonutChart,
  drawLineChart,
  drawTable,
  drawGauge,
  drawStatBoxes,
  drawGroupSubHeader,
  drawGradeBand,
} from './pdf-chart-helpers';

type ProgressCallback = (progress: { percent: number; stage: string }) => void;

const COLORS = {
  primary: '#1e3a5f',
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

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
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
  wellArchitected: 'Well-Architected',
  inventory: 'Resource Inventory',
};

function addPageFooter(doc: PDFKit.PDFDocument, pageNum: number): void {
  const bottom = doc.page.height - 40;
  doc
    .save()
    .fontSize(8)
    .fillColor(COLORS.textLight)
    .text('AWS Resource Analyzer — Account Assessment Report', 50, bottom, { align: 'left', width: 300 })
    .text(`Page ${pageNum}`, 50, bottom, { align: 'right', width: doc.page.width - 100 })
    .restore();
}

function ensureSpace(doc: PDFKit.PDFDocument, needed: number): void {
  if (doc.y + needed > doc.page.height - 60) {
    doc.addPage();
  }
}

const SEVERITY_ORDER = ['critical', 'high', 'medium', 'low', 'info'];

function sortBySeverity(recs: AssessmentRecommendation[]): AssessmentRecommendation[] {
  return [...recs].sort((a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity));
}

export async function generateAssessmentPdf(
  outputDir: string,
  result: AssessmentResult,
  onProgress?: ProgressCallback
): Promise<string> {
  return new Promise((resolve, reject) => {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const filePath = path.join(outputDir, `assessment-${result.profile}-${timestamp}.pdf`);
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
      .text('AWS Account Assessment', 50, 60, { align: 'center' })
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
    const totalSavings = result.costOptimizations?.totalPotentialSavings ?? 0;
    const resourceCount = result.resourceSummary?.totalResources ?? 0;
    drawStatBoxes(doc, [
      { label: 'Recommendations', value: String(result.totalRecommendations) },
      { label: 'Potential Savings', value: totalSavings > 0 ? formatCurrency(totalSavings) : 'N/A' },
      { label: 'Resources Scanned', value: String(resourceCount) },
      { label: 'Domains Assessed', value: String(result.domainScores.length) },
    ], { x: 50, y: cy + 100, totalWidth: 495 });

    doc.moveDown(1);
    doc.fontSize(12).fillColor(COLORS.text);
    const infoY = doc.y;
    doc.text(`Profile: ${result.profile}`, 100, infoY);
    doc.text(`Region: ${result.region}`, 100);
    if (result.accountId) doc.text(`Account ID: ${result.accountId}`, 100);
    doc.text(`Date: ${new Date(result.timestamp).toLocaleString()}`, 100);
    doc.text(`Duration: ${formatDuration(result.duration)}`, 100);
    doc.text(`Domains: ${result.domainScores.map(d => DOMAIN_LABELS[d.domain]).join(', ')}`, 100);

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

    const cardWidth = 120;
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
        { header: 'Remediation', width: 190 },
      ];
      const topRecRows = topRecs.map(r => ({
        Severity: r.severity.toUpperCase(),
        Title: r.title,
        Remediation: r.remediation || r.description,
      }));

      drawTable(doc, topRecCols, topRecRows, { x: 50, y: doc.y }, pageNum, addPageFooter);
    }

    onProgress?.({ percent: 30, stage: 'Writing cost analysis' });

    // ──────────────────────────────────────────────
    // Cost Analysis
    // ──────────────────────────────────────────────
    const costScore = result.domainScores.find(d => d.domain === 'cost');
    if (costScore && result.costData) {
      doc.addPage();
      drawSectionHeader(doc, 'Cost Analysis');

      doc.fontSize(12).fillColor(COLORS.text);
      doc.text(`Total Cost: ${formatCurrency(result.costData.totalCost)}`, 50, doc.y);
      doc.text(`Previous Period: ${formatCurrency(result.costData.previousPeriodTotalCost)}`);

      const changeDir = result.costData.percentChange >= 0 ? 'increased' : 'decreased';
      const changeColor = result.costData.percentChange > 0 ? COLORS.high : COLORS.pass;
      doc.fillColor(changeColor).text(
        `Change: ${changeDir} ${Math.abs(result.costData.percentChange).toFixed(1)}%`
      );

      if (result.costOptimizations) {
        doc.fillColor(COLORS.text).text(
          `Potential Savings: ${formatCurrency(result.costOptimizations.totalPotentialSavings)}/month`
        );
      }

      doc.fillColor(COLORS.text);
      doc.moveDown();

      // Cost trend line chart
      if (result.costData.trend && result.costData.trend.length > 0) {
        ensureSpace(doc, 170);
        doc.fontSize(12).fillColor(COLORS.text).text('Daily Cost Trend', 50, doc.y);
        doc.moveDown(0.5);

        drawLineChart(doc, result.costData.trend.map(t => ({
          label: t.date.slice(5), // MM-DD
          value: t.cost,
        })), {
          x: 50, y: doc.y, width: 495, height: 150,
          valueFormatter: (v) => formatCurrency(v),
        });

        doc.moveDown(0.5);
      }

      // Top services bar chart
      ensureSpace(doc, 200);
      doc.fontSize(12).fillColor(COLORS.text).text('Top Services by Cost', 50, doc.y);
      doc.moveDown(0.5);

      const topServices = result.costData.byService.slice(0, 10);
      drawHorizontalBarChart(doc, topServices.map(svc => ({
        label: svc.service,
        value: svc.cost,
        secondaryValue: svc.previousPeriodCost,
      })), {
        x: 50, y: doc.y, width: 495, height: Math.min(topServices.length * 22, 200),
        valueFormatter: (v) => formatCurrency(v),
        maxLabelWidth: 150,
      });

      doc.moveDown(0.5);

      // Cost by region donut
      if (result.costData.byRegion && result.costData.byRegion.length > 1) {
        ensureSpace(doc, 140);
        doc.fontSize(12).fillColor(COLORS.text).text('Cost by Region', 50, doc.y);
        doc.moveDown(0.5);

        const regionPalette = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];
        const regionY = doc.y;
        const regionTotal = result.costData.byRegion.reduce((s, r) => s + r.cost, 0);

        drawDonutChart(doc, result.costData.byRegion.slice(0, 8).map((r, i) => ({
          label: r.region,
          value: r.cost,
          color: regionPalette[i % regionPalette.length],
        })), {
          cx: 130, cy: regionY + 50,
          outerRadius: 45, innerRadius: 28,
          legendX: 210, legendY: regionY + 5,
          centerValue: formatCurrency(regionTotal),
          centerLabel: 'total',
        });

        doc.y = regionY + 125;
      }

      // Cost optimization recommendations table
      if (result.costOptimizations && result.costOptimizations.recommendations.length > 0) {
        ensureSpace(doc, 60);
        doc.fontSize(12).fillColor(COLORS.text).text('Cost Optimization Recommendations', 50, doc.y);
        doc.moveDown(0.5);

        const costRecCols = [
          { header: 'Severity', width: 45, colorFn: (v: string) => severityColor(v) },
          { header: 'Service', width: 80 },
          { header: 'Description', width: 200 },
          { header: 'Savings/mo', width: 70, align: 'right' as const },
          { header: 'Action', width: 100 },
        ];
        const costRecRows = result.costOptimizations.recommendations.map(r => ({
          Severity: r.severity.toUpperCase(),
          Service: r.service,
          Description: r.description,
          'Savings/mo': formatCurrency(r.estimatedMonthlySavings),
          Action: r.actionRequired,
        }));

        drawTable(doc, costRecCols, costRecRows, { x: 50, y: doc.y }, pageNum, addPageFooter);
      }
    }

    onProgress?.({ percent: 45, stage: 'Writing security analysis' });

    // ──────────────────────────────────────────────
    // Security Posture
    // ──────────────────────────────────────────────
    const secScore = result.domainScores.find(d => d.domain === 'security');
    if (secScore && result.securityData) {
      doc.addPage();
      drawSectionHeader(doc, 'Security Posture');

      const summary = result.securityData.summary;
      doc.fontSize(12).fillColor(COLORS.text);
      doc.text(`Total Findings: ${summary.totalFindings}`, 50, doc.y);
      doc.moveDown();

      // Severity donut
      const secDonutY = doc.y;
      drawDonutChart(doc, [
        { label: 'Critical', value: summary.criticalCount, color: COLORS.critical },
        { label: 'High', value: summary.highCount, color: COLORS.high },
        { label: 'Medium', value: summary.mediumCount, color: COLORS.medium },
        { label: 'Low', value: summary.lowCount, color: COLORS.low },
        { label: 'Info', value: summary.informationalCount, color: COLORS.info },
      ], {
        cx: 130, cy: secDonutY + 50,
        outerRadius: 45, innerRadius: 28,
        legendX: 210, legendY: secDonutY + 5,
        centerValue: String(summary.totalFindings),
        centerLabel: 'findings',
      });

      doc.y = secDonutY + 120;

      // Source breakdown bar chart
      const sourceEntries = Object.entries(summary.bySource).filter(([, v]) => v > 0);
      if (sourceEntries.length > 0) {
        ensureSpace(doc, 20 + sourceEntries.length * 22);
        doc.fontSize(12).fillColor(COLORS.text).text('Findings by Source', 50, doc.y);
        doc.moveDown(0.5);

        const sourcePalette: Record<string, string> = {
          SECURITY_HUB: '#2563eb',
          BEST_PRACTICES: '#16a34a',
          GUARDDUTY: '#d97706',
          INSPECTOR: '#8b5cf6',
          ACCESS_ANALYZER: '#ec4899',
          CONFIG: '#06b6d4',
        };

        drawHorizontalBarChart(doc, sourceEntries.map(([source, count]) => ({
          label: source.replace(/_/g, ' '),
          value: count,
          color: sourcePalette[source] || '#6b7280',
        })), {
          x: 50, y: doc.y, width: 495, height: Math.min(sourceEntries.length * 22, 140),
          maxLabelWidth: 140,
        });

        doc.moveDown(0.5);
      }

      // Compliance scores as bar chart
      if (summary.complianceScores.length > 0) {
        ensureSpace(doc, 20 + summary.complianceScores.length * 22);
        doc.fontSize(12).fillColor(COLORS.text).text('Compliance Scores', 50, doc.y);
        doc.moveDown(0.5);

        drawHorizontalBarChart(doc, summary.complianceScores.map(cs => ({
          label: cs.standardName,
          value: cs.score,
          color: cs.score >= 90 ? COLORS.pass : cs.score >= 60 ? COLORS.medium : COLORS.fail,
        })), {
          x: 50, y: doc.y, width: 495,
          height: Math.min(summary.complianceScores.length * 22, 140),
          valueFormatter: (v) => `${v.toFixed(0)}%`,
          maxLabelWidth: 180,
        });

        doc.moveDown(0.5);
      }

      // Security findings tables grouped by severity
      const activeFindings = result.securityData.findings.filter(f => f.status === 'ACTIVE');

      if (activeFindings.length > 0) {
        ensureSpace(doc, 40);
        doc.fontSize(12).fillColor(COLORS.text).text('Security Findings', 50, doc.y);
        doc.moveDown(0.5);

        const sevGroups: [string, string][] = [
          ['CRITICAL', COLORS.critical],
          ['HIGH', COLORS.high],
          ['MEDIUM', COLORS.medium],
          ['LOW', COLORS.low],
          ['INFORMATIONAL', COLORS.info],
        ];

        const findingsCols = [
          { header: 'Title', width: 180 },
          { header: 'Source', width: 65 },
          { header: 'Resource Type', width: 75 },
          { header: 'Resource ID', width: 100 },
          { header: 'Status', width: 75 },
        ];

        for (const [sev, sevColor] of sevGroups) {
          const group = activeFindings.filter(f => f.severity === sev);
          if (group.length === 0) continue;

          ensureSpace(doc, 50);
          drawGroupSubHeader(doc, sev, group.length, sevColor, 50);

          const groupRows = group.map(f => ({
            Title: f.title,
            Source: (f.source || '').replace(/_/g, ' '),
            'Resource Type': f.resourceType || '',
            'Resource ID': f.resourceId || '',
            Status: f.status,
          }));

          drawTable(doc, findingsCols, groupRows, { x: 50, y: doc.y }, pageNum, addPageFooter);
          doc.moveDown(0.3);
        }

        // Footer note
        const usedSources = sourceEntries.map(([s]) => s.replace(/_/g, ' ')).join(', ');
        if (usedSources) {
          doc.fontSize(8).fillColor(COLORS.textLight).text(`Data sources: ${usedSources}`, 50, doc.y);
          doc.moveDown(0.5);
        }
      }

    }

    onProgress?.({ percent: 60, stage: 'Writing Well-Architected review' });

    // ──────────────────────────────────────────────
    // Well-Architected Review
    // ──────────────────────────────────────────────
    const waScore = result.domainScores.find(d => d.domain === 'wellArchitected');
    if (waScore && result.waData) {
      doc.addPage();
      drawSectionHeader(doc, 'Well-Architected Review');

      doc.fontSize(12).fillColor(COLORS.text);
      doc.text(`Total Checks: ${result.waData.totalChecks}`, 50, doc.y);
      doc.text(`Passed: ${result.waData.totalPass}  |  Failed: ${result.waData.totalFail}  |  Errors: ${result.waData.totalError}`);

      const passRate = result.waData.totalChecks > 0
        ? ((result.waData.totalPass / result.waData.totalChecks) * 100).toFixed(1)
        : '0.0';
      doc.text(`Pass Rate: ${passRate}%`);
      doc.moveDown();

      // Pillar pass rates bar chart
      ensureSpace(doc, 20 + result.waData.pillarSummaries.length * 22);
      doc.fontSize(12).fillColor(COLORS.text).text('Pillar Pass Rates', 50, doc.y);
      doc.moveDown(0.5);

      drawHorizontalBarChart(doc, result.waData.pillarSummaries.map(p => {
        const rate = p.totalChecks > 0 ? (p.passCount / p.totalChecks) * 100 : 0;
        return {
          label: p.pillarName,
          value: rate,
          color: rate >= 90 ? COLORS.pass : rate >= 60 ? COLORS.medium : COLORS.fail,
        };
      }), {
        x: 50, y: doc.y, width: 495,
        height: Math.min(result.waData.pillarSummaries.length * 22, 160),
        valueFormatter: (v) => `${v.toFixed(0)}%`,
        maxLabelWidth: 160,
      });

      doc.moveDown();

      // Findings tables grouped by pillar
      const allWAFailures = result.waData.pillarSummaries
        .flatMap(p => p.findings.filter(f => f.status === 'FAIL'));

      if (allWAFailures.length > 0) {
        ensureSpace(doc, 40);
        doc.fontSize(12).fillColor(COLORS.text).text('Improvement Areas by Pillar', 50, doc.y);
        doc.moveDown(0.5);

        const waCols = [
          { header: 'Severity', width: 45, colorFn: (v: string) => severityColor(v) },
          { header: 'Check', width: 180 },
          { header: 'Service', width: 70 },
          { header: 'Resource', width: 100 },
          { header: 'Remediation', width: 100 },
        ];

        for (const pillar of result.waData.pillarSummaries) {
          const failures = pillar.findings.filter(f => f.status === 'FAIL');
          if (failures.length === 0) continue;

          ensureSpace(doc, 50);
          const pillarRate = pillar.totalChecks > 0 ? (pillar.passCount / pillar.totalChecks) * 100 : 0;
          const pillarColor = pillarRate >= 90 ? COLORS.pass : pillarRate >= 60 ? COLORS.medium : COLORS.fail;

          drawGroupSubHeader(doc, `${pillar.pillarName}`, failures.length, pillarColor, 50);

          const waRows = failures.map(f => ({
            Severity: f.severity,
            Check: f.title,
            Service: f.service,
            Resource: f.resourceId || '',
            Remediation: f.remediationRecommendation || '',
          }));

          drawTable(doc, waCols, waRows, { x: 50, y: doc.y }, pageNum, addPageFooter);
          doc.moveDown(0.3);
        }
      }

    }

    onProgress?.({ percent: 75, stage: 'Writing resource inventory' });

    // ──────────────────────────────────────────────
    // Resource Inventory
    // ──────────────────────────────────────────────
    const invScore = result.domainScores.find(d => d.domain === 'inventory');
    if (invScore && result.resourceSummary) {
      doc.addPage();
      drawSectionHeader(doc, 'Resource Inventory');

      doc.fontSize(12).fillColor(COLORS.text);
      doc.text(`Total Resources: ${result.resourceSummary.totalResources}`, 50, doc.y);
      doc.text(`Services: ${Object.keys(result.resourceSummary.byService).length}`);
      doc.moveDown();

      // Tag coverage gauge
      ensureSpace(doc, 40);
      drawGauge(doc, {
        x: 50, y: doc.y,
        width: 300, height: 16,
        value: result.resourceSummary.tagCoverage,
        label: 'Tag Coverage',
      });

      doc.moveDown();

      // Top services bar chart
      const sorted = Object.entries(result.resourceSummary.byService)
        .sort(([, a], [, b]) => b - a);

      const topSvcChart = sorted.slice(0, 15);

      ensureSpace(doc, 20 + topSvcChart.length * 20);
      doc.fontSize(12).fillColor(COLORS.text).text('Resources by Service', 50, doc.y);
      doc.moveDown(0.5);

      drawHorizontalBarChart(doc, topSvcChart.map(([service, count]) => ({
        label: service,
        value: count,
      })), {
        x: 50, y: doc.y, width: 495,
        height: Math.min(topSvcChart.length * 20, 320),
        maxLabelWidth: 140,
      });

      doc.moveDown();

      // Full breakdown table if >15 services
      if (sorted.length > 15) {
        ensureSpace(doc, 40);
        doc.fontSize(12).fillColor(COLORS.text).text('Full Service Breakdown', 50, doc.y);
        doc.moveDown(0.5);

        const totalRes = result.resourceSummary.totalResources || 1;
        const svcTableCols = [
          { header: 'Service', width: 200 },
          { header: 'Count', width: 80, align: 'right' as const },
          { header: '% of Total', width: 80, align: 'right' as const },
        ];
        const svcTableRows = sorted.map(([service, count]) => ({
          Service: service,
          Count: String(count),
          '% of Total': `${((count / totalRes) * 100).toFixed(1)}%`,
        }));

        drawTable(doc, svcTableCols, svcTableRows, { x: 50, y: doc.y }, pageNum, addPageFooter);
      }
    }

    onProgress?.({ percent: 85, stage: 'Writing recommendations' });

    // ──────────────────────────────────────────────
    // All Recommendations
    // ──────────────────────────────────────────────
    const allRecs = result.domainScores.flatMap(d => d.recommendations);
    if (allRecs.length > 0) {
      doc.addPage();
      drawSectionHeader(doc, 'All Recommendations', `${allRecs.length} total recommendations`);

      // Group by domain
      const byDomain = new Map<string, AssessmentRecommendation[]>();
      for (const rec of allRecs) {
        const existing = byDomain.get(rec.domain) || [];
        existing.push(rec);
        byDomain.set(rec.domain, existing);
      }

      for (const [domain, recs] of byDomain.entries()) {
        const sortedRecs = sortBySeverity(recs);
        const hasSavings = domain === 'cost' && sortedRecs.some(r => r.estimatedSavings);

        ensureSpace(doc, 50);
        drawGroupSubHeader(doc, DOMAIN_LABELS[domain] || domain, sortedRecs.length, COLORS.secondary, 50);

        const recCols = hasSavings
          ? [
              { header: 'Severity', width: 45, colorFn: (v: string) => severityColor(v) },
              { header: 'Title', width: 145 },
              { header: 'Resource', width: 100 },
              { header: 'Remediation', width: 145 },
              { header: 'Savings', width: 60, align: 'right' as const },
            ]
          : [
              { header: 'Severity', width: 45, colorFn: (v: string) => severityColor(v) },
              { header: 'Title', width: 150 },
              { header: 'Resource', width: 100 },
              { header: 'Remediation', width: 200 },
            ];

        const recRows = sortedRecs.map(r => {
          const base: Record<string, string> = {
            Severity: r.severity.toUpperCase(),
            Title: r.title,
            Resource: r.resourceId || '',
            Remediation: r.remediation || r.description,
          };
          if (hasSavings) {
            base.Savings = r.estimatedSavings ? formatCurrency(r.estimatedSavings) : '';
          }
          return base;
        });

        drawTable(doc, recCols, recRows, { x: 50, y: doc.y }, pageNum, addPageFooter);
        doc.moveDown(0.5);
      }
    }

    onProgress?.({ percent: 95, stage: 'Finalizing' });

    // ──────────────────────────────────────────────
    // Appendix — Methodology
    // ──────────────────────────────────────────────
    doc.addPage();
    drawSectionHeader(doc, 'Appendix: Methodology');

    // Scoring weights bar chart
    doc.fontSize(11).fillColor(COLORS.text).text('Scoring Weights', 50, doc.y);
    doc.moveDown(0.5);

    drawHorizontalBarChart(doc, [
      { label: 'Security', value: 35, color: '#dc2626' },
      { label: 'Cost Optimization', value: 25, color: '#2563eb' },
      { label: 'Well-Architected', value: 25, color: '#8b5cf6' },
      { label: 'Resource Inventory', value: 15, color: '#16a34a' },
    ], {
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
    doc.text('  Cost: AWS Cost Explorer API', 50);
    doc.text('  Security: AWS Security Hub / Best Practices Scan');
    doc.text('  Well-Architected: Best Practices Scan (6 pillars)');
    doc.text('  Inventory: AWS Resource Scanning');
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

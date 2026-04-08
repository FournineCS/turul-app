// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

/**
 * Reusable PDFKit-based chart drawing utilities for assessment PDF reports.
 * All functions use PDFKit primitives: rect, circle, path, lineTo, fill, stroke.
 * No external charting libraries required.
 */

const CHART_PALETTE = [
  '#2563eb', '#16a34a', '#d97706', '#dc2626', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1',
];

// ─── Section Header ──────────────────────────────────────────

export function drawSectionHeader(
  doc: PDFKit.PDFDocument,
  title: string,
  subtitle?: string,
): void {
  doc.fontSize(20).fillColor('#1e3a5f').text(title, 50, doc.y, { width: 495 });
  if (subtitle) {
    doc.fontSize(10).fillColor('#6b7280').text(subtitle);
  }
  const lineY = doc.y + 4;
  doc
    .moveTo(50, lineY)
    .lineTo(545, lineY)
    .strokeColor('#e5e7eb')
    .lineWidth(1)
    .stroke();
  doc.y = lineY + 10;
}

// ─── Horizontal Bar Chart ────────────────────────────────────

export interface BarChartItem {
  label: string;
  value: number;
  color?: string;
  secondaryValue?: number;
}

export interface BarChartOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  valueFormatter?: (v: number) => string;
  showValues?: boolean;
  maxLabelWidth?: number;
}

export function drawHorizontalBarChart(
  doc: PDFKit.PDFDocument,
  items: BarChartItem[],
  options: BarChartOptions,
): void {
  if (items.length === 0) {
    drawEmptyMessage(doc, options.x, options.y, options.width, options.height);
    return;
  }

  const {
    x, y, width, height,
    valueFormatter = (v: number) => String(Math.round(v)),
    showValues = true,
    maxLabelWidth = 120,
  } = options;

  const maxVal = Math.max(...items.map(i => Math.max(i.value, i.secondaryValue ?? 0)), 1);
  const barAreaWidth = width - maxLabelWidth - 10;
  const barHeight = Math.min(Math.floor((height - 10) / items.length) - 6, 18);
  const gap = Math.max(4, Math.floor(((height - 10) - barHeight * items.length) / Math.max(items.length - 1, 1)));

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const barY = y + i * (barHeight + gap);
    const color = item.color || CHART_PALETTE[i % CHART_PALETTE.length];

    // Label
    doc
      .fontSize(8)
      .fillColor('#1f2937')
      .text(
        truncateText(item.label, maxLabelWidth, doc, 8),
        x, barY + 1,
        { width: maxLabelWidth, lineBreak: false },
      );

    const barX = x + maxLabelWidth + 5;

    // Secondary bar (previous period) — lighter, behind
    if (item.secondaryValue != null && item.secondaryValue > 0) {
      const secW = Math.max(2, (item.secondaryValue / maxVal) * barAreaWidth);
      doc.rect(barX, barY, secW, barHeight).fill(hexWithAlpha(color, 0.25));
    }

    // Primary bar
    const barW = Math.max(2, (item.value / maxVal) * barAreaWidth);
    doc.rect(barX, barY, barW, barHeight).fill(color);

    // Value label
    if (showValues) {
      const valText = valueFormatter(item.value);
      doc.fontSize(7).fillColor('#374151').text(valText, barX + barW + 4, barY + 2, { lineBreak: false });
    }
  }

  doc.y = y + height;
}

// ─── Donut Chart ─────────────────────────────────────────────

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

export interface DonutChartOptions {
  cx: number;
  cy: number;
  outerRadius: number;
  innerRadius: number;
  legendX: number;
  legendY: number;
  centerLabel?: string;
  centerValue?: string;
}

export function drawDonutChart(
  doc: PDFKit.PDFDocument,
  slices: DonutSlice[],
  options: DonutChartOptions,
): void {
  const { cx, cy, outerRadius, innerRadius, legendX, legendY, centerLabel, centerValue } = options;

  const filtered = slices.filter(s => s.value > 0);
  const total = filtered.reduce((sum, s) => sum + s.value, 0);

  if (total === 0) {
    // Draw empty ring
    doc.circle(cx, cy, outerRadius).fill('#e5e7eb');
    doc.circle(cx, cy, innerRadius).fill('#ffffff');
    doc.fontSize(9).fillColor('#6b7280').text('No data', cx - 20, cy - 5, { width: 40, align: 'center' });
    return;
  }

  if (filtered.length === 1) {
    // Single slice — concentric circles
    doc.circle(cx, cy, outerRadius).fill(filtered[0].color);
    doc.circle(cx, cy, innerRadius).fill('#ffffff');
  } else {
    let startAngle = -Math.PI / 2; // Start from top

    for (const slice of filtered) {
      const sliceAngle = (slice.value / total) * 2 * Math.PI;
      const endAngle = startAngle + sliceAngle;

      drawArc(doc, cx, cy, outerRadius, innerRadius, startAngle, endAngle, slice.color);
      startAngle = endAngle;
    }
  }

  // Center text
  if (centerValue) {
    doc.fontSize(16).fillColor('#1f2937').text(centerValue, cx - 30, cy - 12, { width: 60, align: 'center' });
    if (centerLabel) {
      doc.fontSize(7).fillColor('#6b7280').text(centerLabel, cx - 30, cy + 6, { width: 60, align: 'center' });
    }
  }

  // Legend
  let ly = legendY;
  for (const slice of slices) {
    doc.rect(legendX, ly + 2, 8, 8).fill(slice.color);
    doc.fontSize(8).fillColor('#374151').text(`${slice.label}: ${slice.value}`, legendX + 12, ly, { lineBreak: false });
    ly += 14;
  }
}

function drawArc(
  doc: PDFKit.PDFDocument,
  cx: number, cy: number,
  outerR: number, innerR: number,
  startAngle: number, endAngle: number,
  color: string,
): void {
  const x1 = cx + outerR * Math.cos(startAngle);
  const y1 = cy + outerR * Math.sin(startAngle);
  const x2 = cx + outerR * Math.cos(endAngle);
  const y2 = cy + outerR * Math.sin(endAngle);
  const x3 = cx + innerR * Math.cos(endAngle);
  const y3 = cy + innerR * Math.sin(endAngle);
  const x4 = cx + innerR * Math.cos(startAngle);
  const y4 = cy + innerR * Math.sin(startAngle);

  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;

  // Build SVG path: outer arc → line to inner → inner arc (reverse) → close
  const d = [
    `M ${x1} ${y1}`,
    `A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2} ${y2}`,
    `L ${x3} ${y3}`,
    `A ${innerR} ${innerR} 0 ${largeArc} 0 ${x4} ${y4}`,
    'Z',
  ].join(' ');

  doc.path(d).fill(color);
}

// ─── Line Chart ──────────────────────────────────────────────

export interface LineChartPoint {
  label: string;
  value: number;
}

export interface LineChartOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  valueFormatter?: (v: number) => string;
  fillUnder?: boolean;
  lineColor?: string;
  fillColor?: string;
}

export function drawLineChart(
  doc: PDFKit.PDFDocument,
  points: LineChartPoint[],
  options: LineChartOptions,
): void {
  if (points.length === 0) {
    drawEmptyMessage(doc, options.x, options.y, options.width, options.height);
    return;
  }

  const {
    x, y, width, height,
    valueFormatter = (v: number) => String(Math.round(v)),
    fillUnder = true,
    lineColor = '#2563eb',
    fillColor = '#2563eb',
  } = options;

  const paddingLeft = 55;
  const paddingBottom = 20;
  const chartX = x + paddingLeft;
  const chartW = width - paddingLeft - 10;
  const chartH = height - paddingBottom - 10;
  const chartY = y + 5;

  const values = points.map(p => p.value);
  const maxVal = Math.max(...values, 1);
  const minVal = Math.min(...values, 0);
  const range = maxVal - minVal || 1;

  // Y-axis grid lines + labels (5 lines)
  const ySteps = 4;
  for (let i = 0; i <= ySteps; i++) {
    const ratio = i / ySteps;
    const lineY = chartY + chartH - ratio * chartH;
    const val = minVal + ratio * range;

    doc
      .moveTo(chartX, lineY)
      .lineTo(chartX + chartW, lineY)
      .strokeColor('#f3f4f6')
      .lineWidth(0.5)
      .stroke();

    doc
      .fontSize(7)
      .fillColor('#9ca3af')
      .text(valueFormatter(val), x, lineY - 4, { width: paddingLeft - 8, align: 'right' });
  }

  // Plot data line
  const coords: { px: number; py: number }[] = [];
  for (let i = 0; i < points.length; i++) {
    const px = chartX + (i / Math.max(points.length - 1, 1)) * chartW;
    const py = chartY + chartH - ((points[i].value - minVal) / range) * chartH;
    coords.push({ px, py });
  }

  // Fill under the line
  if (fillUnder && coords.length > 1) {
    let fillPath = `M ${coords[0].px} ${chartY + chartH}`;
    fillPath += ` L ${coords[0].px} ${coords[0].py}`;
    for (let i = 1; i < coords.length; i++) {
      fillPath += ` L ${coords[i].px} ${coords[i].py}`;
    }
    fillPath += ` L ${coords[coords.length - 1].px} ${chartY + chartH} Z`;

    doc.save();
    doc.path(fillPath).fill(hexWithAlpha(fillColor, 0.12));
    doc.restore();
  }

  // Draw line
  if (coords.length > 1) {
    doc.save();
    doc.moveTo(coords[0].px, coords[0].py);
    for (let i = 1; i < coords.length; i++) {
      doc.lineTo(coords[i].px, coords[i].py);
    }
    doc.strokeColor(lineColor).lineWidth(1.5).stroke();
    doc.restore();
  }

  // Dots
  for (const { px, py } of coords) {
    doc.circle(px, py, 2).fill(lineColor);
  }

  // X-axis labels — sparse
  const maxLabels = 7;
  const step = Math.max(1, Math.ceil(points.length / maxLabels));
  for (let i = 0; i < points.length; i += step) {
    const lx = chartX + (i / Math.max(points.length - 1, 1)) * chartW;
    doc
      .fontSize(6)
      .fillColor('#9ca3af')
      .text(points[i].label, lx - 20, chartY + chartH + 4, { width: 40, align: 'center' });
  }

  doc.y = y + height;
}

// ─── Data Table ──────────────────────────────────────────────

export interface TableColumn {
  header: string;
  width: number;
  align?: 'left' | 'center' | 'right';
  colorFn?: (value: string) => string | null;
}

export interface TableOptions {
  x: number;
  y: number;
  fontSize?: number;
  headerBg?: string;
  headerColor?: string;
  rowAlternateBg?: string;
  maxRowHeight?: number;
}

export function drawTable(
  doc: PDFKit.PDFDocument,
  columns: TableColumn[],
  rows: Record<string, string>[],
  options: TableOptions,
  _pageNum?: { value: number },
  _addPageFooterFn?: (doc: PDFKit.PDFDocument, page: number) => void,
): void {
  if (rows.length === 0) {
    doc.fontSize(9).fillColor('#6b7280').text('No data available.', options.x, options.y);
    doc.moveDown(0.5);
    return;
  }

  const {
    x,
    fontSize = 8,
    headerBg = '#1e3a5f',
    headerColor = '#ffffff',
    rowAlternateBg = '#f9fafb',
    maxRowHeight = 48,
  } = options;

  let curY = options.y;
  const cellPadX = 4;
  const cellPadY = 3;

  function drawHeader(): void {
    const headerH = 18;
    const totalW = columns.reduce((s, c) => s + c.width, 0);
    doc.rect(x, curY, totalW, headerH).fill(headerBg);

    let colX = x;
    for (const col of columns) {
      doc
        .fontSize(fontSize)
        .fillColor(headerColor)
        .text(col.header, colX + cellPadX, curY + cellPadY, {
          width: col.width - cellPadX * 2,
          align: col.align || 'left',
          lineBreak: false,
        });
      colX += col.width;
    }
    curY += headerH;
  }

  function ensureTableSpace(needed: number): void {
    if (curY + needed > doc.page.height - 60) {
      doc.addPage();
      curY = 50;
      drawHeader();
    }
  }

  drawHeader();

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r];

    // Measure row height
    let rowH = 16;
    for (const col of columns) {
      const cellText = row[col.header] || '';
      const h = doc.fontSize(fontSize).heightOfString(cellText, { width: col.width - cellPadX * 2 });
      rowH = Math.max(rowH, Math.min(h + cellPadY * 2 + 2, maxRowHeight));
    }

    ensureTableSpace(rowH);

    // Alternating row bg
    if (r % 2 === 1) {
      const totalW = columns.reduce((s, c) => s + c.width, 0);
      doc.rect(x, curY, totalW, rowH).fill(rowAlternateBg);
    }

    // Cell text
    let colX = x;
    for (const col of columns) {
      const cellText = row[col.header] || '';
      const color = col.colorFn?.(cellText) || '#1f2937';

      // Truncate if exceeds maxRowHeight
      const fullH = doc.fontSize(fontSize).heightOfString(cellText, { width: col.width - cellPadX * 2 });
      let displayText = cellText;
      if (fullH + cellPadY * 2 + 2 > maxRowHeight) {
        displayText = truncateToFit(doc, cellText, col.width - cellPadX * 2, maxRowHeight - cellPadY * 2 - 2, fontSize);
      }

      doc
        .fontSize(fontSize)
        .fillColor(color)
        .text(displayText, colX + cellPadX, curY + cellPadY, {
          width: col.width - cellPadX * 2,
          align: col.align || 'left',
          height: maxRowHeight - cellPadY * 2,
        });
      colX += col.width;
    }

    // Bottom border
    const totalW = columns.reduce((s, c) => s + c.width, 0);
    doc.moveTo(x, curY + rowH).lineTo(x + totalW, curY + rowH).strokeColor('#e5e7eb').lineWidth(0.5).stroke();

    curY += rowH;
  }

  doc.x = 50;
  doc.y = curY + 5;
}

// ─── Gauge (progress bar) ────────────────────────────────────

export interface GaugeOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  value: number; // 0-100
  label?: string;
}

export function drawGauge(
  doc: PDFKit.PDFDocument,
  options: GaugeOptions,
): void {
  const { x, y, width, height, value, label } = options;
  const clamped = Math.min(100, Math.max(0, value));

  // Background track
  doc.roundedRect(x, y, width, height, 4).fill('#e5e7eb');

  // Filled portion
  const fillW = (clamped / 100) * width;
  const color = gaugeColor(clamped);
  if (fillW > 0) {
    doc.save();
    doc.roundedRect(x, y, width, height, 4).clip();
    doc.rect(x, y, fillW, height).fill(color);
    doc.restore();
  }

  // Percentage text
  doc
    .fontSize(9)
    .fillColor('#1f2937')
    .text(`${clamped.toFixed(0)}%`, x + width + 8, y + 1, { lineBreak: false });

  if (label) {
    doc.fontSize(8).fillColor('#6b7280').text(label, x, y - 12);
  }

  doc.y = y + height + 8;
}

function gaugeColor(value: number): string {
  if (value < 30) return '#dc2626';
  if (value < 60) return '#d97706';
  if (value < 90) return '#84cc16';
  return '#22c55e';
}

// ─── Stat Boxes (for cover page) ────────────────────────────

export interface StatBox {
  label: string;
  value: string;
  color?: string;
}

export function drawStatBoxes(
  doc: PDFKit.PDFDocument,
  boxes: StatBox[],
  options: { x: number; y: number; totalWidth: number },
): void {
  const { x, y, totalWidth } = options;
  const count = boxes.length;
  if (count === 0) return;

  const gap = 8;
  const boxW = Math.floor((totalWidth - (count - 1) * gap) / count);
  const boxH = 45;

  for (let i = 0; i < count; i++) {
    const bx = x + i * (boxW + gap);
    const bgColor = boxes[i].color || '#f3f4f6';

    doc.roundedRect(bx, y, boxW, boxH, 4).fill(bgColor);
    doc
      .fontSize(14)
      .fillColor('#1f2937')
      .text(boxes[i].value, bx + 6, y + 6, { width: boxW - 12, align: 'center' });
    doc
      .fontSize(7)
      .fillColor('#6b7280')
      .text(boxes[i].label, bx + 6, y + 26, { width: boxW - 12, align: 'center' });
  }

  doc.y = y + boxH + 10;
}

// ─── Severity Sub-Header ────────────────────────────────────

export function drawGroupSubHeader(
  doc: PDFKit.PDFDocument,
  label: string,
  count: number,
  color: string,
  x: number,
): void {
  const y = doc.y;
  doc.roundedRect(x, y, 495, 18, 3).fill(hexWithAlpha(color, 0.12));
  doc.fontSize(9).fillColor(color).text(`${label} (${count})`, x + 8, y + 4, { width: 480 });
  doc.y = y + 22;
}

// ─── Grade Band (for methodology) ──────────────────────────

export function drawGradeBand(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  width: number,
): void {
  const grades = [
    { letter: 'F', range: '0-39', color: '#dc2626', frac: 0.40 },
    { letter: 'D', range: '40-59', color: '#ea580c', frac: 0.20 },
    { letter: 'C', range: '60-74', color: '#eab308', frac: 0.15 },
    { letter: 'B', range: '75-89', color: '#84cc16', frac: 0.15 },
    { letter: 'A', range: '90-100', color: '#22c55e', frac: 0.10 },
  ];

  const bandH = 22;
  let cx = x;
  for (const g of grades) {
    const w = g.frac * width;
    doc.rect(cx, y, w, bandH).fill(g.color);
    doc.fontSize(10).fillColor('#ffffff').text(g.letter, cx + 2, y + 3, { width: w - 4, align: 'center' });
    doc.fontSize(6).fillColor('#ffffff').text(g.range, cx + 2, y + 14, { width: w - 4, align: 'center' });
    cx += w;
  }

  doc.y = y + bandH + 8;
}

// ─── Internal Helpers ────────────────────────────────────────

function drawEmptyMessage(doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number): void {
  doc.fontSize(10).fillColor('#9ca3af').text('No data available', x, y + h / 2 - 5, { width: w, align: 'center' });
  doc.y = y + h;
}

function truncateText(text: string, maxWidth: number, doc: PDFKit.PDFDocument, fontSize: number): string {
  doc.fontSize(fontSize);
  if (doc.widthOfString(text) <= maxWidth) return text;
  let t = text;
  while (t.length > 1 && doc.widthOfString(t + '…') > maxWidth) {
    t = t.slice(0, -1);
  }
  return t + '…';
}

function truncateToFit(
  doc: PDFKit.PDFDocument, text: string, width: number, maxHeight: number, fontSize: number,
): string {
  doc.fontSize(fontSize);
  if (doc.heightOfString(text, { width }) <= maxHeight) return text;

  // Binary search for the right length
  const words = text.split(' ');
  let lo = 1;
  let hi = words.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    const candidate = words.slice(0, mid).join(' ') + '...';
    if (doc.heightOfString(candidate, { width }) <= maxHeight) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return words.slice(0, lo).join(' ') + '...';
}

function hexWithAlpha(hex: string, alpha: number): string {
  // PDFKit doesn't support alpha in hex directly — use opacity via fill with separate opacity
  // For simplicity, blend with white to simulate transparency
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const blended = {
    r: Math.round(r * alpha + 255 * (1 - alpha)),
    g: Math.round(g * alpha + 255 * (1 - alpha)),
    b: Math.round(b * alpha + 255 * (1 - alpha)),
  };
  return `#${blended.r.toString(16).padStart(2, '0')}${blended.g.toString(16).padStart(2, '0')}${blended.b.toString(16).padStart(2, '0')}`;
}

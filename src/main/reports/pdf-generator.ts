// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import PDFDocument from 'pdfkit';
import { createWriteStream } from 'fs';
import path from 'path';
import type { Scan, Resource, Relationship, ReportConfig } from '../../shared/types';

type ProgressCallback = (progress: { percent: number; stage: string }) => void;

export async function generatePdfReport(
  outputPath: string,
  scan: Scan,
  resources: Resource[],
  relationships: Relationship[],
  config: ReportConfig,
  onProgress: ProgressCallback
): Promise<string> {
  return new Promise((resolve, reject) => {
    const safeScanId = path.basename(scan.id);
    const filePath = path.join(outputPath, `aws-scan-${safeScanId}.pdf`);
    const doc = new PDFDocument({ margin: 50, size: 'A4' });
    const stream = createWriteStream(filePath);

    doc.pipe(stream);

    onProgress({ percent: 10, stage: 'Creating PDF document' });

    // Title page
    doc.fontSize(24).text('AWS Resource Analyzer', { align: 'center' });
    doc.moveDown();
    doc.fontSize(18).text('Scan Report', { align: 'center' });
    doc.moveDown(2);

    // Scan info
    doc.fontSize(12);
    doc.text(`Profile: ${scan.profile}`);
    doc.text(`Regions: ${scan.regions.join(', ')}`);
    doc.text(`Services: ${scan.services.join(', ')}`);
    doc.text(`Started: ${new Date(scan.startedAt).toLocaleString()}`);
    if (scan.completedAt) {
      doc.text(`Completed: ${new Date(scan.completedAt).toLocaleString()}`);
    }
    doc.text(`Status: ${scan.status}`);
    doc.text(`Total Resources: ${scan.resourceCount}`);
    doc.moveDown(2);

    onProgress({ percent: 30, stage: 'Adding summary section' });

    // Summary section
    if (config.sections.includes('summary')) {
      doc.addPage();
      doc.fontSize(16).text('Resource Summary', { underline: true });
      doc.moveDown();

      // Group resources by service
      const byService = new Map<string, number>();
      for (const resource of resources) {
        const count = byService.get(resource.service) || 0;
        byService.set(resource.service, count + 1);
      }

      doc.fontSize(12);
      for (const [service, count] of byService.entries()) {
        doc.text(`${service}: ${count} resources`);
      }

      // Group by region
      doc.moveDown();
      doc.fontSize(14).text('Resources by Region', { underline: true });
      doc.moveDown();

      const byRegion = new Map<string, number>();
      for (const resource of resources) {
        const count = byRegion.get(resource.region) || 0;
        byRegion.set(resource.region, count + 1);
      }

      doc.fontSize(12);
      for (const [region, count] of byRegion.entries()) {
        doc.text(`${region}: ${count} resources`);
      }
    }

    onProgress({ percent: 50, stage: 'Adding resources section' });

    // Resources section
    if (config.sections.includes('resources')) {
      doc.addPage();
      doc.fontSize(16).text('Resources', { underline: true });
      doc.moveDown();

      // Group resources by type
      const byType = new Map<string, Resource[]>();
      for (const resource of resources) {
        const existing = byType.get(resource.resourceType) || [];
        existing.push(resource);
        byType.set(resource.resourceType, existing);
      }

      for (const [type, typeResources] of byType.entries()) {
        if (doc.y > 700) {
          doc.addPage();
        }

        doc.fontSize(14).text(type, { underline: true });
        doc.moveDown(0.5);

        for (const resource of typeResources.slice(0, 20)) {
          if (doc.y > 700) {
            doc.addPage();
          }

          doc.fontSize(10);
          doc.text(`Name: ${resource.name || 'N/A'}`, { continued: false });
          doc.text(`Region: ${resource.region}`, { indent: 20 });
          doc.text(`ARN: ${resource.id}`, { indent: 20 });
          doc.moveDown(0.5);
        }

        if (typeResources.length > 20) {
          doc.text(`... and ${typeResources.length - 20} more ${type} resources`);
        }

        doc.moveDown();
      }
    }

    onProgress({ percent: 70, stage: 'Adding relationships section' });

    // Relationships section
    if (config.sections.includes('relationships')) {
      doc.addPage();
      doc.fontSize(16).text('Relationships', { underline: true });
      doc.moveDown();

      // Group relationships by type
      const byRelType = new Map<string, number>();
      for (const rel of relationships) {
        const count = byRelType.get(rel.relationshipType) || 0;
        byRelType.set(rel.relationshipType, count + 1);
      }

      doc.fontSize(12);
      doc.text(`Total Relationships: ${relationships.length}`);
      doc.moveDown();

      for (const [relType, count] of byRelType.entries()) {
        doc.text(`${relType}: ${count}`);
      }
    }

    onProgress({ percent: 85, stage: 'Adding security groups section' });

    // Security Groups section
    if (config.sections.includes('security_groups')) {
      const securityGroups = resources.filter((r) => r.resourceType === 'security-group');

      if (securityGroups.length > 0) {
        doc.addPage();
        doc.fontSize(16).text('Security Groups', { underline: true });
        doc.moveDown();

        for (const sg of securityGroups.slice(0, 10)) {
          if (doc.y > 650) {
            doc.addPage();
          }

          doc.fontSize(12).text(sg.name || sg.data.groupId as string, { underline: true });
          doc.fontSize(10);
          doc.text(`Group ID: ${sg.data.groupId}`);
          doc.text(`VPC: ${sg.data.vpcId || 'N/A'}`);
          doc.text(`Description: ${sg.data.description || 'N/A'}`);

          const inboundRules = sg.data.inboundRules as unknown[];
          if (inboundRules && inboundRules.length > 0) {
            doc.text('Inbound Rules:', { indent: 10 });
            for (const rule of inboundRules.slice(0, 5) as { protocol: string; fromPort: number; toPort: number }[]) {
              doc.text(
                `  ${rule.protocol} ${rule.fromPort}-${rule.toPort}`,
                { indent: 20 }
              );
            }
          }

          doc.moveDown();
        }

        if (securityGroups.length > 10) {
          doc.text(`... and ${securityGroups.length - 10} more security groups`);
        }
      }
    }

    onProgress({ percent: 95, stage: 'Finalizing PDF' });

    // Footer with generation info
    doc.addPage();
    doc.fontSize(10).text('Report generated by AWS Resource Analyzer', { align: 'center' });
    doc.text(`Generated at: ${new Date().toISOString()}`, { align: 'center' });

    doc.end();

    stream.on('finish', () => {
      onProgress({ percent: 100, stage: 'Complete' });
      resolve(filePath);
    });

    stream.on('error', reject);
  });
}

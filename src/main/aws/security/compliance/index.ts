// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { runBestPracticesScan } from '../best-practices';
import { CIS_CONTROLS, CIS_AWS_V3_META } from './cis-controls';
import type {
  ComplianceAssessmentResult,
  ComplianceSectionResult,
  ComplianceControlResult,
  ComplianceFrameworkMeta,
} from './types';

export type {
  ComplianceAssessmentResult,
  ComplianceSectionResult,
  ComplianceControlResult,
  ComplianceFrameworkMeta,
  ComplianceFrameworkId,
} from './types';

export function getAvailableFrameworks(): ComplianceFrameworkMeta[] {
  return [CIS_AWS_V3_META];
}

export async function runComplianceAssessment(
  profile: string,
  region: string,
  _frameworkId: string = 'cis-aws-v3'
): Promise<ComplianceAssessmentResult> {
  // Run the best practices scan to get all findings
  const scanResult = await runBestPracticesScan(profile, region);

  // Build a set of check IDs that produced findings
  const failedCheckIds = new Set<string>();
  for (const finding of scanResult.findings) {
    // Extract the base check ID (e.g. "BP-SG-001" from "BP-SG-001-sg-12345")
    const parts = finding.id.split('-');
    if (parts.length >= 3) {
      failedCheckIds.add(parts.slice(0, 3).join('-'));
    }
  }

  // Map controls to results
  const controlResults: ComplianceControlResult[] = CIS_CONTROLS.map((control) => {
    if (control.checkIds.length === 0) {
      return {
        control,
        status: 'NOT_CHECKED' as const,
        findingCount: 0,
      };
    }

    const hasFinding = control.checkIds.some((checkId) => failedCheckIds.has(checkId));
    const findingCount = hasFinding
      ? scanResult.findings.filter((f) => {
          const baseId = f.id.split('-').slice(0, 3).join('-');
          return control.checkIds.includes(baseId);
        }).length
      : 0;

    return {
      control,
      status: hasFinding ? ('FAIL' as const) : ('PASS' as const),
      findingCount,
    };
  });

  // Group by section
  const sectionMap = new Map<string, ComplianceControlResult[]>();
  for (const result of controlResults) {
    const section = result.control.section;
    if (!sectionMap.has(section)) {
      sectionMap.set(section, []);
    }
    sectionMap.get(section)!.push(result);
  }

  const sections: ComplianceSectionResult[] = [];
  for (const [section, controls] of sectionMap) {
    const passed = controls.filter((c) => c.status === 'PASS').length;
    const failed = controls.filter((c) => c.status === 'FAIL').length;
    const notChecked = controls.filter((c) => c.status === 'NOT_CHECKED').length;

    sections.push({
      section,
      totalControls: controls.length,
      passedControls: passed,
      failedControls: failed,
      notCheckedControls: notChecked,
      controls,
    });
  }

  // Sort sections by section number
  sections.sort((a, b) => {
    const aNum = parseInt(a.section.split(' ')[0], 10);
    const bNum = parseInt(b.section.split(' ')[0], 10);
    return aNum - bNum;
  });

  const totalControls = controlResults.length;
  const passedControls = controlResults.filter((c) => c.status === 'PASS').length;
  const failedControls = controlResults.filter((c) => c.status === 'FAIL').length;
  const notCheckedControls = controlResults.filter((c) => c.status === 'NOT_CHECKED').length;
  const checkedControls = totalControls - notCheckedControls;
  const overallScore = checkedControls > 0 ? Math.round((passedControls / checkedControls) * 100) : 0;

  return {
    framework: CIS_AWS_V3_META,
    overallScore,
    totalControls,
    passedControls,
    failedControls,
    notCheckedControls,
    sections,
    assessedAt: new Date().toISOString(),
    error: scanResult.error,
  };
}

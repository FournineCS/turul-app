// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import crypto from 'crypto';
import type {
  ComplianceAssessmentResult,
  ComplianceSectionResult,
  ComplianceControlResult,
  ComplianceFrameworkMeta,
} from '../../../../shared/types';
import { runGCPBestPracticesScan } from '../best-practices';
import { CIS_GCP_CONTROLS, CIS_GCP_FRAMEWORK } from './cis-gcp-controls';

/**
 * Returns the list of available GCP compliance frameworks.
 */
export function getGCPComplianceFrameworks(): ComplianceFrameworkMeta[] {
  return [CIS_GCP_FRAMEWORK];
}

/**
 * Run a CIS GCP Foundation Benchmark v2.0 compliance assessment.
 *
 * 1. Executes the GCP best-practices scan to collect findings.
 * 2. Maps each CIS control's `checkIds` (prefix match) against finding IDs.
 *    - PASS  — checkIds defined and no findings match.
 *    - FAIL  — at least one finding matches a checkId prefix.
 *    - NOT_CHECKED — no checkIds defined (automated check not yet available).
 * 3. Groups results by section, computes per-section and overall scores.
 */
export async function runGCPComplianceAssessment(
  projectId: string
): Promise<ComplianceAssessmentResult> {
  const startTime = Date.now();

  // 1. Run the best-practices scan
  const securityResult = await runGCPBestPracticesScan(projectId);

  // Collect all finding IDs for prefix matching
  const findingIds = securityResult.findings.map((f) => f.id);

  // 2. Map controls to results
  const controlResults: ComplianceControlResult[] = CIS_GCP_CONTROLS.map((control) => {
    // No automated check available
    if (control.checkIds.length === 0) {
      return {
        control,
        status: 'NOT_CHECKED' as const,
        findingCount: 0,
      };
    }

    // A finding matches if its ID starts with any of the control's checkId prefixes
    const matchingFindings = findingIds.filter((fid) =>
      control.checkIds.some((prefix) => fid === prefix || fid.startsWith(prefix + '-'))
    );

    const hasFinding = matchingFindings.length > 0;

    return {
      control,
      status: hasFinding ? ('FAIL' as const) : ('PASS' as const),
      findingCount: matchingFindings.length,
    };
  });

  // 3. Group by section
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

  // Sort sections by leading section number
  sections.sort((a, b) => {
    const aNum = parseInt(a.section.split(' ')[0], 10);
    const bNum = parseInt(b.section.split(' ')[0], 10);
    return aNum - bNum;
  });

  // 4. Compute overall scores
  const totalControls = controlResults.length;
  const passedControls = controlResults.filter((c) => c.status === 'PASS').length;
  const failedControls = controlResults.filter((c) => c.status === 'FAIL').length;
  const notCheckedControls = controlResults.filter((c) => c.status === 'NOT_CHECKED').length;
  const checkedControls = totalControls - notCheckedControls;
  const overallScore =
    checkedControls > 0 ? Math.round((passedControls / checkedControls) * 100) : 0;

  return {
    id: crypto.randomUUID(),
    projectId,
    framework: CIS_GCP_FRAMEWORK,
    overallScore,
    totalControls,
    passedControls,
    failedControls,
    notCheckedControls,
    sections,
    assessedAt: new Date().toISOString(),
    duration: Date.now() - startTime,
    error: securityResult.error,
  };
}

// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React, { useEffect, useState } from 'react';
import { useScanStore } from '../stores/scanStore';
import { useProfileStore } from '../stores/profileStore';
import { useProviderStore } from '../stores/providerStore';
import { useGCPProjectStore } from '../stores/gcpProjectStore';
import type { ReportFormat, ReportSection } from '../../shared/types';

const REPORT_SECTIONS: { id: ReportSection; name: string; description: string }[] = [
  { id: 'summary', name: 'Summary', description: 'Overview of resources by service and region' },
  { id: 'resources', name: 'Resources', description: 'Detailed list of all resources' },
  { id: 'relationships', name: 'Relationships', description: 'Resource relationships and dependencies' },
  { id: 'security_groups', name: 'Security Groups', description: 'Security group rules analysis' },
];

const REPORT_FORMATS: { id: ReportFormat; name: string; extension: string; description: string }[] = [
  { id: 'pdf', name: 'PDF', extension: '.pdf', description: 'Best for sharing and printing' },
  { id: 'excel', name: 'Excel', extension: '.xlsx', description: 'Best for analysis and filtering' },
  { id: 'csv', name: 'CSV', extension: '.csv', description: 'Multiple CSV files for data processing' },
  { id: 'json', name: 'JSON', extension: '.json', description: 'Raw data for programmatic use' },
];

const ReportsPage: React.FC = () => {
  const { scans, loadScans } = useScanStore();
  const selectedProfileName = useProfileStore((s) => s.selectedProfileName);
  const selectedProvider = useProviderStore((s) => s.selectedProvider);
  const selectedProjectId = useGCPProjectStore((s) => s.selectedProjectId);
  const activeIdentity = selectedProvider === 'gcp' ? selectedProjectId : selectedProfileName;

  const [selectedScanId, setSelectedScanId] = useState<string>('');
  const [selectedFormat, setSelectedFormat] = useState<ReportFormat>('pdf');
  const [selectedSections, setSelectedSections] = useState<ReportSection[]>(['summary', 'resources']);
  const [outputPath, setOutputPath] = useState<string>('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<{ percent: number; stage: string } | null>(null);
  const [result, setResult] = useState<{ success: boolean; message: string; filePath?: string } | null>(null);

  useEffect(() => {
    loadScans(selectedProvider);
  }, [loadScans, selectedProvider]);

  useEffect(() => {
    // Subscribe to report progress
    const unsubscribe = window.electronAPI.report.onProgress(setProgress);
    return () => unsubscribe();
  }, []);

  const toggleSection = (section: ReportSection) => {
    setSelectedSections((prev) =>
      prev.includes(section)
        ? prev.filter((s) => s !== section)
        : [...prev, section]
    );
  };

  const handleSelectDirectory = async () => {
    const path = await window.electronAPI.app.selectDirectory();
    if (path) {
      setOutputPath(path);
    }
  };

  const handleGenerateReport = async () => {
    if (!selectedScanId || !outputPath || selectedSections.length === 0) {
      return;
    }

    setIsGenerating(true);
    setResult(null);
    setProgress({ percent: 0, stage: 'Starting...' });

    try {
      const response = await window.electronAPI.report.generate({
        scanId: selectedScanId,
        format: selectedFormat,
        sections: selectedSections,
        includeTopology: false,
        outputPath,
      });

      if (response.success && response.data) {
        setResult({
          success: true,
          message: 'Report generated successfully!',
          filePath: response.data.filePath,
        });
      } else {
        setResult({
          success: false,
          message: response.error || 'Failed to generate report',
        });
      }
    } catch (error) {
      setResult({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to generate report',
      });
    } finally {
      setIsGenerating(false);
      setProgress(null);
    }
  };

  const completedScans = scans
    .filter((s) => s.status === 'completed')
    .filter((s) => !activeIdentity || s.profile === activeIdentity)
    .filter((s) => s.cloudProvider === selectedProvider || (!s.cloudProvider && selectedProvider === 'aws'));

  return (
    <>
      <header className="page-header">
        <h1 className="page-title">Generate Report</h1>
      </header>

      <div className="page-content">
        {/* Scan Selection */}
        <div className="card mb-4">
          <h3 className="card-title mb-4">Select Scan</h3>

          {completedScans.length === 0 ? (
            <div className="empty-state">
              <p>No completed scans available for reports</p>
            </div>
          ) : (
            <div className="form-group" style={{ margin: 0 }}>
              <select
                className="form-select"
                value={selectedScanId}
                onChange={(e) => setSelectedScanId(e.target.value)}
              >
                <option value="">Select a scan...</option>
                {completedScans.map((scan) => (
                  <option key={scan.id} value={scan.id}>
                    {scan.profile} - {new Date(scan.startedAt).toLocaleString()} ({scan.resourceCount} resources)
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Report Format */}
        <div className="card mb-4">
          <h3 className="card-title mb-4">Report Format</h3>

          <div className="checkbox-group">
            {REPORT_FORMATS.map((format) => (
              <label
                key={format.id}
                className={`checkbox-item ${selectedFormat === format.id ? 'selected' : ''}`}
                style={{ minWidth: '200px' }}
              >
                <input
                  type="radio"
                  name="format"
                  checked={selectedFormat === format.id}
                  onChange={() => setSelectedFormat(format.id)}
                />
                <div>
                  <strong>{format.name}</strong>
                  <div className="text-secondary text-sm">{format.description}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Report Sections */}
        <div className="card mb-4">
          <h3 className="card-title mb-4">Report Sections</h3>

          <div className="checkbox-group">
            {REPORT_SECTIONS.map((section) => (
              <label
                key={section.id}
                className={`checkbox-item ${selectedSections.includes(section.id) ? 'selected' : ''}`}
                style={{ minWidth: '200px' }}
              >
                <input
                  type="checkbox"
                  checked={selectedSections.includes(section.id)}
                  onChange={() => toggleSection(section.id)}
                />
                <div>
                  <strong>{section.name}</strong>
                  <div className="text-secondary text-sm">{section.description}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Output Location */}
        <div className="card mb-4">
          <h3 className="card-title mb-4">Output Location</h3>

          <div className="flex gap-4 items-center">
            <input
              type="text"
              className="form-input"
              placeholder="Select output directory..."
              value={outputPath}
              readOnly
              style={{ flex: 1 }}
            />
            <button className="btn btn-secondary" onClick={handleSelectDirectory}>
              Browse...
            </button>
          </div>
        </div>

        {/* Progress */}
        {isGenerating && progress && (
          <div className="card mb-4">
            <h3 className="card-title mb-4">Generating Report...</h3>
            <p>{progress.stage}</p>
            <div className="progress-bar mt-4">
              <div
                className="progress-bar-fill"
                style={{ width: `${progress.percent}%` }}
              />
            </div>
          </div>
        )}

        {/* Result */}
        {result && (
          <div
            className="card mb-4"
            style={{
              borderColor: result.success ? 'var(--color-success)' : 'var(--color-error)',
            }}
          >
            <p style={{ color: result.success ? 'var(--color-success)' : 'var(--color-error)' }}>
              {result.message}
            </p>
            {result.filePath && (
              <p className="text-secondary mt-4">
                Saved to: <code>{result.filePath}</code>
              </p>
            )}
          </div>
        )}

        {/* Generate Button */}
        <button
          className="btn btn-primary btn-lg"
          onClick={handleGenerateReport}
          disabled={
            !selectedScanId ||
            !outputPath ||
            selectedSections.length === 0 ||
            isGenerating
          }
        >
          {isGenerating ? (
            <>
              <div className="spinner" style={{ width: 16, height: 16 }} />
              Generating...
            </>
          ) : (
            <>
              Generate {REPORT_FORMATS.find((f) => f.id === selectedFormat)?.name} Report
            </>
          )}
        </button>
      </div>
    </>
  );
};

export default ReportsPage;

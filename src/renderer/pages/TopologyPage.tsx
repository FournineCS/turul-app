// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React, { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useScanStore } from '../stores/scanStore';
import { useProfileStore } from '../stores/profileStore';
import { useProviderStore } from '../stores/providerStore';
import { useGCPProjectStore } from '../stores/gcpProjectStore';
import TopologyCanvas from '../components/topology/TopologyCanvas';
import ArchitectureDiagram from '../components/topology/ArchitectureDiagram';
import type { DiagramViewMode } from '../../shared/types';

const VIEW_MODE_OPTIONS: { value: DiagramViewMode; label: string; icon: JSX.Element }[] = [
  {
    value: 'network',
    label: 'Network',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17 16l-4-4V8.82C14.16 8.4 15 7.3 15 6c0-1.66-1.34-3-3-3S9 4.34 9 6c0 1.3.84 2.4 2 2.82V12l-4 4H3v5h5v-3.05l4-4.2 4 4.2V21h5v-5h-4z" />
      </svg>
    ),
  },
  {
    value: 'application',
    label: 'Application',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M4 8h4V4H4v4zm6 12h4v-4h-4v4zm-6 0h4v-4H4v4zm0-6h4v-4H4v4zm6 0h4v-4h-4v4zm6-10v4h4V4h-4zm-6 4h4V4h-4v4zm6 6h4v-4h-4v4zm0 6h4v-4h-4v4z" />
      </svg>
    ),
  },
  {
    value: 'data',
    label: 'Data',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 3C7.58 3 4 4.79 4 7v10c0 2.21 3.58 4 8 4s8-1.79 8-4V7c0-2.21-3.58-4-8-4zm0 2c3.87 0 6 1.5 6 2s-2.13 2-6 2-6-1.5-6-2 2.13-2 6-2zM6 17v-2.42c1.23.79 3.37 1.42 6 1.42s4.77-.63 6-1.42V17c0 .5-2.13 2-6 2s-6-1.5-6-2zm0-5v-2.42c1.23.79 3.37 1.42 6 1.42s4.77-.63 6-1.42V12c0 .5-2.13 2-6 2s-6-1.5-6-2z" />
      </svg>
    ),
  },
  {
    value: 'full',
    label: 'Full Topology',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M22 11V3h-7v3H9V3H2v8h7V8h2v10h4v3h7v-8h-7v3h-2V8h2v3h7zM7 9H4V5h3v4zm10 6h3v4h-3v-4zm0-10h3v4h-3V5z" />
      </svg>
    ),
  },
];

const TopologyPage: React.FC = () => {
  const { scanId } = useParams<{ scanId: string }>();
  const {
    scans,
    currentScan,
    topologyGraph,
    diagramGraph,
    diagramViewMode,
    isLoading,
    loadScans,
    loadScan,
    loadTopology,
    loadDiagram,
    setDiagramViewMode,
  } = useScanStore();

  const selectedProfileName = useProfileStore((s) => s.selectedProfileName);
  const selectedProvider = useProviderStore((s) => s.selectedProvider);
  const selectedProjectId = useGCPProjectStore((s) => s.selectedProjectId);

  // Use the same activeIdentity pattern as Dashboard/History pages
  const activeIdentity = selectedProvider === 'gcp' ? selectedProjectId : selectedProfileName;

  const [selectedScanId, setSelectedScanId] = useState<string>(scanId || '');

  // Filter scans by provider and active identity (profile or project)
  const filteredScans = useMemo(() =>
    scans
      .filter((s) => s.status === 'completed')
      .filter((s) => !activeIdentity || s.profile === activeIdentity)
      .filter((s) => s.cloudProvider === selectedProvider || (!s.cloudProvider && selectedProvider === 'aws')),
    [scans, activeIdentity, selectedProvider]
  );

  useEffect(() => {
    loadScans(selectedProvider);
  }, [loadScans, selectedProvider]);

  // Auto-select scan: prefer URL param, then first matching scan for current identity
  useEffect(() => {
    if (scanId) {
      setSelectedScanId(scanId);
    } else if (filteredScans.length > 0) {
      // If current selection is not in filtered list, pick the first one
      const currentInList = filteredScans.some((s) => s.id === selectedScanId);
      if (!currentInList) {
        setSelectedScanId(filteredScans[0].id);
      }
    } else if (filteredScans.length === 0 && selectedScanId) {
      setSelectedScanId('');
    }
  }, [scanId, filteredScans, selectedScanId]);

  // Reset scan selection when identity changes
  useEffect(() => {
    if (!scanId) {
      setSelectedScanId('');
    }
  }, [activeIdentity, scanId]);

  useEffect(() => {
    if (selectedScanId) {
      loadScan(selectedScanId);
      if (diagramViewMode === 'full') {
        loadTopology(selectedScanId);
      } else {
        loadDiagram(selectedScanId, diagramViewMode);
      }
    }
  }, [selectedScanId, diagramViewMode, loadScan, loadTopology, loadDiagram]);

  const handleViewModeChange = (mode: DiagramViewMode) => {
    setDiagramViewMode(mode);
  };

  const currentGraph = diagramViewMode === 'full' ? topologyGraph : diagramGraph;
  const nodeCount = diagramViewMode === 'full'
    ? topologyGraph?.nodes.length || 0
    : diagramGraph?.nodes.length || 0;
  const edgeCount = diagramViewMode === 'full'
    ? topologyGraph?.links.length || 0
    : diagramGraph?.edges.length || 0;

  return (
    <>
      <header className="page-header" style={{ padding: '14px 28px' }}>
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="var(--color-primary)" style={{ opacity: 0.8 }}>
                <path d="M22 11V3h-7v3H9V3H2v8h7V8h2v10h4v3h7v-8h-7v3h-2V8h2v3h7zM7 9H4V5h3v4zm10 6h3v4h-3v-4zm0-10h3v4h-3V5z" />
              </svg>
              Architecture
            </h1>
            {currentScan && selectedScanId && (
              <div className="flex items-center gap-2" style={{ marginLeft: 4 }}>
                <span className="badge badge-info" style={{ fontSize: 11 }}>
                  {currentScan.profile}
                </span>
                <span style={{
                  fontSize: 11,
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--color-text-muted)',
                  background: 'var(--color-bg-tertiary)',
                  padding: '2px 8px',
                  borderRadius: 4,
                }}>
                  {currentScan.resourceCount} resources
                </span>
              </div>
            )}
          </div>
          {currentGraph && nodeCount > 0 && (
            <div style={{
              fontSize: 12,
              fontFamily: 'var(--font-mono)',
              color: 'var(--color-text-muted)',
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}>
              <span>
                <strong style={{ color: 'var(--color-text-secondary)' }}>{nodeCount}</strong> nodes
              </span>
              <span style={{ color: 'var(--color-border)' }}>|</span>
              <span>
                <strong style={{ color: 'var(--color-text-secondary)' }}>{edgeCount}</strong> {diagramViewMode === 'full' ? 'links' : 'edges'}
              </span>
              {edgeCount === 0 && (
                <span style={{
                  color: 'var(--color-warning)',
                  fontSize: 11,
                  padding: '2px 8px',
                  borderRadius: 4,
                  background: 'var(--color-warning-glow, rgba(245, 158, 11, 0.1))',
                }}>
                  No relationships found — try scanning more services
                </span>
              )}
            </div>
          )}
        </div>
      </header>

      <div className="page-content" style={{ padding: 0, display: 'flex', flexDirection: 'column', animation: 'none' }}>
        {/* Controls Bar */}
        <div style={{
          padding: '10px 24px',
          borderBottom: '1px solid var(--color-border-subtle)',
          display: 'flex',
          gap: 12,
          alignItems: 'center',
          flexWrap: 'wrap',
          background: 'var(--color-bg-secondary)',
        }}>
          {/* Scan Selector */}
          <select
            className="form-select"
            value={selectedScanId}
            onChange={(e) => setSelectedScanId(e.target.value)}
            style={{
              flex: '0 1 340px',
              margin: 0,
              fontSize: 13,
              padding: '7px 12px',
              fontFamily: 'var(--font-mono)',
            }}
          >
            <option value="">Select a scan...</option>
            {filteredScans.map((scan) => (
              <option key={scan.id} value={scan.id}>
                {scan.profile} — {new Date(scan.startedAt).toLocaleString()}
              </option>
            ))}
          </select>

          {/* View Mode Toggle */}
          <div style={{
            display: 'flex',
            gap: 1,
            background: 'var(--color-bg)',
            borderRadius: 'var(--radius-sm)',
            padding: 2,
            border: '1px solid var(--color-border-subtle)',
          }}>
            {VIEW_MODE_OPTIONS.map((opt) => {
              const isActive = diagramViewMode === opt.value;
              return (
                <button
                  key={opt.value}
                  onClick={() => handleViewModeChange(opt.value)}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 'calc(var(--radius-sm) - 2px)',
                    border: 'none',
                    background: isActive
                      ? 'linear-gradient(135deg, var(--color-primary), var(--color-primary-hover))'
                      : 'transparent',
                    color: isActive ? 'var(--color-bg)' : 'var(--color-text-secondary)',
                    fontWeight: isActive ? 600 : 450,
                    fontSize: 13,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    boxShadow: isActive ? '0 2px 8px var(--color-primary-glow)' : 'none',
                  }}
                >
                  {opt.icon}
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Diagram Canvas */}
        <div style={{ flex: 1, position: 'relative', background: 'var(--color-bg)' }}>
          {isLoading ? (
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 16,
            }}>
              <div className="spinner" style={{ width: 32, height: 32 }} />
              <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
                Loading {diagramViewMode === 'full' ? 'topology' : 'diagram'}...
              </p>
            </div>
          ) : !selectedScanId ? (
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <div style={{ textAlign: 'center', maxWidth: 360 }}>
                <svg width="48" height="48" viewBox="0 0 24 24" fill="var(--color-text-muted)" style={{ opacity: 0.25, marginBottom: 16 }}>
                  <path d="M22 11V3h-7v3H9V3H2v8h7V8h2v10h4v3h7v-8h-7v3h-2V8h2v3h7zM7 9H4V5h3v4zm10 6h3v4h-3v-4zm0-10h3v4h-3V5z" />
                </svg>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text)', marginBottom: 8 }}>
                  {filteredScans.length === 0 ? 'No scans available' : 'No scan selected'}
                </h3>
                <p style={{ color: 'var(--color-text-muted)', fontSize: 13, lineHeight: 1.6, marginBottom: 20 }}>
                  {filteredScans.length === 0
                    ? `No completed scans found${activeIdentity ? ` for ${activeIdentity}` : ''}. Run a scan first to visualize your architecture.`
                    : 'Select a scan from the dropdown above to visualize your architecture.'
                  }
                </p>
                {filteredScans.length === 0 && (
                  <Link to="/scan" className="btn btn-primary">
                    Start New Scan
                  </Link>
                )}
              </div>
            </div>
          ) : diagramViewMode === 'full' && topologyGraph && topologyGraph.nodes.length > 0 ? (
            <TopologyCanvas graph={topologyGraph} />
          ) : diagramViewMode !== 'full' && diagramGraph && diagramGraph.nodes.length > 0 ? (
            <ArchitectureDiagram graph={diagramGraph} />
          ) : (
            <div style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
              <div style={{ textAlign: 'center', maxWidth: 400 }}>
                <svg width="44" height="44" viewBox="0 0 24 24" fill="var(--color-text-muted)" style={{ opacity: 0.2, marginBottom: 16 }}>
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                </svg>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--color-text)', marginBottom: 8 }}>
                  No {diagramViewMode} resources found
                </h3>
                <p style={{ color: 'var(--color-text-muted)', fontSize: 13, lineHeight: 1.6 }}>
                  {diagramViewMode === 'network'
                    ? selectedProvider === 'gcp'
                      ? 'No network resources (VPC networks, subnets, GCE instances) found in this scan.'
                      : 'No network resources (VPCs, subnets, instances) found in this scan.'
                    : diagramViewMode === 'application'
                    ? selectedProvider === 'gcp'
                      ? 'No application resources (Cloud Run, GKE, Cloud Functions) found in this scan.'
                      : 'No application resources (Lambda, ECS, API Gateway, SQS) found in this scan.'
                    : diagramViewMode === 'data'
                    ? selectedProvider === 'gcp'
                      ? 'No data resources (Cloud SQL, BigQuery, GCS) found in this scan.'
                      : 'No data resources (RDS, DynamoDB, S3, Glue) found in this scan.'
                    : 'No resources with relationships found in this scan.'
                  }
                </p>
                <p style={{ marginTop: 8, color: 'var(--color-text-muted)', fontSize: 12 }}>
                  Try running a scan that includes the relevant service types.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default TopologyPage;

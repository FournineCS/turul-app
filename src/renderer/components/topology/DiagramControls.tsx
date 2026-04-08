// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React, { useCallback } from 'react';
import { useReactFlow, getNodesBounds, getViewportForBounds } from '@xyflow/react';
import { toPng, toSvg } from 'html-to-image';

interface DiagramControlsProps {
  onExport?: (format: 'png' | 'svg') => void;
}

const DiagramControls: React.FC<DiagramControlsProps> = ({ onExport }) => {
  const { fitView, zoomIn, zoomOut, getNodes } = useReactFlow();

  const handleFitView = useCallback(() => {
    fitView({ padding: 0.2, duration: 300 });
  }, [fitView]);

  const getExportParams = useCallback(() => {
    const nodes = getNodes();
    if (nodes.length === 0) return null;

    const nodesBounds = getNodesBounds(nodes);
    const padding = 50;
    const width = Math.max(nodesBounds.width + padding * 2, 400);
    const height = Math.max(nodesBounds.height + padding * 2, 300);

    const viewport = getViewportForBounds(
      nodesBounds, width, height, 0.5, 2, padding
    );

    const flowEl = document.querySelector('.react-flow__viewport') as HTMLElement;
    if (!flowEl) return null;

    return { flowEl, width, height, viewport };
  }, [getNodes]);

  const handleExportPng = useCallback(async () => {
    const params = getExportParams();
    if (!params) return;

    try {
      const dataUrl = await toPng(params.flowEl, {
        backgroundColor: '#0b0e14',
        width: params.width,
        height: params.height,
        style: {
          width: `${params.width}px`,
          height: `${params.height}px`,
          transform: `translate(${params.viewport.x}px, ${params.viewport.y}px) scale(${params.viewport.zoom})`,
        },
      });

      if (window.electronAPI?.app?.saveFile) {
        const filePath = await window.electronAPI.app.saveFile(
          `architecture-diagram-${Date.now()}.png`, dataUrl
        );
        if (filePath) onExport?.('png');
      } else {
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `architecture-diagram-${Date.now()}.png`;
        link.click();
        onExport?.('png');
      }
    } catch (err) {
      console.error('Failed to export PNG:', err);
    }
  }, [getExportParams, onExport]);

  const handleExportSvg = useCallback(async () => {
    const params = getExportParams();
    if (!params) return;

    try {
      const dataUrl = await toSvg(params.flowEl, {
        backgroundColor: '#0b0e14',
        width: params.width,
        height: params.height,
        style: {
          width: `${params.width}px`,
          height: `${params.height}px`,
          transform: `translate(${params.viewport.x}px, ${params.viewport.y}px) scale(${params.viewport.zoom})`,
        },
      });

      if (window.electronAPI?.app?.saveFile) {
        const filePath = await window.electronAPI.app.saveFile(
          `architecture-diagram-${Date.now()}.svg`, dataUrl
        );
        if (filePath) onExport?.('svg');
      } else {
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `architecture-diagram-${Date.now()}.svg`;
        link.click();
        onExport?.('svg');
      }
    } catch (err) {
      console.error('Failed to export SVG:', err);
    }
  }, [getExportParams, onExport]);

  const buttonStyle: React.CSSProperties = {
    width: 34,
    height: 34,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--color-bg-secondary)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)',
    cursor: 'pointer',
    fontSize: 15,
    color: 'var(--color-text-secondary)',
    transition: 'all 0.15s ease',
  };

  return (
    <div
      style={{
        position: 'absolute',
        top: 12,
        right: 12,
        display: 'flex',
        gap: 4,
        zIndex: 10,
      }}
    >
      <button
        style={buttonStyle}
        onClick={() => zoomIn({ duration: 200 })}
        title="Zoom in"
      >
        +
      </button>
      <button
        style={buttonStyle}
        onClick={() => zoomOut({ duration: 200 })}
        title="Zoom out"
      >
        −
      </button>
      <button
        style={buttonStyle}
        onClick={handleFitView}
        title="Fit to view"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
          <path d="M3 15h2v2c0 .55.45 1 1 1h2v2H5c-1.1 0-2-.9-2-2v-3zm2-4H3V8c0-1.1.9-2 2-2h3v2H6c-.55 0-1 .45-1 1v2zm14 0h-2V9c0-.55-.45-1-1-1h-2V6h3c1.1 0 2 .9 2 2v3zm-2 4h2v3c0 1.1-.9 2-2 2h-3v-2h2c.55 0 1-.45 1-1v-2z" />
        </svg>
      </button>
      <div style={{ width: 1, background: 'var(--color-border)', margin: '4px 2px' }} />
      <button
        style={buttonStyle}
        onClick={handleExportPng}
        title="Export as PNG"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z" />
        </svg>
      </button>
      <button
        style={{ ...buttonStyle, fontSize: 10, fontWeight: 700, letterSpacing: '0.04em' }}
        onClick={handleExportSvg}
        title="Export as SVG"
      >
        SVG
      </button>
    </div>
  );
};

export default DiagramControls;

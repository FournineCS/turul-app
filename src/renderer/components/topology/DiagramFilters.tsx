// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React, { useState, useCallback, useMemo } from 'react';
import { useReactFlow } from '@xyflow/react';

interface DiagramFiltersProps {
  services: string[];
  regions: string[];
}

const DiagramFilters: React.FC<DiagramFiltersProps> = ({ services, regions }) => {
  const [selectedService, setSelectedService] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const { getNodes, setNodes, fitView } = useReactFlow();

  const sortedServices = useMemo(() => [...services].sort(), [services]);
  const sortedRegions = useMemo(() => [...regions].sort(), [regions]);

  const applyFilters = useCallback((service: string, region: string) => {
    const nodes = getNodes();

    if (!service && !region) {
      setNodes(nodes.map((n) => ({ ...n, hidden: false, style: { ...n.style, opacity: 1 } })));
      fitView({ padding: 0.2, duration: 300 });
      return;
    }

    const updatedNodes = nodes.map((n) => {
      const data = n.data as Record<string, unknown>;
      const nodeService = String(data.service || '');
      const nodeRegion = String(data.region || '');

      if (n.type === 'groupNode') return { ...n, style: { ...n.style, opacity: 1 } };

      const matchesService = !service || nodeService === service;
      const matchesRegion = !region || nodeRegion === region;
      const isMatch = matchesService && matchesRegion;

      return {
        ...n,
        style: { ...n.style, opacity: isMatch ? 1 : 0.1 },
      };
    });

    setNodes(updatedNodes);
    fitView({ padding: 0.2, duration: 300 });
  }, [getNodes, setNodes, fitView]);

  const handleServiceChange = (value: string) => {
    setSelectedService(value);
    applyFilters(value, selectedRegion);
  };

  const handleRegionChange = (value: string) => {
    setSelectedRegion(value);
    applyFilters(selectedService, value);
  };

  const handleClear = () => {
    setSelectedService('');
    setSelectedRegion('');
    applyFilters('', '');
  };

  const hasFilter = selectedService || selectedRegion;

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={{
          position: 'absolute', top: 50, right: 12, zIndex: 10,
          width: 34, height: 34,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: hasFilter
            ? 'linear-gradient(135deg, var(--color-primary), var(--color-primary-hover))'
            : 'var(--color-bg-secondary)',
          border: `1px solid ${hasFilter ? 'transparent' : 'var(--color-border)'}`,
          borderRadius: 'var(--radius-sm)',
          cursor: 'pointer',
          color: hasFilter ? '#fff' : 'var(--color-text-secondary)',
          boxShadow: hasFilter ? '0 2px 8px var(--color-primary-glow)' : 'none',
          transition: 'all 0.15s ease',
        }}
        title="Filter nodes"
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
          <path d="M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z" />
        </svg>
      </button>
    );
  }

  const selectStyle: React.CSSProperties = {
    width: '100%',
    padding: '6px 8px',
    fontSize: 12,
    borderRadius: 'var(--radius-sm)',
    border: '1px solid var(--color-border)',
    color: 'var(--color-text)',
    background: 'var(--color-bg-tertiary)',
    outline: 'none',
    fontFamily: 'var(--font-family)',
  };

  return (
    <div style={{
      position: 'absolute', top: 50, right: 12, zIndex: 10,
      background: 'var(--color-bg-secondary)',
      border: '1px solid var(--color-border)',
      borderRadius: 'var(--radius-md)',
      padding: 14,
      minWidth: 210,
      boxShadow: 'var(--shadow-lg)',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <span style={{
          fontSize: 11,
          fontWeight: 600,
          color: 'var(--color-text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}>
          Filters
        </span>
        <button
          onClick={() => setIsOpen(false)}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--color-text-muted)', fontSize: 16, lineHeight: 1,
            padding: '0 2px',
          }}
        >
          ×
        </button>
      </div>
      <div style={{ marginBottom: 10 }}>
        <label style={{
          fontSize: 11, fontWeight: 500,
          color: 'var(--color-text-muted)',
          display: 'block', marginBottom: 4,
        }}>
          Service
        </label>
        <select
          value={selectedService}
          onChange={(e) => handleServiceChange(e.target.value)}
          style={selectStyle}
        >
          <option value="">All Services</option>
          {sortedServices.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div style={{ marginBottom: 10 }}>
        <label style={{
          fontSize: 11, fontWeight: 500,
          color: 'var(--color-text-muted)',
          display: 'block', marginBottom: 4,
        }}>
          Region
        </label>
        <select
          value={selectedRegion}
          onChange={(e) => handleRegionChange(e.target.value)}
          style={selectStyle}
        >
          <option value="">All Regions</option>
          {sortedRegions.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      {hasFilter && (
        <button
          onClick={handleClear}
          style={{
            width: '100%', padding: '5px',
            fontSize: 11, fontWeight: 500,
            borderRadius: 'var(--radius-sm)',
            border: '1px solid var(--color-border)',
            background: 'var(--color-bg-tertiary)',
            cursor: 'pointer',
            color: 'var(--color-text-secondary)',
            transition: 'all 0.15s ease',
          }}
        >
          Clear Filters
        </button>
      )}
    </div>
  );
};

export default DiagramFilters;

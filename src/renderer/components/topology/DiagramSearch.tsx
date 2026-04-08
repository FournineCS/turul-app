// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React, { useState, useCallback } from 'react';
import { useReactFlow } from '@xyflow/react';

const DiagramSearch: React.FC = () => {
  const [query, setQuery] = useState('');
  const [matchCount, setMatchCount] = useState<number | null>(null);
  const { getNodes, setNodes, fitView } = useReactFlow();

  const handleSearch = useCallback(() => {
    const nodes = getNodes();
    const q = query.toLowerCase().trim();

    if (!q) {
      setNodes(nodes.map((n) => ({ ...n, hidden: false, style: { ...n.style, opacity: 1 } })));
      setMatchCount(null);
      fitView({ padding: 0.2, duration: 300 });
      return;
    }

    let matches = 0;
    const matchIds = new Set<string>();

    const updatedNodes = nodes.map((n) => {
      const data = n.data as Record<string, unknown>;
      const label = String(data.label || '').toLowerCase();
      const service = String(data.service || '').toLowerCase();
      const resourceType = String(data.resourceType || '').toLowerCase();
      const id = n.id.toLowerCase();

      const isMatch = label.includes(q) || service.includes(q) || resourceType.includes(q) || id.includes(q);

      if (isMatch) {
        matches++;
        matchIds.add(n.id);
      }

      return {
        ...n,
        style: { ...n.style, opacity: isMatch ? 1 : 0.15 },
      };
    });

    setNodes(updatedNodes);
    setMatchCount(matches);

    if (matchIds.size > 0) {
      const matchedNodes = updatedNodes.filter((n) => matchIds.has(n.id));
      if (matchedNodes.length > 0) {
        fitView({ nodes: matchedNodes, padding: 0.3, duration: 400 });
      }
    }
  }, [query, getNodes, setNodes, fitView]);

  const handleClear = useCallback(() => {
    setQuery('');
    setMatchCount(null);
    const nodes = getNodes();
    setNodes(nodes.map((n) => ({ ...n, style: { ...n.style, opacity: 1 } })));
    fitView({ padding: 0.2, duration: 300 });
  }, [getNodes, setNodes, fitView]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
    if (e.key === 'Escape') handleClear();
  };

  return (
    <div style={{
      position: 'absolute', top: 12, left: 12, zIndex: 10,
      display: 'flex', alignItems: 'center', gap: 4,
    }}>
      <input
        type="text"
        placeholder="Search nodes..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        style={{
          width: 200,
          padding: '7px 12px',
          fontSize: 12,
          background: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-sm)',
          color: 'var(--color-text)',
          outline: 'none',
          fontFamily: 'var(--font-family)',
          transition: 'border-color 0.15s ease',
        }}
      />
      <button
        onClick={handleSearch}
        style={{
          width: 30, height: 30,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-sm)',
          cursor: 'pointer',
          color: 'var(--color-text-secondary)',
          transition: 'all 0.15s ease',
        }}
        title="Search"
      >
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
          <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
        </svg>
      </button>
      {query && (
        <button
          onClick={handleClear}
          style={{
            width: 30, height: 30,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border)',
            borderRadius: 'var(--radius-sm)',
            cursor: 'pointer',
            color: 'var(--color-text-secondary)',
            fontSize: 14,
            transition: 'all 0.15s ease',
          }}
          title="Clear search"
        >
          ×
        </button>
      )}
      {matchCount !== null && (
        <span style={{
          fontSize: 11,
          fontFamily: 'var(--font-mono)',
          color: 'var(--color-text-secondary)',
          background: 'var(--color-bg-tertiary)',
          padding: '3px 8px',
          borderRadius: 4,
          border: '1px solid var(--color-border-subtle)',
        }}>
          {matchCount} found
        </span>
      )}
    </div>
  );
};

export default DiagramSearch;

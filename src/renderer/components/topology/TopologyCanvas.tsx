// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import type { TopologyGraph, TopologyNode, TopologyLink, RelationshipType } from '../../../shared/types';
import { getProviderColor, getProviderLabel } from './providerIcons';
import { GCP_SERVICE_LABELS } from './gcpServiceIcons';

interface TopologyCanvasProps {
  graph: TopologyGraph;
}

// Node colors by resource type
const NODE_COLORS: Record<string, string> = {
  // AWS types
  vpc: '#ff9500',
  instance: '#0984e3',
  'security-group': '#e84393',
  'internet-gateway': '#00cec9',
  'route-table': '#fdcb6e',
  'network-interface': '#a29bfe',
  'load-balancer': '#fd79a8',
  'target-group': '#fab1a0',
  function: '#74b9ff',
  'db-instance': '#ff7675',
  'db-cluster': '#d63031',
  // Shared (AWS + GCP)
  subnet: '#34a853',
  'nat-gateway': '#9334e6',
  bucket: '#55efc4',
  // GCP types
  network: '#4285f4',
  'firewall-rule': '#ea4335',
  cluster: '#4285f4',
  service: '#4285f4',
  'forwarding-rule': '#ff6d01',
  'backend-service': '#ff6d01',
  'sql-instance': '#4285f4',
  router: '#fbbc04',
  topic: '#4285f4',
  'url-map': '#ff6d01',
  'health-check': '#34a853',
  'instance-group': '#4285f4',
  disk: '#4285f4',
  address: '#a142f4',
};

// Node icons (simplified shapes)
const NODE_ICONS: Record<string, string> = {
  // AWS types
  vpc: 'M',
  instance: 'I',
  'security-group': 'SG',
  'internet-gateway': 'IGW',
  'route-table': 'RT',
  'network-interface': 'ENI',
  'load-balancer': 'LB',
  'target-group': 'TG',
  function: 'λ',
  'db-instance': 'DB',
  'db-cluster': 'DBC',
  // Shared (AWS + GCP)
  subnet: 'SN',
  'nat-gateway': 'NAT',
  bucket: 'S3',
  // GCP types
  network: 'VPC',
  'firewall-rule': 'FW',
  cluster: 'GKE',
  service: 'CR',
  'forwarding-rule': 'LB',
  'backend-service': 'BE',
  'sql-instance': 'SQL',
  router: 'RTR',
  topic: 'PS',
  'url-map': 'URL',
  'health-check': 'HC',
  'instance-group': 'IG',
  disk: 'DSK',
  address: 'IP',
};

// Link colors by relationship type
const LINK_COLORS: Record<RelationshipType, string> = {
  contains: '#636e72',
  member_of: '#0984e3',
  targets: '#e84393',
  routes_to: '#6c5ce7',
  serves: '#00b894',
  attached_to: '#fdcb6e',
  uses: '#74b9ff',
  depends_on: '#fd79a8',
};

const TopologyCanvas: React.FC<TopologyCanvasProps> = ({ graph }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedNode, setSelectedNode] = useState<TopologyNode | null>(null);
  const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

  // Update dimensions on resize
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        setDimensions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    };

    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);

  useEffect(() => {
    if (!svgRef.current || !graph.nodes.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const width = dimensions.width;
    const height = dimensions.height;

    // Create container group for zoom
    const container = svg.append('g');

    // Add zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        container.attr('transform', event.transform);
      });

    svg.call(zoom);

    // Create arrow markers for links
    const defs = svg.append('defs');

    Object.entries(LINK_COLORS).forEach(([type, color]) => {
      defs.append('marker')
        .attr('id', `arrow-${type}`)
        .attr('viewBox', '0 -5 10 10')
        .attr('refX', 25)
        .attr('refY', 0)
        .attr('markerWidth', 6)
        .attr('markerHeight', 6)
        .attr('orient', 'auto')
        .append('path')
        .attr('fill', color)
        .attr('d', 'M0,-5L10,0L0,5');
    });

    // Prepare data for simulation
    const nodes: (TopologyNode & { x?: number; y?: number })[] = graph.nodes.map((n) => ({ ...n }));
    const links: (TopologyLink & { source: string | TopologyNode; target: string | TopologyNode })[] = graph.links.map((l) => ({ ...l }));

    // Scale simulation parameters based on node count for performance
    const nodeCount = nodes.length;
    const chargeStrength = nodeCount > 500 ? -150 : nodeCount > 200 ? -200 : -300;
    const alphaDecay = nodeCount > 500 ? 0.05 : nodeCount > 200 ? 0.03 : 0.0228;
    const iterationLimit = nodeCount > 500 ? 100 : nodeCount > 200 ? 200 : 300;

    // Create force simulation
    const simulation = d3.forceSimulation(nodes as d3.SimulationNodeDatum[])
      .force('link', d3.forceLink(links as d3.SimulationLinkDatum<d3.SimulationNodeDatum>[])
        .id((d: any) => d.id)
        .distance(100)
        .strength(0.5))
      .force('charge', d3.forceManyBody().strength(chargeStrength))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(40))
      .alphaDecay(alphaDecay)
      .alphaMin(0.01);

    // Draw links
    const linkGroup = container.append('g').attr('class', 'links');

    const link = linkGroup.selectAll('line')
      .data(links)
      .enter()
      .append('line')
      .attr('stroke', (d: any) => LINK_COLORS[d.type as RelationshipType] || '#636e72')
      .attr('stroke-width', 2)
      .attr('stroke-opacity', 0.6)
      .attr('marker-end', (d: any) => `url(#arrow-${d.type})`);

    // Draw nodes
    const nodeGroup = container.append('g').attr('class', 'nodes');

    const node = nodeGroup.selectAll('g')
      .data(nodes)
      .enter()
      .append('g')
      .attr('cursor', 'pointer')
      .call(d3.drag<SVGGElement, TopologyNode>()
        .on('start', (event, d: any) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d: any) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, d: any) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        }))
      .on('click', (event, d) => {
        event.stopPropagation();
        setSelectedNode(d);
      });

    // Node circles
    node.append('circle')
      .attr('r', 20)
      .attr('fill', (d) => NODE_COLORS[d.type] || ((d as any).cloudProvider === 'gcp' ? '#4285f4' : '#636e72'))
      .attr('stroke', '#fff')
      .attr('stroke-width', 2);

    // Node labels (icons)
    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('dominant-baseline', 'central')
      .attr('fill', '#fff')
      .attr('font-size', '10px')
      .attr('font-weight', 'bold')
      .text((d) => NODE_ICONS[d.type] || ((d as any).cloudProvider === 'gcp' ? (GCP_SERVICE_LABELS[d.type] || d.type.charAt(0).toUpperCase()).slice(0, 3) : d.type.charAt(0).toUpperCase()));

    // Node name labels
    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('y', 35)
      .attr('fill', '#e7e9ea')
      .attr('font-size', '11px')
      .text((d) => {
        const name = d.name || d.id.split('/').pop() || '';
        return name.length > 15 ? name.substring(0, 15) + '...' : name;
      });

    // Update positions on simulation tick
    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      node.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });

    // Click on background to deselect
    svg.on('click', () => {
      setSelectedNode(null);
    });

    // Initial zoom to fit
    const bounds = container.node()?.getBBox();
    if (bounds) {
      const fullWidth = bounds.width;
      const fullHeight = bounds.height;
      const midX = bounds.x + fullWidth / 2;
      const midY = bounds.y + fullHeight / 2;

      const scale = 0.8 / Math.max(fullWidth / width, fullHeight / height);
      const translate = [width / 2 - scale * midX, height / 2 - scale * midY];

      svg.call(
        zoom.transform,
        d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
      );
    }

    // Cleanup
    return () => {
      simulation.stop();
    };
  }, [graph, dimensions.width, dimensions.height]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        backgroundColor: 'var(--color-bg)',
      }}
    >
      <svg
        ref={svgRef}
        width={dimensions.width}
        height={dimensions.height}
        style={{ display: 'block' }}
      />

      {/* Legend */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          left: 16,
          backgroundColor: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border)',
          borderRadius: 8,
          padding: 12,
          fontSize: 12,
        }}
      >
        <div style={{ fontWeight: 'bold', marginBottom: 8 }}>Node Types</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, maxWidth: 300 }}>
          {[...new Set(graph.nodes.map(n => n.type))].slice(0, 10).map((type) => {
            const color = NODE_COLORS[type] || '#636e72';
            return (
              <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <div
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: '50%',
                    backgroundColor: color,
                  }}
                />
                <span>{type}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Controls */}
      <div
        style={{
          position: 'absolute',
          top: 16,
          right: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <button
          className="btn btn-sm btn-secondary"
          onClick={() => {
            const svg = d3.select(svgRef.current);
            svg.transition().duration(750).call(
              (d3.zoom<SVGSVGElement, unknown>() as any).transform,
              d3.zoomIdentity
            );
          }}
        >
          Reset Zoom
        </button>
      </div>

      {/* Selected Node Details */}
      {selectedNode && (
        <div
          style={{
            position: 'absolute',
            bottom: 16,
            right: 16,
            width: 320,
            backgroundColor: 'var(--color-bg-secondary)',
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            padding: 16,
            maxHeight: '40%',
            overflow: 'auto',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h4 style={{ margin: 0 }}>{selectedNode.name || selectedNode.type}</h4>
            <button
              className="btn btn-sm btn-secondary"
              onClick={() => setSelectedNode(null)}
              style={{ padding: '4px 8px' }}
            >
              ×
            </button>
          </div>

          <div style={{ fontSize: 12 }}>
            <div style={{ marginBottom: 8 }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>Type:</span>{' '}
              <span
                style={{
                  backgroundColor: NODE_COLORS[selectedNode.type] || '#636e72',
                  color: '#fff',
                  padding: '2px 6px',
                  borderRadius: 4,
                  fontSize: 11,
                }}
              >
                {selectedNode.type}
              </span>
            </div>

            <div style={{ marginBottom: 8 }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>Service:</span>{' '}
              {selectedNode.service}
            </div>

            <div style={{ marginBottom: 8 }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>Region:</span>{' '}
              {selectedNode.region}
            </div>

            <div style={{ marginBottom: 8 }}>
              <span style={{ color: 'var(--color-text-secondary)' }}>{selectedNode.cloudProvider === 'gcp' ? 'ID:' : 'ARN:'}</span>
              <div style={{ wordBreak: 'break-all', fontSize: 10, marginTop: 4 }}>
                {selectedNode.id}
              </div>
            </div>

            {selectedNode.data && Object.keys(selectedNode.data).length > 0 && (
              <div>
                <span style={{ color: 'var(--color-text-secondary)' }}>Details:</span>
                <pre
                  style={{
                    backgroundColor: 'var(--color-bg-tertiary)',
                    padding: 8,
                    borderRadius: 4,
                    fontSize: 10,
                    overflow: 'auto',
                    maxHeight: 150,
                    marginTop: 4,
                  }}
                >
                  {JSON.stringify(selectedNode.data, null, 2)}
                </pre>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TopologyCanvas;

// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React, { useEffect, useCallback, useState, useRef } from 'react';
import {
  ReactFlow,
  Background,
  MiniMap,
  type Node,
  type Edge,
  type NodeTypes,
  ReactFlowProvider,
  useReactFlow,
  Panel,
} from '@xyflow/react';
import ELK, { type ElkNode, type ElkExtendedEdge } from 'elkjs/lib/elk.bundled.js';
import '@xyflow/react/dist/style.css';
import type { CloudProvider, DiagramGraph, DiagramViewMode } from '../../../shared/types';
import DiagramNode from './DiagramNode';
import DiagramGroupNode from './DiagramGroupNode';
import DiagramLegend from './DiagramLegend';
import DiagramControls from './DiagramControls';
import DiagramSearch from './DiagramSearch';
import DiagramFilters from './DiagramFilters';
import { getProviderColor, getProviderColorMap, getProviderTierLabel } from './providerIcons';

interface ArchitectureDiagramProps {
  graph: DiagramGraph;
}

const nodeTypes: NodeTypes = {
  diagramNode: DiagramNode,
  groupNode: DiagramGroupNode,
};

const NODE_WIDTH = 200;
const NODE_HEIGHT = 76;
const GROUP_PADDING = 50;

const elk = new ELK();

function getElkDirection(viewMode: DiagramViewMode): string {
  return viewMode === 'data' ? 'RIGHT' : 'DOWN';
}

/**
 * Determine the group key for a node.
 * - Network view: group by VPC ID (from node.group)
 * - Application/Data view: group by tier
 */
function getGroupKey(
  nodeData: { tier?: string; group?: string },
  viewMode: DiagramViewMode
): string | null {
  if (viewMode === 'network') {
    return nodeData.group || null;
  }
  if (viewMode === 'application' || viewMode === 'data') {
    return nodeData.tier || null;
  }
  return null;
}

function getGroupLabel(groupKey: string, viewMode: DiagramViewMode, cloudProvider?: CloudProvider): string {
  if (viewMode === 'network') {
    // For network view, group key is a VPC ID (AWS) or network selfLink (GCP)
    if (groupKey.startsWith('vpc-')) {
      return `VPC ${groupKey}`;
    }
    // GCP network selfLinks: projects/{proj}/global/networks/{name}
    if (groupKey.includes('/networks/')) {
      const name = groupKey.split('/networks/').pop() || groupKey;
      return `VPC ${name}`;
    }
    return groupKey;
  }
  return getProviderTierLabel(cloudProvider, groupKey);
}

function getGroupColor(groupKey: string, viewMode: DiagramViewMode, cloudProvider?: CloudProvider): string {
  const colorMap = getProviderColorMap(cloudProvider, viewMode);
  if (!colorMap) return '#94a3b8';

  if (viewMode === 'network') {
    return colorMap['vpc'] || colorMap['network'] || '#ff9500';
  }

  return colorMap[groupKey] || '#94a3b8';
}

interface GraphNodeData {
  label: string;
  resourceType: string;
  service: string;
  tier?: string;
  group?: string;
  viewMode: string;
  region?: string;
  cloudProvider?: CloudProvider;
}

/**
 * Build an ELK graph with nested group nodes, run the layout,
 * then convert back to React Flow nodes/edges.
 */
async function layoutWithELK(
  graph: DiagramGraph
): Promise<{ nodes: Node[]; edges: Edge[] }> {
  const direction = getElkDirection(graph.viewMode);
  const nodeIds = new Set(graph.nodes.map((n) => n.id));

  // Build child node data keyed by id
  const childNodeMap = new Map<string, { elkChild: ElkNode; rfData: GraphNodeData }>();
  // Group assignment: groupKey -> list of node ids
  const groupMap = new Map<string, string[]>();

  // Detect cloudProvider from graph nodes
  const cloudProvider = graph.nodes[0]?.cloudProvider;

  for (const node of graph.nodes) {
    const label = node.name || node.id.split('/').pop() || node.id;
    const rfData: GraphNodeData = {
      label,
      resourceType: node.type,
      service: node.service,
      tier: node.tier,
      group: node.group,
      viewMode: graph.viewMode,
      region: node.region,
      cloudProvider: node.cloudProvider,
    };

    const elkChild: ElkNode = {
      id: node.id,
      width: NODE_WIDTH,
      height: NODE_HEIGHT,
    };

    childNodeMap.set(node.id, { elkChild, rfData });

    const groupKey = getGroupKey(
      { tier: node.tier, group: node.group },
      graph.viewMode
    );

    if (groupKey) {
      if (!groupMap.has(groupKey)) {
        groupMap.set(groupKey, []);
      }
      groupMap.get(groupKey)!.push(node.id);
    }
  }

  // Build ELK edges (only between valid nodes)
  const elkEdges: ElkExtendedEdge[] = graph.edges
    .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
    .map((e) => ({
      id: e.id,
      sources: [e.source],
      targets: [e.target],
    }));

  // Build top-level ELK children: group nodes (with nested children) + ungrouped nodes
  const groupedNodeIds = new Set<string>();
  const topChildren: ElkNode[] = [];

  for (const [groupKey, memberIds] of groupMap) {
    if (memberIds.length === 0) continue;

    const groupChildren: ElkNode[] = [];
    for (const id of memberIds) {
      const entry = childNodeMap.get(id);
      if (entry) {
        groupChildren.push(entry.elkChild);
        groupedNodeIds.add(id);
      }
    }

    if (groupChildren.length > 0) {
      const groupNodeId = `group-${groupKey}`;
      // Use 'rectpacking' inside groups so children wrap into a grid
      // instead of being laid out in a single row by the layered algorithm
      const cols = Math.ceil(Math.sqrt(groupChildren.length));
      const targetWidth = cols * (NODE_WIDTH + 30) + GROUP_PADDING * 2;
      topChildren.push({
        id: groupNodeId,
        children: groupChildren,
        layoutOptions: {
          'elk.algorithm': 'rectpacking',
          'elk.padding': `[top=${GROUP_PADDING + 24},left=${GROUP_PADDING},bottom=${GROUP_PADDING},right=${GROUP_PADDING}]`,
          'elk.rectpacking.targetWidth': String(targetWidth),
          'elk.spacing.nodeNode': '20',
        },
      });
    }
  }

  // Add ungrouped nodes at the top level
  for (const [id, entry] of childNodeMap) {
    if (!groupedNodeIds.has(id)) {
      topChildren.push(entry.elkChild);
    }
  }

  const elkGraph: ElkNode = {
    id: 'root',
    children: topChildren,
    edges: elkEdges,
    layoutOptions: {
      'elk.algorithm': 'layered',
      'elk.direction': direction,
      'elk.hierarchyHandling': 'SEPARATE_CHILDREN',
      'elk.spacing.nodeNode': '60',
      'elk.layered.spacing.nodeNodeBetweenLayers': '100',
      'elk.layered.spacing.edgeNodeBetweenLayers': '40',
      'elk.edgeRouting': 'ORTHOGONAL',
      'elk.layered.mergeEdges': 'true',
    },
  };

  const layoutResult = await elk.layout(elkGraph);

  // Convert ELK result to React Flow nodes
  const rfNodes: Node[] = [];

  for (const topChild of layoutResult.children || []) {
    if (topChild.id.startsWith('group-')) {
      // This is a group node
      const groupKey = topChild.id.replace('group-', '');
      const viewMode = graph.viewMode;

      rfNodes.push({
        id: topChild.id,
        type: 'groupNode',
        position: { x: topChild.x ?? 0, y: topChild.y ?? 0 },
        style: {
          width: topChild.width ?? 200,
          height: topChild.height ?? 100,
        },
        data: {
          label: getGroupLabel(groupKey, viewMode, cloudProvider),
          color: getGroupColor(groupKey, viewMode, cloudProvider),
          tier: groupKey,
          viewMode,
        },
      });

      // Add children inside this group
      for (const child of topChild.children || []) {
        const entry = childNodeMap.get(child.id);
        if (entry) {
          rfNodes.push({
            id: child.id,
            type: 'diagramNode',
            position: { x: child.x ?? 0, y: child.y ?? 0 },
            parentId: topChild.id,
            extent: 'parent' as const,
            data: entry.rfData,
          });
        }
      }
    } else {
      // Ungrouped node at top level (or a plain top-level node)
      const entry = childNodeMap.get(topChild.id);
      if (entry) {
        rfNodes.push({
          id: topChild.id,
          type: 'diagramNode',
          position: { x: topChild.x ?? 0, y: topChild.y ?? 0 },
          data: entry.rfData,
        });
      }
    }
  }

  // Build React Flow edges
  const rfEdges: Edge[] = graph.edges
    .filter((edge) => nodeIds.has(edge.source) && nodeIds.has(edge.target))
    .map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      type: 'smoothstep',
      animated: edge.type === 'targets' || edge.type === 'routes_to',
      style: {
        stroke: getEdgeColor(edge.type),
        strokeWidth: 1.5,
      },
      label: edge.label,
      labelStyle: { fontSize: 9, fill: '#94a3b8' },
      labelBgStyle: { fill: '#131720', fillOpacity: 0.85 },
    }));

  return { nodes: rfNodes, edges: rfEdges };
}

function getEdgeColor(type: string): string {
  switch (type) {
    case 'contains': return '#94a3b8';
    case 'member_of': return '#3b82f6';
    case 'targets': return '#ef4444';
    case 'routes_to': return '#8b5cf6';
    case 'serves': return '#10b981';
    case 'attached_to': return '#f59e0b';
    case 'uses': return '#06b6d4';
    case 'depends_on': return '#ec4899';
    default: return '#94a3b8';
  }
}

const ArchitectureDiagramInner: React.FC<ArchitectureDiagramProps> = ({ graph }) => {
  const { fitView } = useReactFlow();
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [layoutError, setLayoutError] = useState<string | null>(null);
  const fitTimerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    let cancelled = false;
    setLayoutError(null);

    layoutWithELK(graph)
      .then((result) => {
        if (!cancelled) {
          setNodes(result.nodes);
          setEdges(result.edges);
          // Give React Flow a tick to render before fitting
          fitTimerRef.current = setTimeout(() => {
            if (!cancelled) fitView({ padding: 0.2 });
          }, 50);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error('ELK layout failed:', err);
          setLayoutError(err instanceof Error ? err.message : 'Layout failed');
        }
      });

    return () => {
      cancelled = true;
      if (fitTimerRef.current) clearTimeout(fitTimerRef.current);
    };
  }, [graph, fitView]);

  const onNodeClick = useCallback((_event: React.MouseEvent, node: Node) => {
    setSelectedNode((prev) => (node.id === prev ? null : node.id));
  }, []);

  const minimapNodeColor = useCallback((node: Node) => {
    if (node.type === 'groupNode') {
      const data = node.data as { color?: string };
      return data.color || '#94a3b8';
    }
    const data = node.data as { resourceType: string; tier?: string; viewMode: string; cloudProvider?: CloudProvider };
    return getProviderColor(data.cloudProvider, data.viewMode, data.resourceType, data.tier);
  }, []);

  if (layoutError) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#ef4444', fontSize: 14 }}>Layout error: {layoutError}</div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.1}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
        defaultEdgeOptions={{
          type: 'smoothstep',
        }}
      >
        <Background color="var(--color-border)" gap={20} size={1} />
        <MiniMap
          nodeColor={minimapNodeColor}
          maskColor="rgba(0,0,0,0.08)"
          style={{
            bottom: 12,
            right: 12,
            width: 160,
            height: 100,
            border: '1px solid var(--color-border)',
            borderRadius: 8,
          }}
        />
        <Panel position="top-left" style={{ margin: 12 }}>
          <div
            style={{
              background: 'var(--color-bg-secondary)',
              border: '1px solid var(--color-border)',
              borderRadius: 8,
              padding: '6px 12px',
              fontSize: 12,
              color: 'var(--color-text-secondary)',
              backdropFilter: 'blur(4px)',
            }}
          >
            {graph.nodes.length} nodes, {graph.edges.length} edges
          </div>
        </Panel>
      </ReactFlow>

      <DiagramSearch />
      <DiagramControls />
      <DiagramFilters
        services={[...new Set(graph.nodes.map((n) => n.service))]}
        regions={[...new Set(graph.nodes.map((n) => n.region))]}
      />
      <DiagramLegend viewMode={graph.viewMode} cloudProvider={graph.nodes[0]?.cloudProvider} />

      {/* Selected node detail panel */}
      {selectedNode && (
        <NodeDetailPanel
          nodeId={selectedNode}
          graph={graph}
          onClose={() => setSelectedNode(null)}
        />
      )}
    </div>
  );
};

interface NodeDetailPanelProps {
  nodeId: string;
  graph: DiagramGraph;
  onClose: () => void;
}

const NodeDetailPanel: React.FC<NodeDetailPanelProps> = ({ nodeId, graph, onClose }) => {
  const node = graph.nodes.find((n) => n.id === nodeId);
  if (!node) return null;

  const connections = graph.edges.filter((e) => e.source === nodeId || e.target === nodeId);

  return (
    <div
      style={{
        position: 'absolute',
        top: 52,
        left: 12,
        width: 280,
        maxHeight: 'calc(100% - 64px)',
        overflow: 'auto',
        background: 'var(--color-bg-secondary)',
        border: '1px solid var(--color-border)',
        borderRadius: 8,
        padding: 16,
        fontSize: 12,
        zIndex: 20,
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-text)' }}>{node.name}</div>
          <div style={{ color: 'var(--color-text-secondary)', marginTop: 2 }}>{node.type} ({node.service})</div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: 16,
            color: 'var(--color-text-secondary)',
            padding: '0 4px',
          }}
        >
          x
        </button>
      </div>

      <div style={{ marginBottom: 8, color: 'var(--color-text)' }}>
        <div><strong>Region:</strong> {node.region}</div>
        {node.tier && <div><strong>Tier:</strong> {node.tier}</div>}
        {node.group && <div><strong>Group:</strong> {node.group}</div>}
      </div>

      {connections.length > 0 && (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--color-text)', marginBottom: 4 }}>
            Connections ({connections.length})
          </div>
          {connections.map((conn) => {
            const isSource = conn.source === nodeId;
            const otherNodeId = isSource ? conn.target : conn.source;
            const otherNode = graph.nodes.find((n) => n.id === otherNodeId);
            return (
              <div
                key={conn.id}
                style={{
                  padding: '3px 0',
                  borderBottom: '1px solid var(--color-border)',
                  color: 'var(--color-text)',
                }}
              >
                <span style={{ color: 'var(--color-text-secondary)' }}>{isSource ? '\u2192' : '\u2190'}</span>{' '}
                <span style={{ fontWeight: 500 }}>{conn.type}</span>{' '}
                {otherNode?.name || otherNodeId.split('/').pop()}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const ArchitectureDiagram: React.FC<ArchitectureDiagramProps> = (props) => {
  return (
    <ReactFlowProvider>
      <ArchitectureDiagramInner {...props} />
    </ReactFlowProvider>
  );
};

export default ArchitectureDiagram;

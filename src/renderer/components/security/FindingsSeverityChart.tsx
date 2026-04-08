// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React, { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import type { SecurityPostureSummary } from '../../../shared/types';

interface FindingsSeverityChartProps {
  summary: SecurityPostureSummary | null;
  isLoading: boolean;
}

const SEVERITY_COLORS: Record<string, string> = {
  CRITICAL: '#dc2626',
  HIGH: '#ea580c',
  MEDIUM: '#ca8a04',
  LOW: '#2563eb',
  INFORMATIONAL: '#6b7280',
};

export const FindingsSeverityChart: React.FC<FindingsSeverityChartProps> = ({
  summary,
  isLoading,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || isLoading || !summary) return;

    const data = [
      { label: 'Critical', value: summary.criticalCount, color: SEVERITY_COLORS.CRITICAL },
      { label: 'High', value: summary.highCount, color: SEVERITY_COLORS.HIGH },
      { label: 'Medium', value: summary.mediumCount, color: SEVERITY_COLORS.MEDIUM },
      { label: 'Low', value: summary.lowCount, color: SEVERITY_COLORS.LOW },
      { label: 'Info', value: summary.informationalCount, color: SEVERITY_COLORS.INFORMATIONAL },
    ].filter((d) => d.value > 0);

    // Clear previous chart
    d3.select(svgRef.current).selectAll('*').remove();

    const width = 280;
    const height = 200;
    const radius = Math.min(width, height) / 2 - 20;

    const svg = d3
      .select(svgRef.current)
      .attr('width', width)
      .attr('height', height)
      .append('g')
      .attr('transform', `translate(${width / 2}, ${height / 2})`);

    if (data.length === 0) {
      svg
        .append('text')
        .attr('text-anchor', 'middle')
        .attr('fill', 'var(--color-text-secondary)')
        .text('No findings');
      return;
    }

    const pie = d3
      .pie<{ label: string; value: number; color: string }>()
      .value((d) => d.value)
      .sort(null);

    const arc = d3
      .arc<d3.PieArcDatum<{ label: string; value: number; color: string }>>()
      .innerRadius(radius * 0.5)
      .outerRadius(radius);

    const arcs = svg
      .selectAll('arc')
      .data(pie(data))
      .enter()
      .append('g')
      .attr('class', 'arc');

    arcs
      .append('path')
      .attr('d', arc)
      .attr('fill', (d) => d.data.color)
      .attr('stroke', 'var(--color-bg)')
      .attr('stroke-width', 2)
      .style('transition', 'opacity 0.2s')
      .on('mouseover', function () {
        d3.select(this).style('opacity', 0.8);
      })
      .on('mouseout', function () {
        d3.select(this).style('opacity', 1);
      });

    // Add center text showing total
    svg
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '-0.2em')
      .attr('fill', 'var(--color-text)')
      .style('font-size', '24px')
      .style('font-weight', '600')
      .text(summary.totalFindings);

    svg
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '1.2em')
      .attr('fill', 'var(--color-text-secondary)')
      .style('font-size', '12px')
      .text('Total');
  }, [summary, isLoading]);

  return (
    <div className="card">
      <h3 className="card-title" style={{ marginBottom: 16 }}>
        Findings by Severity
      </h3>
      {isLoading ? (
        <div className="loading-overlay" style={{ height: 200 }}>
          <div className="spinner" />
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <svg ref={svgRef} />
          <div style={{ flex: 1 }}>
            {[
              { label: 'Critical', value: summary?.criticalCount ?? 0, color: SEVERITY_COLORS.CRITICAL },
              { label: 'High', value: summary?.highCount ?? 0, color: SEVERITY_COLORS.HIGH },
              { label: 'Medium', value: summary?.mediumCount ?? 0, color: SEVERITY_COLORS.MEDIUM },
              { label: 'Low', value: summary?.lowCount ?? 0, color: SEVERITY_COLORS.LOW },
              { label: 'Informational', value: summary?.informationalCount ?? 0, color: SEVERITY_COLORS.INFORMATIONAL },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginBottom: 8,
                }}
              >
                <div
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 2,
                    backgroundColor: item.color,
                  }}
                />
                <span style={{ fontSize: 13, color: 'var(--color-text-secondary)' }}>
                  {item.label}:
                </span>
                <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-text)' }}>
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default FindingsSeverityChart;

// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React, { useRef, useEffect } from 'react';
import * as d3 from 'd3';
import type { SecurityPostureSummary, FindingSource } from '../../../shared/types';

interface FindingsBySourceChartProps {
  summary: SecurityPostureSummary | null;
  isLoading: boolean;
}

const SOURCE_COLORS: Record<FindingSource, string> = {
  SECURITY_HUB: '#8b5cf6',
  GUARDDUTY: '#ef4444',
  INSPECTOR: '#f97316',
  ACCESS_ANALYZER: '#06b6d4',
  CONFIG: '#10b981',
};

const SOURCE_LABELS: Record<FindingSource, string> = {
  SECURITY_HUB: 'Security Hub',
  GUARDDUTY: 'GuardDuty',
  INSPECTOR: 'Inspector',
  ACCESS_ANALYZER: 'IAM Access Analyzer',
  CONFIG: 'AWS Config',
};

export const FindingsBySourceChart: React.FC<FindingsBySourceChartProps> = ({
  summary,
  isLoading,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || isLoading || !summary) return;

    const data = (Object.entries(summary.bySource) as [FindingSource, number][])
      .filter(([, value]) => value > 0)
      .map(([source, value]) => ({
        source,
        label: SOURCE_LABELS[source],
        value,
        color: SOURCE_COLORS[source],
      }))
      .sort((a, b) => b.value - a.value);

    // Clear previous chart
    d3.select(svgRef.current).selectAll('*').remove();

    const margin = { top: 10, right: 20, bottom: 30, left: 120 };
    const width = 400 - margin.left - margin.right;
    const height = Math.max(150, data.length * 35);

    const svg = d3
      .select(svgRef.current)
      .attr('width', width + margin.left + margin.right)
      .attr('height', height + margin.top + margin.bottom)
      .append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`);

    if (data.length === 0) {
      svg
        .append('text')
        .attr('x', width / 2)
        .attr('y', height / 2)
        .attr('text-anchor', 'middle')
        .attr('fill', 'var(--color-text-secondary)')
        .text('No findings');
      return;
    }

    const xScale = d3
      .scaleLinear()
      .domain([0, d3.max(data, (d) => d.value) || 0])
      .range([0, width]);

    const yScale = d3
      .scaleBand()
      .domain(data.map((d) => d.label))
      .range([0, height])
      .padding(0.3);

    // Add bars
    svg
      .selectAll('rect')
      .data(data)
      .enter()
      .append('rect')
      .attr('x', 0)
      .attr('y', (d) => yScale(d.label) || 0)
      .attr('width', (d) => xScale(d.value))
      .attr('height', yScale.bandwidth())
      .attr('fill', (d) => d.color)
      .attr('rx', 4)
      .style('transition', 'opacity 0.2s')
      .on('mouseover', function () {
        d3.select(this).style('opacity', 0.8);
      })
      .on('mouseout', function () {
        d3.select(this).style('opacity', 1);
      });

    // Add value labels
    svg
      .selectAll('.value-label')
      .data(data)
      .enter()
      .append('text')
      .attr('class', 'value-label')
      .attr('x', (d) => xScale(d.value) + 8)
      .attr('y', (d) => (yScale(d.label) || 0) + yScale.bandwidth() / 2)
      .attr('dy', '0.35em')
      .attr('fill', 'var(--color-text)')
      .style('font-size', '12px')
      .style('font-weight', '500')
      .text((d) => d.value);

    // Add Y axis
    svg
      .append('g')
      .call(d3.axisLeft(yScale))
      .selectAll('text')
      .attr('fill', 'var(--color-text-secondary)')
      .style('font-size', '12px');

    svg.selectAll('.domain').attr('stroke', 'var(--color-border)');
    svg.selectAll('.tick line').attr('stroke', 'var(--color-border)');
  }, [summary, isLoading]);

  return (
    <div className="card">
      <h3 className="card-title" style={{ marginBottom: 16 }}>
        Findings by Source
      </h3>
      {isLoading ? (
        <div className="loading-overlay" style={{ height: 150 }}>
          <div className="spinner" />
        </div>
      ) : (
        <svg ref={svgRef} />
      )}
    </div>
  );
};

export default FindingsBySourceChart;

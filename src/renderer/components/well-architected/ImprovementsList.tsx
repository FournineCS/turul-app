// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React, { useState } from 'react';
import type { WAImprovementItem, WAPillarId, WARiskLevel } from '../../../shared/types';
import { RiskIndicator } from './RiskCountBadge';

interface ImprovementsListProps {
  improvements: WAImprovementItem[];
  isLoading: boolean;
  maxVisible?: number;
}

const pillarNames: Record<WAPillarId, string> = {
  operationalExcellence: 'Operational Excellence',
  security: 'Security',
  reliability: 'Reliability',
  performance: 'Performance Efficiency',
  costOptimization: 'Cost Optimization',
  sustainability: 'Sustainability',
};

const riskColors: Record<WARiskLevel, string> = {
  HIGH: '#ef4444',
  MEDIUM: '#f59e0b',
  NONE: '#22c55e',
  NOT_APPLICABLE: '#9ca3af',
  UNANSWERED: '#3b82f6',
};

export const ImprovementsList: React.FC<ImprovementsListProps> = ({
  improvements,
  isLoading,
  maxVisible = 10,
}) => {
  const [showAll, setShowAll] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  // Filter to show only HIGH and MEDIUM risk items
  const actionableImprovements = improvements.filter(
    (item) => item.risk === 'HIGH' || item.risk === 'MEDIUM'
  );

  const displayedImprovements = showAll
    ? actionableImprovements
    : actionableImprovements.slice(0, maxVisible);

  const toggleExpand = (questionId: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(questionId)) {
        next.delete(questionId);
      } else {
        next.add(questionId);
      }
      return next;
    });
  };

  if (isLoading) {
    return (
      <div
        style={{
          backgroundColor: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border)',
          borderRadius: 8,
          padding: 24,
          marginBottom: 24,
        }}
      >
        <h3 style={{ margin: '0 0 16px', color: 'var(--color-text)', fontSize: 16 }}>
          Improvement Recommendations
        </h3>
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-secondary)' }}>
          Loading improvements...
        </div>
      </div>
    );
  }

  if (actionableImprovements.length === 0) {
    return (
      <div
        style={{
          backgroundColor: 'var(--color-bg-secondary)',
          border: '1px solid var(--color-border)',
          borderRadius: 8,
          padding: 24,
          marginBottom: 24,
        }}
      >
        <h3 style={{ margin: '0 0 16px', color: 'var(--color-text)', fontSize: 16 }}>
          Improvement Recommendations
        </h3>
        <div
          style={{
            textAlign: 'center',
            padding: 40,
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            borderRadius: 8,
          }}
        >
          <span style={{ fontSize: 32, marginBottom: 8, display: 'block' }}>🎉</span>
          <p style={{ color: 'var(--color-text)', margin: 0, fontWeight: 500 }}>
            No high or medium risk items found!
          </p>
          <p style={{ color: 'var(--color-text-secondary)', margin: '8px 0 0', fontSize: 13 }}>
            This workload has addressed all major risks.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        backgroundColor: 'var(--color-bg-secondary)',
        border: '1px solid var(--color-border)',
        borderRadius: 8,
        padding: 24,
        marginBottom: 24,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <h3 style={{ margin: 0, color: 'var(--color-text)', fontSize: 16 }}>
          Improvement Recommendations ({actionableImprovements.length})
        </h3>
        {actionableImprovements.length > maxVisible && (
          <button
            onClick={() => setShowAll(!showAll)}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--color-primary)',
              cursor: 'pointer',
              fontSize: 13,
              padding: 0,
            }}
          >
            {showAll ? 'Show Less' : `View All (${actionableImprovements.length})`}
          </button>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {displayedImprovements.map((item) => (
          <ImprovementItem
            key={`${item.pillarId}-${item.questionId}`}
            item={item}
            isExpanded={expandedItems.has(item.questionId)}
            onToggle={() => toggleExpand(item.questionId)}
          />
        ))}
      </div>
    </div>
  );
};

interface ImprovementItemProps {
  item: WAImprovementItem;
  isExpanded: boolean;
  onToggle: () => void;
}

const ImprovementItem: React.FC<ImprovementItemProps> = ({ item, isExpanded, onToggle }) => {
  const pillarName = pillarNames[item.pillarId] || item.pillarId;
  const riskColor = riskColors[item.risk];

  return (
    <div
      style={{
        backgroundColor: 'var(--color-bg)',
        border: '1px solid var(--color-border)',
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      <div
        onClick={onToggle}
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 12,
          padding: 16,
          cursor: 'pointer',
        }}
      >
        <RiskIndicator riskLevel={item.risk} size={12} />
        <div style={{ flex: 1 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginBottom: 4,
            }}
          >
            <span
              style={{
                fontSize: 10,
                padding: '2px 6px',
                borderRadius: 4,
                backgroundColor: `${riskColor}20`,
                color: riskColor,
                fontWeight: 600,
                textTransform: 'uppercase',
              }}
            >
              {item.risk}
            </span>
            <span style={{ fontSize: 11, color: 'var(--color-text-secondary)' }}>
              {pillarName}
            </span>
          </div>
          <h4
            style={{
              margin: 0,
              color: 'var(--color-text)',
              fontSize: 13,
              fontWeight: 500,
              lineHeight: 1.4,
            }}
          >
            {item.questionTitle}
          </h4>
        </div>
        <span
          style={{
            color: 'var(--color-text-secondary)',
            fontSize: 18,
            transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
          }}
        >
          ▼
        </span>
      </div>

      {isExpanded && (
        <div
          style={{
            padding: '0 16px 16px',
            borderTop: '1px solid var(--color-border)',
          }}
        >
          {item.improvementPlans.length > 0 ? (
            <>
              <h5
                style={{
                  margin: '16px 0 8px',
                  color: 'var(--color-text)',
                  fontSize: 12,
                  fontWeight: 600,
                }}
              >
                Recommended Actions:
              </h5>
              <ul
                style={{
                  margin: 0,
                  padding: '0 0 0 20px',
                  listStyle: 'disc',
                }}
              >
                {item.improvementPlans.map((plan) => (
                  <li
                    key={plan.choiceId}
                    style={{
                      color: 'var(--color-text-secondary)',
                      fontSize: 12,
                      lineHeight: 1.6,
                      marginBottom: 4,
                    }}
                  >
                    {plan.displayText}
                    {plan.improvementPlanUrl && (
                      <a
                        href={plan.improvementPlanUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{
                          color: 'var(--color-primary)',
                          marginLeft: 8,
                          fontSize: 11,
                        }}
                      >
                        Learn more →
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p
              style={{
                margin: '16px 0 0',
                color: 'var(--color-text-secondary)',
                fontSize: 12,
              }}
            >
              No specific improvement actions available.
            </p>
          )}

          {item.improvementPlanUrl && (
            <a
              href={item.improvementPlanUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-block',
                marginTop: 12,
                padding: '8px 12px',
                backgroundColor: 'var(--color-primary)',
                color: 'white',
                borderRadius: 4,
                fontSize: 12,
                textDecoration: 'none',
                fontWeight: 500,
              }}
            >
              View Full Improvement Plan
            </a>
          )}
        </div>
      )}
    </div>
  );
};

// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React, { useState, useCallback } from 'react';
import { useProfileStore } from '../../stores/profileStore';
import type { AssessmentConfig, AssessmentDomain } from '../../../shared/types';

const AWS_REGIONS = [
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
  'af-south-1', 'ap-east-1', 'ap-south-1', 'ap-south-2',
  'ap-southeast-1', 'ap-southeast-2', 'ap-southeast-3', 'ap-southeast-4',
  'ap-northeast-1', 'ap-northeast-2', 'ap-northeast-3',
  'ca-central-1',
  'eu-central-1', 'eu-central-2', 'eu-west-1', 'eu-west-2', 'eu-west-3',
  'eu-south-1', 'eu-south-2', 'eu-north-1',
  'me-south-1', 'me-central-1', 'sa-east-1',
] as const;

const ALL_DOMAINS: { id: AssessmentDomain; label: string; description: string }[] = [
  { id: 'cost', label: 'Cost Optimization', description: 'Analyze spending trends and identify savings opportunities' },
  { id: 'security', label: 'Security', description: 'Evaluate security posture via Security Hub or best practices scan' },
  { id: 'wellArchitected', label: 'Well-Architected', description: 'Run best practices checks across 6 pillars' },
  { id: 'inventory', label: 'Resource Inventory', description: 'Scan resources for tag coverage and distribution' },
];

interface AssessmentConfigFormProps {
  onSubmit: (config: AssessmentConfig) => void;
  isRunning: boolean;
}

export const AssessmentConfigForm: React.FC<AssessmentConfigFormProps> = ({ onSubmit, isRunning }) => {
  const selectedProfileName = useProfileStore((s) => s.selectedProfileName);
  const [selectedRegion, setSelectedRegion] = useState('us-west-2');
  const [selectedDomains, setSelectedDomains] = useState<AssessmentDomain[]>([
    'cost', 'security', 'wellArchitected', 'inventory',
  ]);
  const [costDays, setCostDays] = useState(30);
  const [includeResourceScan, setIncludeResourceScan] = useState(false);

  const toggleDomain = useCallback((domain: AssessmentDomain) => {
    setSelectedDomains(prev =>
      prev.includes(domain)
        ? prev.filter(d => d !== domain)
        : [...prev, domain]
    );
  }, []);

  const handleSubmit = useCallback((e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProfileName || selectedDomains.length === 0) return;

    onSubmit({
      profile: selectedProfileName,
      region: selectedRegion,
      domains: selectedDomains,
      costDays,
      includeResourceScan: selectedDomains.includes('inventory') && includeResourceScan,
    });
  }, [selectedProfileName, selectedRegion, selectedDomains, costDays, includeResourceScan, onSubmit]);

  return (
    <div className="assessment-config">
      <div className="page-header">
        <h1>Account Assessment</h1>
        <p style={{ color: 'var(--color-text-secondary)', marginTop: 4 }}>
          Run a comprehensive health check across cost, security, well-architected, and inventory domains.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="config-form" style={{ maxWidth: 640, marginTop: 24 }}>
        {/* Profile (from global selector) */}
        <div className="form-group" style={{ marginBottom: 20 }}>
          <label className="form-label" style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>
            AWS Profile
          </label>
          <div style={{ padding: '8px 12px', background: 'var(--color-bg-tertiary)', borderRadius: 6, fontSize: 14 }}>
            {selectedProfileName || <span style={{ color: 'var(--color-text-secondary)' }}>No profile selected — choose one from the top bar</span>}
          </div>
        </div>

        {/* Region Selection */}
        <div className="form-group" style={{ marginBottom: 20 }}>
          <label className="form-label" style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>
            Region
          </label>
          <select
            className="form-select"
            value={selectedRegion}
            onChange={e => setSelectedRegion(e.target.value)}
            disabled={isRunning}
            style={{ width: '100%' }}
          >
            {AWS_REGIONS.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        {/* Domain Toggles */}
        <div className="form-group" style={{ marginBottom: 20 }}>
          <label className="form-label" style={{ display: 'block', fontWeight: 600, marginBottom: 8 }}>
            Assessment Domains
          </label>
          <div style={{ display: 'grid', gap: 10 }}>
            {ALL_DOMAINS.map(domain => (
              <label
                key={domain.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  padding: '10px 14px',
                  borderRadius: 8,
                  border: selectedDomains.includes(domain.id) ? '2px solid var(--color-primary)' : '2px solid var(--color-border)',
                  background: selectedDomains.includes(domain.id) ? 'rgba(29, 155, 240, 0.1)' : 'var(--color-bg-tertiary)',
                  cursor: isRunning ? 'not-allowed' : 'pointer',
                  opacity: isRunning ? 0.6 : 1,
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedDomains.includes(domain.id)}
                  onChange={() => toggleDomain(domain.id)}
                  disabled={isRunning}
                  style={{ marginTop: 3, accentColor: 'var(--color-primary)' }}
                />
                <div>
                  <div style={{ fontWeight: 500 }}>{domain.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{domain.description}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Cost lookback */}
        {selectedDomains.includes('cost') && (
          <div className="form-group" style={{ marginBottom: 20 }}>
            <label className="form-label" style={{ display: 'block', fontWeight: 600, marginBottom: 6 }}>
              Cost Lookback Period
            </label>
            <select
              className="form-select"
              value={costDays}
              onChange={e => setCostDays(Number(e.target.value))}
              disabled={isRunning}
              style={{ width: '100%' }}
            >
              <option value={7}>7 days</option>
              <option value={30}>30 days</option>
              <option value={90}>90 days</option>
            </select>
          </div>
        )}

        {/* Inventory resource scan toggle */}
        {selectedDomains.includes('inventory') && (
          <div className="form-group" style={{ marginBottom: 20 }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: isRunning ? 'not-allowed' : 'pointer' }}>
              <input
                type="checkbox"
                checked={includeResourceScan}
                onChange={e => setIncludeResourceScan(e.target.checked)}
                disabled={isRunning}
                style={{ accentColor: 'var(--color-primary)' }}
              />
              <span style={{ fontWeight: 500 }}>Run resource scan for inventory</span>
              <span style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>(adds ~1-2 min)</span>
            </label>
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={isRunning || !selectedProfileName || selectedDomains.length === 0}
          className="btn btn-primary btn-lg"
          style={{ width: '100%' }}
        >
          {isRunning ? 'Running Assessment...' : 'Run Assessment'}
        </button>
      </form>
    </div>
  );
};

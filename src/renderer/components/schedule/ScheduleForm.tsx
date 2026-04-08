// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React, { useState } from 'react';
import { useProfileStore } from '../../stores/profileStore';
import type { ScheduleFrequency, ScanScheduleConfig } from '../../../shared/types';

const AWS_REGIONS = [
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
  'eu-west-1', 'eu-west-2', 'eu-central-1',
  'ap-southeast-1', 'ap-southeast-2', 'ap-northeast-1',
];

const COMMON_SERVICES = [
  { id: 'ec2', name: 'EC2' },
  { id: 'lambda', name: 'Lambda' },
  { id: 'rds', name: 'RDS' },
  { id: 's3', name: 'S3' },
  { id: 'ecs', name: 'ECS' },
  { id: 'dynamodb', name: 'DynamoDB' },
  { id: 'alb', name: 'ALB/NLB' },
  { id: 'cloudfront', name: 'CloudFront' },
  { id: 'iam', name: 'IAM' },
  { id: 'sqs', name: 'SQS' },
  { id: 'sns', name: 'SNS' },
  { id: 'kms', name: 'KMS' },
  { id: 'secretsmanager', name: 'Secrets Manager' },
  { id: 'cloudwatch', name: 'CloudWatch' },
  { id: 'eks', name: 'EKS' },
  { id: 'elasticache', name: 'ElastiCache' },
];

interface ScheduleFormProps {
  onSubmit: (config: ScanScheduleConfig) => Promise<boolean>;
}

const ScheduleForm: React.FC<ScheduleFormProps> = ({ onSubmit }) => {
  const selectedProfileName = useProfileStore((s) => s.selectedProfileName);
  const [name, setName] = useState('');
  const [selectedRegions, setSelectedRegions] = useState<string[]>(['us-east-1']);
  const [selectedServices, setSelectedServices] = useState<string[]>(['ec2']);
  const [frequency, setFrequency] = useState<ScheduleFrequency>('daily');
  const [autoAssess, setAutoAssess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleRegion = (region: string) => {
    setSelectedRegions((prev) =>
      prev.includes(region) ? prev.filter((r) => r !== region) : [...prev, region]
    );
  };

  const toggleService = (serviceId: string) => {
    setSelectedServices((prev) =>
      prev.includes(serviceId) ? prev.filter((s) => s !== serviceId) : [...prev, serviceId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !selectedProfileName || selectedRegions.length === 0 || selectedServices.length === 0) return;

    setIsSubmitting(true);
    const success = await onSubmit({
      name: name.trim(),
      profileName: selectedProfileName,
      regions: selectedRegions,
      services: selectedServices,
      frequency,
      autoAssess,
    });

    if (success) {
      setName('');
      setSelectedRegions(['us-east-1']);
      setSelectedServices(['ec2']);
      setFrequency('daily');
      setAutoAssess(false);
    }
    setIsSubmitting(false);
  };

  const canSubmit = name.trim() && selectedProfileName && selectedRegions.length > 0 && selectedServices.length > 0;

  return (
    <div className="card mb-4">
      <h3 className="card-title mb-4">Create Schedule</h3>
      <form onSubmit={handleSubmit}>
        {/* Schedule Name */}
        <div className="form-group" style={{ marginBottom: 16 }}>
          <label className="form-label">Schedule Name</label>
          <input
            type="text"
            className="input"
            placeholder="e.g. Nightly Full Scan"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ maxWidth: 400 }}
          />
        </div>

        {/* Profile (from global selector) */}
        <div className="form-group" style={{ marginBottom: 16 }}>
          <label className="form-label">AWS Profile</label>
          <div style={{ padding: '8px 12px', background: 'var(--color-bg-tertiary)', borderRadius: 6, fontSize: 14, maxWidth: 400 }}>
            {selectedProfileName || <span style={{ color: 'var(--color-text-secondary)' }}>No profile selected — choose one from the top bar</span>}
          </div>
        </div>

        {/* Frequency */}
        <div className="form-group" style={{ marginBottom: 16 }}>
          <label className="form-label">Frequency</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['hourly', 'daily', 'weekly'] as ScheduleFrequency[]).map((f) => (
              <button
                key={f}
                type="button"
                className={`btn btn-sm ${frequency === f ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setFrequency(f)}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Regions */}
        <div className="form-group" style={{ marginBottom: 16 }}>
          <label className="form-label">Regions ({selectedRegions.length} selected)</label>
          <div className="checkbox-group">
            {AWS_REGIONS.map((region) => (
              <label
                key={region}
                className={`checkbox-item ${selectedRegions.includes(region) ? 'selected' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={selectedRegions.includes(region)}
                  onChange={() => toggleRegion(region)}
                />
                {region}
              </label>
            ))}
          </div>
        </div>

        {/* Services */}
        <div className="form-group" style={{ marginBottom: 16 }}>
          <label className="form-label">Services ({selectedServices.length} selected)</label>
          <div className="checkbox-group">
            {COMMON_SERVICES.map((svc) => (
              <label
                key={svc.id}
                className={`checkbox-item ${selectedServices.includes(svc.id) ? 'selected' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={selectedServices.includes(svc.id)}
                  onChange={() => toggleService(svc.id)}
                />
                {svc.name}
              </label>
            ))}
          </div>
        </div>

        {/* Auto-assess */}
        <div className="form-group" style={{ marginBottom: 20 }}>
          <label className="checkbox-item" style={{ display: 'inline-flex' }}>
            <input
              type="checkbox"
              checked={autoAssess}
              onChange={(e) => setAutoAssess(e.target.checked)}
            />
            <div>
              <strong>Auto-assess after scan</strong>
              <div className="text-secondary text-sm">Run a full assessment automatically when the scan completes</div>
            </div>
          </label>
        </div>

        <button
          type="submit"
          className="btn btn-primary"
          disabled={!canSubmit || isSubmitting}
        >
          {isSubmitting ? 'Creating...' : 'Create Schedule'}
        </button>
      </form>
    </div>
  );
};

export default ScheduleForm;

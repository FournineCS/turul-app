// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React, { useEffect, useState } from 'react';
import { useSettingsStore } from '../stores/settingsStore';
import { useProfileStore } from '../stores/profileStore';
import { useProviderStore } from '../stores/providerStore';
import { useGCPProjectStore } from '../stores/gcpProjectStore';
import { useToastStore } from '../stores/toastStore';
import { useAuthStore } from '../stores/authStore';
import type { AppSettings, AppTheme } from '../stores/settingsStore';
import EnvironmentHealthCard from '../components/settings/EnvironmentHealthCard';

const COMMON_SERVICES: { id: string; name: string }[] = [
  { id: 'ec2', name: 'EC2' },
  { id: 'lambda', name: 'Lambda' },
  { id: 'rds', name: 'RDS' },
  { id: 's3', name: 'S3' },
  { id: 'ecs', name: 'ECS' },
  { id: 'dynamodb', name: 'DynamoDB' },
  { id: 'alb', name: 'ALB/NLB' },
  { id: 'iam', name: 'IAM' },
  { id: 'kms', name: 'KMS' },
  { id: 'cloudwatch', name: 'CloudWatch' },
];

const REGIONS = [
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
  'eu-west-1', 'eu-central-1', 'ap-southeast-1',
];

const SettingsPage: React.FC = () => {
  const { settings, isLoading, isSaving, loadSettings, saveAll } = useSettingsStore();
  const { profiles, loadProfiles } = useProfileStore();
  const selectedProvider = useProviderStore((s) => s.selectedProvider);
  const { billingConfig, loadBillingConfig, saveBillingConfig } = useGCPProjectStore();
  const addToast = useToastStore((s) => s.addToast);
  const { biometricAvailable, biometricEnabled, enableBiometric, disableBiometric } = useAuthStore();

  const [local, setLocal] = useState<AppSettings>(settings);
  const [gcpBQProject, setGcpBQProject] = useState('');
  const [gcpBQDataset, setGcpBQDataset] = useState('billing_export');
  const [gcpBQRegion, setGcpBQRegion] = useState('');

  useEffect(() => {
    loadSettings();
    loadProfiles();
  }, [loadSettings, loadProfiles]);

  useEffect(() => {
    setLocal(settings);
  }, [settings]);

  // Load GCP billing config when switching to GCP
  useEffect(() => {
    if (selectedProvider === 'gcp') loadBillingConfig();
  }, [selectedProvider, loadBillingConfig]);

  // Sync local GCP state from store
  useEffect(() => {
    if (billingConfig) {
      setGcpBQProject(billingConfig.bqProject);
      setGcpBQDataset(billingConfig.bqDataset);
      setGcpBQRegion(billingConfig.bqRegion || '');
    }
  }, [billingConfig]);

  const handleSave = async () => {
    try {
      await saveAll(local);
      if (selectedProvider === 'gcp') {
        await saveBillingConfig(gcpBQProject, gcpBQDataset, gcpBQRegion);
      }
      // Clear cached CLI paths so resolvers pick up the new settings
      await window.electronAPI?.settings?.clearGcloudCache?.();
      addToast('success', 'Settings saved successfully');
    } catch (err) {
      addToast('error', `Failed to save settings: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  const toggleRegion = (region: string) => {
    setLocal((prev) => ({
      ...prev,
      defaultRegions: prev.defaultRegions.includes(region)
        ? prev.defaultRegions.filter((r) => r !== region)
        : [...prev.defaultRegions, region],
    }));
  };

  const toggleService = (id: string) => {
    setLocal((prev) => ({
      ...prev,
      defaultServices: prev.defaultServices.includes(id)
        ? prev.defaultServices.filter((s) => s !== id)
        : [...prev.defaultServices, id],
    }));
  };

  if (isLoading) {
    return (
      <div className="loading-overlay">
        <div className="spinner" />
        <p>Loading settings...</p>
      </div>
    );
  }

  return (
    <>
      <header className="page-header">
        <h1 className="page-title">Settings</h1>
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? 'Saving...' : 'Save Settings'}
        </button>
      </header>

      <div className="page-content">
        {/* Appearance */}
        <div className="card mb-4">
          <h3 className="card-title mb-4">Appearance</h3>
          <p className="text-secondary text-sm" style={{ marginBottom: 12 }}>
            Choose your preferred theme. You can also toggle quickly from the top bar.
          </p>
          <div style={{ display: 'flex', gap: 12 }}>
            {(['dark', 'light', 'system'] as AppTheme[]).map((theme) => (
              <button
                key={theme}
                className={`btn ${local.theme === theme ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setLocal((prev) => ({ ...prev, theme }))}
                style={{ textTransform: 'capitalize', minWidth: 100 }}
              >
                {theme === 'dark' ? 'Dark' : theme === 'light' ? 'Light' : 'System'}
              </button>
            ))}
          </div>
          {local.theme === 'system' && (
            <p className="text-secondary text-sm" style={{ marginTop: 8 }}>
              Automatically follows your operating system's appearance setting.
            </p>
          )}
        </div>

        {/* AWS Default Scan Configuration */}
        {selectedProvider === 'aws' && (
          <div className="card mb-4">
            <h3 className="card-title mb-4">Default Scan Configuration</h3>
            <p className="text-secondary text-sm" style={{ marginBottom: 16 }}>
              These defaults will be pre-selected when starting a new scan.
            </p>

            <div style={{ marginBottom: 16 }}>
              <label className="form-label">Default Profile</label>
              <select
                className="form-select"
                value={local.defaultProfile}
                onChange={(e) => setLocal((prev) => ({ ...prev, defaultProfile: e.target.value }))}
                style={{ maxWidth: 400 }}
              >
                <option value="">None (manual selection)</option>
                {profiles.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.source === 'app' ? '[App] ' : ''}{p.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label className="form-label">Default Regions</label>
              <div className="checkbox-group">
                {REGIONS.map((r) => (
                  <label
                    key={r}
                    className={`checkbox-item ${local.defaultRegions.includes(r) ? 'selected' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={local.defaultRegions.includes(r)}
                      onChange={() => toggleRegion(r)}
                    />
                    {r}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="form-label">Default Services</label>
              <div className="checkbox-group">
                {COMMON_SERVICES.map((svc) => (
                  <label
                    key={svc.id}
                    className={`checkbox-item ${local.defaultServices.includes(svc.id) ? 'selected' : ''}`}
                  >
                    <input
                      type="checkbox"
                      checked={local.defaultServices.includes(svc.id)}
                      onChange={() => toggleService(svc.id)}
                    />
                    {svc.name}
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* GCP Configuration */}
        {selectedProvider === 'gcp' && (
          <div className="card mb-4">
            <h3 className="card-title mb-4">GCP Configuration</h3>
            <p className="text-secondary text-sm" style={{ marginBottom: 16 }}>
              Configure your BigQuery billing export for cost analysis.
            </p>

            <div style={{ marginBottom: 16 }}>
              <label className="form-label">BigQuery Billing Project</label>
              <input
                type="text"
                className="form-input"
                value={gcpBQProject}
                onChange={(e) => setGcpBQProject(e.target.value)}
                placeholder="billing-project-id"
                style={{ maxWidth: 400 }}
              />
              <p className="text-secondary text-sm" style={{ marginTop: 4 }}>
                The GCP project that contains your billing export BigQuery dataset.
              </p>
            </div>

            <div style={{ marginBottom: 16 }}>
              <label className="form-label">BigQuery Dataset</label>
              <input
                type="text"
                className="form-input"
                value={gcpBQDataset}
                onChange={(e) => setGcpBQDataset(e.target.value)}
                placeholder="billing_export"
                style={{ maxWidth: 400 }}
              />
              <p className="text-secondary text-sm" style={{ marginTop: 4 }}>
                The BigQuery dataset name. Defaults to "billing_export" if left empty.
              </p>
            </div>

            <div>
              <label className="form-label">BigQuery Dataset Region</label>
              <select
                className="form-select"
                value={gcpBQRegion}
                onChange={(e) => setGcpBQRegion(e.target.value)}
                style={{ maxWidth: 400 }}
              >
                <option value="">Auto-detect</option>
                <optgroup label="Multi-region">
                  <option value="US">US (multi-region)</option>
                  <option value="EU">EU (multi-region)</option>
                </optgroup>
                <optgroup label="Americas">
                  <option value="us-central1">us-central1 (Iowa)</option>
                  <option value="us-east1">us-east1 (South Carolina)</option>
                  <option value="us-east4">us-east4 (Virginia)</option>
                  <option value="us-west1">us-west1 (Oregon)</option>
                  <option value="us-west2">us-west2 (Los Angeles)</option>
                  <option value="southamerica-east1">southamerica-east1 (Sao Paulo)</option>
                  <option value="northamerica-northeast1">northamerica-northeast1 (Montreal)</option>
                </optgroup>
                <optgroup label="Europe">
                  <option value="europe-west1">europe-west1 (Belgium)</option>
                  <option value="europe-west2">europe-west2 (London)</option>
                  <option value="europe-west3">europe-west3 (Frankfurt)</option>
                  <option value="europe-north1">europe-north1 (Finland)</option>
                </optgroup>
                <optgroup label="Asia Pacific">
                  <option value="asia-south1">asia-south1 (Mumbai)</option>
                  <option value="asia-southeast1">asia-southeast1 (Singapore)</option>
                  <option value="asia-east1">asia-east1 (Taiwan)</option>
                  <option value="asia-northeast1">asia-northeast1 (Tokyo)</option>
                  <option value="australia-southeast1">australia-southeast1 (Sydney)</option>
                </optgroup>
              </select>
              <p className="text-secondary text-sm" style={{ marginTop: 4 }}>
                The region where your BigQuery billing dataset is located. Set this if you get "Cannot parse as CloudRegion" errors.
              </p>
            </div>
          </div>
        )}

        {/* Security */}
        {biometricAvailable && (
          <div className="card mb-4">
            <h3 className="card-title mb-4">Security</h3>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontWeight: 500 }}>Touch ID</div>
                <div className="text-secondary text-sm">Use Touch ID to unlock the app</div>
              </div>
              <button
                className={`btn ${biometricEnabled ? 'btn-primary' : 'btn-secondary'}`}
                onClick={async () => {
                  if (biometricEnabled) {
                    const ok = await disableBiometric();
                    if (ok) addToast('success', 'Touch ID disabled');
                  } else {
                    const ok = await enableBiometric();
                    if (ok) addToast('success', 'Touch ID enabled');
                    else addToast('error', 'Failed to enable Touch ID');
                  }
                }}
                style={{ minWidth: 100 }}
              >
                {biometricEnabled ? 'Enabled' : 'Enable'}
              </button>
            </div>
          </div>
        )}

        {/* CLI Tool Paths */}
        <div className="card mb-4">
          <h3 className="card-title mb-4">CLI Tool Paths</h3>
          <p className="text-secondary text-sm" style={{ marginBottom: 16 }}>
            Override auto-detected CLI tool paths. Leave empty to auto-detect.
          </p>

          <div>
            <label className="form-label">gcloud CLI Path</label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', maxWidth: 500 }}>
              <input
                type="text"
                className="form-input"
                value={local.gcloudPath}
                onChange={(e) => setLocal((prev) => ({ ...prev, gcloudPath: e.target.value }))}
                placeholder="Auto-detect"
                style={{ flex: 1 }}
              />
              <button
                className="btn btn-secondary btn-sm"
                onClick={async () => {
                  const path = await window.electronAPI?.app?.selectFile?.();
                  if (path) setLocal((prev) => ({ ...prev, gcloudPath: path }));
                }}
              >
                Browse
              </button>
            </div>
            <p className="text-secondary text-sm" style={{ marginTop: 4 }}>
              Path to the gcloud binary. Auto-detection checks common install locations for your platform.
            </p>
          </div>

        </div>

        {/* Data Retention */}
        <div className="card mb-4">
          <h3 className="card-title mb-4">Data Retention</h3>
          <p className="text-secondary text-sm" style={{ marginBottom: 16 }}>
            How long to keep scan data and assessment results.
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <select
              className="form-select"
              value={local.dataRetentionDays}
              onChange={(e) =>
                setLocal((prev) => ({
                  ...prev,
                  dataRetentionDays: parseInt(e.target.value, 10),
                }))
              }
              style={{ maxWidth: 200 }}
            >
              <option value="30">30 days</option>
              <option value="60">60 days</option>
              <option value="90">90 days</option>
              <option value="180">180 days</option>
              <option value="365">1 year</option>
              <option value="0">Keep forever</option>
            </select>
          </div>
        </div>

        {/* Environment Health */}
        <EnvironmentHealthCard />
      </div>
    </>
  );
};

export default SettingsPage;

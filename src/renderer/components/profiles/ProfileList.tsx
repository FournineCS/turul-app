// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React, { useState } from 'react';
import type { AppProfileSummary } from '../../../shared/types';
import ProfileSourceBadge from './ProfileSourceBadge';

interface ProfileListProps {
  profiles: AppProfileSummary[];
  onEdit: (profile: AppProfileSummary) => void;
  onDelete: (id: string) => void;
  onAdd: () => void;
}

const credentialTypeLabel: Record<string, string> = {
  iam_keys: 'IAM Keys',
  sso_config: 'SSO Config',
  assume_role: 'Assume Role',
};

const ProfileList: React.FC<ProfileListProps> = ({ profiles, onEdit, onDelete, onAdd }) => {
  const [ssoLoginInProgress, setSsoLoginInProgress] = useState<string | null>(null);
  const [ssoLoginResult, setSsoLoginResult] = useState<{ id: string; success: boolean; message: string } | null>(null);

  const handleSSOLogin = async (profile: AppProfileSummary) => {
    setSsoLoginInProgress(profile.id);
    setSsoLoginResult(null);
    try {
      const response = await window.electronAPI.profiles.ssoLogin(profile.name);
      if (response.success) {
        setSsoLoginResult({ id: profile.id, success: true, message: 'SSO re-authentication successful' });
      } else {
        setSsoLoginResult({ id: profile.id, success: false, message: response.error || 'SSO login failed' });
      }
    } catch (error) {
      setSsoLoginResult({
        id: profile.id,
        success: false,
        message: error instanceof Error ? error.message : 'SSO login failed',
      });
    }
    setSsoLoginInProgress(null);
  };

  return (
    <div>
      <div className="profile-list-header">
        <div style={{ color: 'var(--color-text-secondary)', fontSize: '13px' }}>
          {profiles.length} app-stored profile{profiles.length !== 1 ? 's' : ''}
        </div>
        <button className="profile-add-button" onClick={onAdd}>
          + Add Profile
        </button>
      </div>

      {profiles.length === 0 ? (
        <div className="profile-list-empty">
          No app-stored profiles yet. Profiles from ~/.aws files are always available.
          <br />
          Click "Add Profile" to store a profile in the app (encrypted at rest).
        </div>
      ) : (
        <div className="profile-list-items">
          {profiles.map((profile) => (
            <div key={profile.id} className="profile-item">
              <div className="profile-item-info">
                <div className="profile-item-name">
                  {profile.name}
                  <ProfileSourceBadge source="app" />
                </div>
                <div className="profile-item-details">
                  {credentialTypeLabel[profile.credentialType] || profile.credentialType}
                  {profile.region && ` | ${profile.region}`}
                  {profile.description && ` | ${profile.description}`}
                </div>
              </div>
              <div className="profile-item-actions">
                {profile.credentialType === 'sso_config' && (
                  <button
                    className="profile-item-action"
                    onClick={() => handleSSOLogin(profile)}
                    disabled={ssoLoginInProgress === profile.id}
                    title="Re-authenticate SSO session (runs aws sso login)"
                  >
                    {ssoLoginInProgress === profile.id ? 'Authenticating...' : 'Re-authenticate'}
                  </button>
                )}
                <button className="profile-item-action" onClick={() => onEdit(profile)}>
                  Edit
                </button>
                <button
                  className="profile-item-action delete"
                  onClick={() => {
                    if (confirm(`Delete profile "${profile.name}"?`)) {
                      onDelete(profile.id);
                    }
                  }}
                >
                  Delete
                </button>
              </div>
              {ssoLoginResult && ssoLoginResult.id === profile.id && (
                <div
                  style={{
                    marginTop: 6,
                    fontSize: 12,
                    color: ssoLoginResult.success ? 'var(--color-success)' : 'var(--color-error)',
                  }}
                >
                  {ssoLoginResult.message}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProfileList;

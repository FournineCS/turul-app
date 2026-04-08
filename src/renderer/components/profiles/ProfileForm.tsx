// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React, { useState } from 'react';
import type { AppProfileCredentialType, AppProfileInput, AppProfileSummary, AWSProfile } from '../../../shared/types';

const COMMON_REGIONS = [
  'us-east-1', 'us-east-2', 'us-west-1', 'us-west-2',
  'af-south-1', 'ap-east-1', 'ap-south-1', 'ap-south-2',
  'ap-southeast-1', 'ap-southeast-2', 'ap-southeast-3', 'ap-southeast-4',
  'ap-northeast-1', 'ap-northeast-2', 'ap-northeast-3',
  'ca-central-1',
  'eu-central-1', 'eu-central-2', 'eu-west-1', 'eu-west-2', 'eu-west-3',
  'eu-south-1', 'eu-south-2', 'eu-north-1',
  'me-south-1', 'me-central-1', 'sa-east-1',
] as const;

interface ProfileFormProps {
  existingProfile?: AppProfileSummary;
  allProfiles: AWSProfile[];
  onSubmit: (input: AppProfileInput) => Promise<void>;
  onCancel: () => void;
  isLoading: boolean;
  error: string | null;
}

const ProfileForm: React.FC<ProfileFormProps> = ({
  existingProfile,
  allProfiles,
  onSubmit,
  onCancel,
  isLoading,
  error,
}) => {
  const [credentialType, setCredentialType] = useState<AppProfileCredentialType>(
    existingProfile?.credentialType || 'iam_keys'
  );
  const [name, setName] = useState(existingProfile?.name || '');
  const [region, setRegion] = useState(existingProfile?.region || 'us-west-2');
  const [description, setDescription] = useState(existingProfile?.description || '');

  // IAM Keys
  const [accessKeyId, setAccessKeyId] = useState('');
  const [secretAccessKey, setSecretAccessKey] = useState('');
  const [sessionToken, setSessionToken] = useState('');

  // SSO Config
  const [ssoStartUrl, setSsoStartUrl] = useState(existingProfile?.ssoStartUrl || '');
  const [ssoRegion, setSsoRegion] = useState(existingProfile?.ssoRegion || 'us-east-1');
  const [ssoAccountId, setSsoAccountId] = useState(existingProfile?.ssoAccountId || '');
  const [ssoRoleName, setSsoRoleName] = useState(existingProfile?.ssoRoleName || '');

  // Assume Role
  const [assumeRoleArn, setAssumeRoleArn] = useState(existingProfile?.assumeRoleArn || '');
  const [externalId, setExternalId] = useState('');
  const [sourceProfile, setSourceProfile] = useState(existingProfile?.sourceProfile || '');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const input: AppProfileInput = {
      name,
      credentialType,
      region: region || undefined,
      description: description || undefined,
    };

    if (credentialType === 'iam_keys') {
      input.accessKeyId = accessKeyId || undefined;
      input.secretAccessKey = secretAccessKey || undefined;
      input.sessionToken = sessionToken || undefined;
    } else if (credentialType === 'sso_config') {
      input.ssoStartUrl = ssoStartUrl || undefined;
      input.ssoRegion = ssoRegion || undefined;
      input.ssoAccountId = ssoAccountId || undefined;
      input.ssoRoleName = ssoRoleName || undefined;
    } else if (credentialType === 'assume_role') {
      input.assumeRoleArn = assumeRoleArn || undefined;
      input.externalId = externalId || undefined;
      input.sourceProfile = sourceProfile || undefined;
    }

    await onSubmit(input);
  };

  const isValid = () => {
    if (!name) return false;
    if (credentialType === 'iam_keys') {
      // For edits, keys are optional (means "keep existing")
      if (!existingProfile && (!accessKeyId || !secretAccessKey)) return false;
    }
    if (credentialType === 'sso_config') {
      if (!ssoStartUrl || !ssoAccountId || !ssoRoleName) return false;
    }
    if (credentialType === 'assume_role') {
      if (!assumeRoleArn || !sourceProfile) return false;
    }
    return true;
  };

  return (
    <div>
      <button type="button" className="profile-form-back" onClick={onCancel}>
        &larr; Back to profiles
      </button>
      <div className="profile-form-title">
        {existingProfile ? 'Edit Profile' : 'Add Profile'}
      </div>

      <form className="profile-form" onSubmit={handleSubmit}>
        {error && <div className="auth-error">{error}</div>}

        <div className="credential-type-tabs">
          <button
            type="button"
            className={`credential-type-tab ${credentialType === 'iam_keys' ? 'active' : ''}`}
            onClick={() => setCredentialType('iam_keys')}
          >
            IAM Keys
          </button>
          <button
            type="button"
            className={`credential-type-tab ${credentialType === 'sso_config' ? 'active' : ''}`}
            onClick={() => setCredentialType('sso_config')}
          >
            SSO Config
          </button>
          <button
            type="button"
            className={`credential-type-tab ${credentialType === 'assume_role' ? 'active' : ''}`}
            onClick={() => setCredentialType('assume_role')}
          >
            Assume Role
          </button>
        </div>

        <div className="profile-form-field">
          <label>Profile Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="my-profile"
            disabled={!!existingProfile}
          />
        </div>

        <div className="profile-form-field">
          <label>Region</label>
          <select value={region} onChange={(e) => setRegion(e.target.value)}>
            {COMMON_REGIONS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>

        <div className="profile-form-field">
          <label>
            Description <span className="optional-label">(optional)</span>
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description for this profile"
          />
        </div>

        {credentialType === 'iam_keys' && (
          <>
            <div className="profile-form-field">
              <label>
                Access Key ID
                {existingProfile && <span className="optional-label">(leave blank to keep existing)</span>}
              </label>
              <input
                type="text"
                value={accessKeyId}
                onChange={(e) => setAccessKeyId(e.target.value)}
                placeholder="AKIA..."
              />
            </div>
            <div className="profile-form-field">
              <label>
                Secret Access Key
                {existingProfile && <span className="optional-label">(leave blank to keep existing)</span>}
              </label>
              <input
                type="password"
                value={secretAccessKey}
                onChange={(e) => setSecretAccessKey(e.target.value)}
                placeholder="Enter secret access key"
              />
            </div>
            <div className="profile-form-field">
              <label>
                Session Token <span className="optional-label">(optional)</span>
              </label>
              <input
                type="password"
                value={sessionToken}
                onChange={(e) => setSessionToken(e.target.value)}
                placeholder="Enter session token"
              />
            </div>
          </>
        )}

        {credentialType === 'sso_config' && (
          <>
            <div className="profile-form-field">
              <label>SSO Start URL</label>
              <input
                type="text"
                value={ssoStartUrl}
                onChange={(e) => setSsoStartUrl(e.target.value)}
                placeholder="https://my-org.awsapps.com/start"
              />
            </div>
            <div className="profile-form-field">
              <label>SSO Region</label>
              <select value={ssoRegion} onChange={(e) => setSsoRegion(e.target.value)}>
                {COMMON_REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div className="profile-form-field">
              <label>SSO Account ID</label>
              <input
                type="text"
                value={ssoAccountId}
                onChange={(e) => setSsoAccountId(e.target.value)}
                placeholder="123456789012"
              />
            </div>
            <div className="profile-form-field">
              <label>SSO Role Name</label>
              <input
                type="text"
                value={ssoRoleName}
                onChange={(e) => setSsoRoleName(e.target.value)}
                placeholder="AdministratorAccess"
              />
            </div>
          </>
        )}

        {credentialType === 'assume_role' && (
          <>
            <div className="profile-form-field">
              <label>Role ARN</label>
              <input
                type="text"
                value={assumeRoleArn}
                onChange={(e) => setAssumeRoleArn(e.target.value)}
                placeholder="arn:aws:iam::123456789012:role/MyRole"
              />
            </div>
            <div className="profile-form-field">
              <label>
                External ID <span className="optional-label">(optional)</span>
              </label>
              <input
                type="text"
                value={externalId}
                onChange={(e) => setExternalId(e.target.value)}
                placeholder="Enter external ID"
              />
            </div>
            <div className="profile-form-field">
              <label>Source Profile</label>
              <select value={sourceProfile} onChange={(e) => setSourceProfile(e.target.value)}>
                <option value="">Select a source profile</option>
                {allProfiles
                  .filter((p) => p.name !== name)
                  .map((p) => (
                    <option key={p.name} value={p.name}>
                      {p.name}
                    </option>
                  ))}
              </select>
            </div>
          </>
        )}

        <div className="profile-form-actions">
          <button type="button" className="modal-button-secondary" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="submit"
            className="modal-button-primary"
            disabled={isLoading || !isValid()}
          >
            {isLoading
              ? existingProfile
                ? 'Updating...'
                : 'Adding...'
              : existingProfile
                ? 'Update Profile'
                : 'Add Profile'}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ProfileForm;

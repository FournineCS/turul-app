// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React, { useEffect } from 'react';
import { useProfileStore } from '../stores/profileStore';
import { useProviderStore } from '../stores/providerStore';
import { useGCPProjectStore } from '../stores/gcpProjectStore';

const GlobalProfileSelector: React.FC = () => {
  const { profiles, selectedProfileName, setSelectedProfileName } = useProfileStore();
  const { selectedProvider } = useProviderStore();
  const {
    projects,
    selectedProjectId,
    organizations,
    selectedOrgId,
    isAuthenticated,
    isLoading,
    error,
    loadProjects,
    loadOrganizations,
    setSelectedProjectId,
    setSelectedOrgId,
    checkAuth,
    login,
    logout,
  } = useGCPProjectStore();

  // When switching to GCP, check auth and load projects + orgs
  useEffect(() => {
    if (selectedProvider === 'gcp') {
      checkAuth().then((authed) => {
        if (authed) {
          loadProjects();
          loadOrganizations();
        }
      });
    }
  }, [selectedProvider]);

  const handleGCPLogin = async () => {
    const success = await login();
    if (success) {
      await loadProjects();
      await loadOrganizations();
    }
  };

  return (
    <div className="global-profile-selector" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      {/* Context Dropdown */}
      {selectedProvider === 'aws' ? (
        <>
          <label className="global-profile-label">Profile:</label>
          <select
            className="global-profile-select"
            value={selectedProfileName || ''}
            onChange={(e) => setSelectedProfileName(e.target.value || null)}
          >
            {profiles.length === 0 ? (
              <option value="">No profiles available</option>
            ) : (
              <>
                <option value="">Select a profile...</option>
                {profiles.map((profile) => (
                  <option key={profile.name} value={profile.name}>
                    {profile.source === 'app' ? '[App] ' : ''}{profile.name}
                  </option>
                ))}
              </>
            )}
          </select>
        </>
      ) : (
        <>
          {!isAuthenticated ? (
            <button
              onClick={handleGCPLogin}
              disabled={isLoading}
              style={{
                padding: '3px 12px',
                fontSize: '12px',
                borderRadius: '4px',
                border: '1px solid #4285f4',
                background: '#4285f4',
                color: '#fff',
                cursor: isLoading ? 'not-allowed' : 'pointer',
              }}
            >
              {isLoading ? 'Authenticating...' : 'Login with gcloud'}
            </button>
          ) : (
            <>
              {/* Organization selector (optional) */}
              {organizations.length > 0 && (
                <>
                  <label className="global-profile-label">Org:</label>
                  <select
                    className="global-profile-select"
                    value={selectedOrgId || ''}
                    onChange={(e) => setSelectedOrgId(e.target.value || null)}
                    style={{ maxWidth: 180 }}
                  >
                    <option value="">None</option>
                    {organizations.map((org) => (
                      <option key={org.organizationId} value={org.organizationId}>
                        {org.displayName}
                      </option>
                    ))}
                  </select>
                </>
              )}

              {/* Project selector */}
              <label className="global-profile-label">Project:</label>
              <select
                className="global-profile-select"
                value={selectedProjectId || ''}
                onChange={(e) => setSelectedProjectId(e.target.value)}
                disabled={isLoading}
              >
                {isLoading ? (
                  <option value="">Loading projects...</option>
                ) : projects.length === 0 ? (
                  <option value="">No projects available</option>
                ) : (
                  <>
                    <option value="">Select a project...</option>
                    {projects.map((project) => (
                      <option key={project.projectId} value={project.projectId}>
                        {project.projectName} ({project.projectId})
                      </option>
                    ))}
                  </>
                )}
              </select>
              {/* Retry button + error when projects failed to load */}
              {!isLoading && projects.length === 0 && isAuthenticated && (
                <>
                  <button
                    onClick={() => loadProjects()}
                    title={error || 'Retry loading projects'}
                    style={{
                      padding: '3px 10px',
                      fontSize: '11px',
                      borderRadius: '4px',
                      border: '1px solid #f59e0b',
                      background: 'transparent',
                      color: '#f59e0b',
                      cursor: 'pointer',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    Retry
                  </button>
                  {error && (
                    <span style={{ fontSize: '11px', color: '#ef4444', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={error}>
                      {error}
                    </span>
                  )}
                </>
              )}

              {/* Switch Account / Logout */}
              <button
                onClick={async () => {
                  await logout();
                  // Immediately trigger re-login with different account
                  const success = await login();
                  if (success) {
                    await loadOrganizations();
                    await loadProjects();
                  }
                }}
                disabled={isLoading}
                title="Logout and switch to a different Google account"
                style={{
                  padding: '3px 10px',
                  fontSize: '11px',
                  borderRadius: '4px',
                  border: '1px solid #666',
                  background: 'transparent',
                  color: '#ccc',
                  cursor: isLoading ? 'not-allowed' : 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Switch Account
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default GlobalProfileSelector;

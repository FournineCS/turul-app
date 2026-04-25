// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React, { useEffect } from 'react';
import { useProfileStore } from '../stores/profileStore';
import { useProviderStore } from '../stores/providerStore';
import { useGCPProjectStore } from '../stores/gcpProjectStore';
import { useGCPAccountStore } from '../stores/gcpAccountStore';

interface GlobalProfileSelectorProps {
  onManageGCPAccounts?: () => void;
}

const GlobalProfileSelector: React.FC<GlobalProfileSelectorProps> = ({ onManageGCPAccounts }) => {
  const { profiles, selectedProfileName, setSelectedProfileName } = useProfileStore();
  const { selectedProvider } = useProviderStore();
  const {
    projects,
    selectedProjectId,
    organizations,
    selectedOrgId,
    isLoading,
    error,
    needsReauth,
    loadProjects,
    loadOrganizations,
    setSelectedProjectId,
    setSelectedOrgId,
    setAuthenticated,
    clearForAccountSwitch,
  } = useGCPProjectStore();
  const {
    accounts,
    selectedAccountId,
    isLoading: accountLoading,
    loadAccounts,
    addAccount,
    activateAccount,
    reloginAccount,
  } = useGCPAccountStore();

  const handleReauth = async () => {
    if (!selectedAccountId) return;
    await reloginAccount(selectedAccountId);
    // After successful re-login, retry projects + orgs
    setAuthenticated(true);
    loadProjects();
    loadOrganizations();
  };

  // When switching to GCP, load accounts + projects
  useEffect(() => {
    if (selectedProvider === 'gcp') {
      loadAccounts().then(() => {
        const { accounts: accts, selectedAccountId: selId } = useGCPAccountStore.getState();
        if (accts.length > 0 && selId) {
          setAuthenticated(true);
          loadProjects();
          loadOrganizations();
        }
      });
    }
  }, [selectedProvider]);

  const handleAccountChange = async (accountId: string) => {
    if (!accountId) return;
    // Immediately clear previous account's projects/org/selection so the UI
    // doesn't show stale data while the new account loads.
    clearForAccountSwitch();
    await activateAccount(accountId);
    setAuthenticated(true);
    // Load projects for the new account, then orgs (orgs may trigger a project
    // re-load if the list is empty, so order matters less but this is cleaner).
    await loadProjects();
    await loadOrganizations();
  };

  const handleAddAccount = async () => {
    const label = 'New Account';
    const success = await addAccount(label);
    if (success) {
      setAuthenticated(true);
      loadProjects();
      loadOrganizations();
    }
  };

  return (
    <div className="global-profile-selector" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
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
          {accounts.length === 0 ? (
            <button
              onClick={handleAddAccount}
              disabled={accountLoading}
              style={{
                padding: '3px 12px',
                fontSize: '12px',
                borderRadius: '4px',
                border: '1px solid #4285f4',
                background: '#4285f4',
                color: '#fff',
                cursor: accountLoading ? 'not-allowed' : 'pointer',
              }}
            >
              {accountLoading ? 'Authenticating...' : 'Add GCP Account'}
            </button>
          ) : (
            <>
              {/* Account selector */}
              <label className="global-profile-label">Account:</label>
              <select
                className="global-profile-select"
                value={selectedAccountId || ''}
                onChange={(e) => handleAccountChange(e.target.value)}
                style={{ maxWidth: 200 }}
              >
                <option value="">Select account...</option>
                {accounts.map((acct) => (
                  <option key={acct.accountId} value={acct.accountId}>
                    {acct.label || 'Unnamed'}{acct.googleEmail ? ` (${acct.googleEmail})` : ''}
                  </option>
                ))}
              </select>

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
              {/* Re-auth or Retry button + error when projects failed to load */}
              {!isLoading && projects.length === 0 && selectedAccountId && (
                <>
                  {needsReauth ? (
                    <button
                      onClick={handleReauth}
                      disabled={accountLoading}
                      title="Your Google session has expired. Click to re-authenticate."
                      style={{
                        padding: '3px 10px',
                        fontSize: '11px',
                        borderRadius: '4px',
                        border: '1px solid #4285f4',
                        background: '#4285f4',
                        color: '#fff',
                        cursor: accountLoading ? 'not-allowed' : 'pointer',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {accountLoading ? 'Re-authenticating...' : 'Re-authenticate'}
                    </button>
                  ) : (
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
                        <span
                          style={{ fontSize: '11px', color: '#ef4444', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          title={error}
                        >
                          {error}
                        </span>
                      )}
                    </>
                  )}
                </>
              )}

              {/* Manage Accounts button */}
              {onManageGCPAccounts && (
                <button
                  onClick={onManageGCPAccounts}
                  title="Manage GCP accounts"
                  style={{
                    padding: '3px 10px',
                    fontSize: '11px',
                    borderRadius: '4px',
                    border: '1px solid #666',
                    background: 'transparent',
                    color: '#ccc',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Manage
                </button>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
};

export default GlobalProfileSelector;

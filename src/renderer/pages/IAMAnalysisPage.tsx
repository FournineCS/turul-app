// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React, { useState, useEffect } from 'react';
import { useProfileStore } from '../stores/profileStore';
import { useIAMAnalysisStore } from '../stores/iamAnalysisStore';
import { useProviderStore } from '../stores/providerStore';
import { useGCPProjectStore } from '../stores/gcpProjectStore';
import ExportCSVButton from '../components/ExportCSVButton';
import type {
  IAMUnusedRole,
  IAMOverlyPermissivePolicy,
  IAMCrossAccountTrust,
  IAMPasswordPolicyCompliance,
  IAMUserAnalysisResult,
  IAMUserIssue,
  GCPIAMAnalysisResult,
} from '../../shared/types';

type Tab = 'unused' | 'permissive' | 'crossaccount' | 'password' | 'users';

const UnusedRolesTab: React.FC<{ roles: IAMUnusedRole[] }> = ({ roles }) => {
  if (roles.length === 0) {
    return (
      <div className="empty-state">
        <p>No unused roles found. All roles have been accessed within the last 90 days.</p>
      </div>
    );
  }

  return (
    <div className="table-container">
      <table className="table">
        <thead>
          <tr>
            <th>Role Name</th>
            <th>Created</th>
            <th>Last Used</th>
            <th>Days Idle</th>
          </tr>
        </thead>
        <tbody>
          {roles.map((role) => (
            <tr key={role.roleArn}>
              <td>
                <strong>{role.roleName}</strong>
                <div className="text-secondary text-sm" style={{ wordBreak: 'break-all' }}>
                  {role.roleArn}
                </div>
              </td>
              <td>{new Date(role.createdDate).toLocaleDateString()}</td>
              <td>{role.lastUsedDate ? new Date(role.lastUsedDate).toLocaleDateString() : 'Never'}</td>
              <td>
                <span
                  className={`badge ${role.daysSinceLastUse > 180 ? 'badge-error' : 'badge-warning'}`}
                >
                  {role.daysSinceLastUse}d
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const PermissivePoliciesTab: React.FC<{ policies: IAMOverlyPermissivePolicy[] }> = ({ policies }) => {
  if (policies.length === 0) {
    return (
      <div className="empty-state">
        <p>No overly permissive customer-managed policies found.</p>
      </div>
    );
  }

  return (
    <div className="table-container">
      <table className="table">
        <thead>
          <tr>
            <th>Policy Name</th>
            <th>Attachments</th>
            <th>Issues</th>
          </tr>
        </thead>
        <tbody>
          {policies.map((policy) => (
            <tr key={policy.policyArn}>
              <td>
                <strong>{policy.policyName}</strong>
                <div className="text-secondary text-sm" style={{ wordBreak: 'break-all' }}>
                  {policy.policyArn}
                </div>
              </td>
              <td>{policy.attachmentCount}</td>
              <td>
                {policy.dangerousStatements.map((stmt, i) => (
                  <div key={i} style={{ marginBottom: 4 }}>
                    <span className="badge badge-error" style={{ fontSize: 11 }}>
                      {stmt}
                    </span>
                  </div>
                ))}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const CrossAccountTab: React.FC<{ trusts: IAMCrossAccountTrust[] }> = ({ trusts }) => {
  if (trusts.length === 0) {
    return (
      <div className="empty-state">
        <p>No cross-account trust relationships found.</p>
      </div>
    );
  }

  return (
    <div className="table-container">
      <table className="table">
        <thead>
          <tr>
            <th>Role</th>
            <th>Trusted Account</th>
            <th>Trusted Principal</th>
            <th>Conditions</th>
          </tr>
        </thead>
        <tbody>
          {trusts.map((trust, i) => (
            <tr key={`${trust.roleArn}-${i}`}>
              <td>
                <strong>{trust.roleName}</strong>
              </td>
              <td>
                <code style={{ fontSize: 12 }}>{trust.trustedAccountId}</code>
              </td>
              <td>
                <div className="text-sm" style={{ wordBreak: 'break-all' }}>
                  {trust.trustedPrincipal}
                </div>
              </td>
              <td>
                {trust.conditionKeys.length > 0 ? (
                  trust.conditionKeys.map((c, j) => (
                    <div key={j} className="text-sm">{c}</div>
                  ))
                ) : (
                  <span className="badge badge-warning">No conditions</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

const PasswordPolicyTab: React.FC<{ policy: IAMPasswordPolicyCompliance }> = ({ policy }) => {
  if (!policy.hasPolicy) {
    return (
      <div className="card" style={{ borderColor: 'var(--color-error)' }}>
        <h4 style={{ color: 'var(--color-error)', marginBottom: 8 }}>No Custom Password Policy</h4>
        <p className="text-secondary">
          This account is using AWS default password policy. A custom policy with stricter
          requirements is recommended.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="stats-grid" style={{ marginBottom: 16 }}>
        <div className="stat-card">
          <div
            className="stat-value"
            style={{
              color: policy.score >= 80 ? 'var(--color-success)' :
                     policy.score >= 50 ? 'var(--color-warning)' : 'var(--color-error)',
            }}
          >
            {policy.score}%
          </div>
          <div className="stat-label">Compliance Score</div>
        </div>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Check</th>
              <th>Current</th>
              <th>Recommended</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {policy.checks.map((check) => (
              <tr key={check.check}>
                <td><strong>{check.check}</strong></td>
                <td>{check.current}</td>
                <td>{check.recommended}</td>
                <td>
                  <span className={`badge ${check.compliant ? 'badge-success' : 'badge-error'}`}>
                    {check.compliant ? 'Pass' : 'Fail'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const severityBadge = (severity: string) => {
  const cls = severity === 'CRITICAL' || severity === 'HIGH' ? 'badge-error' : severity === 'MEDIUM' ? 'badge-warning' : 'badge-info';
  return <span className={`badge ${cls}`}>{severity}</span>;
};

const categoryLabel: Record<string, string> = {
  root_account: 'Root Account',
  mfa: 'MFA',
  access_key_rotation: 'Key Rotation',
  unused_credentials: 'Unused Credentials',
  multiple_keys: 'Multiple Keys',
  direct_policy: 'Direct Policy',
};

const UserAnalysisTab: React.FC<{ userAnalysis: IAMUserAnalysisResult }> = ({ userAnalysis }) => {
  const [filterCategory, setFilterCategory] = useState<string>('all');

  if (userAnalysis.issues.length === 0) {
    return (
      <div className="empty-state">
        <p>No user issues found. All IAM users follow security best practices.</p>
      </div>
    );
  }

  const filteredIssues = filterCategory === 'all'
    ? userAnalysis.issues
    : userAnalysis.issues.filter(i => i.category === filterCategory);

  const categories = Array.from(new Set(userAnalysis.issues.map(i => i.category)));

  return (
    <div>
      <div className="stats-grid" style={{ marginBottom: 16 }}>
        <div className="stat-card">
          <div className="stat-value" style={{
            color: userAnalysis.score >= 80 ? 'var(--color-success)' :
                   userAnalysis.score >= 50 ? 'var(--color-warning)' : 'var(--color-error)',
          }}>
            {userAnalysis.score}%
          </div>
          <div className="stat-label">User Security Score</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{userAnalysis.totalUsers}</div>
          <div className="stat-label">IAM Users</div>
        </div>
        {userAnalysis.summary.rootIssues > 0 && (
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--color-error)' }}>{userAnalysis.summary.rootIssues}</div>
            <div className="stat-label">Root Issues</div>
          </div>
        )}
        {userAnalysis.summary.noMFA > 0 && (
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--color-error)' }}>{userAnalysis.summary.noMFA}</div>
            <div className="stat-label">No MFA</div>
          </div>
        )}
        {userAnalysis.summary.oldAccessKeys > 0 && (
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--color-warning)' }}>{userAnalysis.summary.oldAccessKeys}</div>
            <div className="stat-label">Old Access Keys</div>
          </div>
        )}
        {userAnalysis.summary.unusedCredentials > 0 && (
          <div className="stat-card">
            <div className="stat-value" style={{ color: 'var(--color-warning)' }}>{userAnalysis.summary.unusedCredentials}</div>
            <div className="stat-label">Unused Credentials</div>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <select
          className="global-profile-select"
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          style={{ minWidth: 180, fontSize: 12 }}
        >
          <option value="all">All Categories ({userAnalysis.issues.length})</option>
          {categories.map(cat => (
            <option key={cat} value={cat}>
              {categoryLabel[cat] || cat} ({userAnalysis.issues.filter(i => i.category === cat).length})
            </option>
          ))}
        </select>
        <ExportCSVButton
          data={userAnalysis.issues.map(i => ({ ...i }))}
          columns={[
            { key: 'userName', label: 'User' },
            { key: 'category', label: 'Category' },
            { key: 'severity', label: 'Severity' },
            { key: 'issue', label: 'Issue' },
            { key: 'detail', label: 'Detail' },
          ]}
          filename="iam-user-analysis"
        />
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>User</th>
              <th>Category</th>
              <th>Severity</th>
              <th>Issue</th>
            </tr>
          </thead>
          <tbody>
            {filteredIssues.map((issue, idx) => (
              <tr key={`${issue.userName}-${issue.category}-${idx}`}>
                <td>
                  <strong>{issue.userName}</strong>
                  <div className="text-secondary text-sm" style={{ wordBreak: 'break-all' }}>{issue.userArn}</div>
                </td>
                <td>{categoryLabel[issue.category] || issue.category}</td>
                <td>{severityBadge(issue.severity)}</td>
                <td>
                  <strong>{issue.issue}</strong>
                  <div className="text-secondary text-sm">{issue.detail}</div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

type GCPTab = 'service_accounts' | 'permissive' | 'keys' | 'cross_project';

const GCPIAMAnalysisView: React.FC<{
  projectId: string | null;
  result: GCPIAMAnalysisResult | null;
  isLoading: boolean;
  error: string | null;
  onRunAnalysis: () => void;
  onClearError: () => void;
}> = ({ projectId, result, isLoading, error, onRunAnalysis, onClearError }) => {
  const [activeTab, setActiveTab] = useState<GCPTab>('service_accounts');
  const { gcpHistory, loadGCPHistory, loadGCPAnalysisById } = useIAMAnalysisStore();

  // Subscribe to completed event
  useEffect(() => {
    if (!window.electronAPI?.gcp?.iam?.onCompleted) return;
    const unsubscribe = window.electronAPI.gcp.iam.onCompleted((result) => {
      useIAMAnalysisStore.setState({ gcpResult: result, isLoading: false });
      if (projectId) loadGCPHistory(projectId);
    });
    return () => unsubscribe();
  }, [projectId, loadGCPHistory]);

  // Subscribe to failed event
  useEffect(() => {
    if (!window.electronAPI?.gcp?.iam?.onFailed) return;
    const unsubscribe = window.electronAPI.gcp.iam.onFailed(({ error }) => {
      useIAMAnalysisStore.setState({ error, isLoading: false });
    });
    return () => unsubscribe();
  }, []);

  // Clear stale result & load history on project change
  useEffect(() => {
    if (projectId) {
      // Clear result if it belongs to a different project
      if (result && result.projectId !== projectId) {
        useIAMAnalysisStore.setState({ gcpResult: null });
      }
      loadGCPHistory(projectId);
    }
  }, [projectId, loadGCPHistory]); // eslint-disable-line react-hooks/exhaustive-deps

  // Navigation persistence — auto-load most recent result
  useEffect(() => {
    if (!result && !isLoading && gcpHistory.length > 0) {
      loadGCPAnalysisById(gcpHistory[0].id);
    }
  }, [gcpHistory, result, isLoading, loadGCPAnalysisById]);

  const tabs: { id: GCPTab; label: string; count?: number }[] = [
    { id: 'service_accounts', label: 'Unused Service Accounts', count: result?.unusedServiceAccounts.length },
    { id: 'permissive', label: 'Permissive Bindings', count: result?.overlyPermissiveBindings.length },
    { id: 'keys', label: 'Key Issues', count: result?.serviceAccountKeyIssues.length },
    { id: 'cross_project', label: 'Cross-Project', count: result?.crossProjectBindings.length },
  ];

  return (
    <>
      <header className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1 }}>
          <h1 className="page-title">IAM Analysis</h1>
          <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: 12, fontSize: 12, fontWeight: 600, backgroundColor: 'var(--color-primary-glow)', color: 'var(--color-primary)' }}>Google Cloud</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {gcpHistory.length > 0 && (
            <select
              className="global-profile-select"
              style={{ minWidth: 260, fontSize: 12 }}
              value={result?.id || ''}
              onChange={(e) => e.target.value && loadGCPAnalysisById(e.target.value)}
            >
              <option value="" disabled>Past analyses ({gcpHistory.length})...</option>
              {gcpHistory.map((h) => (
                <option key={h.id} value={h.id}>
                  {new Date(h.analyzedAt).toLocaleString()} — {h.totalFindings} findings
                </option>
              ))}
            </select>
          )}
          <button className="btn btn-primary" onClick={onRunAnalysis} disabled={!projectId || isLoading}>
            {isLoading ? (<><div className="spinner" style={{ width: 16, height: 16 }} /> Analyzing...</>) : 'Run Analysis'}
          </button>
        </div>
      </header>

      <div className="page-content">
        {error && (
          <div className="card mb-4" style={{ borderColor: 'var(--color-error)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--color-error)' }}>{error}</span>
              <button className="btn btn-sm btn-secondary" onClick={onClearError}>Dismiss</button>
            </div>
          </div>
        )}

        {!projectId && !result && (
          <div className="card mb-4">
            <h3 className="card-title mb-4">Run GCP IAM Analysis</h3>
            <p className="text-secondary text-sm">
              Select a GCP project from the top bar, then click "Run Analysis" to analyze service accounts, IAM bindings, key hygiene, and cross-project access patterns.
            </p>
          </div>
        )}

        {result && (
          <>
            {(result.errors?.length || 0) > 0 && (
              <div className="card mb-4" style={{ borderColor: 'var(--color-warning)' }}>
                <h4 style={{ color: 'var(--color-warning)', marginBottom: 8 }}>Partial Results</h4>
                {(result.errors || []).map((err, i) => (<p key={i} className="text-secondary text-sm">{err}</p>))}
              </div>
            )}

            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-value" style={{ color: result.unusedServiceAccounts.length > 0 ? 'var(--color-warning)' : 'var(--color-success)' }}>
                  {result.unusedServiceAccounts.length}
                </div>
                <div className="stat-label">Unused Service Accounts</div>
              </div>
              <div className="stat-card">
                <div className="stat-value" style={{ color: result.overlyPermissiveBindings.length > 0 ? 'var(--color-error)' : 'var(--color-success)' }}>
                  {result.overlyPermissiveBindings.length}
                </div>
                <div className="stat-label">Permissive Bindings</div>
              </div>
              <div className="stat-card">
                <div className="stat-value" style={{ color: result.serviceAccountKeyIssues.length > 0 ? 'var(--color-error)' : 'var(--color-success)' }}>
                  {result.serviceAccountKeyIssues.length}
                </div>
                <div className="stat-label">Key Issues</div>
              </div>
              <div className="stat-card">
                <div className="stat-value" style={{ color: result.crossProjectBindings.length > 0 ? 'var(--color-info)' : 'var(--color-success)' }}>
                  {result.crossProjectBindings.length}
                </div>
                <div className="stat-label">Cross-Project Bindings</div>
              </div>
            </div>

            <div className="card">
              <div className="tabs" style={{ marginBottom: 16 }}>
                {tabs.map((tab) => (
                  <button key={tab.id} className={`tab ${activeTab === tab.id ? 'active' : ''}`} onClick={() => setActiveTab(tab.id)}>
                    {tab.label}
                    {tab.count !== undefined && (
                      <span style={{ marginLeft: 6, backgroundColor: 'var(--color-bg-secondary)', padding: '2px 6px', borderRadius: 10, fontSize: 11 }}>{tab.count}</span>
                    )}
                  </button>
                ))}
              </div>

              {activeTab === 'service_accounts' && (
                result.unusedServiceAccounts.length === 0 ? (
                  <div className="empty-state"><p>No unused service accounts found.</p></div>
                ) : (
                  <div className="table-container">
                    <table className="table">
                      <thead><tr><th>Service Account</th><th>Last Activity</th><th>Days Idle</th><th>Keys</th><th>Status</th></tr></thead>
                      <tbody>
                        {result.unusedServiceAccounts.map((sa) => (
                          <tr key={sa.uniqueId}>
                            <td>
                              <strong>{sa.displayName || sa.email}</strong>
                              <div className="text-secondary text-sm" style={{ wordBreak: 'break-all' }}>{sa.email}</div>
                            </td>
                            <td>{sa.lastActivityDate ? new Date(sa.lastActivityDate).toLocaleDateString() : 'Never'}</td>
                            <td><span className={`badge ${sa.daysSinceLastActivity > 180 ? 'badge-error' : 'badge-warning'}`}>{sa.daysSinceLastActivity}d</span></td>
                            <td>{sa.keyCount > 0 ? <span className="badge badge-warning">{sa.keyCount} keys</span> : '-'}</td>
                            <td>{sa.disabled ? <span className="badge badge-info">Disabled</span> : <span className="badge badge-success">Active</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}

              {activeTab === 'permissive' && (
                result.overlyPermissiveBindings.length === 0 ? (
                  <div className="empty-state"><p>No overly permissive IAM bindings found.</p></div>
                ) : (
                  <div className="table-container">
                    <table className="table">
                      <thead><tr><th>Member</th><th>Role</th><th>Type</th><th>Reason</th></tr></thead>
                      <tbody>
                        {result.overlyPermissiveBindings.map((b, i) => (
                          <tr key={`${b.member}-${b.role}-${i}`}>
                            <td>
                              <strong>{b.member}</strong>
                              <div className="text-secondary text-sm">{b.memberType}{b.isOrgLevel ? ' (org-level)' : ''}</div>
                            </td>
                            <td><code style={{ fontSize: 12 }}>{b.role}</code></td>
                            <td><span className={`badge ${b.roleType === 'primitive' ? 'badge-error' : 'badge-warning'}`}>{b.roleType}</span></td>
                            <td className="text-sm">{b.reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}

              {activeTab === 'keys' && (
                result.serviceAccountKeyIssues.length === 0 ? (
                  <div className="empty-state"><p>No service account key issues found.</p></div>
                ) : (
                  <div className="table-container">
                    <table className="table">
                      <thead><tr><th>Service Account</th><th>Key ID</th><th>Age</th><th>Severity</th><th>Issue</th></tr></thead>
                      <tbody>
                        {result.serviceAccountKeyIssues.map((k, i) => (
                          <tr key={`${k.keyId}-${i}`}>
                            <td style={{ wordBreak: 'break-all' }}>{k.serviceAccountEmail}</td>
                            <td><code style={{ fontSize: 11 }}>{k.keyId.substring(0, 12)}...</code></td>
                            <td>{k.keyAgeInDays}d</td>
                            <td><span className={`badge ${k.severity === 'HIGH' ? 'badge-error' : k.severity === 'MEDIUM' ? 'badge-warning' : 'badge-info'}`}>{k.severity}</span></td>
                            <td className="text-sm">{k.issue}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}

              {activeTab === 'cross_project' && (
                result.crossProjectBindings.length === 0 ? (
                  <div className="empty-state"><p>No cross-project bindings found.</p></div>
                ) : (
                  <div className="table-container">
                    <table className="table">
                      <thead><tr><th>Member</th><th>Source Project</th><th>Role</th><th>External</th></tr></thead>
                      <tbody>
                        {result.crossProjectBindings.map((b, i) => (
                          <tr key={`${b.member}-${b.role}-${i}`}>
                            <td style={{ wordBreak: 'break-all' }}>{b.member}</td>
                            <td>{b.memberProjectId}</td>
                            <td><code style={{ fontSize: 12 }}>{b.role}</code></td>
                            <td>{b.isExternalProject ? <span className="badge badge-warning">External</span> : <span className="badge badge-info">Internal</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              )}
            </div>

            <p className="text-secondary text-sm" style={{ marginTop: 12 }}>
              Analyzed at {new Date(result.analyzedAt).toLocaleString()}
              {result.duration > 0 && <> | Duration: {(result.duration / 1000).toFixed(1)}s</>}
            </p>
          </>
        )}
      </div>
    </>
  );
};

const IAMAnalysisPage: React.FC = () => {
  const selectedProfile = useProfileStore((s) => s.selectedProfileName);
  const selectedProvider = useProviderStore((s) => s.selectedProvider);
  const selectedProjectId = useGCPProjectStore((s) => s.selectedProjectId);
  const { result, isLoading, error, runAnalysis, clearError, gcpResult, runGCPAnalysis,
    awsHistory, loadAWSHistory, loadAWSScanById } = useIAMAnalysisStore();
  const [activeTab, setActiveTab] = useState<Tab>('unused');

  // Subscribe to AWS IAM completed event
  useEffect(() => {
    if (selectedProvider !== 'aws') return;
    if (!window.electronAPI?.iam?.onCompleted) return;
    const unsubscribe = window.electronAPI.iam.onCompleted((res: any) => {
      useIAMAnalysisStore.setState({ result: res, isLoading: false });
      if (selectedProfile) loadAWSHistory(selectedProfile);
    });
    return () => unsubscribe();
  }, [selectedProvider, selectedProfile, loadAWSHistory]);

  // Subscribe to AWS IAM failed event
  useEffect(() => {
    if (selectedProvider !== 'aws') return;
    if (!window.electronAPI?.iam?.onFailed) return;
    const unsubscribe = window.electronAPI.iam.onFailed(({ error: err }: { error: string }) => {
      useIAMAnalysisStore.setState({ error: err, isLoading: false });
    });
    return () => unsubscribe();
  }, [selectedProvider]);

  // Load AWS history when profile changes
  useEffect(() => {
    if (selectedProvider === 'aws' && selectedProfile) {
      loadAWSHistory(selectedProfile);
    }
  }, [selectedProvider, selectedProfile, loadAWSHistory]);

  // Clear stale result when profile changes
  useEffect(() => {
    if (selectedProvider === 'aws') {
      useIAMAnalysisStore.setState({ result: null });
    }
  }, [selectedProvider, selectedProfile]);

  // Navigation persistence — auto-load most recent AWS result
  useEffect(() => {
    if (selectedProvider === 'aws' && !result && !isLoading && awsHistory.length > 0) {
      loadAWSScanById(awsHistory[0].id);
    }
  }, [selectedProvider, result, isLoading, awsHistory, loadAWSScanById]);

  if (selectedProvider === 'gcp') {
    return <GCPIAMAnalysisView
      projectId={selectedProjectId}
      result={gcpResult}
      isLoading={isLoading}
      error={error}
      onRunAnalysis={() => selectedProjectId && runGCPAnalysis(selectedProjectId)}
      onClearError={clearError}
    />;
  }

  const handleRunAnalysis = () => {
    if (selectedProfile) {
      runAnalysis(selectedProfile);
    }
  };

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'unused', label: 'Unused Roles', count: result?.unusedRoles?.length },
    { id: 'permissive', label: 'Permissive Policies', count: result?.overlyPermissivePolicies?.length },
    { id: 'crossaccount', label: 'Cross-Account', count: result?.crossAccountTrusts?.length },
    { id: 'password', label: 'Password Policy' },
    { id: 'users', label: 'Users', count: result?.userAnalysis?.issues?.length },
  ];

  return (
    <>
      <header className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h1 className="page-title">IAM Analysis</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {awsHistory.length > 0 && (
              <select
                className="global-profile-select"
                value={result?.id || ''}
                onChange={(e) => e.target.value && loadAWSScanById(e.target.value)}
                style={{ minWidth: 260, fontSize: 12 }}
              >
                <option value="" disabled>Past analyses ({awsHistory.length})...</option>
                {awsHistory.map((h: any) => (
                  <option key={h.id} value={h.id}>
                    {new Date(h.timestamp).toLocaleString()} — {(h.unusedRolesCount || 0) + (h.permissiveCount || 0) + (h.crossAccountCount || 0) + (h.userIssuesCount || 0)} findings
                  </option>
                ))}
              </select>
            )}
            <button
              className="btn btn-primary"
              onClick={handleRunAnalysis}
              disabled={!selectedProfile || isLoading}
            >
              {isLoading ? (
                <>
                  <div className="spinner" style={{ width: 16, height: 16 }} />
                  Analyzing...
                </>
              ) : (
                'Run Analysis'
              )}
            </button>
          </div>
        </div>
      </header>

      <div className="page-content">
        {error && (
          <div className="card mb-4" style={{ borderColor: 'var(--color-error)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--color-error)' }}>{error}</span>
              <button className="btn btn-sm btn-secondary" onClick={clearError}>Dismiss</button>
            </div>
          </div>
        )}

        {/* No profile prompt */}
        {!selectedProfile && !result && (
          <div className="empty-state">
            <h3>No Profile Selected</h3>
            <p>Select an AWS profile from the top bar, then click "Run Analysis" to analyze IAM roles, policies, cross-account trusts, and password policy.</p>
          </div>
        )}

        {/* Results */}
        {result && (
          <>
            {/* Errors from analysis */}
            {(result.errors?.length || 0) > 0 && (
              <div className="card mb-4" style={{ borderColor: 'var(--color-warning)' }}>
                <h4 style={{ color: 'var(--color-warning)', marginBottom: 8 }}>Partial Results</h4>
                {(result.errors || []).map((err, i) => (
                  <p key={i} className="text-secondary text-sm">{err}</p>
                ))}
              </div>
            )}

            {/* Summary stats */}
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-value" style={{ color: (result.unusedRoles?.length || 0) > 0 ? 'var(--color-warning)' : 'var(--color-success)' }}>
                  {result.unusedRoles?.length || 0}
                </div>
                <div className="stat-label">Unused Roles (90d+)</div>
              </div>
              <div className="stat-card">
                <div className="stat-value" style={{ color: (result.overlyPermissivePolicies?.length || 0) > 0 ? 'var(--color-error)' : 'var(--color-success)' }}>
                  {result.overlyPermissivePolicies?.length || 0}
                </div>
                <div className="stat-label">Permissive Policies</div>
              </div>
              <div className="stat-card">
                <div className="stat-value" style={{ color: (result.crossAccountTrusts?.length || 0) > 0 ? 'var(--color-info)' : 'var(--color-success)' }}>
                  {result.crossAccountTrusts?.length || 0}
                </div>
                <div className="stat-label">Cross-Account Trusts</div>
              </div>
              <div className="stat-card">
                <div className="stat-value" style={{
                  color: (result.passwordPolicy?.score || 0) >= 80 ? 'var(--color-success)' :
                         (result.passwordPolicy?.score || 0) >= 50 ? 'var(--color-warning)' : 'var(--color-error)',
                }}>
                  {result.passwordPolicy?.score || 0}%
                </div>
                <div className="stat-label">Password Policy Score</div>
              </div>
              <div className="stat-card">
                <div className="stat-value" style={{ color: (result.userAnalysis?.issues?.length || 0) > 0 ? 'var(--color-warning)' : 'var(--color-success)' }}>
                  {result.userAnalysis?.issues?.length || 0}
                </div>
                <div className="stat-label">User Issues</div>
              </div>
            </div>

            {/* Tabs */}
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--color-border)', marginBottom: 16 }}>
                <div className="tabs" style={{ borderBottom: 'none', marginBottom: 0 }}>
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    className={`tab ${activeTab === tab.id ? 'active' : ''}`}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    {tab.label}
                    {tab.count !== undefined && (
                      <span
                        style={{
                          marginLeft: 6,
                          backgroundColor: 'var(--color-bg-secondary)',
                          padding: '2px 6px',
                          borderRadius: 10,
                          fontSize: 11,
                        }}
                      >
                        {tab.count}
                      </span>
                    )}
                  </button>
                ))}
                </div>
                <div style={{ paddingBottom: 4 }}>
                  {activeTab === 'unused' && (
                    <ExportCSVButton
                      data={(result.unusedRoles || []).map((r) => ({ ...r }))}
                      columns={[
                        { key: 'roleName', label: 'Role Name' },
                        { key: 'roleArn', label: 'ARN' },
                        { key: 'createdDate', label: 'Created' },
                        { key: 'lastUsedDate', label: 'Last Used' },
                        { key: 'daysSinceLastUse', label: 'Days Idle' },
                      ]}
                      filename="iam-unused-roles"
                    />
                  )}
                  {activeTab === 'permissive' && (
                    <ExportCSVButton
                      data={(result.overlyPermissivePolicies || []).map((p) => ({
                        ...p,
                        dangerousStatements: p.dangerousStatements.join('; '),
                      }))}
                      columns={[
                        { key: 'policyName', label: 'Policy Name' },
                        { key: 'policyArn', label: 'ARN' },
                        { key: 'attachmentCount', label: 'Attachments' },
                        { key: 'dangerousStatements', label: 'Issues' },
                      ]}
                      filename="iam-permissive-policies"
                    />
                  )}
                  {activeTab === 'crossaccount' && (
                    <ExportCSVButton
                      data={(result.crossAccountTrusts || []).map((t) => ({
                        ...t,
                        conditionKeys: t.conditionKeys.join('; '),
                      }))}
                      columns={[
                        { key: 'roleName', label: 'Role' },
                        { key: 'trustedAccountId', label: 'Trusted Account' },
                        { key: 'trustedPrincipal', label: 'Trusted Principal' },
                        { key: 'conditionKeys', label: 'Conditions' },
                      ]}
                      filename="iam-cross-account-trusts"
                    />
                  )}
                  {activeTab === 'password' && result.passwordPolicy?.hasPolicy && (
                    <ExportCSVButton
                      data={(result.passwordPolicy?.checks || []).map((c) => ({ ...c }))}
                      columns={[
                        { key: 'check', label: 'Check' },
                        { key: 'current', label: 'Current' },
                        { key: 'recommended', label: 'Recommended' },
                        { key: 'compliant', label: 'Compliant' },
                      ]}
                      filename="iam-password-policy"
                    />
                  )}
                </div>
              </div>

              {activeTab === 'unused' && <UnusedRolesTab roles={result.unusedRoles || []} />}
              {activeTab === 'permissive' && <PermissivePoliciesTab policies={result.overlyPermissivePolicies || []} />}
              {activeTab === 'crossaccount' && <CrossAccountTab trusts={result.crossAccountTrusts || []} />}
              {activeTab === 'password' && result.passwordPolicy && <PasswordPolicyTab policy={result.passwordPolicy} />}
              {activeTab === 'users' && result.userAnalysis && <UserAnalysisTab userAnalysis={result.userAnalysis} />}
              {activeTab === 'users' && !result.userAnalysis && (
                <div className="empty-state"><p>User analysis data not available for this result. Run a new analysis to include user-level checks.</p></div>
              )}
            </div>

            <p className="text-secondary text-sm" style={{ marginTop: 12 }}>
              Analyzed at {new Date(result.analyzedAt).toLocaleString()}
            </p>
          </>
        )}
      </div>
    </>
  );
};

export default IAMAnalysisPage;

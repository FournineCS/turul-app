// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React, { useState, useEffect, useCallback } from 'react';
import { useGCPAccountStore } from '../../stores/gcpAccountStore';

interface ManageGCPAccountsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccountsChanged: () => void;
}

const ManageGCPAccountsModal: React.FC<ManageGCPAccountsModalProps> = ({
  isOpen,
  onClose,
  onAccountsChanged,
}) => {
  const { accounts, isLoading, loadAccounts, addAccount, renameAccount, deleteAccount, reloginAccount } = useGCPAccountStore();
  const [newLabel, setNewLabel] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      loadAccounts();
      setIsAdding(false);
      setEditingId(null);
      setError(null);
    }
  }, [isOpen, loadAccounts]);

  const handleAdd = useCallback(async () => {
    if (!newLabel.trim()) return;
    setError(null);
    const success = await addAccount(newLabel.trim());
    if (success) {
      setNewLabel('');
      setIsAdding(false);
      onAccountsChanged();
    } else {
      setError('Failed to add account. Check the terminal for gcloud login output.');
    }
  }, [newLabel, addAccount, onAccountsChanged]);

  const handleRename = useCallback(async (accountId: string) => {
    if (!editLabel.trim()) return;
    await renameAccount(accountId, editLabel.trim());
    setEditingId(null);
    onAccountsChanged();
  }, [editLabel, renameAccount, onAccountsChanged]);

  const handleDelete = useCallback(async (accountId: string) => {
    await deleteAccount(accountId);
    onAccountsChanged();
  }, [deleteAccount, onAccountsChanged]);

  const handleRelogin = useCallback(async (accountId: string) => {
    setError(null);
    await reloginAccount(accountId);
    onAccountsChanged();
  }, [reloginAccount, onAccountsChanged]);

  if (!isOpen) return null;

  return (
    <div className="profiles-modal-overlay" onClick={onClose}>
      <div className="profiles-modal" onClick={(e) => e.stopPropagation()}>
        <div className="profiles-modal-header">
          <h2>Manage GCP Accounts</h2>
          <button className="profiles-modal-close" onClick={onClose}>
            &times;
          </button>
        </div>
        <div className="profiles-modal-body">
          {error && (
            <div style={{ padding: '8px 12px', marginBottom: 12, background: 'rgba(239,68,68,0.15)', borderRadius: 6, color: '#ef4444', fontSize: 13 }}>
              {error}
            </div>
          )}

          {/* Account list */}
          <div style={{ marginBottom: 16 }}>
            {accounts.length === 0 && !isAdding && (
              <p style={{ color: 'var(--color-text-secondary)', fontSize: 13, margin: '16px 0' }}>
                No GCP accounts configured. Add an account to get started.
              </p>
            )}
            {accounts.map((account) => (
              <div
                key={account.accountId}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '10px 12px',
                  marginBottom: 8,
                  background: 'var(--color-bg-tertiary)',
                  borderRadius: 6,
                  border: '1px solid var(--color-border)',
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  {editingId === account.accountId ? (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input
                        type="text"
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleRename(account.accountId); if (e.key === 'Escape') setEditingId(null); }}
                        autoFocus
                        style={{
                          flex: 1,
                          padding: '4px 8px',
                          fontSize: 13,
                          background: 'var(--color-bg)',
                          border: '1px solid var(--color-border)',
                          borderRadius: 4,
                          color: 'var(--color-text)',
                        }}
                      />
                      <button className="btn btn-primary btn-sm" onClick={() => handleRename(account.accountId)}>Save</button>
                      <button className="btn btn-secondary btn-sm" onClick={() => setEditingId(null)}>Cancel</button>
                    </div>
                  ) : (
                    <>
                      <div style={{ fontWeight: 500, fontSize: 14, color: 'var(--color-text)' }}>
                        {account.label || 'Unnamed Account'}
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                        {account.googleEmail || 'No email available'}
                        <span style={{ margin: '0 6px', opacity: 0.4 }}>|</span>
                        Added {new Date(account.createdAt).toLocaleDateString()}
                      </div>
                    </>
                  )}
                </div>
                {editingId !== account.accountId && (
                  <div style={{ display: 'flex', gap: 4, marginLeft: 8, flexShrink: 0 }}>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => { setEditingId(account.accountId); setEditLabel(account.label); }}
                      title="Rename"
                    >
                      Rename
                    </button>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={() => handleRelogin(account.accountId)}
                      disabled={isLoading}
                      title="Re-authenticate with Google"
                    >
                      Re-auth
                    </button>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleDelete(account.accountId)}
                      title="Remove account"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Add account form */}
          {isAdding ? (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="text"
                placeholder="Account label (e.g., Work, Personal)"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setIsAdding(false); }}
                autoFocus
                style={{
                  flex: 1,
                  padding: '6px 10px',
                  fontSize: 13,
                  background: 'var(--color-bg)',
                  border: '1px solid var(--color-border)',
                  borderRadius: 4,
                  color: 'var(--color-text)',
                }}
              />
              <button className="btn btn-primary btn-sm" onClick={handleAdd} disabled={isLoading || !newLabel.trim()}>
                {isLoading ? 'Authenticating...' : 'Login with gcloud'}
              </button>
              <button className="btn btn-secondary btn-sm" onClick={() => { setIsAdding(false); setNewLabel(''); }}>
                Cancel
              </button>
            </div>
          ) : (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => { setIsAdding(true); setNewLabel(''); }}
              style={{ width: '100%' }}
            >
              + Add GCP Account
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ManageGCPAccountsModal;

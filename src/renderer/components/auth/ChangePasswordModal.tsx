// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React, { useState, useCallback, useEffect } from 'react';
import { useAuthStore } from '../../stores/authStore';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ isOpen, onClose }) => {
  const { changePassword, isLoading, error, clearError } = useAuthStore();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!currentPassword || !newPassword || !confirmNewPassword) return;
      const ok = await changePassword(currentPassword, newPassword, confirmNewPassword);
      if (ok) {
        setSuccess(true);
        setTimeout(() => {
          setSuccess(false);
          setCurrentPassword('');
          setNewPassword('');
          setConfirmNewPassword('');
          onClose();
        }, 1500);
      }
    },
    [currentPassword, newPassword, confirmNewPassword, changePassword, onClose]
  );

  const handleClose = () => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmNewPassword('');
    setSuccess(false);
    clearError();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose} role="dialog" aria-modal="true" aria-labelledby="change-password-title">
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-title" id="change-password-title">Change Password</div>
        <form className="auth-form" onSubmit={handleSubmit}>
          {error && <div className="auth-error">{error}</div>}
          {success && <div className="modal-success">Password changed successfully!</div>}
          <div className="auth-field">
            <label htmlFor="currentPassword">Current Password</label>
            <input
              id="currentPassword"
              type="password"
              value={currentPassword}
              onChange={(e) => {
                setCurrentPassword(e.target.value);
                if (error) clearError();
              }}
              placeholder="Enter current password"
              autoFocus
            />
          </div>
          <div className="auth-field">
            <label htmlFor="newPassword">New Password</label>
            <input
              id="newPassword"
              type="password"
              value={newPassword}
              onChange={(e) => {
                setNewPassword(e.target.value);
                if (error) clearError();
              }}
              placeholder="Minimum 12 characters"
            />
          </div>
          <div className="auth-field">
            <label htmlFor="confirmNewPassword">Confirm New Password</label>
            <input
              id="confirmNewPassword"
              type="password"
              value={confirmNewPassword}
              onChange={(e) => {
                setConfirmNewPassword(e.target.value);
                if (error) clearError();
              }}
              placeholder="Re-enter new password"
            />
          </div>
          <div className="modal-actions">
            <button type="button" className="modal-button-secondary" onClick={handleClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="modal-button-primary"
              disabled={isLoading || !currentPassword || !newPassword || !confirmNewPassword || success}
            >
              {isLoading ? 'Changing...' : 'Change Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ChangePasswordModal;

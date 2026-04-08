// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React, { useState, useEffect, useCallback } from 'react';
import type { AppProfileInput, AppProfileSummary, AWSProfile } from '../../../shared/types';
import ProfileList from './ProfileList';
import ProfileForm from './ProfileForm';

interface ManageProfilesModalProps {
  isOpen: boolean;
  onClose: () => void;
  allProfiles: AWSProfile[];
  onProfilesChanged: () => void;
}

type View = 'list' | 'add' | 'edit';

const ManageProfilesModal: React.FC<ManageProfilesModalProps> = ({
  isOpen,
  onClose,
  allProfiles,
  onProfilesChanged,
}) => {
  const [view, setView] = useState<View>('list');
  const [appProfiles, setAppProfiles] = useState<AppProfileSummary[]>([]);
  const [editingProfile, setEditingProfile] = useState<AppProfileSummary | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  const loadAppProfiles = useCallback(async () => {
    if (!window.electronAPI?.profiles) return;
    try {
      const response = await window.electronAPI.profiles.list();
      if (response.success && response.data) {
        setAppProfiles(response.data);
      }
    } catch (err) {
      console.error('Failed to load app profiles:', err);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadAppProfiles();
      setView('list');
      setError(null);
    }
  }, [isOpen, loadAppProfiles]);

  const handleAdd = async (input: AppProfileInput) => {
    if (!window.electronAPI?.profiles) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await window.electronAPI.profiles.add(input);
      if (response.success) {
        await loadAppProfiles();
        onProfilesChanged();
        setView('list');
      } else {
        setError(response.error || 'Failed to add profile');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdate = async (input: AppProfileInput) => {
    if (!window.electronAPI?.profiles || !editingProfile) return;
    setIsLoading(true);
    setError(null);
    try {
      const response = await window.electronAPI.profiles.update(editingProfile.id, input);
      if (response.success) {
        await loadAppProfiles();
        onProfilesChanged();
        setView('list');
        setEditingProfile(undefined);
      } else {
        setError(response.error || 'Failed to update profile');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.electronAPI?.profiles) return;
    try {
      const response = await window.electronAPI.profiles.delete(id);
      if (response.success) {
        await loadAppProfiles();
        onProfilesChanged();
      }
    } catch (err) {
      console.error('Failed to delete profile:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="profiles-modal-overlay" onClick={onClose}>
      <div className="profiles-modal" onClick={(e) => e.stopPropagation()}>
        <div className="profiles-modal-header">
          <h2>Manage Profiles</h2>
          <button className="profiles-modal-close" onClick={onClose}>
            &times;
          </button>
        </div>
        <div className="profiles-modal-body">
          {view === 'list' && (
            <ProfileList
              profiles={appProfiles}
              onAdd={() => {
                setEditingProfile(undefined);
                setError(null);
                setView('add');
              }}
              onEdit={(profile) => {
                setEditingProfile(profile);
                setError(null);
                setView('edit');
              }}
              onDelete={handleDelete}
            />
          )}
          {view === 'add' && (
            <ProfileForm
              allProfiles={allProfiles}
              onSubmit={handleAdd}
              onCancel={() => {
                setView('list');
                setError(null);
              }}
              isLoading={isLoading}
              error={error}
            />
          )}
          {view === 'edit' && editingProfile && (
            <ProfileForm
              existingProfile={editingProfile}
              allProfiles={allProfiles}
              onSubmit={handleUpdate}
              onCancel={() => {
                setView('list');
                setEditingProfile(undefined);
                setError(null);
              }}
              isLoading={isLoading}
              error={error}
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default ManageProfilesModal;

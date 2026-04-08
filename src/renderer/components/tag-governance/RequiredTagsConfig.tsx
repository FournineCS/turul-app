// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React, { useState, useEffect } from 'react';

interface Props {
  requiredTags: string[];
  isSaving: boolean;
  onSave: (tags: string[]) => void;
}

const RequiredTagsConfig: React.FC<Props> = ({ requiredTags, isSaving, onSave }) => {
  const [tags, setTags] = useState<string[]>(requiredTags);
  const [newTag, setNewTag] = useState('');

  useEffect(() => {
    setTags(requiredTags);
  }, [requiredTags]);

  const addTag = () => {
    const trimmed = newTag.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags([...tags, trimmed]);
      setNewTag('');
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addTag();
    }
  };

  const hasChanges = JSON.stringify(tags) !== JSON.stringify(requiredTags);

  return (
    <div className="card mb-4">
      <h3 className="card-title mb-4">Required Tags</h3>
      <p className="text-secondary" style={{ marginBottom: 16, fontSize: 13 }}>
        Define tags that all resources should have. Compliance is measured against these.
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          type="text"
          className="input"
          placeholder="e.g., Environment, Team, CostCenter"
          value={newTag}
          onChange={(e) => setNewTag(e.target.value)}
          onKeyDown={handleKeyDown}
          style={{ flex: 1 }}
        />
        <button className="btn btn-secondary" onClick={addTag} disabled={!newTag.trim()}>
          Add
        </button>
      </div>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {tags.map((tag) => (
          <span
            key={tag}
            className="badge"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '4px 10px', background: 'var(--color-bg-tertiary)',
              border: '1px solid var(--color-border)', borderRadius: 4,
            }}
          >
            {tag}
            <button
              onClick={() => removeTag(tag)}
              style={{
                background: 'none', border: 'none', color: 'var(--color-text-secondary)',
                cursor: 'pointer', padding: 0, fontSize: 16, lineHeight: 1,
              }}
            >
              x
            </button>
          </span>
        ))}
        {tags.length === 0 && (
          <span className="text-secondary" style={{ fontSize: 13 }}>No required tags defined</span>
        )}
      </div>

      {hasChanges && (
        <button className="btn btn-primary" onClick={() => onSave(tags)} disabled={isSaving}>
          {isSaving ? 'Saving...' : 'Save Configuration'}
        </button>
      )}
    </div>
  );
};

export default RequiredTagsConfig;

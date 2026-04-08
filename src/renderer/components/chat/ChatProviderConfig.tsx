// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React, { useState, useEffect } from 'react';
import { useChatStore } from '../../stores/chatStore';
import { useProfileStore } from '../../stores/profileStore';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const ChatProviderConfig: React.FC<Props> = ({ isOpen, onClose }) => {
  const { selectedProvider, setProvider, providers, loadProviders } = useChatStore();
  const { profiles } = useProfileStore();
  const [bedrockRegion, setBedrockRegion] = useState('us-west-2');

  useEffect(() => {
    if (isOpen) loadProviders();
  }, [isOpen, loadProviders]);

  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content chat-provider-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>AI Provider Settings</h3>
          <button className="modal-close" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>Provider</label>
            <select
              value={selectedProvider}
              onChange={(e) => setProvider(e.target.value as any)}
            >
              {providers.map(p => (
                <option key={p.type} value={p.type} disabled={!p.configured && p.type !== 'bedrock'}>
                  {p.name} {!p.configured && p.type !== 'bedrock' ? '(coming soon)' : ''}
                </option>
              ))}
            </select>
          </div>

          {selectedProvider === 'bedrock' && (
            <>
              <div className="form-group">
                <label>AWS Profile</label>
                <p className="form-hint">Uses the currently selected AWS profile from the sidebar.</p>
                <div className="form-value">
                  {profiles.length > 0 ? profiles.find(p => p.name === useProfileStore.getState().selectedProfileName)?.name || 'None selected' : 'No profiles configured'}
                </div>
              </div>
              <div className="form-group">
                <label>Bedrock Region</label>
                <select value={bedrockRegion} onChange={(e) => setBedrockRegion(e.target.value)}>
                  <option value="us-east-1">US East (N. Virginia)</option>
                  <option value="us-west-2">US West (Oregon)</option>
                  <option value="eu-west-1">EU (Ireland)</option>
                  <option value="ap-northeast-1">Asia Pacific (Tokyo)</option>
                </select>
              </div>
            </>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-primary" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
};

export default ChatProviderConfig;

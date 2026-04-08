// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React from 'react';

interface ProfileSourceBadgeProps {
  source: string;
}

const ProfileSourceBadge: React.FC<ProfileSourceBadgeProps> = ({ source }) => {
  const isApp = source === 'app';

  return (
    <span className={`profile-source-badge ${isApp ? 'app' : 'aws'}`}>
      {isApp ? 'App' : '~/.aws'}
    </span>
  );
};

export default ProfileSourceBadge;

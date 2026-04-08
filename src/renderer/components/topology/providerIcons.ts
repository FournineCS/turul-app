// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

// Thin router that picks AWS vs GCP module based on cloudProvider field

import type { ComponentType } from 'react';
import type { CloudProvider } from '../../../shared/types';
import {
  getServiceIcon,
  getNodeLabel,
  getNodeColor,
  SERVICE_LABELS,
  NODE_COLORS,
  TIER_LABELS,
} from './serviceIcons';
import {
  getGCPServiceIcon,
  getGCPNodeLabel,
  getGCPNodeColor,
  GCP_SERVICE_LABELS,
  GCP_NODE_COLORS,
  GCP_TIER_LABELS,
} from './gcpServiceIcons';

export function getProviderIcon(
  cloudProvider: CloudProvider | undefined,
  resourceType: string
): ComponentType<{ size?: string }> | null {
  return cloudProvider === 'gcp'
    ? getGCPServiceIcon(resourceType)
    : getServiceIcon(resourceType);
}

export function getProviderLabel(
  cloudProvider: CloudProvider | undefined,
  resourceType: string
): string {
  return cloudProvider === 'gcp'
    ? getGCPNodeLabel(resourceType)
    : getNodeLabel(resourceType);
}

export function getProviderColor(
  cloudProvider: CloudProvider | undefined,
  viewMode: string,
  resourceType: string,
  tier?: string
): string {
  return cloudProvider === 'gcp'
    ? getGCPNodeColor(viewMode, resourceType, tier)
    : getNodeColor(viewMode, resourceType, tier);
}

export function getProviderColorMap(
  cloudProvider: CloudProvider | undefined,
  viewMode: string
): Record<string, string> {
  return cloudProvider === 'gcp'
    ? GCP_NODE_COLORS[viewMode] || GCP_NODE_COLORS.full
    : NODE_COLORS[viewMode] || NODE_COLORS.full;
}

export function getProviderTierLabel(
  cloudProvider: CloudProvider | undefined,
  key: string
): string {
  return cloudProvider === 'gcp'
    ? GCP_TIER_LABELS[key] || key
    : TIER_LABELS[key] || key;
}

export function getProviderServiceLabels(
  cloudProvider: CloudProvider | undefined
): Record<string, string> {
  return cloudProvider === 'gcp' ? GCP_SERVICE_LABELS : SERVICE_LABELS;
}

// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';
import { GCPVPCAnalysis } from './types';

export async function analyzeVPCs(projectId: string): Promise<GCPVPCAnalysis[]> {
  const auth = new GoogleAuth({ scopes: ['https://www.googleapis.com/auth/cloud-platform'] });
  const compute = google.compute({ version: 'v1', auth });

  const networkResponse = await compute.networks.list({ project: projectId });
  const networks = networkResponse.data.items || [];
  const results: GCPVPCAnalysis[] = [];

  // Fetch all subnets once (aggregated) to avoid per-network calls
  let allSubnets: any[] = [];
  try {
    const subnetResponse = await compute.subnetworks.aggregatedList({ project: projectId });
    const subnetItems = subnetResponse.data.items || {};
    for (const scopedList of Object.values(subnetItems)) {
      allSubnets = allSubnets.concat((scopedList as any).subnetworks || []);
    }
  } catch {
    // Subnets API may not be accessible
  }

  for (const network of networks) {
    const networkName = network.name || '';

    // Count subnets and check private Google access for this network
    let subnetCount = 0;
    let hasPrivateGoogleAccess = true;

    if (network.subnetworks) {
      subnetCount = network.subnetworks.length;

      // Check subnets belonging to this network for private Google access
      const networkSubnets = allSubnets.filter(
        subnet => subnet.network?.endsWith(`/${networkName}`)
      );

      if (networkSubnets.length > 0) {
        for (const subnet of networkSubnets) {
          if (!subnet.privateIpGoogleAccess) {
            hasPrivateGoogleAccess = false;
            break;
          }
        }
      } else {
        // No subnet data available, assume unknown
        hasPrivateGoogleAccess = false;
      }
    } else {
      // Legacy network or no subnets
      hasPrivateGoogleAccess = false;
    }

    // Check peering connections
    const peeringConnections = (network.peerings || []).map((p: any) => ({
      network: extractNetworkName(p.network || ''),
      state: p.state || 'UNKNOWN',
      importRoutes: p.importCustomRoutes || false,
      exportRoutes: p.exportCustomRoutes || false,
    }));

    // Determine network mode
    let networkMode: 'auto' | 'custom' | 'legacy';
    if (network.autoCreateSubnetworks === true) {
      networkMode = 'auto';
    } else if (network.autoCreateSubnetworks === false) {
      networkMode = 'custom';
    } else {
      // Legacy networks have no autoCreateSubnetworks field
      networkMode = 'legacy';
    }

    results.push({
      networkName,
      networkMode,
      subnetCount,
      peeringConnections,
      isSharedVpc: false, // Requires org-level permissions to determine
      isDefault: networkName === 'default',
      privateGoogleAccess: hasPrivateGoogleAccess,
    });
  }

  return results;
}

function extractNetworkName(url: string): string {
  return url.split('/').pop() || '';
}

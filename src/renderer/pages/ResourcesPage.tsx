// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useScanStore } from '../stores/scanStore';
import { useProfileStore } from '../stores/profileStore';
import { useProviderStore } from '../stores/providerStore';
import { useGCPProjectStore } from '../stores/gcpProjectStore';
import ExportCSVButton from '../components/ExportCSVButton';
import type { Resource, ServiceType, CloudProvider } from '../../shared/types';

/**
 * Build a GCP Console deep-link URL for a resource based on its service type and selfLink ID.
 */
function buildGCPConsoleUrl(resource: Resource): string {
  const id = resource.id || '';
  const projectMatch = id.match(/projects\/([^/]+)/);
  const project = projectMatch?.[1] || '';
  const base = 'https://console.cloud.google.com';

  // Extract zone or region from selfLink
  const zoneMatch = id.match(/zones\/([^/]+)/);
  const regionMatch = id.match(/regions\/([^/]+)/);
  const zone = zoneMatch?.[1] || '';
  const region = regionMatch?.[1] || resource.region || '';

  // Resource name (last path segment)
  const name = resource.name || '';

  const svc = resource.service;

  // Compute Engine
  if (svc === 'gce') return `${base}/compute/instancesDetail/zones/${zone}/instances/${name}?project=${project}`;
  if (svc === 'gce-disks') return `${base}/compute/disksDetail/zones/${zone}/disks/${name}?project=${project}`;
  if (svc === 'gce-images') return `${base}/compute/imagesDetail/projects/${project}/global/images/${name}?project=${project}`;
  if (svc === 'gce-snapshots') return `${base}/compute/snapshotsDetail/projects/${project}/global/snapshots/${name}?project=${project}`;
  if (svc === 'gce-instance-groups') return `${base}/compute/instanceGroups/details/${zone}/${name}?project=${project}`;

  // Containers
  if (svc === 'gke') return `${base}/kubernetes/clusters/details/${zone || region}/${name}/details?project=${project}`;
  if (svc === 'cloud-run') return `${base}/run/detail/${region}/${name}?project=${project}`;
  if (svc === 'cloud-functions') return `${base}/functions/details/${region}/${name}?project=${project}`;

  // Storage
  if (svc === 'gcs') return `${base}/storage/browser/${name}?project=${project}`;
  if (svc === 'filestore') return `${base}/filestore/instances/details/${zone}/${name}?project=${project}`;

  // Database
  if (svc === 'cloud-sql') return `${base}/sql/instances/${name}/overview?project=${project}`;
  if (svc === 'cloud-spanner') return `${base}/spanner/instances/${name}?project=${project}`;
  if (svc === 'firestore') return `${base}/firestore?project=${project}`;
  if (svc === 'bigtable') return `${base}/bigtable/instances/${name}?project=${project}`;
  if (svc === 'memorystore') return `${base}/memorystore/redis/locations/${region}/instances/${name}?project=${project}`;
  if (svc === 'alloydb') return `${base}/alloydb/locations/${region}/clusters/${name}?project=${project}`;

  // Networking
  if (svc === 'vpc-network') return `${base}/networking/networks/details/${name}?project=${project}`;
  if (svc === 'vpc-subnet') return `${base}/networking/subnetworks/details/${region}/${name}?project=${project}`;
  if (svc === 'vpc-firewall') return `${base}/networking/firewalls/details/${name}?project=${project}`;
  if (svc === 'cloud-router') return `${base}/hybrid/routers/details/${region}/${name}?project=${project}`;
  if (svc === 'cloud-nat') return `${base}/hybrid/nat/details/${region}/${name}?project=${project}`;
  if (svc === 'cloud-address') return `${base}/networking/addresses/list?project=${project}`;
  if (svc === 'cloud-dns') return `${base}/net-services/dns/zones/${name}?project=${project}`;
  if (svc === 'gclb' || svc === 'gclb-url-maps') return `${base}/net-services/loadbalancing/details/http/${name}?project=${project}`;
  if (svc === 'cloud-armor') return `${base}/net-security/securitypolicies/details/${name}?project=${project}`;

  // Analytics
  if (svc === 'bigquery') return `${base}/bigquery?project=${project}&d=${name}&p=${project}&page=dataset`;
  if (svc === 'dataflow') return `${base}/dataflow/jobs/${region}/${name}?project=${project}`;
  if (svc === 'dataproc') return `${base}/dataproc/clusters/${name}/monitoring?region=${region}&project=${project}`;
  if (svc === 'cloud-composer') return `${base}/composer/environments/detail/${region}/${name}?project=${project}`;
  if (svc === 'pubsub') return `${base}/cloudpubsub/topic/detail/${name}?project=${project}`;

  // Security
  if (svc === 'gcp-iam') return `${base}/iam-admin/iam?project=${project}`;
  if (svc === 'gcp-kms') return `${base}/security/kms?project=${project}`;
  if (svc === 'secret-manager') return `${base}/security/secret-manager/secret/${name}?project=${project}`;

  // DevOps
  if (svc === 'cloud-build') return `${base}/cloud-build/builds?project=${project}`;
  if (svc === 'artifact-registry') return `${base}/artifacts?project=${project}`;

  // AI/ML
  if (svc === 'vertex-ai') return `${base}/vertex-ai?project=${project}`;

  // Monitoring
  if (svc === 'cloud-logging') return `${base}/logs?project=${project}`;
  if (svc === 'cloud-monitoring') return `${base}/monitoring?project=${project}`;

  // Fallback: project dashboard
  return `${base}/home/dashboard?project=${project}`;
}

const ResourcesPage: React.FC = () => {
  const { scanId } = useParams<{ scanId: string }>();
  const { scans, currentScan, resources, isLoading, loadScans, loadScan, loadResources, searchResources } = useScanStore();
  const selectedProfileName = useProfileStore((s) => s.selectedProfileName);
  const selectedProvider = useProviderStore((s) => s.selectedProvider) as CloudProvider;
  const selectedProjectId = useGCPProjectStore((s) => s.selectedProjectId);
  const activeIdentity = selectedProvider === 'gcp' ? selectedProjectId : selectedProfileName;

  const [selectedScanId, setSelectedScanId] = useState<string>(scanId || '');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterService, setFilterService] = useState<string>('all');
  const [filterRegion, setFilterRegion] = useState<string>('all');
  const [filterType, setFilterType] = useState<string>('all');
  const [filterTagKey, setFilterTagKey] = useState<string>('all');
  const [filterUntaggedOnly, setFilterUntaggedOnly] = useState(false);
  const [selectedResource, setSelectedResource] = useState<Resource | null>(null);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  // Sorting
  const [sortColumn, setSortColumn] = useState<'name' | 'resourceType' | 'service' | 'region' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Close modal on Escape
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') setSelectedResource(null);
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    loadScans(selectedProvider);
  }, [loadScans, selectedProvider]);

  // Clear stale scan selection and resources when provider or identity changes
  useEffect(() => {
    setSelectedScanId('');
    setSearchQuery('');
    setFilterService('all');
    setFilterRegion('all');
    setFilterType('all');
    setFilterTagKey('all');
    setFilterUntaggedOnly(false);
    setSelectedResource(null);
    setCurrentPage(1);
    useScanStore.setState({ resources: [], currentScan: null });
  }, [selectedProvider, activeIdentity]);

  // Auto-select the first scan when scans load (or when selectedScanId was cleared)
  useEffect(() => {
    if (scanId) {
      setSelectedScanId(scanId);
    } else if (scans.length > 0 && !selectedScanId) {
      setSelectedScanId(scans[0].id);
    }
  }, [scanId, scans, selectedScanId]);

  useEffect(() => {
    if (selectedScanId) {
      loadScan(selectedScanId);
      loadResources(selectedScanId);
    }
  }, [selectedScanId, loadScan, loadResources]);

  const handleSearch = () => {
    if (selectedScanId && searchQuery) {
      searchResources(selectedScanId, searchQuery);
    } else if (selectedScanId) {
      loadResources(selectedScanId);
    }
  };

  // Get unique services and regions from resources
  const services = useMemo(() => {
    const serviceSet = new Set(resources.map((r) => r.service));
    return Array.from(serviceSet).sort();
  }, [resources]);

  const regions = useMemo(() => {
    const regionSet = new Set(resources.map((r) => r.region));
    return Array.from(regionSet).sort();
  }, [resources]);

  const resourceTypes = useMemo(() => {
    const typeSet = new Set(resources.map((r) => r.resourceType));
    return Array.from(typeSet).sort();
  }, [resources]);

  const tagKeys = useMemo(() => {
    const keySet = new Set<string>();
    resources.forEach((r) => Object.keys(r.tags).forEach((k) => keySet.add(k)));
    return Array.from(keySet).sort();
  }, [resources]);

  // Filter resources
  const filteredResources = useMemo(() => {
    return resources.filter((resource) => {
      if (filterService !== 'all' && resource.service !== filterService) return false;
      if (filterRegion !== 'all' && resource.region !== filterRegion) return false;
      if (filterType !== 'all' && resource.resourceType !== filterType) return false;
      if (filterUntaggedOnly && Object.keys(resource.tags).length > 0) return false;
      if (filterTagKey !== 'all' && !(filterTagKey in resource.tags)) return false;
      return true;
    });
  }, [resources, filterService, filterRegion, filterType, filterTagKey, filterUntaggedOnly]);

  // Active filter count
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filterService !== 'all') count++;
    if (filterRegion !== 'all') count++;
    if (filterType !== 'all') count++;
    if (filterTagKey !== 'all') count++;
    if (filterUntaggedOnly) count++;
    return count;
  }, [filterService, filterRegion, filterType, filterTagKey, filterUntaggedOnly]);

  const clearAllFilters = useCallback(() => {
    setFilterService('all');
    setFilterRegion('all');
    setFilterType('all');
    setFilterTagKey('all');
    setFilterUntaggedOnly(false);
  }, []);

  // Sort resources
  const sortedResources = useMemo(() => {
    if (!sortColumn) return filteredResources;

    return [...filteredResources].sort((a, b) => {
      let aVal = sortColumn === 'name' ? (a.name || a.id.split('/').pop() || '') : a[sortColumn];
      let bVal = sortColumn === 'name' ? (b.name || b.id.split('/').pop() || '') : b[sortColumn];

      aVal = String(aVal).toLowerCase();
      bVal = String(bVal).toLowerCase();

      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredResources, sortColumn, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(sortedResources.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedResources = sortedResources.slice(startIndex, startIndex + itemsPerPage);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [filterService, filterRegion, filterType, filterTagKey, filterUntaggedOnly, searchQuery]);

  // Sort handler
  const handleSort = (column: 'name' | 'resourceType' | 'service' | 'region') => {
    if (sortColumn === column) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('asc');
    }
  };

  // Group resources by type
  const groupedResources = useMemo(() => {
    const groups = new Map<string, Resource[]>();
    for (const resource of filteredResources) {
      const key = resource.resourceType;
      const existing = groups.get(key) || [];
      existing.push(resource);
      groups.set(key, existing);
    }
    return groups;
  }, [filteredResources]);

  return (
    <>
      <header className="page-header">
        <h1 className="page-title">Resources</h1>
      </header>

      <div className="page-content">
        {/* Scan Selector */}
        <div className="card mb-4">
          <div className="flex gap-4 items-center">
            <div className="form-group" style={{ margin: 0, flex: 1 }}>
              <label className="form-label">Select Scan</label>
              <select
                className="form-select"
                value={selectedScanId}
                onChange={(e) => setSelectedScanId(e.target.value)}
              >
                <option value="">Select a scan...</option>
                {scans.filter((s) => s.status === 'completed').filter((s) => !activeIdentity || s.profile === activeIdentity).map((scan) => (
                  <option key={scan.id} value={scan.id}>
                    {scan.profile} - {new Date(scan.startedAt).toLocaleString()} ({scan.resourceCount} resources)
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {selectedScanId && currentScan && (
          <>
            {/* Search and Filters */}
            <div className="flex gap-3 items-center" style={{ marginBottom: 12 }}>
              <div className="form-group" style={{ margin: 0, flex: 1 }}>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="form-input"
                    placeholder="Search by name, ARN, or tags..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  />
                  <button className="btn btn-primary" onClick={handleSearch}>
                    Search
                  </button>
                </div>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <select
                  className="form-select"
                  style={{ minWidth: 130 }}
                  value={filterService}
                  onChange={(e) => setFilterService(e.target.value)}
                >
                  <option value="all">All Services</option>
                  {services.map((service) => (
                    <option key={service} value={service}>
                      {service}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <select
                  className="form-select"
                  style={{ minWidth: 130 }}
                  value={filterRegion}
                  onChange={(e) => setFilterRegion(e.target.value)}
                >
                  <option value="all">All Regions</option>
                  {regions.map((region) => (
                    <option key={region} value={region}>
                      {region}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <select
                  className="form-select"
                  style={{ minWidth: 120 }}
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                >
                  <option value="all">All Types</option>
                  {resourceTypes.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <select
                  className="form-select"
                  style={{ minWidth: 120 }}
                  value={filterTagKey}
                  onChange={(e) => setFilterTagKey(e.target.value)}
                  disabled={filterUntaggedOnly}
                >
                  <option value="all">All Tags</option>
                  {tagKeys.map((key) => (
                    <option key={key} value={key}>
                      {key}
                    </option>
                  ))}
                </select>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', color: 'var(--color-text-secondary)', whiteSpace: 'nowrap' }}>
                <input
                  type="checkbox"
                  checked={filterUntaggedOnly}
                  onChange={(e) => {
                    setFilterUntaggedOnly(e.target.checked);
                    if (e.target.checked) setFilterTagKey('all');
                  }}
                />
                Untagged only
              </label>

              {activeFilterCount > 0 && (
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={clearAllFilters}
                  style={{ whiteSpace: 'nowrap' }}
                >
                  Clear Filters ({activeFilterCount})
                </button>
              )}
            </div>

            {/* Stats + Export */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div />
              <ExportCSVButton
                data={filteredResources.map((r) => ({
                  name: r.name,
                  service: r.service,
                  type: r.resourceType,
                  region: r.region,
                  arn: r.id,
                  tags: Object.entries(r.tags).map(([k, v]) => `${k}=${v}`).join('; '),
                }))}
                columns={[
                  { key: 'name', label: 'Name' },
                  { key: 'service', label: 'Service' },
                  { key: 'type', label: 'Type' },
                  { key: 'region', label: 'Region' },
                  { key: 'arn', label: 'ARN' },
                  { key: 'tags', label: 'Tags' },
                ]}
                filename={`resources-${selectedScanId}`}
              />
            </div>
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-value">{filteredResources.length}</div>
                <div className="stat-label">Resources</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{groupedResources.size}</div>
                <div className="stat-label">Resource Types</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{services.length}</div>
                <div className="stat-label">Services</div>
              </div>
              <div className="stat-card">
                <div className="stat-value">{regions.length}</div>
                <div className="stat-label">Regions</div>
              </div>
            </div>

            {/* Resources Table */}
            {isLoading ? (
              <div className="loading-overlay">
                <div className="spinner" />
                <p>Loading resources...</p>
              </div>
            ) : filteredResources.length === 0 ? (
              <div className="empty-state">
                <h3>No resources found</h3>
                <p>Try adjusting your filters or search query</p>
              </div>
            ) : (
              <div className="card">
                <div className="table-container">
                  <table className="table">
                    <thead>
                      <tr>
                        <th className="sortable" onClick={() => handleSort('name')}>
                          Name {sortColumn === 'name' && (sortDirection === 'asc' ? '▲' : '▼')}
                        </th>
                        <th className="sortable" onClick={() => handleSort('resourceType')}>
                          Type {sortColumn === 'resourceType' && (sortDirection === 'asc' ? '▲' : '▼')}
                        </th>
                        <th className="sortable" onClick={() => handleSort('service')}>
                          Service {sortColumn === 'service' && (sortDirection === 'asc' ? '▲' : '▼')}
                        </th>
                        <th className="sortable" onClick={() => handleSort('region')}>
                          Region {sortColumn === 'region' && (sortDirection === 'asc' ? '▲' : '▼')}
                        </th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedResources.map((resource) => (
                        <tr key={resource.id}>
                          <td>
                            <div className="truncate" style={{ maxWidth: 300 }}>
                              {resource.name || resource.id.split('/').pop()}
                            </div>
                          </td>
                          <td>{resource.resourceType}</td>
                          <td>
                            <span className="badge badge-info">{resource.service}</span>
                            {resource.cloudProvider && (
                              <span
                                className="badge"
                                style={{
                                  fontSize: 10,
                                  padding: '1px 6px',
                                  marginLeft: 4,
                                  backgroundColor: 'var(--color-primary-glow)',
                                  color: 'var(--color-primary)',
                                }}
                              >
                                {resource.cloudProvider.toUpperCase()}
                              </span>
                            )}
                          </td>
                          <td>{resource.region}</td>
                          <td>
                            <button
                              className="btn btn-sm btn-secondary"
                              onClick={() => setSelectedResource(resource)}
                            >
                              Details
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {sortedResources.length > 0 && (
                  <div className="pagination">
                    <div className="pagination-info">
                      Showing {startIndex + 1}-{Math.min(startIndex + itemsPerPage, sortedResources.length)} of {sortedResources.length} resources
                    </div>
                    <div className="pagination-controls">
                      <select
                        className="form-select"
                        value={itemsPerPage}
                        onChange={(e) => { setItemsPerPage(Number(e.target.value)); setCurrentPage(1); }}
                        style={{ width: 'auto' }}
                      >
                        <option value={10}>10 per page</option>
                        <option value={25}>25 per page</option>
                        <option value={50}>50 per page</option>
                        <option value={100}>100 per page</option>
                      </select>
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => setCurrentPage(1)}
                        disabled={currentPage === 1}
                      >
                        First
                      </button>
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => setCurrentPage(p => p - 1)}
                        disabled={currentPage === 1}
                      >
                        Previous
                      </button>
                      <span className="pagination-pages">
                        Page {currentPage} of {totalPages || 1}
                      </span>
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => setCurrentPage(p => p + 1)}
                        disabled={currentPage === totalPages || totalPages === 0}
                      >
                        Next
                      </button>
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => setCurrentPage(totalPages)}
                        disabled={currentPage === totalPages || totalPages === 0}
                      >
                        Last
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {!selectedScanId && (
          <div className="empty-state">
            <h3>No scan selected</h3>
            <p>Select a scan from the dropdown above or run a new scan</p>
            <Link to="/scan" className="btn btn-primary mt-4">
              Start New Scan
            </Link>
          </div>
        )}

        {/* Resource Detail Modal */}
        {selectedResource && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000,
            }}
            onClick={() => setSelectedResource(null)}
          >
            <div
              className="card"
              style={{ maxWidth: 800, maxHeight: '80vh', overflow: 'auto', margin: 20 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="card-header">
                <h3 className="card-title">{selectedResource.name || 'Resource Details'}</h3>
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={() => setSelectedResource(null)}
                >
                  Close
                </button>
              </div>

              <div className="form-group">
                <label className="form-label">
                  {selectedResource.cloudProvider === 'gcp' ? 'Resource ID' : 'ARN / ID'}
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <code style={{ wordBreak: 'break-all', flex: 1 }}>{selectedResource.id}</code>
                  <button
                    className="btn btn-sm btn-secondary"
                    title="Copy ID"
                    onClick={() => {
                      navigator.clipboard.writeText(selectedResource.id);
                    }}
                    style={{ flexShrink: 0 }}
                  >
                    Copy
                  </button>
                  {selectedResource.cloudProvider === 'gcp' ? (
                    <a
                      href={buildGCPConsoleUrl(selectedResource)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-sm btn-secondary"
                      title="Open in GCP Console"
                      style={{ flexShrink: 0, textDecoration: 'none' }}
                    >
                      GCP Console
                    </a>
                  ) : selectedResource.region && selectedResource.region !== 'global' ? (
                    <a
                      href={`https://${selectedResource.region}.console.aws.amazon.com/`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-sm btn-secondary"
                      title="Open AWS Console"
                      style={{ flexShrink: 0, textDecoration: 'none' }}
                    >
                      AWS Console
                    </a>
                  ) : null}
                </div>
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Service</label>
                  <p>{selectedResource.service}</p>
                </div>
                <div className="form-group">
                  <label className="form-label">Type</label>
                  <p>{selectedResource.resourceType}</p>
                </div>
                <div className="form-group">
                  <label className="form-label">Region</label>
                  <p>{selectedResource.region}</p>
                </div>
                <div className="form-group">
                  <label className="form-label">Created</label>
                  <p>{selectedResource.createdAt || 'N/A'}</p>
                </div>
              </div>

              {Object.keys(selectedResource.tags).length > 0 && (
                <div className="form-group">
                  <label className="form-label">Tags ({Object.keys(selectedResource.tags).length})</label>
                  <div className="checkbox-group">
                    {Object.entries(selectedResource.tags).map(([key, value]) => (
                      <span key={key} className="badge badge-info">
                        {key}: {value}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="form-group">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <label className="form-label" style={{ margin: 0 }}>Raw Data</label>
                  <button
                    className="btn btn-sm btn-secondary"
                    onClick={() => {
                      navigator.clipboard.writeText(JSON.stringify(selectedResource.data, null, 2));
                    }}
                    title="Copy JSON"
                  >
                    Copy JSON
                  </button>
                </div>
                <pre
                  style={{
                    backgroundColor: 'var(--color-bg-tertiary)',
                    padding: 16,
                    borderRadius: 8,
                    overflow: 'auto',
                    maxHeight: 300,
                    fontSize: 12,
                    lineHeight: 1.5,
                  }}
                >
                  {JSON.stringify(selectedResource.data, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default ResourcesPage;

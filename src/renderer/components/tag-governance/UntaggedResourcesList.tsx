// SPDX-License-Identifier: Apache-2.0
// Copyright 2024-present Fournine Cloud

import React, { useState } from 'react';
import type { UntaggedResource } from '../../../shared/types';

interface Props {
  resources: UntaggedResource[];
}

const PAGE_SIZE = 20;

const UntaggedResourcesList: React.FC<Props> = ({ resources }) => {
  const [page, setPage] = useState(0);
  const [serviceFilter, setServiceFilter] = useState('');

  const services = [...new Set(resources.map((r) => r.service))].sort();

  const filtered = serviceFilter
    ? resources.filter((r) => r.service === serviceFilter)
    : resources;

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageItems = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="card-title">Non-Compliant Resources ({filtered.length})</h3>
        <select
          className="input"
          style={{ width: 200 }}
          value={serviceFilter}
          onChange={(e) => { setServiceFilter(e.target.value); setPage(0); }}
        >
          <option value="">All Services</option>
          {services.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      <div className="table-container">
        <table className="table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Service</th>
              <th>Region</th>
              <th>Missing Tags</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map((r) => (
              <tr key={r.id}>
                <td style={{ maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.name}
                </td>
                <td>{r.service}</td>
                <td>{r.region}</td>
                <td>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {r.missingTags.map((tag) => (
                      <span
                        key={tag}
                        className="badge badge-error"
                        style={{ fontSize: 11, padding: '2px 6px' }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: 16 }}>
          <button
            className="btn btn-sm btn-secondary"
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
          >
            Previous
          </button>
          <span className="text-secondary" style={{ lineHeight: '28px', fontSize: 13 }}>
            Page {page + 1} of {totalPages}
          </span>
          <button
            className="btn btn-sm btn-secondary"
            onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
            disabled={page >= totalPages - 1}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default UntaggedResourcesList;

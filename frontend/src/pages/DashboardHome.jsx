import { useEffect, useMemo, useState } from 'react';
import axiosClient from '../api/axiosClient';
import { usePermissions } from '../DashboardLayout';

const summaries = [
  { key: 'users', label: 'Total Users', endpoint: '/api/users', permissions: ['user:read', 'user:watch'] },
  { key: 'roles', label: 'Total Roles', endpoint: '/api/roles', permissions: ['role:read', 'role:watch'] },
  { key: 'categories', label: 'Total Categories', endpoint: '/api/categories', permissions: ['category:read', 'category:watch'] },
  { key: 'media', label: 'Total Media files', endpoint: '/api/media', permissions: ['media:read', 'media:watch'] },
];

function getCount(data) {
  if (typeof data?.total === 'number') return data.total;
  if (Array.isArray(data)) return data.length;
  if (Array.isArray(data?.items)) return data.items.length;
  if (Array.isArray(data?.data)) return data.data.length;
  return 0;
}

function DashboardHome({ user, role }) {
  const { permissions } = usePermissions();
  const visibleSummaries = useMemo(
    () => summaries.filter((summary) => summary.permissions.some((permission) => permissions.includes(permission))),
    [permissions],
  );
  const [counts, setCounts] = useState({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (visibleSummaries.length === 0) {
      setCounts({});
      setLoading(false);
      return () => { cancelled = true; };
    }

    setLoading(true);
    setCounts({});

    Promise.all(visibleSummaries.map(async (summary) => {
      try {
        const response = await axiosClient.get(summary.endpoint);
        return [summary.key, getCount(response.data)];
      } catch (_error) {
        return [summary.key, null];
      }
    })).then((results) => {
      if (!cancelled) setCounts(Object.fromEntries(results));
    }).finally(() => {
      if (!cancelled) setLoading(false);
    });

    return () => { cancelled = true; };
  }, [visibleSummaries]);

  return (
    <>
      <div className="card">
        <h2 style={{ margin: 0 }}>Welcome back, {user?.name || 'there'}</h2>
        <p style={{ marginBottom: 0, color: '#64748b' }}>{role || 'No role'}</p>
      </div>

      {visibleSummaries.length === 0 ? (
        <div className="card">
          <p style={{ margin: 0 }}>You don't have access to any dashboard summaries yet. Contact your administrator.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: '1rem', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
          {visibleSummaries.map((summary) => {
            const count = counts[summary.key];
            const value = loading && count === undefined ? 'Loading...' : count ?? '—';

            return (
              <div className="card" key={summary.key}>
                <div style={{ fontSize: '2rem', fontWeight: 700 }}>{value}</div>
                <div style={{ color: '#64748b' }}>{summary.label}</div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

export default DashboardHome;

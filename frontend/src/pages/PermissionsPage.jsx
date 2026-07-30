import { useEffect, useRef, useState } from 'react';
import axiosClient from '../api/axiosClient';
import { usePermissions } from '../DashboardLayout';

const standardActions = ['create', 'read', 'update', 'delete', 'watch', 'upload', 'write', 'approve', 'status'];
const emptyForm = {
  name: '',
  description: '',
  actions: [],
  customAction: '',
  includeCustomAction: false,
};

function getErrorMessage(error, fallback) {
  if (error.response?.status === 403) return "You don't have permission to do this";
  return error.response?.data?.message || fallback;
}

function actionFromPermission(permission) {
  return String(permission.name || '').split(':').slice(1).join(':');
}

function PermissionsPage() {
  const { permissions } = usePermissions();
  const canCreate = permissions.includes('permission:create');
  const canUpdate = permissions.includes('permission:update');
  const canDelete = permissions.includes('permission:delete');
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const hasLoaded = useRef(false);

  const loadGroups = async (searchTerm = '') => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (searchTerm.trim()) params.set('search', searchTerm.trim());
      const response = await axiosClient.get(`/api/permissions${params.size ? `?${params}` : ''}`);
      setGroups(response.data?.items || response.data || []);
    } catch (requestError) {
      setGroups([]);
      setError(getErrorMessage(requestError, 'Failed to load permission groups'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const delay = hasLoaded.current ? 400 : 0;
    hasLoaded.current = true;
    const timer = setTimeout(() => loadGroups(search), delay);
    return () => clearTimeout(timer);
  }, [search]);

  const openCreateForm = () => {
    setEditingGroup(null);
    setForm(emptyForm);
    setError('');
    setFormOpen(true);
  };

  const openEditForm = (group) => {
    const actions = (group.Permissions || []).map(actionFromPermission);
    const customAction = actions.find((action) => !standardActions.includes(action)) || '';

    setEditingGroup(group);
    setForm({
      name: group.name || '',
      description: group.description || '',
      actions: actions.filter((action) => standardActions.includes(action)),
      customAction,
      includeCustomAction: Boolean(customAction),
    });
    setError('');
    setFormOpen(true);
  };

  const toggleAction = (action) => {
    setForm((current) => ({
      ...current,
      actions: current.actions.includes(action)
        ? current.actions.filter((item) => item !== action)
        : [...current.actions, action],
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setError('');

    const actions = [...form.actions];
    if (form.includeCustomAction && form.customAction.trim()) {
      actions.push(form.customAction.trim().toLowerCase());
    }
    const payload = {
      name: form.name.trim(),
      description: form.description.trim(),
      actions: [...new Set(actions)],
    };

    try {
      if (editingGroup) {
        await axiosClient.put(`/api/permissions/${editingGroup.id}`, payload);
      } else {
        await axiosClient.post('/api/permissions', payload);
      }
      setFormOpen(false);
      setEditingGroup(null);
      setForm(emptyForm);
      await loadGroups(search);
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Failed to save permission group'));
    } finally {
      setSubmitting(false);
    }
  };

  const deletePermission = async (permission) => {
    if (!window.confirm(`Delete permission "${permission.name}"?`)) return;

    setDeletingId(permission.id);
    setError('');
    try {
      await axiosClient.delete(`/api/permissions/${permission.id}`);
      await loadGroups(search);
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Failed to delete permission'));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0 }}>Permission Groups</h2>
        {canCreate && <button type="button" onClick={openCreateForm}>New Group</button>}
      </div>

      {error && <div className="error" style={{ marginBottom: '1rem' }}>{error}</div>}

      <input
        type="search"
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search groups or permissions"
        aria-label="Search permission groups"
        style={{ width: '100%', boxSizing: 'border-box', marginBottom: '1rem' }}
      />

      {formOpen && (
        <form className="card" onSubmit={handleSubmit} style={{ marginBottom: '1rem', boxShadow: 'none', border: '1px solid #e2e8f0' }}>
          <h3 style={{ margin: 0 }}>{editingGroup ? 'Edit Permission Group' : 'New Permission Group'}</h3>
          <input
            value={form.name}
            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            placeholder="Group name (for example, Warehouse)"
            disabled={Boolean(editingGroup)}
            required
          />
          <input
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            placeholder="Description"
          />

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
            {standardActions.map((action) => (
              <label key={action} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', textTransform: 'capitalize' }}>
                <input type="checkbox" checked={form.actions.includes(action)} onChange={() => toggleAction(action)} />
                {action}
              </label>
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <input
                type="checkbox"
                checked={form.includeCustomAction}
                onChange={(event) => setForm((current) => ({ ...current, includeCustomAction: event.target.checked }))}
              />
              Custom permission
            </label>
            <input
              value={form.customAction}
              onChange={(event) => setForm((current) => ({ ...current, customAction: event.target.value }))}
              placeholder="Custom action name"
              disabled={!form.includeCustomAction}
              style={{ flex: '1 1 220px' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button type="submit" disabled={submitting}>{submitting ? 'Saving...' : editingGroup ? 'Save Changes' : 'Create Group'}</button>
            <button type="button" onClick={() => setFormOpen(false)} style={{ background: '#6b7280' }}>Cancel</button>
          </div>
        </form>
      )}

      {loading ? (
        <p>Loading permission groups...</p>
      ) : groups.length === 0 ? (
        <p>No permission groups yet</p>
      ) : (
        <div style={{ display: 'grid', gap: '1rem' }}>
          {groups.map((group) => (
            <section key={group.id} style={{ padding: '1rem', border: '1px solid #e5e7eb', borderRadius: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: '1rem', marginBottom: '0.75rem' }}>
                <div>
                  <h3 style={{ margin: 0 }}>{group.name}</h3>
                  {group.description && <p style={{ margin: '0.35rem 0 0', color: '#64748b' }}>{group.description}</p>}
                </div>
                {canUpdate && <button type="button" onClick={() => openEditForm(group)}>Edit</button>}
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {(group.Permissions || []).map((permission) => (
                  <div key={permission.id} style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.25rem 0.55rem', borderRadius: 999, background: '#dbeafe', color: '#1d4ed8', fontSize: '0.85rem' }}>
                    <span>{actionFromPermission(permission)}</span>
                    {canDelete && (
                      <button
                        type="button"
                        onClick={() => deletePermission(permission)}
                        disabled={deletingId === permission.id}
                        aria-label={`Delete ${permission.name}`}
                        style={{ padding: '0 0.2rem', border: 0, color: '#b91c1c', background: 'transparent' }}
                      >
                        {deletingId === permission.id ? '...' : '×'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

export default PermissionsPage;

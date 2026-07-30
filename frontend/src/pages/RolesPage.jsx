import { useEffect, useMemo, useState } from 'react';
import axiosClient from '../api/axiosClient';
import { usePermissions } from '../DashboardLayout';

function RolesPage() {
  const { permissions } = usePermissions();
  const [roles, setRoles] = useState([]);
  const [permissionsList, setPermissionsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [form, setForm] = useState({ name: '', description: '', permissionIds: [] });
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canCreate = permissions.includes('role:create');
  const canUpdate = permissions.includes('role:update');
  const canDelete = permissions.includes('role:delete');

  const loadRoles = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axiosClient.get('/api/roles');
      setRoles(res.data || []);
    } catch (err) {
      if (err.response?.status === 403) {
        setError("You don't have permission to do this");
      } else {
        setError('Failed to load roles');
      }
      setRoles([]);
    } finally {
      setLoading(false);
    }
  };

  const loadPermissions = async () => {
    try {
      const res = await axiosClient.get('/api/permissions');
      const items = res.data?.items || res.data || [];
      const flattened = Array.isArray(items)
        ? items.flatMap((group) => (group.Permissions || []).map((permission) => permission))
        : [];
      setPermissionsList(flattened);
    } catch (err) {
      setPermissionsList([]);
    }
  };

  useEffect(() => {
    loadRoles();
    loadPermissions();
  }, []);

  const openCreateForm = () => {
    setEditingRole(null);
    setForm({ name: '', description: '', permissionIds: [] });
    setError('');
    setFormOpen(true);
  };

  const openEditForm = (role) => {
    setEditingRole(role);
    setForm({
      name: role.name || '',
      description: role.description || '',
      permissionIds: (role.Permissions || []).map((permission) => permission.id),
    });
    setError('');
    setFormOpen(true);
  };

  const handleCheckboxChange = (permissionId) => {
    setForm((prev) => ({
      ...prev,
      permissionIds: prev.permissionIds.includes(permissionId)
        ? prev.permissionIds.filter((id) => id !== permissionId)
        : [...prev.permissionIds, permissionId],
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');

    try {
      if (editingRole) {
        await axiosClient.put(`/api/roles/${editingRole.id}`, form);
      } else {
        await axiosClient.post('/api/roles', form);
      }

      setFormOpen(false);
      setEditingRole(null);
      setForm({ name: '', description: '', permissionIds: [] });
      await loadRoles();
    } catch (err) {
      if (err.response?.status === 403) {
        setError("You don't have permission to do this");
      } else {
        setError('Failed to save role');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (roleId) => {
    setError('');
    try {
      await axiosClient.delete(`/api/roles/${roleId}`);
      await loadRoles();
    } catch (err) {
      if (err.response?.status === 403) {
        setError("You don't have permission to do this");
      } else if (err.response?.status === 409) {
        setError('Cannot delete a role that is still assigned to users');
      } else {
        setError('Failed to delete role');
      }
    }
  };

  const permissionCount = useMemo(() => (role) => (role.Permissions || []).length, []);

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2>Roles</h2>
        {canCreate && (
          <button type="button" onClick={openCreateForm}>New Role</button>
        )}
      </div>

      {error && <div className="error" style={{ marginBottom: '1rem' }}>{error}</div>}

      {formOpen && (
        <form className="card" onSubmit={handleSubmit} style={{ marginBottom: '1rem' }}>
          <h3>{editingRole ? 'Edit Role' : 'New Role'}</h3>
          <input
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <input
            placeholder="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            required
          />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.5rem', marginTop: '0.5rem' }}>
            {permissionsList.map((permission) => (
              <label key={permission.id} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <input
                  type="checkbox"
                  checked={form.permissionIds.includes(permission.id)}
                  onChange={() => handleCheckboxChange(permission.id)}
                />
                <span>{permission.name}</span>
              </label>
            ))}
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
            <button type="submit" disabled={submitting}>{submitting ? 'Saving...' : editingRole ? 'Save Changes' : 'Create Role'}</button>
            <button type="button" onClick={() => setFormOpen(false)} style={{ background: '#6b7280' }}>Cancel</button>
          </div>
        </form>
      )}

      {loading ? (
        <p>Loading roles...</p>
      ) : roles.length === 0 ? (
        <p>No roles yet.</p>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
              <th style={{ padding: '0.75rem 0' }}>Name</th>
              <th style={{ padding: '0.75rem 0' }}>Description</th>
              <th style={{ padding: '0.75rem 0' }}>Status</th>
              <th style={{ padding: '0.75rem 0' }}>Permissions</th>
              <th style={{ padding: '0.75rem 0' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {roles.map((role) => (
              <tr key={role.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                <td style={{ padding: '0.75rem 0' }}>{role.name}</td>
                <td style={{ padding: '0.75rem 0' }}>{role.description || '—'}</td>
                <td style={{ padding: '0.75rem 0' }}>{role.status || 'active'}</td>
                <td style={{ padding: '0.75rem 0' }}>{(role.Permissions || []).length}</td>
                <td style={{ padding: '0.75rem 0' }}>
                  {canUpdate && <button type="button" onClick={() => openEditForm(role)} style={{ marginRight: '0.5rem' }}>Edit</button>}
                  {canDelete && <button type="button" onClick={() => handleDelete(role.id)} style={{ background: '#dc2626' }}>Delete</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default RolesPage;

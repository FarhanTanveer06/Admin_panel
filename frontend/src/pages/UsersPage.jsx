import { useEffect, useMemo, useState } from 'react';
import axiosClient from '../api/axiosClient';
import { usePermissions } from '../DashboardLayout';

function UsersPage() {
  const { permissions } = usePermissions();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formErrors, setFormErrors] = useState({});
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit] = useState(20);
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    gender: '',
    roleId: '',
  });

  const canCreate = permissions.includes('user:create');
  const canUpdate = permissions.includes('user:update');
  const canDelete = permissions.includes('user:delete');
  const currentUserId = Number(localStorage.getItem('userId') || 0);

  const loadUsers = async (nextPage = 1, nextSearch = search, nextRole = roleFilter, nextStatus = statusFilter) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(nextPage), limit: String(limit) });
      if (nextSearch) params.set('search', nextSearch);
      if (nextRole) params.set('role', nextRole);
      if (nextStatus) params.set('status', nextStatus);

      const res = await axiosClient.get(`/api/users?${params.toString()}`);
      const payload = res.data || {};
      const list = payload.users || payload.items || payload.data || [];
      setUsers(list);
      setTotalPages(payload.totalPages || 1);
      setPage(payload.page || nextPage);
    } catch (err) {
      if (err.response?.status === 403) {
        setError("You don't have permission to do this");
      } else {
        setError('Failed to load users');
      }
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const loadRoles = async () => {
    try {
      const res = await axiosClient.get('/api/roles');
      const list = res.data?.roles || res.data?.items || res.data || [];
      setRoles(list);
    } catch (err) {
      setRoles([]);
    }
  };

  useEffect(() => {
    loadUsers(1);
    loadRoles();
  }, []);

  const debouncedSearch = useMemo(() => search, [search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      loadUsers(1, search, roleFilter, statusFilter);
    }, 400);

    return () => clearTimeout(timer);
  }, [debouncedSearch, roleFilter, statusFilter]);

  const openCreateForm = () => {
    setEditingUser(null);
    setForm({ name: '', email: '', password: '', phone: '', gender: '', roleId: '' });
    setFormErrors({});
    setError('');
    setFormOpen(true);
  };

  const openEditForm = (user) => {
    setEditingUser(user);
    setForm({
      name: user.name || '',
      email: user.email || '',
      password: '',
      phone: user.phone || '',
      gender: user.gender || '',
      roleId: user.roleId || user.Role?.id || '',
    });
    setFormErrors({});
    setError('');
    setFormOpen(true);
  };

  const handleFormChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFormErrors((prev) => ({ ...prev, [field]: '' }));
  };

  const collectValidationErrors = (payload) => {
    if (!payload) return {};
    if (payload.errors) return payload.errors;
    if (payload.message && payload.details) return payload.details;
    return {};
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setFormErrors({});
    setError('');

    if (!form.roleId) {
      setFormErrors((prev) => ({ ...prev, roleId: 'Please select a role' }));
      setSubmitting(false);
      return;
    }

    const payload = {
      name: form.name,
      email: form.email,
      password: form.password || undefined,
      phone: form.phone || undefined,
      gender: form.gender || undefined,
      roleId: Number(form.roleId),
    };

    try {
      if (editingUser) {
        await axiosClient.put(`/api/users/${editingUser.id}`, payload);
      } else {
        await axiosClient.post('/api/users', payload);
      }

      setFormOpen(false);
      setEditingUser(null);
      setForm({ name: '', email: '', password: '', phone: '', gender: '', roleId: '' });
      await loadUsers(page, search, roleFilter, statusFilter);
    } catch (err) {
      if (err.response?.status === 403) {
        setError("You don't have permission to do this");
      } else if (err.response?.status === 409) {
        setError('A user with that email already exists');
      } else if (err.response?.status === 400 || err.response?.status === 422) {
        const fieldErrors = collectValidationErrors(err.response.data);
        setFormErrors(fieldErrors);
        setError('Please fix the highlighted fields');
      } else {
        setError('Failed to save user');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (user) => {
    if (!canUpdate) return;

    const previousUsers = users;
    const optimisticUsers = users.map((item) =>
      item.id === user.id ? { ...item, active: !item.active } : item,
    );
    setUsers(optimisticUsers);

    try {
      await axiosClient.put(`/api/users/${user.id}`, { active: !user.active });
    } catch (err) {
      setUsers(previousUsers);
      if (err.response?.status === 403) {
        setError("You don't have permission to do this");
      } else {
        setError('Failed to update status');
      }
    }
  };

  const handleDelete = async (userId) => {
    if (!window.confirm('Delete this user?')) return;

    try {
      await axiosClient.delete(`/api/users/${userId}`);
      setUsers((prev) => prev.filter((user) => user.id !== userId));
    } catch (err) {
      if (err.response?.status === 403) {
        setError("You don't have permission to do this");
      } else {
        setError('Failed to delete user');
      }
    }
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h2>Users</h2>
        {canCreate && (
          <button type="button" onClick={openCreateForm}>New User</button>
        )}
      </div>

      {error && <div className="error" style={{ marginBottom: '1rem' }}>{error}</div>}

      <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginBottom: '1rem' }}>
        <input
          type="text"
          placeholder="Search by name or email"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
        <select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
          <option value="">All roles</option>
          {roles.map((role) => (
            <option key={role.id} value={role.name}>{role.name}</option>
          ))}
        </select>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {formOpen && (
        <form className="card" onSubmit={handleSubmit} style={{ marginBottom: '1rem' }}>
          <h3>{editingUser ? 'Edit User' : 'New User'}</h3>

          <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            <div>
              <input
                placeholder="Name"
                value={form.name}
                onChange={(event) => handleFormChange('name', event.target.value)}
                required
              />
              {formErrors.name && <div className="error">{formErrors.name}</div>}
            </div>

            <div>
              <input
                type="email"
                placeholder="Email"
                value={form.email}
                onChange={(event) => handleFormChange('email', event.target.value)}
                required
              />
              {formErrors.email && <div className="error">{formErrors.email}</div>}
            </div>

            <div>
              <input
                type="password"
                placeholder="Password"
                value={form.password}
                onChange={(event) => handleFormChange('password', event.target.value)}
                required={!editingUser}
              />
              {formErrors.password && <div className="error">{formErrors.password}</div>}
            </div>

            <div>
              <input
                placeholder="Phone"
                value={form.phone}
                onChange={(event) => handleFormChange('phone', event.target.value)}
              />
              {formErrors.phone && <div className="error">{formErrors.phone}</div>}
            </div>

            <div>
              <select value={form.gender} onChange={(event) => handleFormChange('gender', event.target.value)}>
                <option value="">Select gender</option>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
              </select>
              {formErrors.gender && <div className="error">{formErrors.gender}</div>}
            </div>

            <div>
              <select
                value={form.roleId}
                onChange={(event) => handleFormChange('roleId', event.target.value)}
                disabled={Boolean(editingUser && editingUser.id === currentUserId)}
                required
              >
                <option value="">Select role</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>{role.name}</option>
                ))}
              </select>
              {formErrors.roleId && <div className="error">{formErrors.roleId}</div>}
              {editingUser && editingUser.id === currentUserId && (
                <div style={{ fontSize: '0.85rem', color: '#6b7280', marginTop: '0.25rem' }}>
                  You cannot change your own role
                </div>
              )}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
            <button type="submit" disabled={submitting}>{submitting ? 'Saving...' : editingUser ? 'Save Changes' : 'Create User'}</button>
            <button type="button" onClick={() => setFormOpen(false)} style={{ background: '#6b7280' }}>Cancel</button>
          </div>
        </form>
      )}

      {loading ? (
        <p>Loading users...</p>
      ) : users.length === 0 ? (
        <p>No users found</p>
      ) : (
        <>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #e5e7eb' }}>
                <th style={{ padding: '0.75rem 0' }}>Name</th>
                <th style={{ padding: '0.75rem 0' }}>Email</th>
                <th style={{ padding: '0.75rem 0' }}>Role</th>
                <th style={{ padding: '0.75rem 0' }}>Status</th>
                <th style={{ padding: '0.75rem 0' }}>Created</th>
                <th style={{ padding: '0.75rem 0' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '0.75rem 0' }}>{user.name}</td>
                  <td style={{ padding: '0.75rem 0' }}>{user.email}</td>
                  <td style={{ padding: '0.75rem 0' }}>{user.Role?.name || user.roleName || '—'}</td>
                  <td style={{ padding: '0.75rem 0' }}>{user.active ? 'active' : 'inactive'}</td>
                  <td style={{ padding: '0.75rem 0' }}>{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : '—'}</td>
                  <td style={{ padding: '0.75rem 0' }}>
                    {canUpdate && (
                      <>
                        <button type="button" onClick={() => openEditForm(user)} style={{ marginRight: '0.5rem' }}>Edit</button>
                        <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', marginRight: '0.5rem' }}>
                          <input
                            type="checkbox"
                            checked={Boolean(user.active)}
                            onChange={() => handleToggleActive(user)}
                          />
                          <span>{user.active ? 'On' : 'Off'}</span>
                        </label>
                      </>
                    )}
                    {canDelete && (
                      <button type="button" onClick={() => handleDelete(user.id)} style={{ background: '#dc2626' }}>Delete</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1rem' }}>
            <button type="button" onClick={() => loadUsers(page - 1, search, roleFilter, statusFilter)} disabled={page <= 1}>Previous</button>
            {Array.from({ length: totalPages }, (_, index) => index + 1).map((pageNumber) => (
              <button
                key={pageNumber}
                type="button"
                onClick={() => loadUsers(pageNumber, search, roleFilter, statusFilter)}
                style={{ background: pageNumber === page ? '#2563eb' : '#e5e7eb', color: pageNumber === page ? '#fff' : '#111827' }}
              >
                {pageNumber}
              </button>
            ))}
            <button type="button" onClick={() => loadUsers(page + 1, search, roleFilter, statusFilter)} disabled={page >= totalPages}>Next</button>
          </div>
        </>
      )}
    </div>
  );
}

export default UsersPage;

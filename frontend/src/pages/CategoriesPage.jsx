import { useEffect, useMemo, useState } from 'react';
import axiosClient from '../api/axiosClient';
import { usePermissions } from '../DashboardLayout';

function getErrorMessage(error, fallback) {
  if (error.response?.status === 403) return "You don't have permission to do this";
  return error.response?.data?.message || fallback;
}

function assetUrl(value) {
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  const relativePath = value.startsWith('/') ? value : `/uploads/${String(value).split(/[\\/]/).pop()}`;
  const baseUrl = axiosClient.defaults.baseURL || '';
  return !baseUrl || baseUrl === '/' ? relativePath : `${baseUrl.replace(/\/$/, '')}${relativePath}`;
}

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function flattenTree(nodes, depth = 0, output = []) {
  nodes.forEach((node) => {
    output.push({ node, depth });
    flattenTree(node.children || [], depth + 1, output);
  });
  return output;
}

function descendantIds(node, ids = new Set()) {
  if (!node) return ids;
  ids.add(node.id);
  (node.children || []).forEach((child) => descendantIds(child, ids));
  return ids;
}

const emptyForm = {
  name: '',
  slug: '',
  description: '',
  parentId: '',
  imageId: '',
  active: true,
  sortOrder: 0,
};

function CategoriesPage() {
  const { permissions } = usePermissions();
  const canCreate = permissions.includes('category:create');
  const canUpdate = permissions.includes('category:update');
  const canDelete = permissions.includes('category:delete');
  const [tree, setTree] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [expanded, setExpanded] = useState(new Set());
  const [formOpen, setFormOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [slugTouched, setSlugTouched] = useState(false);
  const [parentSearch, setParentSearch] = useState('');
  const [parentError, setParentError] = useState('');
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [media, setMedia] = useState([]);
  const [mediaLoading, setMediaLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const flatCategories = useMemo(() => flattenTree(tree), [tree]);
  const blockedParentIds = useMemo(() => descendantIds(editingCategory), [editingCategory]);
  const parentOptions = flatCategories.filter(({ node }) => {
    const search = parentSearch.trim().toLowerCase();
    return !blockedParentIds.has(node.id) && (!search || node.name.toLowerCase().includes(search));
  });

  const loadTree = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await axiosClient.get('/api/categories/tree');
      const nextTree = Array.isArray(response.data) ? response.data : response.data?.items || [];
      setTree(nextTree);
      setExpanded(new Set(nextTree.map((category) => category.id)));
    } catch (requestError) {
      setTree([]);
      setError(getErrorMessage(requestError, 'Failed to load categories'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTree();
  }, []);

  const openCreateForm = () => {
    setEditingCategory(null);
    setForm(emptyForm);
    setSlugTouched(false);
    setParentSearch('');
    setParentError('');
    setError('');
    setNotice('');
    setFormOpen(true);
  };

  const openEditForm = (category) => {
    setEditingCategory(category);
    setForm({
      name: category.name || '',
      slug: category.slug || '',
      description: category.description || '',
      parentId: category.parentId ? String(category.parentId) : '',
      imageId: category.imageId ? String(category.imageId) : '',
      active: Boolean(category.active),
      sortOrder: category.sortOrder ?? 0,
    });
    setSlugTouched(true);
    setParentSearch('');
    setParentError('');
    setError('');
    setNotice('');
    setFormOpen(true);
  };

  const handleNameChange = (name) => {
    setForm((current) => ({ ...current, name, slug: slugTouched ? current.slug : slugify(name) }));
  };

  const loadMedia = async () => {
    setMediaLoading(true);
    try {
      const response = await axiosClient.get('/api/media?page=1&limit=100&type=image');
      setMedia(response.data?.items || response.data || []);
    } catch (requestError) {
      setMedia([]);
      setError(getErrorMessage(requestError, 'Failed to load the media library'));
    } finally {
      setMediaLoading(false);
    }
  };

  const openPicker = () => {
    setPickerOpen(true);
    loadMedia();
  };

  const submitForm = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    setNotice('');
    setParentError('');

    const payload = {
      ...form,
      slug: form.slug || slugify(form.name),
      parentId: form.parentId ? Number(form.parentId) : null,
      imageId: form.imageId ? Number(form.imageId) : null,
      sortOrder: Number(form.sortOrder) || 0,
    };

    try {
      if (editingCategory) {
        await axiosClient.put(`/api/categories/${editingCategory.id}`, payload);
      } else {
        await axiosClient.post('/api/categories', payload);
      }
      setNotice(editingCategory ? 'Category updated.' : 'Category created.');
      setFormOpen(false);
      await loadTree();
    } catch (requestError) {
      const message = getErrorMessage(requestError, 'Failed to save category');
      if (requestError.response?.data?.error === 'CIRCULAR_REFERENCE' || /circular reference/i.test(message)) {
        setParentError(message);
      } else {
        setError(message);
      }
    } finally {
      setSaving(false);
    }
  };

  const deleteCategory = async (category) => {
    if (!window.confirm(`Delete "${category.name}"?`)) return;

    setDeletingId(category.id);
    setError('');
    setNotice('');
    try {
      await axiosClient.delete(`/api/categories/${category.id}`);
      setNotice('Category deleted.');
      await loadTree();
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Failed to delete category'));
    } finally {
      setDeletingId(null);
    }
  };

  const toggleExpanded = (categoryId) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(categoryId)) next.delete(categoryId);
      else next.add(categoryId);
      return next;
    });
  };

  const renderNode = (category, depth = 0) => {
    const children = category.children || [];
    const hasChildren = children.length > 0;
    const isExpanded = expanded.has(category.id);

    return (
      <li key={category.id} style={{ listStyle: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minHeight: 40, paddingLeft: `${depth * 1.25}rem`, borderBottom: '1px solid #f1f5f9' }}>
          <button
            type="button"
            onClick={() => hasChildren && toggleExpanded(category.id)}
            aria-label={hasChildren ? `${isExpanded ? 'Collapse' : 'Expand'} ${category.name}` : undefined}
            disabled={!hasChildren}
            style={{ width: 28, padding: '0.2rem', color: hasChildren ? '#334155' : 'transparent', background: 'transparent', border: 0 }}
          >
            {hasChildren ? (isExpanded ? 'v' : '>') : '•'}
          </button>
          <button type="button" onClick={() => hasChildren && toggleExpanded(category.id)} style={{ flex: 1, padding: 0, textAlign: 'left', color: '#111827', background: 'transparent', border: 0 }}>
            {category.name}
          </button>
          <span style={{ padding: '0.15rem 0.45rem', borderRadius: 999, fontSize: '0.75rem', color: category.active ? '#166534' : '#991b1b', background: category.active ? '#dcfce7' : '#fee2e2' }}>
            {category.active ? 'Active' : 'Inactive'}
          </span>
          {canUpdate && <button type="button" onClick={() => openEditForm(category)} aria-label={`Edit ${category.name}`} style={{ padding: '0.3rem 0.45rem' }}>Edit</button>}
          {canDelete && (
            <button type="button" onClick={() => deleteCategory(category)} disabled={deletingId === category.id} aria-label={`Delete ${category.name}`} style={{ padding: '0.3rem 0.45rem', background: '#dc2626' }}>
              {deletingId === category.id ? '...' : 'Delete'}
            </button>
          )}
        </div>
        {hasChildren && isExpanded && <ul style={{ padding: 0, margin: 0 }}>{children.map((child) => renderNode(child, depth + 1))}</ul>}
      </li>
    );
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0 }}>Categories</h2>
        {canCreate && <button type="button" onClick={openCreateForm}>New Category</button>}
      </div>

      {error && <div className="error" style={{ marginBottom: '1rem' }}>{error}</div>}
      {notice && <div style={{ marginBottom: '1rem', color: '#15803d' }}>{notice}</div>}

      {formOpen && (
        <form className="card" onSubmit={submitForm} style={{ marginBottom: '1rem', boxShadow: 'none', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>{editingCategory ? 'Edit Category' : 'New Category'}</h3>
            <button type="button" onClick={() => setFormOpen(false)} style={{ background: '#64748b' }}>Close</button>
          </div>

          <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', marginTop: '1rem' }}>
            <input value={form.name} onChange={(event) => handleNameChange(event.target.value)} placeholder="Name" required />
            <input value={form.slug} onChange={(event) => { setSlugTouched(true); setForm((current) => ({ ...current, slug: event.target.value })); }} placeholder="Slug" required />
            <textarea value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} placeholder="Description (optional)" style={{ minHeight: 92, padding: '0.75rem', borderRadius: 8, border: '1px solid #d1d5db' }} />
            <div>
              <input value={parentSearch} onChange={(event) => setParentSearch(event.target.value)} placeholder="Search parent categories" />
              <select
                value={form.parentId}
                onChange={(event) => { setParentError(''); setForm((current) => ({ ...current, parentId: event.target.value })); }}
                style={{ marginTop: '0.4rem', width: '100%' }}
              >
                <option value="">No parent (top level)</option>
                {parentOptions.map(({ node, depth }) => <option key={node.id} value={node.id}>{`${'— '.repeat(depth)}${node.name}`}</option>)}
              </select>
              {parentError && <div className="error" style={{ marginTop: '0.4rem' }}>{parentError}</div>}
            </div>
            <div>
              <button type="button" onClick={openPicker} style={{ width: '100%' }}>{form.imageId ? 'Change image' : 'Choose image'}</button>
              {form.imageId && <div style={{ fontSize: '0.85rem', marginTop: '0.4rem' }}>Selected media #{form.imageId}</div>}
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <input type="checkbox" checked={form.active} onChange={(event) => setForm((current) => ({ ...current, active: event.target.checked }))} />
              Active
            </label>
            <input type="number" value={form.sortOrder} onChange={(event) => setForm((current) => ({ ...current, sortOrder: event.target.value }))} placeholder="Sort order" />
          </div>
          <button type="submit" disabled={saving} style={{ marginTop: '1rem' }}>{saving ? 'Saving...' : editingCategory ? 'Save changes' : 'Create category'}</button>
        </form>
      )}

      {loading ? (
        <p>Loading categories...</p>
      ) : tree.length === 0 ? (
        <p>No categories yet</p>
      ) : (
        <ul style={{ padding: 0, margin: 0 }}>{tree.map((category) => renderNode(category))}</ul>
      )}

      {pickerOpen && (
        <div role="dialog" aria-modal="true" aria-label="Choose category image" style={{ position: 'fixed', inset: 0, zIndex: 20, display: 'grid', placeItems: 'center', padding: '1rem', background: 'rgba(15, 23, 42, 0.55)' }}>
          <div className="card" style={{ width: 'min(760px, 100%)', maxHeight: '80vh', overflow: 'auto', margin: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0 }}>Choose an image</h3>
              <button type="button" onClick={() => setPickerOpen(false)} style={{ background: '#64748b' }}>Close</button>
            </div>
            {mediaLoading ? <p>Loading media...</p> : media.length === 0 ? <p>No images available. Upload one in Media first.</p> : (
              <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))' }}>
                {media.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => { setForm((current) => ({ ...current, imageId: String(item.id) })); setPickerOpen(false); }}
                    title={item.fileName}
                    style={{ padding: 0, overflow: 'hidden', background: '#f1f5f9', border: form.imageId === String(item.id) ? '3px solid #2563eb' : '1px solid #e2e8f0' }}
                  >
                    <img src={assetUrl(item.thumbnailPath || item.publicUrl)} alt={item.altText || item.fileName} style={{ width: '100%', height: 100, display: 'block', objectFit: 'cover' }} />
                    <span style={{ display: 'block', padding: '0.4rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#111827', background: '#fff', fontSize: '0.75rem' }}>{item.fileName}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default CategoriesPage;

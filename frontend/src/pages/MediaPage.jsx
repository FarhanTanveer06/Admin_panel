import { useEffect, useState } from 'react';
import axiosClient from '../api/axiosClient';
import { usePermissions } from '../DashboardLayout';

const PAGE_SIZE = 24;

function getErrorMessage(error, fallback) {
  if (error.response?.status === 403) return "You don't have permission to do this";
  return error.response?.data?.message || fallback;
}

function assetUrl(value) {
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;

  const relativePath = value.startsWith('/')
    ? value
    : `/uploads/${String(value).split(/[\\/]/).pop()}`;
  const baseUrl = axiosClient.defaults.baseURL || '';
  return !baseUrl || baseUrl === '/'
    ? relativePath
    : `${baseUrl.replace(/\/$/, '')}${relativePath}`;
}

function MediaPage() {
  const { permissions } = usePermissions();
  const canUpload = permissions.includes('media:upload');
  const canWrite = permissions.includes('media:write');
  const canDelete = permissions.includes('media:delete');
  const [media, setMedia] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [uploading, setUploading] = useState([]);
  const [dragActive, setDragActive] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState(null);
  const [editForm, setEditForm] = useState({ altText: '', title: '' });
  const [saving, setSaving] = useState(false);
  const [hoveredMediaId, setHoveredMediaId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  const loadMedia = async (nextPage = 1, nextSearch = debouncedSearch, nextType = typeFilter) => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(nextPage), limit: String(PAGE_SIZE) });
      if (nextSearch) params.set('search', nextSearch);
      if (nextType) params.set('type', nextType);

      const response = await axiosClient.get(`/api/media?${params.toString()}`);
      const payload = response.data || {};
      setMedia(payload.items || payload.data || []);
      setPage(payload.page || nextPage);
      setTotalPages(payload.totalPages || 1);
    } catch (requestError) {
      setMedia([]);
      setError(getErrorMessage(requestError, 'Failed to load media'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search.trim()), 400);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    loadMedia(1, debouncedSearch, typeFilter);
  }, [debouncedSearch, typeFilter]);

  const uploadFile = async (file, uploadId) => {
    const formData = new FormData();
    formData.append('files', file);

    try {
      await axiosClient.post('/api/media/upload', formData, {
        onUploadProgress: (event) => {
          const progress = event.total ? Math.round((event.loaded * 100) / event.total) : 0;
          setUploading((current) => current.map((item) => (
            item.id === uploadId ? { ...item, progress } : item
          )));
        },
      });
      setUploading((current) => current.map((item) => (
        item.id === uploadId ? { ...item, progress: 100, status: 'complete' } : item
      )));
    } catch (requestError) {
      setUploading((current) => current.map((item) => (
        item.id === uploadId
          ? { ...item, status: 'error', error: getErrorMessage(requestError, 'Upload failed') }
          : item
      )));
    }
  };

  const startUploads = async (files) => {
    const selectedFiles = Array.from(files || []);
    if (!selectedFiles.length) return;

    const pending = selectedFiles.map((file) => ({
      id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
      name: file.name,
      progress: 0,
      status: 'uploading',
      error: '',
    }));
    setUploading((current) => [...pending, ...current]);
    await Promise.all(pending.map((item, index) => uploadFile(selectedFiles[index], item.id)));
    await loadMedia(1, debouncedSearch, typeFilter);
  };

  const openEditPanel = (item) => {
    if (!canWrite) return;
    setSelectedMedia(item);
    setEditForm({ altText: item.altText || '', title: item.title || '' });
    setError('');
    setNotice('');
  };

  const saveMedia = async (event) => {
    event.preventDefault();
    if (!selectedMedia) return;

    setSaving(true);
    setError('');
    setNotice('');
    try {
      const response = await axiosClient.put(`/api/media/${selectedMedia.id}`, editForm);
      const updated = { ...selectedMedia, ...editForm, ...(response.data || {}) };
      setMedia((current) => current.map((item) => (item.id === updated.id ? updated : item)));
      setSelectedMedia(updated);
      setEditForm({ altText: updated.altText || '', title: updated.title || '' });
      setNotice('Media details saved.');
      await loadMedia(page, debouncedSearch, typeFilter);
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Failed to save media details'));
    } finally {
      setSaving(false);
    }
  };

  const deleteMedia = async (item) => {
    if (!window.confirm(`Delete “${item.fileName}”?`)) return;

    setDeletingId(item.id);
    setError('');
    try {
      await axiosClient.delete(`/api/media/${item.id}`);
      setMedia((current) => current.filter((entry) => entry.id !== item.id));
      if (selectedMedia?.id === item.id) setSelectedMedia(null);
    } catch (requestError) {
      setError(getErrorMessage(requestError, 'Failed to delete media'));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
        <h2 style={{ margin: 0 }}>Media</h2>
      </div>

      {error && <div className="error" style={{ marginBottom: '1rem' }}>{error}</div>}
      {notice && <div style={{ marginBottom: '1rem', color: '#15803d' }}>{notice}</div>}

      {canUpload && (
        <section style={{ marginBottom: '1.25rem' }}>
          <label
            htmlFor="media-files"
            onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={() => setDragActive(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragActive(false);
              startUploads(event.dataTransfer.files);
            }}
            style={{
              display: 'block',
              padding: '2rem',
              textAlign: 'center',
              cursor: 'pointer',
              border: `2px dashed ${dragActive ? '#2563eb' : '#cbd5e1'}`,
              borderRadius: '0.5rem',
              background: dragActive ? '#eff6ff' : '#f8fafc',
            }}
          >
            <strong>Drop images or videos here</strong>
            <div style={{ color: '#64748b', marginTop: '0.35rem' }}>or click to choose multiple files (max 10 MB each)</div>
            <input
              id="media-files"
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,image/gif,video/mp4"
              onChange={(event) => {
                startUploads(event.target.files);
                event.target.value = '';
              }}
              style={{ display: 'none' }}
            />
          </label>

          {uploading.length > 0 && (
            <div style={{ display: 'grid', gap: '0.5rem', marginTop: '0.75rem' }}>
              {uploading.map((item) => (
                <div key={item.id} style={{ padding: '0.6rem 0.75rem', border: '1px solid #e2e8f0', borderRadius: '0.35rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem' }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.name}</span>
                    <span>{item.status === 'error' ? 'Failed' : item.status === 'complete' ? 'Uploaded' : `${item.progress}%`}</span>
                  </div>
                  {item.status === 'uploading' && (
                    <div style={{ height: 6, background: '#e2e8f0', borderRadius: 99, marginTop: '0.4rem' }}>
                      <div style={{ width: `${item.progress}%`, height: '100%', borderRadius: 99, background: '#2563eb' }} />
                    </div>
                  )}
                  {item.error && <div className="error" style={{ marginTop: '0.35rem' }}>{item.error}</div>}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'minmax(0, 1fr) minmax(160px, 220px)', marginBottom: '1rem' }}>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search filename, title, or alt text"
        />
        <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
          <option value="">All media</option>
          <option value="image">Images</option>
          <option value="video">Videos</option>
        </select>
      </div>

      {loading ? (
        <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
          {Array.from({ length: 12 }, (_, index) => (
            <div key={index} style={{ height: 170, borderRadius: '0.5rem', background: '#e2e8f0', animation: 'pulse 1.5s ease-in-out infinite' }} />
          ))}
        </div>
      ) : media.length === 0 ? (
        <p>No media uploaded yet</p>
      ) : (
        <>
          <div style={{ display: 'grid', gap: '0.75rem', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))' }}>
            {media.map((item) => {
              const preview = item.type === 'image' ? assetUrl(item.thumbnailPath || item.publicUrl) : '';
              return (
                <article
                  key={item.id}
                  onClick={() => openEditPanel(item)}
                  onMouseEnter={() => setHoveredMediaId(item.id)}
                  onMouseLeave={() => setHoveredMediaId(null)}
                  style={{ position: 'relative', overflow: 'hidden', border: '1px solid #e2e8f0', borderRadius: '0.5rem', cursor: canWrite ? 'pointer' : 'default', background: '#fff' }}
                >
                  <div style={{ height: 125, display: 'grid', placeItems: 'center', background: '#f1f5f9' }}>
                    {item.type === 'video' ? (
                      <span role="img" aria-label="Video" style={{ fontSize: '2.5rem' }}>🎬</span>
                    ) : (
                      <img src={preview} alt={item.altText || item.fileName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    )}
                  </div>
                  <div title={item.fileName} style={{ padding: '0.6rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.875rem' }}>
                    {item.fileName}
                  </div>
                  {item.title && (
                    <div title={item.title} style={{ padding: '0 0.6rem 0.6rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#64748b', fontSize: '0.78rem' }}>
                      {item.title}
                    </div>
                  )}
                  {canDelete && hoveredMediaId === item.id && (
                    <button
                      type="button"
                      aria-label={`Delete ${item.fileName}`}
                      disabled={deletingId === item.id}
                      onClick={(event) => { event.stopPropagation(); deleteMedia(item); }}
                      style={{ position: 'absolute', top: '0.4rem', right: '0.4rem', padding: '0.3rem 0.45rem', background: '#dc2626' }}
                    >
                      {deletingId === item.id ? '…' : 'Delete'}
                    </button>
                  )}
                </article>
              );
            })}
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginTop: '1rem' }}>
            <button type="button" onClick={() => loadMedia(page - 1)} disabled={page <= 1}>Previous</button>
            <span style={{ alignSelf: 'center' }}>Page {page} of {totalPages}</span>
            <button type="button" onClick={() => loadMedia(page + 1)} disabled={page >= totalPages}>Next</button>
          </div>
        </>
      )}

      {canWrite && selectedMedia && (
        <form onSubmit={saveMedia} className="card" style={{ marginTop: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Edit media</h3>
            <button type="button" onClick={() => setSelectedMedia(null)} style={{ background: '#64748b' }}>Close</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 320px) minmax(0, 1fr)', gap: '1rem', marginTop: '1rem' }}>
            <div style={{ minHeight: 180, display: 'grid', placeItems: 'center', background: '#f1f5f9' }}>
              {selectedMedia.type === 'video' ? (
                <video controls src={assetUrl(selectedMedia.publicUrl)} style={{ maxWidth: '100%', maxHeight: 300 }} />
              ) : (
                <img src={assetUrl(selectedMedia.publicUrl)} alt={editForm.altText || selectedMedia.fileName} style={{ maxWidth: '100%', maxHeight: 300, objectFit: 'contain' }} />
              )}
            </div>
            <div style={{ display: 'grid', alignContent: 'start', gap: '0.75rem' }}>
              <strong>{selectedMedia.fileName}</strong>
              <input
                value={editForm.altText}
                onChange={(event) => setEditForm((current) => ({ ...current, altText: event.target.value }))}
                placeholder="Alt text"
              />
              <input
                value={editForm.title}
                onChange={(event) => setEditForm((current) => ({ ...current, title: event.target.value }))}
                placeholder="Title"
              />
              <button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        </form>
      )}
    </div>
  );
}

export default MediaPage;

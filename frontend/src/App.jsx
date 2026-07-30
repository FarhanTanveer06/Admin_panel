import { useEffect, useState } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import axiosClient from './api/axiosClient';
import DashboardLayout, { PermissionsProvider } from './DashboardLayout';
import RolesPage from './pages/RolesPage';
import UsersPage from './pages/UsersPage';
import MediaPage from './pages/MediaPage';
import CategoriesPage from './pages/CategoriesPage';
import DashboardHome from './pages/DashboardHome';
import PermissionsPage from './pages/PermissionsPage';

function Login({ onLogin }) {
  const [form, setForm] = useState({ email: 'admin@example.com', password: 'admin123' });
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await axiosClient.post('/api/auth/login', form);
      onLogin(res.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    }
  };

  return (
    <div className="auth-shell">
      <form className="card auth-card" onSubmit={handleSubmit}>
        <h1>Admin Login</h1>
        <p>Sign in with your admin account.</p>
        {error && <div className="error">{error}</div>}
        <input placeholder="Email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
        <input placeholder="Password" type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
        <button type="submit">Login</button>
      </form>
    </div>
  );
}

function PlaceholderPage({ title }) {
  return (
    <div className="card">
      <h2>{title}</h2>
      <p>Page coming soon.</p>
    </div>
  );
}

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchSession = async (token) => {
    try {
      const res = await axiosClient.get('/api/auth/session');
      setSession(res.data);
      return res.data;
    } catch (error) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      setSession(null);
      throw error;
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (!token) {
      setLoading(false);
      return;
    }

    fetchSession(token).finally(() => setLoading(false));
  }, []);

  const handleLogin = async (data) => {
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);

    try {
      await fetchSession(data.accessToken);
    } catch (error) {
      console.error('Failed to load session after login', error);
    }
  };

  const handleLogout = async () => {
    const refreshToken = localStorage.getItem('refreshToken');
    if (refreshToken) {
      await axiosClient.post('/api/auth/logout', { refreshToken });
    }
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setSession(null);
  };

  if (loading) return <div className="container">Loading...</div>;

  return (
    <Routes>
      <Route path="/login" element={session ? <Navigate to="/" replace /> : <Login onLogin={handleLogin} />} />
      <Route
        path="/"
        element={session ? (
          <PermissionsProvider permissions={session.permissions || []}>
            <DashboardLayout user={session.user} onLogout={handleLogout} />
          </PermissionsProvider>
        ) : <Navigate to="/login" replace />}
      >
        <Route index element={<DashboardHome user={session?.user} role={session?.role} />} />
        <Route path="permissions" element={<PermissionsPage />} />
        <Route path="roles" element={<RolesPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="media" element={<MediaPage />} />
        <Route path="categories" element={<CategoriesPage />} />
        <Route path="brands" element={<PlaceholderPage title="Brands" />} />
        <Route path="attributes" element={<PlaceholderPage title="Attributes" />} />
        <Route path="products" element={<PlaceholderPage title="Products" />} />
      </Route>
    </Routes>
  );
}

export default App;

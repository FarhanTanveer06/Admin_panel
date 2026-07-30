import { createContext, useContext } from 'react';
import { NavLink, Outlet } from 'react-router-dom';

const PermissionsContext = createContext({ permissions: [] });

export function PermissionsProvider({ permissions, children }) {
  return (
    <PermissionsContext.Provider value={{ permissions }}>
      {children}
    </PermissionsContext.Provider>
  );
}

export function usePermissions() {
  return useContext(PermissionsContext);
}

function DashboardLayout({ user, onLogout }) {
  const { permissions } = usePermissions();

  const menuItems = [
    { label: 'Dashboard', path: '', permission: 'dashboard:watch' },
    { label: 'Permissions', path: 'permissions', permission: 'permission:watch' },
    { label: 'Roles', path: 'roles', permission: 'role:watch' },
    { label: 'Users', path: 'users', permission: 'user:watch' },
    { label: 'Media', path: 'media', permission: 'media:watch' },
    { label: 'Categories', path: 'categories', permission: 'category:watch' },
    { label: 'Brands', path: 'brands', permission: 'brand:watch' },
    { label: 'Attributes', path: 'attributes', permission: 'attribute:watch' },
    { label: 'Products', path: 'products', permission: 'product:watch' },
  ];

  const visibleItems = menuItems.filter((item) => permissions.includes(item.permission));

  return (
    <div className="dashboard-shell">
      <aside className="dashboard-sidebar">
        <div className="sidebar-header">Admin Panel</div>
        <nav className="sidebar-nav">
          {visibleItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === ''}
              className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="dashboard-main">
        <header className="top-nav">
          <div>
            <strong>{user?.name}</strong>
            <div>{user?.role || 'No role'}</div>
          </div>
          <button onClick={onLogout}>Logout</button>
        </header>

        <div className="container dashboard-content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}

export default DashboardLayout;

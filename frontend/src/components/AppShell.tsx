import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth';
import type { UserRole } from '../types/auth';
import { BrandLogo } from './BrandLogo';

interface NavigationItem {
  label: string;
  to: string;
  mark: string;
  roles?: UserRole[];
}

const navigation: NavigationItem[] = [
  { label: 'Overview', to: '/app', mark: 'OV' },
  { label: 'Tickets', to: '/app/tickets', mark: 'TK' },
  { label: 'Notifications', to: '/app/notifications', mark: 'NT' },
  { label: 'Reports & SLA', to: '/app/reports', mark: 'RP', roles: ['supervisor', 'administrator'] },
  { label: 'Submit ticket', to: '/app/tickets/new', mark: 'NW', roles: ['consumer', 'employee'] },
  { label: 'My profile', to: '/app/profile', mark: 'ME' },
  { label: 'User accounts', to: '/app/admin/users', mark: 'US', roles: ['administrator'] },
  { label: 'Master data', to: '/app/admin/master-data', mark: 'MD', roles: ['administrator'] },
  { label: 'Operations admin', to: '/app/admin/operations', mark: 'OP', roles: ['administrator'] },
];

export function AppShell() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  if (user === null) return null;
  const visibleNavigation = navigation.filter(
    (item) => item.roles === undefined || item.roles.includes(user.role),
  );

  return (
    <div className="workspace-shell">
      <aside className={menuOpen ? 'workspace-sidebar is-open' : 'workspace-sidebar'}>
        <div className="workspace-sidebar__brand"><BrandLogo /></div>
        <nav aria-label="Primary navigation">
          {visibleNavigation.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/app'}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) => isActive ? 'is-active' : undefined}
            >
              <span>{item.mark}</span>{item.label}
            </NavLink>
          ))}
        </nav>
        <div className="workspace-sidebar__foot">
          <span>{user.role}</span>
          <strong>{user.displayName}</strong>
          <button type="button" onClick={() => void logout()}>Sign out</button>
        </div>
      </aside>
      <div className="workspace-main">
        <header className="workspace-topbar">
          <button
            type="button"
            className="workspace-menu"
            aria-label="Toggle navigation"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span /><span /><span />
          </button>
          <div><small>MEPCO help desk</small><strong>{user.displayName}</strong></div>
          <span className="workspace-topbar__role">{user.role}</span>
        </header>
        <div className="workspace-content"><Outlet /></div>
      </div>
      {menuOpen && <button className="workspace-backdrop" type="button" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
    </div>
  );
}

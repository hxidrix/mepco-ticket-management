import { useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth';
import type { UserRole } from '../types/auth';
import { BrandLogo } from './BrandLogo';
import { DotGridCanvas } from './DotGridCanvas';
import { ThemeToggle } from './ThemeToggle';

interface NavigationItem {
  label: string;
  to: string;
  roles?: UserRole[];
  section: 'Workspace' | 'Administration';
  emphasis?: boolean;
}

const navigation: NavigationItem[] = [
  { label: 'Overview', to: '/app', section: 'Workspace' },
  { label: 'Tickets', to: '/app/tickets', section: 'Workspace' },
  { label: 'Submit ticket', to: '/app/tickets/new', roles: ['consumer', 'employee'], section: 'Workspace', emphasis: true },
  { label: 'Notifications', to: '/app/notifications', section: 'Workspace' },
  { label: 'Reports & SLA', to: '/app/reports', roles: ['supervisor', 'administrator'], section: 'Workspace' },
  { label: 'My profile', to: '/app/profile', section: 'Workspace' },
  { label: 'User accounts', to: '/app/admin/users', roles: ['administrator'], section: 'Administration' },
  { label: 'Master data', to: '/app/admin/master-data', roles: ['administrator'], section: 'Administration' },
  { label: 'Operations admin', to: '/app/admin/operations', roles: ['administrator'], section: 'Administration' },
];

export function AppShell() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  if (user === null) return null;
  const visibleNavigation = navigation.filter(
    (item) => item.roles === undefined || item.roles.includes(user.role),
  );
  const initials = user.displayName.split(' ').slice(0, 2)
    .map((part) => part[0]).join('').toUpperCase();

  return (
    <div className="workspace-shell">
      <div className="workspace-background" aria-hidden="true">
        <DotGridCanvas />
        <div className="workspace-background__glow" />
      </div>
      <aside className={menuOpen ? 'workspace-sidebar is-open' : 'workspace-sidebar'}>
        <div className="workspace-sidebar__brand"><BrandLogo /></div>
        <nav aria-label="Primary navigation">
          {(['Workspace', 'Administration'] as const).map((section) => {
            const items = visibleNavigation.filter((item) => item.section === section);
            if (items.length === 0) return null;
            return <section className="workspace-nav-group" key={section} aria-label={section}>
              <span className="workspace-nav-group__label">{section}</span>
              {items.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/app'}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) => [
                    isActive ? 'is-active' : '', item.emphasis ? 'is-emphasis' : '',
                  ].filter(Boolean).join(' ')}
                >
                  {item.label}
                </NavLink>
              ))}
            </section>;
          })}
        </nav>
        <div className="workspace-sidebar__foot">
          <div className="workspace-user-avatar" aria-hidden="true">{initials}</div>
          <div><span>{user.role}</span><strong>{user.displayName}</strong></div>
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
          <ThemeToggle />
          <div className="workspace-topbar__identity"><small>MEPCO help desk</small><strong>{user.displayName}</strong></div>
          <span className="workspace-topbar__role">{user.role}</span>
        </header>
        <div className="workspace-content"><Outlet /></div>
      </div>
      {menuOpen && <button className="workspace-backdrop" type="button" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
    </div>
  );
}

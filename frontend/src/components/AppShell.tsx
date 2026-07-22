import { useState } from 'react';
import { Outlet } from 'react-router-dom';

import { useAuth } from '../hooks/useAuth';
import type { UserRole } from '../types/auth';
import { BrandLogo } from './BrandLogo';
import { SidebarNavGroup } from './SidebarNavGroup';
import { SilkBackground } from './SilkBackground';
import { ThemeToggle } from './ThemeToggle';

interface NavigationItem {
  label: string;
  to: string;
  roles?: UserRole[];
  section: 'Workspace' | 'Administration';
}

const navigation: NavigationItem[] = [
  { label: 'Overview', to: '/app', section: 'Workspace' },
  { label: 'Tickets', to: '/app/tickets', section: 'Workspace' },
  { label: 'Submit ticket', to: '/app/tickets/new', roles: ['consumer', 'employee'], section: 'Workspace' },
  { label: 'Notifications', to: '/app/notifications', section: 'Workspace' },
  { label: 'Reports & SLA', to: '/app/reports', roles: ['supervisor', 'administrator'], section: 'Workspace' },
  { label: 'Announcements', to: '/app/announcements', roles: ['supervisor', 'administrator'], section: 'Workspace' },
  { label: 'My profile', to: '/app/profile', section: 'Workspace' },
  { label: 'User accounts', to: '/app/admin/users', roles: ['administrator'], section: 'Administration' },
  { label: 'Master data', to: '/app/admin/master-data', roles: ['administrator'], section: 'Administration' },
  { label: 'Operations admin', to: '/app/admin/operations', roles: ['administrator'], section: 'Administration' },
];

export function AppShell() {
  const { user, logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmingSignOut, setConfirmingSignOut] = useState(false);
  if (user === null) return null;
  const visibleNavigation = navigation.filter(
    (item) => item.roles === undefined || item.roles.includes(user.role),
  );
  return (
    <div className="workspace-shell">
      <div className="workspace-background" aria-hidden="true">
        <SilkBackground />
      </div>
      <aside id="workspace-sidebar" className={menuOpen ? 'workspace-sidebar is-open' : 'workspace-sidebar'}>
        <div className="workspace-sidebar__brand">
          <BrandLogo />
          <button
            type="button"
            className="workspace-sidebar__close"
            aria-label="Close navigation"
            onClick={() => setMenuOpen(false)}
          />
        </div>
        <nav aria-label="Primary navigation">
          {(['Workspace', 'Administration'] as const).map((section) => {
            const items = visibleNavigation.filter((item) => item.section === section);
            if (items.length === 0) return null;
            return (
              <SidebarNavGroup
                key={section}
                label={section}
                items={items}
                onNavigate={() => setMenuOpen(false)}
              />
            );
          })}
        </nav>
        <div className="workspace-sidebar__foot">
          <ThemeToggle compact />
          {confirmingSignOut ? (
            <div className="workspace-signout-confirmation" aria-live="polite">
              <p>Are you sure you want to sign out?</p>
              <div className="workspace-signout-confirmation__actions">
                <button type="button" onClick={() => setConfirmingSignOut(false)}>Cancel</button>
                <button className="is-danger" type="button" onClick={() => void logout()}>Sign out</button>
              </div>
            </div>
          ) : (
            <button className="workspace-signout" type="button" onClick={() => setConfirmingSignOut(true)}>
              Sign out
            </button>
          )}
        </div>
      </aside>
      <div className="workspace-main">
        <button
          type="button"
          className="workspace-menu"
          aria-label="Toggle navigation"
          aria-controls="workspace-sidebar"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span /><span /><span />
        </button>
        <div className="workspace-content"><Outlet /></div>
      </div>
      {menuOpen && <button className="workspace-backdrop" type="button" aria-label="Close navigation" onClick={() => setMenuOpen(false)} />}
    </div>
  );
}
